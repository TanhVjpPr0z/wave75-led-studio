import type { EffectParams } from '../engines/effectEngine';
import { PRESET_EFFECTS } from '../engines/effectEngine';
import { TOTAL_KEYS } from '../layout/win60heLayout';
import type { RGB } from '../utils/color';
import { clamp, clampByte } from '../utils/color';
import {
  AdapterContext,
  CapabilityFlags,
  ConcreteModelId,
  KeyboardProtocolAdapter,
  computeAdditiveChecksum,
  dispatchSafeReport,
} from './types';
import { Win60StandardAdapter, WIN60_FF1B_PROTOCOL } from './win60StandardAdapter';

/**
 * AULA WIN60 HE Pro & Max WebHID Protocol Adapter
 * Automatically delegates to the hardware-verified 0xFF1B (ReportID 0x01, 63B, 132-slot matrix)
 * engine whenever connected to a 0x2E3C / 0xFF1B board, and keeps legacy 64B framing for 0x8089 batches.
 */
export const WIN60_PRO_MAX_PROTOCOL = {
  HEADER_MAGIC: 0x08,
  CMD_GET_INFO: 0x01,
  CMD_SET_LED_MODE: 0x10,
  CMD_SET_BRIGHTNESS: 0x11,
  CMD_SET_SPEED: 0x12,
  CMD_PER_KEY_FRAME: 0x22,
  CMD_PER_KEY_COMMIT: 0x23,
  CMD_SAVE_ONBOARD: 0x30,
  CMD_RESET_LED: 0x31,
  KEYS_PER_CHUNK: 18,
  DEFAULT_PACKET_SIZE: 64,
} as const;

const DIRECTION_BYTE_MAP: Record<EffectParams['direction'], number> = {
  left_to_right: 0x00,
  right_to_left: 0x01,
  top_to_bottom: 0x02,
  bottom_to_top: 0x03,
  outward: 0x04,
  inward: 0x05,
};

export class Win60ProMaxAdapter implements KeyboardProtocolAdapter {
  readonly modelId: ConcreteModelId;
  readonly displayName: string;

  private device: HIDDevice | null = null;
  private context: AdapterContext | null = null;
  private ff1bDelegate: Win60StandardAdapter | null = null;
  private packetSize: number = WIN60_PRO_MAX_PROTOCOL.DEFAULT_PACKET_SIZE;
  private reportId = 0x00;
  private transport: 'output' | 'feature' = 'output';

  constructor(variant: 'win60he_pro' | 'win60he_max' = 'win60he_max') {
    this.modelId = variant;
    this.displayName =
      variant === 'win60he_max' ? 'AULA WIN60 HE Max' : 'AULA WIN60 HE Pro';
  }

  async connect(device: HIDDevice, context: AdapterContext): Promise<CapabilityFlags> {
    this.device = device;
    this.context = context;

    // Auto-delegate to verified 0xFF1B / 0x2E3C protocol if the plugged-in board uses it!
    const isFF1B =
      device.vendorId === WIN60_FF1B_PROTOCOL.VENDOR_ID ||
      context.deviceInfo.usagePage === WIN60_FF1B_PROTOCOL.USAGE_PAGE ||
      (device.collections ?? []).some(
        (c) => c.usagePage === WIN60_FF1B_PROTOCOL.USAGE_PAGE
      );

    if (isFF1B) {
      this.ff1bDelegate = new Win60StandardAdapter(
        this.modelId,
        `${this.displayName} (0xFF1B Verified)`
      );
      return this.ff1bDelegate.connect(device, context);
    }

    this.ff1bDelegate = null;
    this.packetSize = context.deviceInfo.packetSize || WIN60_PRO_MAX_PROTOCOL.DEFAULT_PACKET_SIZE;
    this.transport = context.deviceInfo.transport === 'feature' ? 'feature' : 'output';
    this.reportId =
      this.transport === 'feature'
        ? context.deviceInfo.featureReportId
        : context.deviceInfo.outputReportId;

    context.logTraffic(
      'info',
      this.reportId,
      null,
      `Bound ${this.displayName} adapter on UsagePage ${context.deviceInfo.usagePageHex} (${this.transport}, ${this.packetSize}B)`
    );

    return {
      supportsPerKeyStreaming: true,
      supportsOnboardSave: true,
      supportsHardwarePresets: true,
      supportsBrightness: true,
      supportsSpeed: true,
      supportsSleepTimer: true,
      requiresLedPowerOnFirst: false,
      maxSafeFps: 30,
      packetSize: this.packetSize,
      pollingRateLabel: '8000Hz Wired',
      driverPlatform: 'win.aulacn.com / hea.aulacn.com',
    };
  }

