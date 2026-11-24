import {
  WAVE75_GAP_LIGHT_INDEX,
  WAVE75_KEY_COUNT,
  WAVE75_SYNC_LED_SLOTS,
  logicalKeyToDefaultLightIndex,
} from '../layout/wave75Layout';
import { BLACK, RGB, rgbToRgb565LE } from '../utils/color';
import {
  AdapterContext,
  FlashSaveResult,
  KeyboardLightingAdapter,
  LogoSettings,
  QmkLightingState,
  WaveCapabilities,
  WaveModelId,
} from './types';

export class WaveSimulatorAdapter implements KeyboardLightingAdapter {
  readonly transportMode = 'simulator' as const;
  readonly displayName: string;

  private modelId: WaveModelId;
  private context: AdapterContext | null = null;
  private frameCount = 0;

  constructor(modelId: WaveModelId = 'wave75_pro_rgb') {
    this.modelId = modelId;
    this.displayName = `Virtual ${modelId.toUpperCase()}`;
  }

  getCapabilities(): WaveCapabilities {
    const isLogoOnly = this.modelId === 'wave75_non_rgb';
    return {
      supportsPerKeySync: !isLogoOnly,
      supportsOnboardSlots: !isLogoOnly,
      supportsQmkLighting: true,
      logoOnly: isLogoOnly,
      maxSafeFps: 30,
      slotCount: isLogoOnly ? 0 : 5,
      protocolName: isLogoOnly
        ? 'Virtual WAVE75 Non-RGB (Logo Only)'
        : 'Virtual PMO Native (0x2E RGB565 / 0x23 RGB888)',
    };
  }

  async connect(_device: HIDDevice, context: AdapterContext): Promise<WaveCapabilities> {
    this.context = context;
    context.logTraffic(
      'info',
      '0x10',
      null,
      `Virtual Simulator active for ${this.modelId} (60 FPS preview, 0x36B0:0x3009 framing)`
    );
    return this.getCapabilities();
  }

  async readDeviceInfo(): Promise<{ modelName: string; firmwareVersion?: string }> {
    return { modelName: this.displayName, firmwareVersion: 'SIM-RDR-v2.1' };
  }

  async sendPerKeySyncFrame(
    keyColors: RGB[],
    _logoColor: RGB,
    lightIndexMap?: number[]
  ): Promise<void> {
    this.frameCount++;
    if (this.context && this.frameCount % 20 === 1) {
      // Show authentic RGB565 0x2E packet preview (with Gap #46 verified 0x0000)
      const preview = new Uint8Array(24);
      preview[0] = 0x2e;
      preview[1] = 0x00;
      preview[2] = 0x00;
      preview[4] = 56;
      preview[6] = 164;
      for (let i = 0; i < 6; i++) {
        const idx = lightIndexMap ? lightIndexMap[i] : logicalKeyToDefaultLightIndex(i);
        if (idx === WAVE75_GAP_LIGHT_INDEX || idx >= WAVE75_SYNC_LED_SLOTS) continue;
        const [lo, hi] = rgbToRgb565LE(keyColors[i] ?? BLACK);
        preview[8 + i * 2] = lo;
        preview[8 + i * 2 + 1] = hi;
      }
      this.context.logTraffic(
        'tx',
        '0x2E',
        preview,
        `[SIM] SET_LIGHT_SYNC #${this.frameCount} (164B RGB565: 56+56+52, gap #46=0x0000)`,
        '0x55 OK'
      );
    }
  }

  async readOnboardSlot(slot: number): Promise<{ keys: RGB[]; logo: RGB }> {
    const readOp = 0x22 + (slot - 1) * 2;
    this.context?.logTraffic(
      'rx',
      `0x${readOp.toString(16).toUpperCase()}`,
      new Uint8Array([readOp, slot, 0, 0, 56, 0, 0, 0x55]),
      `[SIM] Read Onboard Slot ${slot} (384B RGB888)`,
      '0x55 OK'
    );
    return {
      keys: new Array<RGB>(WAVE75_KEY_COUNT).fill(BLACK),
      logo: { r: 56, g: 189, b: 248 },
    };
  }

  async saveOnboardSlotWithVerify(slot: number): Promise<FlashSaveResult> {
    if (this.modelId === 'wave75_non_rgb') {
      throw new Error('WAVE75 Non-RGB does not have per-key onboard RGB888 slots.');
    }
    this.context?.logTraffic('tx', '0x2F', new Uint8Array([0x2f, 0, 0, 0, 0, 0, 0, 0x55]), '[SIM] CLOSE_LIGHT_SYNC (0x2F)');
    this.context?.logTraffic('tx', '0x11', new Uint8Array([0x11, 0, 0, 0, 0, 0, 0, 0x55]), '[SIM] STOP_COMM (0x11)');
    await new Promise((r) => setTimeout(r, 380));
    const writeOp = 0x23 + (slot - 1) * 2;
    this.context?.logTraffic(
      'tx',
      `0x${writeOp.toString(16).toUpperCase()}`,
      new Uint8Array([writeOp, slot, 0, 0, 56, 0, 0, 0x55]),
      `[SIM] SET_USERLIGHT_${slot} (384B RGB888 Flash Write)`,
      '0x55 OK'
    );
    const readOp = 0x22 + (slot - 1) * 2;
    this.context?.logTraffic(
      'rx',
      `0x${readOp.toString(16).toUpperCase()}`,
      new Uint8Array([readOp, slot, 0, 0, 56, 0, 0, 0x55]),
      `[SIM] Read-Back Verification Slot ${slot}: 384/384 bytes matched!`,
      '0x55 OK'
    );
    return {
      slot,
      verified: true,
      bytesWritten: 384,
      message: `[SIM] Saved & read-back verified 384B RGB888 in Onboard Slot ${slot}!`,
    };
  }

  async selectOnboardSlot(slot: number): Promise<void> {
    this.context?.logTraffic(
      'tx',
      '0x15',
      new Uint8Array([0x15, 0, 0, 0, 2, 0, 0, 0x55, 253, slot]),
      `[SIM] SET_LIGHT_MODE -> lightMode=253, slot=${slot}`,
      '0x55 OK'
    );
  }

  async applyQmkLighting(state: QmkLightingState): Promise<void> {
    this.context?.logTraffic(
      'tx',
      '0x07',
      new Uint8Array([0x07, 0x03, 0x02, state.effectId, state.brightness, state.speed, state.hue, state.saturation]),
      `[SIM] QMK VIA Effect #${state.effectId} (B:${state.brightness} S:${state.speed})`,
      '0x55 OK'
    );
  }

  async applyLogoSettings(settings: LogoSettings): Promise<void> {
    this.context?.logTraffic(
      'tx',
      '0x07',
      new Uint8Array([0x07, 0x03, 0x01, settings.brightness, settings.speed, settings.saturation]),
      `[SIM] Logo LED -> ${settings.effect} (${settings.brightness}%)`,
      '0x55 OK'
    );
  }

  async handBackToFirmware(): Promise<void> {
    this.context?.logTraffic(
      'info',
      '0x2F',
      new Uint8Array([0x2f, 0x15, 0x11, 0x55]),
      '[SIM] Handed lighting control back to keyboard firmware (0x2F → 0x15 → 0x11)',
      '0x55 OK'
    );
  }

  async disconnect(): Promise<void> {
    this.context = null;
  }
}

