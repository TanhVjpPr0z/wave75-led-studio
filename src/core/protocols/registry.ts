import type {
  ConcreteModelId,
  CustomProtocolConfig,
  KeyboardModelId,
  KeyboardProtocolAdapter,
} from './types';
import { Win60ProMaxAdapter } from './win60ProMaxAdapter';
import { Win60StandardAdapter } from './win60StandardAdapter';
import { Win60SEAdapter } from './win60SEAdapter';
import { CustomGenericAdapter } from './customGenericAdapter';
import { SimulatorAdapter } from './simulatorAdapter';

export interface ModelSpec {
  id: ConcreteModelId;
  shortName: string;
  fullName: string;
  badge: string;
  driverPlatform: string;
  pollingRate: string;
  supportsOnboardSave: boolean;
  requiresLedPowerOnFirst: boolean;
  knownVidPids: Array<{ vendorId: number; productId?: number }>;
  notesVi: string;
  notesEn: string;
}

export const MODEL_SPECS: Record<ConcreteModelId, ModelSpec> = {
  win60he_standard: {
    id: 'win60he_standard',
    shortName: 'WIN60 HE Standard',
    fullName: 'AULA WIN60 HE Standard',
    badge: 'STANDARD',
    driverPlatform: 'device.aulacn.com / hed.aulacn.com',
    pollingRate: 'Up to 8000Hz',
    supportsOnboardSave: true,
    requiresLedPowerOnFirst: false,
    knownVidPids: [
      { vendorId: 0x38a6 },
      { vendorId: 0x258a },
      { vendorId: 0x320f },
    ],
    notesVi: 'Nền tảng MCU riêng biệt với Pro/Max; hỗ trợ 61 phím LED hướng nam & lưu bộ nhớ phím.',
    notesEn: 'Separate MCU platform from Pro/Max; supports 61-key south-facing RGB & onboard memory.',
  },
  win60he_pro: {
    id: 'win60he_pro',
    shortName: 'WIN60 HE Pro',
    fullName: 'AULA WIN60 HE Pro',
    badge: 'PRO 8K',
    driverPlatform: 'win.aulacn.com / hea.aulacn.com',
    pollingRate: '8000Hz Wired',
    supportsOnboardSave: true,
    requiresLedPowerOnFirst: false,
    knownVidPids: [
      { vendorId: 0x8089, productId: 0x0009 },
      { vendorId: 0x8089 },
    ],
    notesVi: 'Dùng chung nền tảng driver web với bản Max; 14+ hiệu ứng sẵn (Fn+Tab) & stream RGB mượt 30 FPS.',
    notesEn: 'Shares web driver platform with Max; 14+ built-in effects (Fn+Tab) & smooth 30 FPS RGB streaming.',
  },
  win60he_max: {
    id: 'win60he_max',
    shortName: 'WIN60 HE Max',
    fullName: 'AULA WIN60 HE Max',
    badge: 'MAX 8K',
    driverPlatform: 'win.aulacn.com / hea.aulacn.com',
    pollingRate: '8000Hz Wired',
    supportsOnboardSave: true,
    requiresLedPowerOnFirst: false,
    knownVidPids: [
      { vendorId: 0x8089, productId: 0x0009 },
      { vendorId: 0x8089 },
    ],
    notesVi: 'Phiên bản cao cấp nhất dòng WIN60 HE, đầy đủ tùy chỉnh từng phím, GIF & lưu cấu hình EEPROM.',
    notesEn: 'Flagship WIN60 HE edition with full per-key customization, GIF streaming & EEPROM saving.',
  },
  win60_se: {
    id: 'win60_se',
    shortName: 'WIN60 SE',
    fullName: 'AULA WIN60 SE',
    badge: 'SE',
    driverPlatform: 'USB VID 0x38A6 / PID 0x291A',
    pollingRate: 'Wired USB-C',
    supportsOnboardSave: false,
    requiresLedPowerOnFirst: true,
    knownVidPids: [{ vendorId: 0x38a6, productId: 0x291a }],
    notesVi: 'Dùng chung layout 61 phím; tự động bật nguồn đèn trước khi phát màu/GIF trực tiếp qua USB.',
    notesEn: 'Shares 61-key layout; automatically enables LED power before live USB color/GIF streaming.',
  },
  custom_generic: {
    id: 'custom_generic',
    shortName: 'Custom HID',
    fullName: 'Custom Generic HID Batch',
    badge: 'CUSTOM',
    driverPlatform: 'Custom Report ID / Header',
    pollingRate: 'Configurable',
    supportsOnboardSave: false,
    requiresLedPowerOnFirst: false,
    knownVidPids: [],
    notesVi: 'Dành cho lô firmware mới hoặc phần cứng tương thích; tùy chỉnh Report ID & Header trong HID Inspector.',
    notesEn: 'For newer firmware batches; customize Report ID & Header bytes inside HID Inspector.',
  },
};