  private buildPacket(cmd: number, subCmd: number, payload: number[] = []): Uint8Array {
    const packet = new Uint8Array(this.packetSize);
    packet[0] = WIN60_PRO_MAX_PROTOCOL.HEADER_MAGIC;
    packet[1] = cmd;
    packet[2] = subCmd;
    packet[3] = payload.length & 0xff;
    for (let i = 0; i < payload.length && i + 4 < this.packetSize - 1; i++) {
      packet[4 + i] = payload[i] & 0xff;
    }
    packet[this.packetSize - 1] = computeAdditiveChecksum(packet, this.packetSize - 1);
    return packet;
  }

  async readDeviceInfo(): Promise<{ modelName: string; firmwareVersion?: string }> {
    if (this.ff1bDelegate) return this.ff1bDelegate.readDeviceInfo();
    if (this.device && this.context) {
      const pkt = this.buildPacket(WIN60_PRO_MAX_PROTOCOL.CMD_GET_INFO, 0x00);
      await dispatchSafeReport(
        this.device,
        this.reportId,
        pkt,
        this.transport,
        this.context,
        `${this.displayName}: Query device metadata`
      );
    }
    return {
      modelName: this.device?.productName || this.displayName,
      firmwareVersion: 'WebHID Live',
    };
  }

  async setLightingMode(modeId: number, params: EffectParams): Promise<void> {
    if (this.ff1bDelegate) return this.ff1bDelegate.setLightingMode(modeId, params);
    if (!this.device || !this.context) return;
    const hwMode =
      PRESET_EFFECTS.find((e) => e.id === params.mode)?.hardwareModeId ?? modeId;
    const brightByte = Math.round((clamp(params.brightness, 0, 100) / 100) * 255);
    const speedByte = clamp(params.speed, 1, 5);
    const dirByte = DIRECTION_BYTE_MAP[params.direction] ?? 0x00;
    const colorModeByte =
      params.colorMode === 'solid' ? 0x00 : params.colorMode === 'dual' ? 0x01 : 0x02;

    const pkt = this.buildPacket(WIN60_PRO_MAX_PROTOCOL.CMD_SET_LED_MODE, hwMode, [
      brightByte,
      speedByte,
      dirByte,
      colorModeByte,
      clampByte(params.primaryColor.r),
      clampByte(params.primaryColor.g),
      clampByte(params.primaryColor.b),
      clampByte(params.secondaryColor.r),
      clampByte(params.secondaryColor.g),
      clampByte(params.secondaryColor.b),
      clamp(params.sleepTimeoutMinutes, 0, 60),
    ]);

    await dispatchSafeReport(
      this.device,
      this.reportId,
      pkt,
      this.transport,
      this.context,
      `Set LED mode 0x${hwMode.toString(16).padStart(2, '0')} (${params.mode})`
    );
  }

  async setBrightness(level: number): Promise<void> {
    if (this.ff1bDelegate) return this.ff1bDelegate.setBrightness(level);
    if (!this.device || !this.context) return;
    const brightByte = Math.round((clamp(level, 0, 100) / 100) * 255);
    const pkt = this.buildPacket(WIN60_PRO_MAX_PROTOCOL.CMD_SET_BRIGHTNESS, 0x00, [
      brightByte,
    ]);
    await dispatchSafeReport(
      this.device,
      this.reportId,
      pkt,
      this.transport,
      this.context,
      `Set brightness ${Math.round(level)}%`
    );
  }

