import type { EffectParams } from '../engines/effectEngine';
import type { RGB } from '../utils/color';

export type KeyboardModelId =
  | 'auto'
  | 'win60he_standard'
  | 'win60he_pro'
  | 'win60he_max'
  | 'win60_se'
  | 'custom_generic';

export type ConcreteModelId = Exclude<KeyboardModelId, 'auto'>;

export interface CapabilityFlags {
  supportsPerKeyStreaming: boolean;
  supportsOnboardSave: boolean;
  supportsHardwarePresets: boolean;
  supportsBrightness: boolean;
  supportsSpeed: boolean;
  supportsSleepTimer: boolean;
  requiresLedPowerOnFirst: boolean;
  maxSafeFps: number;
  packetSize: number;
  pollingRateLabel: string;
  driverPlatform: string;
}

export interface HidDeviceInfo {
  vendorId: number;
  productId: number;
  vendorIdHex: string;
  productIdHex: string;
  productName: string;
  usagePage: number;
  usagePageHex: string;
  usage: number;
  usageHex: string;
  outputReportId: number;
  featureReportId: number;
  packetSize: number;
  transport: 'output' | 'feature' | 'virtual';
  firmwareVersion?: string;
}

export interface HidTrafficEntry {
  id: number;
  timestamp: string;
  direction: 'tx' | 'rx' | 'info' | 'warn' | 'error';
  reportId: number;
  hex: string;
  summary: string;
  bytesLength: number;
}

export interface CustomProtocolConfig {
  reportId: number;
  transport: 'output' | 'feature';
  packetSize: number;
  headerHex: string;
  perKeyCommandByte: number;
  commitCommandByte: number;
  useChecksum: boolean;
  keysPerPacket: number;
}

export const DEFAULT_CUSTOM_PROTOCOL_CONFIG: CustomProtocolConfig = {
  reportId: 0x00,
  transport: 'output',
  packetSize: 64,
  headerHex: '08 02',
  perKeyCommandByte: 0x22,
  commitCommandByte: 0x2f,
  useChecksum: true,
  keysPerPacket: 18,
};

export interface AdapterContext {
  deviceInfo: HidDeviceInfo;
  logTraffic: (
    direction: HidTrafficEntry['direction'],
    reportId: number,
    bytes: Uint8Array | null,
    summary: string
  ) => void;
}

export interface KeyboardProtocolAdapter {
  readonly modelId: ConcreteModelId;
  readonly displayName: string;
  connect(device: HIDDevice, context: AdapterContext): Promise<CapabilityFlags>;
  readDeviceInfo(): Promise<{ modelName: string; firmwareVersion?: string }>;
  setLightingMode(modeId: number, params: EffectParams): Promise<void>;
  setBrightness(level: number): Promise<void>;
  setSpeed(level: number): Promise<void>;
  sendPerKeyFrame(colors: RGB[], ledIndexMap?: number[]): Promise<void>;
  saveToOnboardMemory(): Promise<void>;
  resetLighting(): Promise<void>;
  disconnect(): Promise<void>;
}

/**
 * HARDWARE SAFETY GUARDRAIL (MANDATORY):
 * Explicitly blocks any bootloader, DFU, ISP, or raw flash-erase opcodes
 * from ever being dispatched over WebHID. WIN60HE LED Studio ONLY transmits
 * LED/RGB control and read-only metadata commands.
 */
const BLOCKED_BOOTLOADER_OPCODES = new Set<number>([
  0xdf, // DFU entry
  0xf0, // Bootloader jump
  0xf1, // Flash erase
  0xf2, // Flash write page
  0xf3, // Bootloader reset
  0xfe, // ISP mode
  0xff, // Raw system reset / flash lock
]);

export function assertSafeLedPacket(payload: Uint8Array, commandByteIndex = 1): void {
  if (payload.length === 0) {
    throw new Error('Safety Guardrail: Refused to send empty HID packet.');
  }
  const op = payload[commandByteIndex];
  const header0 = payload[0];
  if (BLOCKED_BOOTLOADER_OPCODES.has(op) || BLOCKED_BOOTLOADER_OPCODES.has(header0)) {
    throw new Error(
      `Safety Guardrail: Blocked potentially unsafe non-LED opcode (0x${header0.toString(16)}, 0x${op.toString(16)}). Bootloader/DFU writes are strictly prohibited.`
    );
  }
}

export function computeAdditiveChecksum(bytes: Uint8Array, endExclusive: number): number {
  let sum = 0;
  for (let i = 0; i < endExclusive; i++) {
    sum = (sum + bytes[i]) & 0xff;
  }
  return (0x100 - sum) & 0xff;
}

export function computeXorChecksum(bytes: Uint8Array, endExclusive: number): number {
  let acc = 0x55;
  for (let i = 0; i < endExclusive; i++) {
    acc ^= bytes[i];
  }
  return acc & 0xff;
}

export async function dispatchSafeReport(
  device: HIDDevice,
  reportId: number,
  payload: Uint8Array,
  transport: 'output' | 'feature',
  context: AdapterContext,
  summary: string,
  commandByteIndex = 1
): Promise<void> {
  assertSafeLedPacket(payload, commandByteIndex);
  if (!device.opened) {
    throw new Error('HID device is not open.');
  }
  const buffer = new Uint8Array(payload);
  if (transport === 'feature') {
    await device.sendFeatureReport(reportId, buffer);
  } else {
    await device.sendReport(reportId, buffer);
  }
  context.logTraffic('tx', reportId, buffer, summary);
}