export const SELECTABLE_MODELS: KeyboardModelId[] = [
  'auto',
  'win60he_standard',
  'win60he_pro',
  'win60he_max',
  'win60_se',
  'custom_generic',
];

/**
 * Known WebHID device filters for primary "Connect USB Keyboard" button.
 * Matches known AULA WIN60 VID/PIDs plus vendor-defined control usage pages.
 */
export const KNOWN_WEBHID_FILTERS: HIDDeviceFilter[] = [
  // Hardware-verified AULA WIN 60 HE (Artery AT32 — VID 0x2E3C, PID 0xC365, UsagePage 0xFF1B)
  { vendorId: 0x2e3c, productId: 0xc365, usagePage: 0xff1b, usage: 0x91 },
  { vendorId: 0x2e3c, productId: 0xc365 },
  { vendorId: 0x2e3c },
  // AULA WIN 60 HE MAX (Sparklink KB2 — VID 0x1CA2, PID 0x1902)
  { vendorId: 0x1ca2, productId: 0x1902, usagePage: 0xffa0, usage: 0x01 },
  { vendorId: 0x1ca2, productId: 0x1902, usagePage: 0xffb0, usage: 0x01 },
  // AULA WIN60 SE (VID 0x38A6, PID 0x291A)
  { vendorId: 0x38a6, productId: 0x291a },
  { vendorId: 0x38a6 },
  // AULA WIN60 HE Pro / Max (Sayo/Vendor controller 0x8089)
  { vendorId: 0x8089, productId: 0x0009 },
  { vendorId: 0x8089 },
  // Common AULA / Sonix / Royuan keyboard VIDs on vendor control pages
  { vendorId: 0x258a, usagePage: 0xff1b },
  { vendorId: 0x258a, usagePage: 0xff00 },
  { vendorId: 0x320f, usagePage: 0xff1b },
  { vendorId: 0x320f, usagePage: 0xff00 },
  { vendorId: 0x3554 },
  // Vendor-defined AULA control usage page fallback
  { usagePage: 0xff1b, usage: 0x91 },
  { usagePage: 0xff1b },
];

export function detectModelFromDevice(device: HIDDevice): ConcreteModelId {
  const name = (device.productName || '').toLowerCase();
  const vid = device.vendorId;
  const pid = device.productId;

  // Exact hardware-verified AULA WIN 60 HE (2E3C:C365, 0xFF1B:0x91)
  if (vid === 0x2e3c && pid === 0xc365) {
    return 'win60he_standard';
  }
  if (vid === 0x2e3c) {
    return 'win60he_standard';
  }
  // Exact WIN60 SE VID/PID
  if (vid === 0x38a6 && pid === 0x291a) {
    return 'win60_se';
  }
  if (name.includes('win60') && name.includes('se')) {
    return 'win60_se';
  }
  if (name.includes('max') || (vid === 0x1ca2 && pid === 0x1902)) {
    return 'win60he_max';
  }
  if (name.includes('pro')) {
    return 'win60he_pro';
  }
  if (name.includes('standard') || name.includes('std')) {
    return 'win60he_standard';
  }

  // Check if device exposes the known 0xFF1B vendor control usage page
  const hasFF1B = (device.collections ?? []).some((c) => c.usagePage === 0xff1b);
  if (hasFF1B) {
    return 'win60he_standard';
  }

  // VID heuristics
  if (vid === 0x8089) {
    return 'win60he_max';
  }
  if (vid === 0x38a6 || vid === 0x258a || vid === 0x320f) {
    return 'win60he_standard';
  }

  return 'custom_generic';
}

export function createAdapterForModel(
  modelId: ConcreteModelId,
  customConfig?: Partial<CustomProtocolConfig>
): KeyboardProtocolAdapter {
  switch (modelId) {
    case 'win60he_pro':
      return new Win60ProMaxAdapter('win60he_pro');
    case 'win60he_max':
      return new Win60ProMaxAdapter('win60he_max');
    case 'win60he_standard':
      return new Win60StandardAdapter();
    case 'win60_se':
      return new Win60SEAdapter();
    case 'custom_generic':
      return new CustomGenericAdapter(customConfig);
  }
}

export function createSimulatorAdapter(modelId: ConcreteModelId): SimulatorAdapter {
  return new SimulatorAdapter(modelId);
}

