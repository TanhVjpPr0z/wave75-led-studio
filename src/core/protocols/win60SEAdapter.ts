import type { EffectParams } from '../engines/effectEngine';
import { PRESET_EFFECTS } from '../engines/effectEngine';
import { TOTAL_KEYS } from '../layout/win60heLayout';
import type { RGB } from '../utils/color';
import { clamp, clampByte } from '../utils/color';
import {
  AdapterContext,
  CapabilityFlags,
  KeyboardProtocolAdapter,
  computeAdditiveChecksum,
  dispatchSafeReport,
} from './types';

/**
 * AULA WIN60 SE WebHID Protocol Adapter
 * Hardware ID: USB VID 0x38A6 / PID 0x291A
 * Note: WIN60 SE requires LED power/streaming mode to be enabled prior to pushing
 * live per-key / GIF RGB frames over USB.
 */
export const WIN60_SE_PROTOCOL = {
  VENDOR_ID: 0x38a6,
  PRODUCT_ID: 0x291a,
  HEADER_MAGIC: 0x06,
  CMD_LED_POWER_ON: 0x09,
  CMD_SET_MODE: 0x14,
  CMD_SET_BRIGHTNESS: 0x15,
  CMD_SET_SPEED: 0x16,
  CMD_STREAM_RGB_CHUNK: 0x24,
  CMD_STREAM_COMMIT: 0x25,
  CMD_RESET_LED: 0x35,
  KEYS_PER_CHUNK: 18,
  DEFAULT_PACKET_SIZE: 64,
} as const;

export class Win60SEAdapter implements KeyboardProtocolAdapter {
  readonly modelId = 'win60_se' as const;
  readonly displayName = 'AULA WIN60 SE';

  private device: HIDDevice | null = null;
  private context: AdapterContext | null = null;
  private packetSize: number = WIN60_SE_PROTOCOL.DEFAULT_PACKET_SIZE;
  private reportId = 0x00;
  private transport: 'output' | 'feature' = 'output';
  private ledPoweredOn = false;

  async connect(device: HIDDevice, context: AdapterContext): Promise<CapabilityFlags> {
    this.device = device;
    this.context = context;
    this.packetSize =
      context.deviceInfo.packetSize || WIN60_SE_PROTOCOL.DEFAULT_PACKET_SIZE;
    this.transport = context.deviceInfo.transport === 'feature' ? 'feature' : 'output';
    this.reportId =
      this.transport === 'feature'
        ? context.deviceInfo.featureReportId
        : context.deviceInfo.outputReportId;
    this.ledPoweredOn = false;

    context.logTraffic(
      'info',
      this.reportId,
      null,
      `Bound AULA WIN60 SE (VID 0x38A6 / PID 0x291A) — auto LED wake enabled before RGB streaming`
    );

    return {
      supportsPerKeyStreaming: true,
      supportsOnboardSave: false,
      supportsHardwarePresets: true,
      supportsBrightness: true,
      supportsSpeed: true,
      supportsSleepTimer: false,
      requiresLedPowerOnFirst: true,
      maxSafeFps: 24,
      packetSize: this.packetSize,
      pollingRateLabel: 'Wired USB-C (SE)',
      driverPlatform: 'WIN60 SE Direct USB HID',
    };
  }

  private buildPacket(cmd: number, payload: number[] = []): Uint8Array {
    const packet = new Uint8Array(this.packetSize);
    packet[0] = WIN60_SE_PROTOCOL.HEADER_MAGIC;
    packet[1] = cmd;
    packet[2] = payload.length & 0xff;
    for (let i = 0; i < payload.length && i + 3 < this.packetSize - 1; i++) {
      packet[3 + i] = payload[i] & 0xff;
    }
    packet[this.packetSize - 1] = computeAdditiveChecksum(packet, this.packetSize - 1);
    return packet;
  }

  private async ensureLedPowerOn(): Promise<void> {
    if (this.ledPoweredOn || !this.device || !this.context) return;
    const wakePkt = this.buildPacket(WIN60_SE_PROTOCOL.CMD_LED_POWER_ON, [0x01, 0xff]);
    await dispatchSafeReport(
      this.device,
      this.reportId,
      wakePkt,
      this.transport,
      this.context,
      'WIN60 SE: Enable LED backlight / direct stream mode'
    );
    this.ledPoweredOn = true;
  }

  async readDeviceInfo(): Promise<{ modelName: string; firmwareVersion?: string }> {
    return {
      modelName: this.device?.productName || 'AULA WIN60 SE (0x38A6:0x291A)',
      firmwareVersion: 'SE Stream Protocol',
    };
  }