  async setSpeed(level: number): Promise<void> {
    if (this.ff1bDelegate) return this.ff1bDelegate.setSpeed(level);
    if (!this.device || !this.context) return;
    const speedByte = clamp(Math.round(level), 1, 5);
    const pkt = this.buildPacket(WIN60_PRO_MAX_PROTOCOL.CMD_SET_SPEED, 0x00, [
      speedByte,
    ]);
    await dispatchSafeReport(
      this.device,
      this.reportId,
      pkt,
      this.transport,
      this.context,
      `Set animation speed ${speedByte}`
    );
  }

  async sendPerKeyFrame(colors: RGB[], ledIndexMap?: number[]): Promise<void> {
    if (this.ff1bDelegate) return this.ff1bDelegate.sendPerKeyFrame(colors, ledIndexMap);
    if (!this.device || !this.context) return;

    const mapped = new Array<RGB>(TOTAL_KEYS);
    for (let i = 0; i < TOTAL_KEYS; i++) {
      const targetSlot = ledIndexMap ? clamp(ledIndexMap[i] ?? i, 0, TOTAL_KEYS - 1) : i;
      mapped[targetSlot] = colors[i] ?? { r: 0, g: 0, b: 0 };
    }

    const chunkSize = WIN60_PRO_MAX_PROTOCOL.KEYS_PER_CHUNK;
    const totalChunks = Math.ceil(TOTAL_KEYS / chunkSize);

    for (let chunk = 0; chunk < totalChunks; chunk++) {
      const startIdx = chunk * chunkSize;
      const count = Math.min(chunkSize, TOTAL_KEYS - startIdx);
      const packet = new Uint8Array(this.packetSize);
      packet[0] = WIN60_PRO_MAX_PROTOCOL.HEADER_MAGIC;
      packet[1] = WIN60_PRO_MAX_PROTOCOL.CMD_PER_KEY_FRAME;
      packet[2] = chunk;
      packet[3] = totalChunks;
      packet[4] = startIdx;
      packet[5] = count;

      for (let j = 0; j < count; j++) {
        const c = mapped[startIdx + j] ?? { r: 0, g: 0, b: 0 };
        const offset = 6 + j * 3;
        if (offset + 2 < this.packetSize - 1) {
          packet[offset] = clampByte(c.r);
          packet[offset + 1] = clampByte(c.g);
          packet[offset + 2] = clampByte(c.b);
        }
      }
      packet[this.packetSize - 1] = computeAdditiveChecksum(packet, this.packetSize - 1);

      await dispatchSafeReport(
        this.device,
        this.reportId,
        packet,
        this.transport,
        this.context,
        `Per-Key RGB chunk ${chunk + 1}/${totalChunks} (${count} keys)`
      );
    }

    const commitPkt = this.buildPacket(WIN60_PRO_MAX_PROTOCOL.CMD_PER_KEY_COMMIT, 0x01);
    await dispatchSafeReport(
      this.device,
      this.reportId,
      commitPkt,
      this.transport,
      this.context,
      'Commit 61-key LED frame'
    );
  }

  async saveToOnboardMemory(): Promise<void> {
    if (this.ff1bDelegate) return this.ff1bDelegate.saveToOnboardMemory();
    if (!this.device || !this.context) return;
    const pkt = this.buildPacket(WIN60_PRO_MAX_PROTOCOL.CMD_SAVE_ONBOARD, 0x01, [0xaa, 0x55]);
    await dispatchSafeReport(
      this.device,
      this.reportId,
      pkt,
      this.transport,
      this.context,
      'Save current RGB profile to onboard EEPROM/Flash'
    );
  }

  async resetLighting(): Promise<void> {
    if (this.ff1bDelegate) return this.ff1bDelegate.resetLighting();
    if (!this.device || !this.context) return;
    const pkt = this.buildPacket(WIN60_PRO_MAX_PROTOCOL.CMD_RESET_LED, 0x00);
    await dispatchSafeReport(
      this.device,
      this.reportId,
      pkt,
      this.transport,
      this.context,
      'Reset LED lighting to factory default'
    );
  }

  async disconnect(): Promise<void> {
    if (this.ff1bDelegate) {
      await this.ff1bDelegate.disconnect();
      this.ff1bDelegate = null;
    }
    this.device = null;
    this.context = null;
  }
}
