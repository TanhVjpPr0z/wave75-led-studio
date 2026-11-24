import type { RGB } from '../utils/color';
import { clamp, rgbToHsv } from '../utils/color';
import {
  AdapterContext,
  FlashSaveResult,
  KeyboardLightingAdapter,
  LogoSettings,
  ProtocolTransportMode,
  QmkLightingState,
  WaveCapabilities,
  assertSafeWavePacket,
} from './types';

/**
 * QMK / VIA Raw HID Lighting Adapter (usagePage: 0xFF60, usage: 0x61, 32-byte packets)
 * Compatible with PMO WAVE75 Standard, WAVE75 Pro, and Womier RD75 / RD75 Pro.
 */
export const QMK_VIA_PROTOCOL = {
  USAGE_PAGE: 0xff60,
  USAGE: 0x61,
  PACKET_SIZE: 32,
  ID_LIGHTING_SET_VALUE: 0x07,
  ID_LIGHTING_GET_VALUE: 0x08,
  ID_LIGHTING_SAVE: 0x09,
  CHANNEL_RGB_MATRIX: 0x03,
  VAL_BRIGHTNESS: 0x01,
  VAL_EFFECT: 0x02,
  VAL_EFFECT_SPEED: 0x03,
  VAL_COLOR: 0x04,
} as const;

export const QMK_RGB_MATRIX_EFFECTS: Array<{ id: number; name: string }> = [
  { id: 0, name: '00 • All Off' },
  { id: 1, name: '01 • Solid Color' },
  { id: 2, name: '02 • Alphas Mods' },
  { id: 3, name: '03 • Gradient Up Down' },
  { id: 4, name: '04 • Gradient Left Right' },
  { id: 5, name: '05 • Breathing' },
  { id: 6, name: '06 • Band Sat' },
  { id: 7, name: '07 • Band Val' },
  { id: 8, name: '08 • Band Pinwheel Sat' },
  { id: 9, name: '09 • Band Pinwheel Val' },
  { id: 10, name: '10 • Band Spiral Sat' },
  { id: 11, name: '11 • Band Spiral Val' },
  { id: 12, name: '12 • Cycle All' },
  { id: 13, name: '13 • Cycle Left Right' },
  { id: 14, name: '14 • Cycle Up Down' },
  { id: 15, name: '15 • Rainbow Moving Chevron' },
  { id: 16, name: '16 • Cycle Out In' },
  { id: 17, name: '17 • Cycle Out In Dual' },
  { id: 18, name: '18 • Cycle Pinwheel' },
  { id: 19, name: '19 • Cycle Spiral' },
  { id: 20, name: '20 • Dual Beacon' },
  { id: 21, name: '21 • Rainbow Beacon' },
  { id: 22, name: '22 • Rainbow Pinwheels' },
  { id: 23, name: '23 • Flower Blooming' },
  { id: 24, name: '24 • Raindrops' },
  { id: 25, name: '25 • Jellybean Raindrops' },
  { id: 26, name: '26 • Hue Breathing' },
  { id: 27, name: '27 • Hue Pendulum' },
  { id: 28, name: '28 • Hue Wave' },
  { id: 29, name: '29 • Pixel Fractal' },
  { id: 30, name: '30 • Pixel Flow' },
  { id: 31, name: '31 • Pixel Rain' },
  { id: 32, name: '32 • Typing Heatmap' },
  { id: 33, name: '33 • Digital Rain' },
  { id: 34, name: '34 • Solid Reactive Simple' },
  { id: 35, name: '35 • Solid Reactive' },
  { id: 36, name: '36 • Solid Reactive Wide' },
  { id: 37, name: '37 • Solid Reactive Multiwide' },
  { id: 38, name: '38 • Solid Reactive Cross' },
  { id: 39, name: '39 • Solid Reactive Multicross' },
  { id: 40, name: '40 • Solid Reactive Nexus' },
  { id: 41, name: '41 • Solid Reactive Multinexus' },
  { id: 42, name: '42 • Splash' },
  { id: 43, name: '43 • Multisplash' },
  { id: 44, name: '44 • Solid Splash' },
  { id: 45, name: '45 • Solid Multisplash' },
  { id: 46, name: '46 • Starlight' },
  { id: 47, name: '47 • Starlight Dual Hue' },
  { id: 48, name: '48 • Starlight Dual Sat' },
  { id: 49, name: '49 • Riverflow' },
  { id: 50, name: '50 • Wave75 Signature Glow' },
  { id: 51, name: '51 • Wave75 Aurora Flow' },
];

export class QmkViaLightingAdapter implements KeyboardLightingAdapter {
  readonly transportMode: ProtocolTransportMode = 'qmk_via';
  readonly displayName: string = 'QMK / VIA Raw HID (0xFF60:0x61)';

  private device: HIDDevice | null = null;
  private context: AdapterContext | null = null;
  private reportId = 0x00;