  async setLightingMode(modeId: number, params: EffectParams): Promise<void> {
    if (!this.device || !this.context) return;
    await this.ensureLedPowerOn();
    const hwMode =
      PRESET_EFFECTS.find((e) => e.id === params.mode)?.hardwareModeId ?? modeId;
    const pkt = this.buildPacket(WIN60_SE_PROTOCOL.CMD_SET_MODE, [
      hwMode,
      Math.round((clamp(params.brightness, 0, 100) / 100) * 255),
      clamp(params.speed, 1, 5),
      clampByte(params.primaryColor.r),
      clampByte(params.primaryColor.g),
      clampByte(params.primaryColor.b),
    ]);
    await dispatchSafeReport(
      this.device,
      this.reportId,
      pkt,
      this.transport,
      this.context,
      `WIN60 SE: Set lighting mode ${params.mode}`
    );
  }

  async setBrightness(level: number): Promise<void> {
    if (!this.device || !this.context) return;
    await this.ensureLedPowerOn();
    const pkt = this.buildPacket(WIN60_SE_PROTOCOL.CMD_SET_BRIGHTNESS, [
      Math.round((clamp(level, 0, 100) / 100) * 255),
    ]);
    await dispatchSafeReport(
      this.device,
      this.reportId,
      pkt,
      this.transport,
      this.context,
      `WIN60 SE: Brightness ${Math.round(level)}%`
    );
  }

  async setSpeed(level: number): Promise<void> {
    if (!this.device || !this.context) return;
    const pkt = this.buildPacket(WIN60_SE_PROTOCOL.CMD_SET_SPEED, [
      clamp(Math.round(level), 1, 5),
    ]);
    await dispatchSafeReport(
      this.device,
      this.reportId,
      pkt,
      this.transport,
      this.context,
      `WIN60 SE: Speed ${Math.round(level)}`
    );
  }

  async sendPerKeyFrame(colors: RGB[], ledIndexMap?: number[]): Promise<void> {
    if (!this.device || !this.context) return;
    await this.ensureLedPowerOn();

    const mapped = new Array<RGB>(TOTAL_KEYS);
    for (let i = 0; i < TOTAL_KEYS; i++) {
      const slot = ledIndexMap ? clamp(ledIndexMap[i] ?? i, 0, TOTAL_KEYS - 1) : i;
      mapped[slot] = colors[i] ?? { r: 0, g: 0, b: 0 };
    }

    const chunkSize = WIN60_SE_PROTOCOL.KEYS_PER_CHUNK;
    const totalChunks = Math.ceil(TOTAL_KEYS / chunkSize);

    for (let chunk = 0; chunk < totalChunks; chunk++) {
      const start = chunk * chunkSize;
      const count = Math.min(chunkSize, TOTAL_KEYS - start);
      const packet = new Uint8Array(this.packetSize);
      packet[0] = WIN60_SE_PROTOCOL.HEADER_MAGIC;
      packet[1] = WIN60_SE_PROTOCOL.CMD_STREAM_RGB_CHUNK;
      packet[2] = chunk;
      packet[3] = start;
      packet[4] = count;

      for (let j = 0; j < count; j++) {
        const c = mapped[start + j] ?? { r: 0, g: 0, b: 0 };
        const off = 5 + j * 3;
        if (off + 2 < this.packetSize - 1) {
          packet[off] = clampByte(c.r);
          packet[off + 1] = clampByte(c.g);
          packet[off + 2] = clampByte(c.b);
        }
      }
      packet[this.packetSize - 1] = computeAdditiveChecksum(packet, this.packetSize - 1);

      await dispatchSafeReport(
        this.device,
        this.reportId,
        packet,
        this.transport,
        this.context,
        `WIN60 SE: Stream chunk ${chunk + 1}/${totalChunks}`
      );
    }

    const commitPkt = this.buildPacket(WIN60_SE_PROTOCOL.CMD_STREAM_COMMIT, [0x01]);
    await dispatchSafeReport(
      this.device,
      this.reportId,
      commitPkt,
      this.transport,
      this.context,
      'WIN60 SE: Latch RGB frame'
    );
  }

  async saveToOnboardMemory(): Promise<void> {
    throw new Error('AULA WIN60 SE does not support persistent onboard flash write from WebHID.');
  }

  async resetLighting(): Promise<void> {
    if (!this.device || !this.context) return;
    const pkt = this.buildPacket(WIN60_SE_PROTOCOL.CMD_RESET_LED, [0x00]);
    await dispatchSafeReport(
      this.device,
      this.reportId,
      pkt,
      this.transport,
      this.context,
      'WIN60 SE: Reset lighting'
    );
  }

  async disconnect(): Promise<void> {
    this.ledPoweredOn = false;
    this.device = null;
    this.context = null;
  }
}

