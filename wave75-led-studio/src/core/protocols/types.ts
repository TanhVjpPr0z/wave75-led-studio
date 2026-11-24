import type { RGB } from '../utils/color';

export type WaveModelId =
  | 'wave75_standard_rgb'
  | 'wave75_pro_rgb'
  | 'wave75_non_rgb'
  | 'womier_rd75';

export type ProtocolTransportMode = 'pmo_native' | 'qmk_via' | 'logo_only' | 'simulator';

export interface WaveCapabilities {
  supportsPerKeySync: boolean;    // 0x2E RGB565 streaming
  supportsOnboardSlots: boolean;  // 0x22-0x2A / 0x23 RGB888 5-slot flash
  supportsQmkLighting: boolean;   // 0xFF60:0x61 VIA Raw HID
  logoOnly: boolean;              // WAVE75 Non-RGB variant
  maxSafeFps: number;
  slotCount: number;
  protocolName: string;
}

export interface WaveDeviceInfo {
  vendorId: number;
  productId: number;
  vendorIdHex: string;
  productIdHex: string;
  productName: string;
  usagePage: number;
  usagePageHex: string;
  usage: number;
  usageHex: string;
  reportId: number;
  packetSize: number;
  transportMode: ProtocolTransportMode;
  firmwareVersion?: string;
}

export interface HidTrafficPacket {
  id: number;
  timestamp: string;
  direction: 'tx' | 'rx' | 'info' | 'warn' | 'error';
  opcodeHex: string;
  statusTag?: '0x55 OK' | '0x0F REJECTED';
  hex: string;
  summary: string;
  bytesLength: number;
}

export interface LogoSettings {
  color: RGB;
  brightness: number; // 0..100
  speed: number;      // 1..5
  saturation: number; // 0..100
  effect: 'static' | 'breathing' | 'rainbow' | 'neon_pulse' | 'off';
}

export interface QmkLightingState {
  effectId: number;   // 0..51 QMK RGB Matrix modes
  brightness: number; // 0..255
  speed: number;      // 0..255
  hue: number;        // 0..255
  saturation: number; // 0..255
}

export interface FlashSaveResult {
  slot: number;
  verified: boolean;
  bytesWritten: number;
  message: string;
}

export interface AdapterContext {
  deviceInfo: WaveDeviceInfo;
  logTraffic: (
    direction: HidTrafficPacket['direction'],
    opcodeHex: string,
    bytes: Uint8Array | null,
    summary: string,
    statusTag?: HidTrafficPacket['statusTag']
  ) => void;
}

export interface NativeHardwarePresetConfig {
  modeId: number;       // 1..20 official WAVE75 RDR hardware effects
  brightness: number;   // 0..100 (%)
  speed: number;        // 1..5
  rainbow: boolean;     // true = colorful mix, false = solid RGB
  color: RGB;
  logo?: LogoSettings;  // optional simultaneous CNC Logo LED update
}

export interface KeyboardLightingAdapter {
  readonly transportMode: ProtocolTransportMode;
  readonly displayName: string;
  connect(device: HIDDevice, context: AdapterContext): Promise<WaveCapabilities>;
  readDeviceInfo(): Promise<{ modelName: string; firmwareVersion?: string }>;
  sendPerKeySyncFrame(
    keyColors: RGB[],
    logoColor: RGB,
    lightIndexMap?: number[]
  ): Promise<void>;
  readOnboardSlot(slot: number, lightIndexMap?: number[]): Promise<{ keys: RGB[]; logo: RGB }>;
  saveOnboardSlotWithVerify(
    slot: number,
    keyColors: RGB[],
    logoColor: RGB,
    lightIndexMap?: number[]
  ): Promise<FlashSaveResult>;
  selectOnboardSlot(slot: number): Promise<void>;
  applyQmkLighting(state: QmkLightingState): Promise<void>;
  applyLogoSettings(settings: LogoSettings): Promise<void>;
  applyNativePresetToFlash?(config: NativeHardwarePresetConfig): Promise<string>;
  handBackToFirmware(): Promise<void>;
  disconnect(): Promise<void>;
}

