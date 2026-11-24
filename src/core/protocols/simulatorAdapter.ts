import type { EffectParams } from '../engines/effectEngine';
import type { RGB } from '../utils/color';
import { clampByte } from '../utils/color';
import {
  AdapterContext,
  CapabilityFlags,
  ConcreteModelId,
  KeyboardProtocolAdapter,
  computeAdditiveChecksum,
} from './types';

const SIMULATED_CAPABILITIES: Record<ConcreteModelId, CapabilityFlags> = {
  win60he_standard: {
    supportsPerKeyStreaming: true,
    supportsOnboardSave: true,
    supportsHardwarePresets: true,
    supportsBrightness: true,
    supportsSpeed: true,
    supportsSleepTimer: true,
    requiresLedPowerOnFirst: false,
    maxSafeFps: 24,
    packetSize: 64,
    pollingRateLabel: '1000Hz–8000Hz (Sim)',
    driverPlatform: 'device.aulacn.com / hed.aulacn.com',
  },
  win60he_pro: {
    supportsPerKeyStreaming: true,
    supportsOnboardSave: true,
    supportsHardwarePresets: true,
    supportsBrightness: true,
    supportsSpeed: true,
    supportsSleepTimer: true,
    requiresLedPowerOnFirst: false,
    maxSafeFps: 30,
    packetSize: 64,
    pollingRateLabel: '8000Hz Wired (Sim)',
    driverPlatform: 'win.aulacn.com / hea.aulacn.com',
  },
  win60he_max: {
    supportsPerKeyStreaming: true,
    supportsOnboardSave: true,
    supportsHardwarePresets: true,
    supportsBrightness: true,
    supportsSpeed: true,
    supportsSleepTimer: true,
    requiresLedPowerOnFirst: false,
    maxSafeFps: 30,
    packetSize: 64,
    pollingRateLabel: '8000Hz Wired (Sim)',
    driverPlatform: 'win.aulacn.com / hea.aulacn.com',
  },
  win60_se: {
    supportsPerKeyStreaming: true,
    supportsOnboardSave: false,
    supportsHardwarePresets: true,
    supportsBrightness: true,
    supportsSpeed: true,
    supportsSleepTimer: false,
    requiresLedPowerOnFirst: true,
    maxSafeFps: 24,
    packetSize: 64,
    pollingRateLabel: 'USB-C Wired (Sim)',
    driverPlatform: 'WIN60 SE Direct USB (0x38A6:0x291A)',
  },
  custom_generic: {
    supportsPerKeyStreaming: true,
    supportsOnboardSave: false,
    supportsHardwarePresets: false,
    supportsBrightness: true,
    supportsSpeed: true,
    supportsSleepTimer: false,
    requiresLedPowerOnFirst: false,
    maxSafeFps: 20,
    packetSize: 64,
    pollingRateLabel: 'Custom HID (Sim)',
    driverPlatform: 'Custom Generic Protocol',
  },
};

export class SimulatorAdapter implements KeyboardProtocolAdapter {
  readonly modelId: ConcreteModelId;
  readonly displayName: string;
  private context: AdapterContext | null = null;
  private frameCounter = 0;

  constructor(modelId: ConcreteModelId = 'win60he_max') {
    this.modelId = modelId;
    this.displayName = `Virtual ${modelId.toUpperCase()}`;
  }

  getCapabilities(): CapabilityFlags {
    return SIMULATED_CAPABILITIES[this.modelId];
  }

  async connect(_device: HIDDevice, context: AdapterContext): Promise<CapabilityFlags> {
    this.context = context;
    context.logTraffic(
      'info',
      0x00,
      null,
      `Virtual Simulator active for ${this.modelId} (no USB hardware required)`
    );
    return this.getCapabilities();
  }

  async readDeviceInfo(): Promise<{ modelName: string; firmwareVersion?: string }> {
    return {
      modelName: this.displayName,
      firmwareVersion: 'SIM-v2.4.0',
    };
  }

  async setLightingMode(modeId: number, params: EffectParams): Promise<void> {
    if (!this.context) return;
    const pkt = new Uint8Array(16);
    pkt[0] = 0x08;
    pkt[1] = 0x10;
    pkt[2] = modeId & 0xff;
    pkt[3] = Math.round((params.brightness / 100) * 255);
    pkt[4] = params.speed;
    pkt[5] = clampByte(params.primaryColor.r);
    pkt[6] = clampByte(params.primaryColor.g);
    pkt[7] = clampByte(params.primaryColor.b);
    pkt[15] = computeAdditiveChecksum(pkt, 15);
    this.context.logTraffic('tx', 0x00, pkt, `[SIM] Set mode ${params.mode}`);
  }

  async setBrightness(level: number): Promise<void> {
    if (!this.context) return;
    const pkt = new Uint8Array([0x08, 0x11, 0x00, Math.round((level / 100) * 255)]);
    this.context.logTraffic('tx', 0x00, pkt, `[SIM] Set brightness ${Math.round(level)}%`);
  }

  async setSpeed(level: number): Promise<void> {
    if (!this.context) return;
    const pkt = new Uint8Array([0x08, 0x12, 0x00, Math.round(level)]);
    this.context.logTraffic('tx', 0x00, pkt, `[SIM] Set speed ${Math.round(level)}`);
  }

  async sendPerKeyFrame(colors: RGB[]): Promise<void> {
    this.frameCounter++;
    // Log periodically in simulator mode so traffic inspector stays informative without flooding
    if (this.context && this.frameCounter % 15 === 1) {
      const sample = new Uint8Array(16);
      sample[0] = 0x08;
      sample[1] = 0x22;
      sample[2] = 0x00;
      sample[3] = 0x04;
      for (let i = 0; i < 4; i++) {
        const c = colors[i] ?? { r: 0, g: 0, b: 0 };
        sample[4 + i * 3] = clampByte(c.r);
        sample[5 + i * 3] = clampByte(c.g);
        sample[6 + i * 3] = clampByte(c.b);
      }
      this.context.logTraffic(
        'tx',
        0x00,
        sample,
        `[SIM] Per-Key RGB Frame #${this.frameCounter} (61 keys)`
      );
    }
  }

  async saveToOnboardMemory(): Promise<void> {
    const caps = this.getCapabilities();
    if (!caps.supportsOnboardSave) {
      throw new Error('This model does not support persistent onboard flash saving.');
    }
    await new Promise((r) => setTimeout(r, 420));
    this.context?.logTraffic(
      'info',
      0x00,
      new Uint8Array([0x08, 0x30, 0x01, 0xaa, 0x55]),
      '[SIM] Saved RGB profile to virtual onboard memory'
    );
  }

  async resetLighting(): Promise<void> {
    this.context?.logTraffic(
      'info',
      0x00,
      new Uint8Array([0x08, 0x31, 0x00]),
      '[SIM] Reset lighting to factory default'
    );
  }

  async disconnect(): Promise<void> {
    this.context = null;
  }
}