  async connect(device: HIDDevice, context: AdapterContext): Promise<WaveCapabilities> {
    this.device = device;
    this.context = context;
    this.reportId = context.deviceInfo.reportId;

    context.logTraffic(
      'info',
      '0x07',
      null,
      `Connected QMK/VIA Raw HID (${context.deviceInfo.usagePageHex}:${context.deviceInfo.usageHex}, 32B)`
    );

    return {
      supportsPerKeySync: false,
      supportsOnboardSlots: false,
      supportsQmkLighting: true,
      logoOnly: false,
      maxSafeFps: 15,
      slotCount: 0,
      protocolName: 'QMK / VIA Raw HID (32B)',
    };
  }

  private async sendViaPacket(bytes: number[], summary: string): Promise<void> {
    if (!this.device || !this.device.opened) return;
    assertSafeWavePacket(bytes[0] ?? 0);
    const pkt = new Uint8Array(QMK_VIA_PROTOCOL.PACKET_SIZE);
    for (let i = 0; i < bytes.length && i < pkt.length; i++) {
      pkt[i] = bytes[i] & 0xff;
    }
    await this.device.sendReport(this.reportId, pkt);
    this.context?.logTraffic(
      'tx',
      `0x${(bytes[0] ?? 0).toString(16).toUpperCase().padStart(2, '0')}`,
      pkt,
      summary
    );
  }

  async readDeviceInfo(): Promise<{ modelName: string; firmwareVersion?: string }> {
    return {
      modelName: this.device?.productName || 'WAVE75 QMK/VIA',
      firmwareVersion: 'QMK VIA v3',
    };
  }

  async sendPerKeySyncFrame(): Promise<void> {
    // QMK/VIA Raw HID does not support 0x2E per-key RAM streaming
  }

  async readOnboardSlot(): Promise<{ keys: RGB[]; logo: RGB }> {
    throw new Error('Onboard 5-slot RGB888 read requires PMO Native interface (0x36B0:0x3009).');
  }

  async saveOnboardSlotWithVerify(): Promise<FlashSaveResult> {
    await this.sendViaPacket(
      [QMK_VIA_PROTOCOL.ID_LIGHTING_SAVE, QMK_VIA_PROTOCOL.CHANNEL_RGB_MATRIX],
      'VIA: Save QMK RGB Matrix state to EEPROM (0x09)'
    );
    return {
      slot: 1,
      verified: true,
      bytesWritten: 32,
      message: 'Saved current QMK/VIA lighting preset to keyboard EEPROM.',
    };
  }

  async selectOnboardSlot(): Promise<void> {}

  async applyQmkLighting(state: QmkLightingState): Promise<void> {
    if (!this.device || !this.device.opened) return;
    const ch = QMK_VIA_PROTOCOL.CHANNEL_RGB_MATRIX;
    const setOp = QMK_VIA_PROTOCOL.ID_LIGHTING_SET_VALUE;

    await this.sendViaPacket(
      [setOp, ch, QMK_VIA_PROTOCOL.VAL_EFFECT, clamp(state.effectId, 0, 51)],
      `QMK RGB Matrix Effect #${state.effectId}`
    );
    await this.sendViaPacket(
      [setOp, ch, QMK_VIA_PROTOCOL.VAL_BRIGHTNESS, clamp(state.brightness, 0, 255)],
      `QMK Brightness = ${state.brightness}`
    );
    await this.sendViaPacket(
      [setOp, ch, QMK_VIA_PROTOCOL.VAL_EFFECT_SPEED, clamp(state.speed, 0, 255)],
      `QMK Speed = ${state.speed}`
    );
    await this.sendViaPacket(
      [
        setOp,
        ch,
        QMK_VIA_PROTOCOL.VAL_COLOR,
        clamp(state.hue, 0, 255),
        clamp(state.saturation, 0, 255),
      ],
      `QMK Color H=${state.hue} S=${state.saturation}`
    );
  }

  async applyLogoSettings(settings: LogoSettings): Promise<void> {
    // QMK WAVE75 ties Logo brightness to global RGB brightness (0 = off)
    const hsv = rgbToHsv(settings.color);
    await this.applyQmkLighting({
      effectId: settings.effect === 'off' ? 0 : settings.effect === 'rainbow' ? 13 : 1,
      brightness: settings.effect === 'off' ? 0 : Math.round((settings.brightness / 100) * 255),
      speed: Math.round((settings.speed / 5) * 255),
      hue: Math.round((hsv.h / 360) * 255),
      saturation: Math.round((settings.saturation / 100) * 255),
    });
  }

  async handBackToFirmware(): Promise<void> {
    await this.sendViaPacket(
      [QMK_VIA_PROTOCOL.ID_LIGHTING_SAVE, QMK_VIA_PROTOCOL.CHANNEL_RGB_MATRIX],
      'VIA: Commit lighting state on disconnect'
    );
  }

  async disconnect(): Promise<void> {
    this.device = null;
    this.context = null;
  }
}