/**
 * HARDWARE SAFETY GUARDRAIL:
 * Strictly blocks any bootloader, DFU, or firmware .bin flash opcodes.
 * WAVE75 LED Studio ONLY executes lighting control and read-only queries.
 */
const FORBIDDEN_FLASH_OPCODES = new Set<number>([
  0xa0, // Bootloader enter
  0xa1, // Firmware flash erase
  0xa2, // Firmware page write
  0xdf, // DFU mode
  0xf0, // Raw IAP jump
  0xfe, // ISP bootloader
  0xff, // Hard bootloader reset
]);

export function assertSafeWavePacket(opcode: number): void {
  if (FORBIDDEN_FLASH_OPCODES.has(opcode & 0xff)) {
    throw new Error(
      `Hardware Safety Guardrail: Blocked forbidden bootloader/DFU opcode 0x${opcode
        .toString(16)
        .toUpperCase()}. Firmware flashing is strictly disabled.`
    );
  }
}

export interface WaveModelSpec {
  id: WaveModelId;
  shortName: string;
  fullName: string;
  badge: string;
  batteryPlate: string;
  logoOnly: boolean;
  notesVi: string;
  notesEn: string;
}

export const WAVE_MODEL_SPECS: Record<WaveModelId, WaveModelSpec> = {
  wave75_standard_rgb: {
    id: 'wave75_standard_rgb',
    shortName: 'WAVE75 Standard (RGB)',
    fullName: 'PMO WAVE75 Standard RGB',
    badge: 'STD RGB',
    batteryPlate: '4000mAh • PP Plate • Tri-Mode',
    logoOnly: false,
    notesVi: '81 phím ARGB mạch xuôi + Đèn Logo • Đẩy frame 0x2E, lưu 5 khe Flash 0x23 & QMK/VIA.',
    notesEn: '81-key south-facing ARGB + Logo LED • Live 0x2E sync, 5 onboard slots (0x23) & QMK/VIA.',
  },
  wave75_pro_rgb: {
    id: 'wave75_pro_rgb',
    shortName: 'WAVE75 Pro (RGB)',
    fullName: 'PMO WAVE75 Pro RGB',
    badge: 'PRO RGB',
    batteryPlate: '8000mAh • FR4 Plate • PVD Weight',
    logoOnly: false,
    notesVi: 'Đầy đủ 81 phím ARGB + Đèn Logo • Hỗ trợ giao thức gốc 0x36B0:0x3009 và QMK/VIA Raw HID.',
    notesEn: 'Full 81-key ARGB + Logo LED • Supports native 0x36B0:0x3009 protocol and QMK/VIA Raw HID.',
  },
  wave75_non_rgb: {
    id: 'wave75_non_rgb',
    shortName: 'WAVE75 Non-RGB (Logo)',
    fullName: 'PMO WAVE75 Standard Non-RGB',
    badge: 'LOGO ONLY',
    batteryPlate: 'No Per-Key LED • CNC Logo RGB',
    logoOnly: true,
    notesVi: 'Phiên bản không LED nền phím — Chế độ chuyên biệt điều khiển Đèn Logo RGB & tra cứu phím tắt.',
    notesEn: 'Non-RGB edition — Streamlined CNC Logo RGB controller and quick Fn shortcut cheatsheet.',
  },
  womier_rd75: {
    id: 'womier_rd75',
    shortName: 'Womier RD75 / RD75 Pro',
    fullName: 'Womier RD75 / RD75 Pro (OEM Twin)',
    badge: 'OEM RD75',
    batteryPlate: 'Shared WAVE75 PCB & Firmware',
    logoOnly: false,
    notesVi: 'Dùng chung PCB & firmware với WAVE75 Pro; hỗ trợ quét VID/PID linh hoạt và LED Calibrator.',
    notesEn: 'Shares PCB & firmware with WAVE75 Pro; flexible VID/PID matching and LED Index Calibrator.',
  },
};

export const WAVE_MODELS_ORDER: WaveModelId[] = [
  'wave75_pro_rgb',
  'wave75_standard_rgb',
  'wave75_non_rgb',
  'womier_rd75',
];

