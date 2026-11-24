import type { EffectParams } from '../engines/effectEngine';
import { TOTAL_KEYS } from '../layout/win60heLayout';
import type { RGB } from '../utils/color';
import { clamp, clampByte } from '../utils/color';
import {
  AdapterContext,
  CapabilityFlags,
  CustomProtocolConfig,
  DEFAULT_CUSTOM_PROTOCOL_CONFIG,
  KeyboardProtocolAdapter,
  computeAdditiveChecksum,
  dispatchSafeReport,
} from './types';

function parseHexHeader(hex: string): number[] {
  return hex
    .trim()
    .split(/[\s,]+/)
    .filter(Boolean)
    .map((token) => parseInt(token.replace(/^0x/i, ''), 16))
    .filter((n) => !Number.isNaN(n) && n >= 0 && n <= 255);
}

/**
 * Custom Generic WebHID Adapter for new or variant firmware batches.
 * Allows adjusting Report ID, transport (Output/Feature), header bytes, and chunk size
 * from the HID Diagnostics drawer while enforcing Hardware Safety Guardrails.
 */
export class CustomGenericAdapter implements KeyboardProtocolAdapter {
  readonly modelId = 'custom_generic' as const;
  readonly displayName = 'Custom Generic HID';

  private device: HIDDevice | null = null;
  private context: AdapterContext | null = null;
  private config: CustomProtocolConfig;

  constructor(config?: Partial<CustomProtocolConfig>) {
    this.config = { ...DEFAULT_CUSTOM_PROTOCOL_CONFIG, ...config };
  }

  updateConfig(next: Partial<CustomProtocolConfig>): void {
    this.config = { ...this.config, ...next };
  }

  async connect(device: HIDDevice, context: AdapterContext): Promise<CapabilityFlags> {
    this.device = device;
    this.context = context;

    context.logTraffic(
      'info',
      this.config.reportId,
      null,
      `Bound Custom Generic Adapter (reportId=0x${this.config.reportId.toString(16)}, transport=${this.config.transport}, size=${this.config.packetSize}B)`
    );

    return {
      supportsPerKeyStreaming: true,
      supportsOnboardSave: false,
      supportsHardwarePresets: false,
      supportsBrightness: true,
      supportsSpeed: true,
      supportsSleepTimer: false,
      requiresLedPowerOnFirst: false,
      maxSafeFps: 20,
      packetSize: this.config.packetSize,
      pollingRateLabel: 'Custom HID Batch',
      driverPlatform: 'Custom Generic Protocol',
    };
  }

  async readDeviceInfo(): Promise<{ modelName: string; firmwareVersion?: string }> {
    return {
      modelName: this.device?.productName || 'Custom HID Keyboard',
      firmwareVersion: `Custom (${this.config.transport.toUpperCase()} ${this.config.packetSize}B)`,
    };
  }

  async setLightingMode(_modeId: number, _params: EffectParams): Promise<void> {
    // Generic adapter streams computed frames directly via sendPerKeyFrame
  }

  async setBrightness(_level: number): Promise<void> {
    // Applied directly in RGB pixel frame values
  }

  async setSpeed(_level: number): Promise<void> {
    // Handled by host effect engine
  }

  async sendPerKeyFrame(colors: RGB[], ledIndexMap?: number[]): Promise<void> {
    if (!this.device || !this.context) return;

    const headerBytes = parseHexHeader(this.config.headerHex);
    const packetSize = clamp(this.config.packetSize, 32, 64);
    const overhead = headerBytes.length + 3 + (this.config.useChecksum ? 1 : 0);
    const maxKeysFit = Math.max(1, Math.floor((packetSize - overhead) / 3));
    const keysPerChunk = clamp(this.config.keysPerPacket, 1, maxKeysFit);

    const mapped = new Array<RGB>(TOTAL_KEYS);
    for (let i = 0; i < TOTAL_KEYS; i++) {
      const slot = ledIndexMap ? clamp(ledIndexMap[i] ?? i, 0, TOTAL_KEYS - 1) : i;
      mapped[slot] = colors[i] ?? { r: 0, g: 0, b: 0 };
    }

    const totalChunks = Math.ceil(TOTAL_KEYS / keysPerChunk);

    for (let chunk = 0; chunk < totalChunks; chunk++) {
      const start = chunk * keysPerChunk;
      const count = Math.min(keysPerChunk, TOTAL_KEYS - start);
      const packet = new Uint8Array(packetSize);

      let cursor = 0;
      for (const hb of headerBytes) {
        if (cursor < packetSize - 4) packet[cursor++] = hb;
      }
      packet[cursor++] = this.config.perKeyCommandByte & 0xff;
      packet[cursor++] = start & 0xff;
      packet[cursor++] = count & 0xff;

      for (let j = 0; j < count; j++) {
        const c = mapped[start + j] ?? { r: 0, g: 0, b: 0 };
        if (cursor + 2 < packetSize - (this.config.useChecksum ? 1 : 0)) {
          packet[cursor++] = clampByte(c.r);
          packet[cursor++] = clampByte(c.g);
          packet[cursor++] = clampByte(c.b);
        }
      }

      if (this.config.useChecksum) {
        packet[packetSize - 1] = computeAdditiveChecksum(packet, packetSize - 1);
      }

      await dispatchSafeReport(
        this.device,
        this.config.reportId,
        packet,
        this.config.transport,
        this.context,
        `CustomGeneric: Chunk ${chunk + 1}/${totalChunks}`,
        Math.min(headerBytes.length, packetSize - 1)
      );
    }

    // Commit packet
    const commit = new Uint8Array(packetSize);
    let cIdx = 0;
    for (const hb of headerBytes) {
      if (cIdx < packetSize - 2) commit[cIdx++] = hb;
    }
    commit[cIdx++] = this.config.commitCommandByte & 0xff;
    if (this.config.useChecksum) {
      commit[packetSize - 1] = computeAdditiveChecksum(commit, packetSize - 1);
    }

    await dispatchSafeReport(
      this.device,
      this.config.reportId,
      commit,
      this.config.transport,
      this.context,
      'CustomGeneric: Commit frame',
      Math.min(headerBytes.length, packetSize - 1)
    );
  }

  async saveToOnboardMemory(): Promise<void> {
    throw new Error('Onboard save is disabled in Custom Generic mode for hardware safety.');
  }

  async resetLighting(): Promise<void> {
    // Send black frame safely
    const zeros = new Array<RGB>(TOTAL_KEYS).fill({ r: 0, g: 0, b: 0 });
    await this.sendPerKeyFrame(zeros);
  }

  async disconnect(): Promise<void> {
    this.device = null;
    this.context = null;
  }
}

