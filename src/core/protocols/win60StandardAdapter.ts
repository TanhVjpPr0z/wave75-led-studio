import type { EffectParams, EffectModeId } from '../engines/effectEngine';
import { TOTAL_KEYS, WIN60HE_KEYS } from '../layout/win60heLayout';
import type { RGB } from '../utils/color';
import { clamp, clampByte } from '../utils/color';
import {
  AdapterContext,
  CapabilityFlags,
  ConcreteModelId,
  KeyboardProtocolAdapter,
  assertSafeLedPacket,
} from './types';

/**
 * HARDWARE-VERIFIED AULA WIN 60 HE Protocol (`VID 0x2E3C / PID 0xC365`, `UsagePage 0xFF1B / Usage 0x0091`)
 * Confirmed from real hardware HID descriptor (`In=64B Out=64B Feat=0B, ReportID=0x01, 63-byte body`)
 * and cross-verified with MizProject/reaula & MrWhosNexus/Aether-HE.
 *
 * Wire envelope: sendReport(0x01, Uint8Array(63))
 *  - body[0]: command byte
 *  - body[1]: sub-selector / slot (0 or 1) / read flag
 *  - body[2..3]: page index (BIG-ENDIAN u16)
 *  - body[4]: payload length
 *  - body[5..]: payload bytes
 */
export const WIN60_FF1B_PROTOCOL = {
  VENDOR_ID: 0x2e3c,
  PRODUCT_ID: 0xc365,
  USAGE_PAGE: 0xff1b,
  USAGE: 0x0091,
  REPORT_ID: 0x01,
  BODY_LEN: 63,
  MATRIX_SLOTS: 132, // 6 rows × 22 cols
  CUSTOM_LIGHT_BYTES: 396, // 132 × 3 RGB888
  CUSTOM_LIGHT_CHUNK: 54, // 8 pages: 7×54 + 18 = 396
  LIGHT_MAX_LEVEL: 4, // Hardware brightness & speed range 0..4
  CMD: {
    HEARTBEAT: 0x01,
    LIGHT: 0x07,
    CUSTOM_LIGHT: 0x09,
    LIGHT_LIST: 0x0a,
    DEVICE_INFO: 0x0d,
    MUSIC_RHYTHM: 0x17,
  },
  MODE_CUSTOM: 10,
} as const;

/**
 * Hardware-verified 6×22 matrix slot index for each of the 61 physical WIN 60 HE keys
 * (SI2825KZHEARGB / SI2825HEARGB keymap).
 */
export const WIN60HE_MATRIX_SLOT_BY_ID: Record<string, number> = {
  // Row 0 (14 keys)
  esc: 22, '1': 23, '2': 24, '3': 25, '4': 26, '5': 27, '6': 28,
  '7': 29, '8': 30, '9': 31, '0': 32, minus: 33, equal: 34, backspace: 36,
  // Row 1 (14 keys)
  tab: 44, q: 45, w: 46, e: 47, r: 48, t: 49, y: 50,
  u: 51, i: 52, o: 53, p: 54, lbracket: 55, rbracket: 56, backslash: 58,
  // Row 2 (13 keys)
  caps: 66, a: 68, s: 69, d: 70, f: 71, g: 72, h: 73,
  j: 74, k: 75, l: 76, semicolon: 77, quote: 78, enter: 80,
  // Row 3 (12 keys)
  lshift: 88, z: 90, x: 91, c: 92, v: 93, b: 94, n: 95,
  m: 96, comma: 97, period: 98, slash: 99, rshift: 100,
  // Row 4 (8 keys)
  lctrl: 110, lwin: 111, lalt: 112, space: 116,
  ralt: 119, menu: 120, rctrl: 121, fn: 122,
};

const EFFECT_TO_FF1B_MODE: Record<EffectModeId, number> = {
  static: 0,
  breathing: 1,
  rainbow_wave: 2,
  spectrum_cycle: 3,
  reactive_ripple: 8,
  single_key_fade: 6,
  raindrop: 15,
  aurora: 7,
  starlight: 9,
  sine_wave: 4,
  neon_stream: 3,
  dual_gradient_wave: 2,
  laser_row: 11,
  off: 0,
};

const DIR_TO_FF1B: Record<EffectParams['direction'], number> = {
  left_to_right: 0, // Right
  right_to_left: 1, // Left
  bottom_to_top: 2, // Up
  top_to_bottom: 3, // Down
  outward: 4,       // Spread
  inward: 5,        // Gather
};

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function makeBody63(cmd: number): Uint8Array<ArrayBuffer> {
  const body = new Uint8Array(new ArrayBuffer(WIN60_FF1B_PROTOCOL.BODY_LEN));
  body[0] = cmd & 0xff;
  return body;
}

export class Win60StandardAdapter implements KeyboardProtocolAdapter {
  readonly modelId: ConcreteModelId;
  readonly displayName: string;

  private device: HIDDevice | null = null;
  private context: AdapterContext | null = null;
  private reportId: number = WIN60_FF1B_PROTOCOL.REPORT_ID;
  private inCustomMode = false;
  private hasPrimedAllPages = false;
  private brightnessLevel: number = WIN60_FF1B_PROTOCOL.LIGHT_MAX_LEVEL;
  private speedLevel = 3;
  // Reusable zero-GC buffers for 60-90 FPS streaming
  private readonly flatBuf = new Uint8Array(WIN60_FF1B_PROTOCOL.CUSTOM_LIGHT_BYTES);
  // Stores ONLY the exact page bytes confirmed written to the keyboard MCU (never overwritten by unsent frames!)
  private committedPages: Array<Uint8Array<ArrayBuffer> | null> = new Array(8).fill(null);
  private lastColors: RGB[] | null = null;
  private frameCounter = 0;

  // Hardware ACK flow control for cmd 0x09 (prevents AT32 MCU USB RX FIFO overflow & row tearing/stutter)
  private ackResolver: ((gotAck: boolean) => void) | null = null;
  private ackSupported: boolean | null = null;
  private consecutiveAckTimeouts = 0;

  private readonly onInputReport = (ev: Event) => {
    const hidEv = ev as HIDInputReportEvent;
    if (hidEv.data.byteLength < 1) return;
    const cmd = hidEv.data.getUint8(0);
    if (cmd === WIN60_FF1B_PROTOCOL.CMD.CUSTOM_LIGHT && this.ackResolver) {
      const resolve = this.ackResolver;
      this.ackResolver = null;
      resolve(true);
    }
  };

  constructor(
    modelId: ConcreteModelId = 'win60he_standard',
    displayName = 'AULA WIN60 HE (0x2E3C:0xC365 • 0xFF1B)'
  ) {
    this.modelId = modelId;
    this.displayName = displayName;
  }

  private async sendBody(
    body: Uint8Array<ArrayBuffer>,
    summary: string | null
  ): Promise<void> {
    if (!this.device || !this.device.opened) {
      throw new Error('WIN60 HE HID device is not open.');
    }
    assertSafeLedPacket(body, 0);
    await this.device.sendReport(this.reportId, body);
    if (summary !== null) {
      this.context?.logTraffic('tx', this.reportId, body, summary);
    }
  }

  /**
   * Probes whether an open HIDDevice responds to AULA 0xFF1B heartbeat (cmd 0x01).
   */
  async probe(device: HIDDevice, context: AdapterContext): Promise<boolean> {
    const hasFF1B = (device.collections ?? []).some(
      (c) => c.usagePage === WIN60_FF1B_PROTOCOL.USAGE_PAGE
    );
    if (!hasFF1B && device.vendorId !== WIN60_FF1B_PROTOCOL.VENDOR_ID) {
      return false;
    }

    const repId =
      device.collections
        ?.find((c) => c.usagePage === WIN60_FF1B_PROTOCOL.USAGE_PAGE)
        ?.outputReports?.[0]?.reportId ?? WIN60_FF1B_PROTOCOL.REPORT_ID;

    let gotReply = false;
    const onReply = (ev: Event) => {
      const hidEv = ev as HIDInputReportEvent;
      const u = new Uint8Array(
        hidEv.data.buffer,
        hidEv.data.byteOffset,
        hidEv.data.byteLength
      );
      if (u[0] === WIN60_FF1B_PROTOCOL.CMD.HEARTBEAT || u[0] === WIN60_FF1B_PROTOCOL.CMD.DEVICE_INFO) {
        gotReply = true;
      }
    };

    device.addEventListener('inputreport', onReply);
    try {
      const hb = makeBody63(WIN60_FF1B_PROTOCOL.CMD.HEARTBEAT);
      await device.sendReport(repId, hb);
      context.logTraffic('tx', repId, hb, 'Probe WIN60 HE (0xFF1B): Heartbeat cmd 0x01');
      for (let i = 0; i < 20 && !gotReply; i++) {
        await sleep(25);
      }
      // Even if a batch ignores 0x01 silently, an exact 0x2E3C:0xC365 on UsagePage 0xFF1B/0x91 with sendReport success is the verified control interface
      const exactMatch =
        device.vendorId === WIN60_FF1B_PROTOCOL.VENDOR_ID &&
        device.productId === WIN60_FF1B_PROTOCOL.PRODUCT_ID &&
        hasFF1B;
      return gotReply || exactMatch;
    } catch {
      return false;
    } finally {
      device.removeEventListener('inputreport', onReply);
    }
  }

  async connect(device: HIDDevice, context: AdapterContext): Promise<CapabilityFlags> {
    if (this.device && typeof this.device.removeEventListener === 'function') {
      this.device.removeEventListener('inputreport', this.onInputReport);
    }
    this.device = device;
    this.context = context;
    this.inCustomMode = false;
    this.hasPrimedAllPages = false;
    this.committedPages = new Array(8).fill(null);
    this.ackResolver = null;
    this.consecutiveAckTimeouts = 0;

    if (typeof device.addEventListener === 'function') {
      device.addEventListener('inputreport', this.onInputReport);
      this.ackSupported = null; // Auto-detect on first cmd 0x09 packet
    } else {
      this.ackSupported = false;
    }

    // Determine exact output Report ID (0x01 on 2E3C:C365)
    const ff1bCol = device.collections?.find(
      (c) => c.usagePage === WIN60_FF1B_PROTOCOL.USAGE_PAGE
    );
    this.reportId =
      ff1bCol?.outputReports?.[0]?.reportId ??
      (context.deviceInfo.outputReportId || WIN60_FF1B_PROTOCOL.REPORT_ID);

    context.logTraffic(
      'info',
      this.reportId,
      null,
      `Bound ${this.displayName} (ReportID=0x${this.reportId
        .toString(16)
        .padStart(2, '0')}, 63B body, UsagePage ${context.deviceInfo.usagePageHex})`
    );

    return {
      supportsPerKeyStreaming: true,
      supportsOnboardSave: true,
      supportsHardwarePresets: true,
      supportsBrightness: true,
      supportsSpeed: true,
      supportsSleepTimer: true,
      requiresLedPowerOnFirst: false,
      maxSafeFps: 90,
      packetSize: WIN60_FF1B_PROTOCOL.BODY_LEN,
      pollingRateLabel: '8000Hz Wired (0x2E3C:0xC365)',
      driverPlatform: 'hed.aulacn.com / 0xFF1B:0x0091',
    };
  }

  async readDeviceInfo(): Promise<{ modelName: string; firmwareVersion?: string }> {
    if (this.device && this.device.opened) {
      try {
        await this.sendBody(
          makeBody63(WIN60_FF1B_PROTOCOL.CMD.HEARTBEAT),
          'WIN60 HE: Heartbeat / InitInfo (0x01)'
        );
        await sleep(8);
        await this.sendBody(
          makeBody63(WIN60_FF1B_PROTOCOL.CMD.DEVICE_INFO),
          'WIN60 HE: Query firmware string (0x0D)'
        );
      } catch {
        // optional
      }
    }
    return {
      modelName: this.device?.productName || this.displayName,
      firmwareVersion: '0xFF1B ReportID 0x01 (63B)',
    };
  }

  private async sendMusicRhythm(on: boolean): Promise<void> {
    const body = makeBody63(WIN60_FF1B_PROTOCOL.CMD.MUSIC_RHYTHM);
    body[4] = 0x02;
    body[5] = on ? 1 : 0;
    body[6] = on ? 1 : 0;
    await this.sendBody(body, `MusicRhythm ${on ? 'ON' : 'OFF'} (0x17)`);
  }

  private async sendLightCommand(opts: {
    mode: number;
    brightness: number; // 0..4
    speed: number;      // 0..4
    fg: RGB;
    bg: RGB;
    direction: number;  // 0..5
    fullColor: boolean;
    powerOn: boolean;
  }): Promise<void> {
    if (opts.mode !== 100) {
      await this.sendMusicRhythm(false);
      await sleep(5);
    }

    const body = makeBody63(WIN60_FF1B_PROTOCOL.CMD.LIGHT);
    body[4] = 0x0e;
    body[5] = opts.mode & 0xff;
    body[6] = clamp(Math.round(opts.brightness), 0, WIN60_FF1B_PROTOCOL.LIGHT_MAX_LEVEL);
    body[7] = clamp(Math.round(opts.speed), 0, WIN60_FF1B_PROTOCOL.LIGHT_MAX_LEVEL);
    body[8] = clampByte(opts.fg.r);
    body[9] = clampByte(opts.fg.g);
    body[10] = clampByte(opts.fg.b);
    body[11] = clampByte(opts.bg.r);
    body[12] = clampByte(opts.bg.g);
    body[13] = clampByte(opts.bg.b);
    body[14] = clamp(opts.direction, 0, 5);
    body[15] = opts.fullColor ? 1 : 0;
    body[16] = opts.powerOn ? 0 : 1; // 0 = power ON, 1 = power OFF

    await this.sendBody(
      body,
      `Set Light (0x07): mode=${opts.mode} bri=${body[6]}/4 spd=${body[7]}/4 rgb=(${body[8]},${body[9]},${body[10]}) rainbow=${body[15]} on=${opts.powerOn}`
    );
  }

  async setLightingMode(_modeId: number, params: EffectParams): Promise<void> {
    if (!this.device || !this.device.opened) return;
    this.inCustomMode = false;
    this.hasPrimedAllPages = false;
    this.committedPages.fill(null);
    this.brightnessLevel = clamp(
      Math.round((params.brightness / 100) * WIN60_FF1B_PROTOCOL.LIGHT_MAX_LEVEL),
      0,
      WIN60_FF1B_PROTOCOL.LIGHT_MAX_LEVEL
    );
    this.speedLevel = clamp(params.speed - 1, 0, WIN60_FF1B_PROTOCOL.LIGHT_MAX_LEVEL);

    const hwMode = EFFECT_TO_FF1B_MODE[params.mode] ?? 0;
    await this.sendLightCommand({
      mode: hwMode,
      brightness: this.brightnessLevel,
      speed: this.speedLevel,
      fg: params.primaryColor,
      bg: params.secondaryColor,
      direction: DIR_TO_FF1B[params.direction] ?? 0,
      fullColor: params.colorMode === 'rainbow',
      powerOn: params.mode !== 'off' && params.brightness > 0,
    });
  }

  async setBrightness(level: number): Promise<void> {
    this.brightnessLevel = clamp(
      Math.round((level / 100) * WIN60_FF1B_PROTOCOL.LIGHT_MAX_LEVEL),
      0,
      WIN60_FF1B_PROTOCOL.LIGHT_MAX_LEVEL
    );
    if (this.inCustomMode && this.device?.opened) {
      await this.enterCustomMode();
    }
  }

  async setSpeed(level: number): Promise<void> {
    this.speedLevel = clamp(Math.round(level) - 1, 0, WIN60_FF1B_PROTOCOL.LIGHT_MAX_LEVEL);
  }

  private async enterCustomMode(): Promise<void> {
    await this.sendLightCommand({
      mode: WIN60_FF1B_PROTOCOL.MODE_CUSTOM, // mode 10 = Custom Per-Key RGB
      brightness: Math.max(1, this.brightnessLevel),
      speed: WIN60_FF1B_PROTOCOL.LIGHT_MAX_LEVEL,
      fg: { r: 255, g: 255, b: 255 },
      bg: { r: 0, g: 0, b: 0 },
      direction: 0,
      fullColor: false,
      powerOn: true,
    });
    await sleep(6);
    this.inCustomMode = true;
  }

  /**
   * Builds the verified 396-byte (132 matrix slots × 3 RGB888) flat table
   * and splits into 8 paged 63-byte bodies (54 bytes/page, cmd 0x09, big-endian page index).
   */
  encodeCustomLightPages(
    colors: RGB[],
    ledIndexMap?: number[],
    slot = 0
  ): Uint8Array<ArrayBuffer>[] {
    const flat = this.flatBuf;
    flat.fill(0);

    for (let i = 0; i < TOTAL_KEYS; i++) {
      const c = colors[i];
      if (!c) continue;
      // If user calibrated a custom index (different from default 0..60), remap logical key first
      const mappedKeyIdx = ledIndexMap ? clamp(ledIndexMap[i] ?? i, 0, TOTAL_KEYS - 1) : i;
      const keyDef = WIN60HE_KEYS[mappedKeyIdx];
      const matrixSlot = keyDef ? WIN60HE_MATRIX_SLOT_BY_ID[keyDef.id] : undefined;
      if (matrixSlot === undefined || matrixSlot < 0 || matrixSlot >= WIN60_FF1B_PROTOCOL.MATRIX_SLOTS) {
        continue;
      }
      const off = matrixSlot * 3;
      flat[off] = clampByte(c.r);
      flat[off + 1] = clampByte(c.g);
      flat[off + 2] = clampByte(c.b);
    }

    const pages: Uint8Array<ArrayBuffer>[] = [];
    const stride = WIN60_FF1B_PROTOCOL.CUSTOM_LIGHT_CHUNK; // 54
    const totalPages = Math.ceil(flat.length / stride); // 8 pages

    for (let page = 0; page < totalPages; page++) {
      const start = page * stride;
      const len = Math.min(stride, flat.length - start);
      const body = makeBody63(WIN60_FF1B_PROTOCOL.CMD.CUSTOM_LIGHT);
      body[1] = slot & 0x01;
      body[2] = (page >> 8) & 0xff; // big-endian u16 page index
      body[3] = page & 0xff;
      body[4] = len & 0xff;
      body.set(flat.subarray(start, start + len), 5);
      pages.push(body);
    }

    return pages;
  }

  private pagesEqual(a: Uint8Array, b: Uint8Array): boolean {
    if (a.length !== b.length) return false;
    const payloadLen = b[4] ?? 54;
    const end = Math.min(a.length, 5 + payloadLen);
    for (let i = 5; i < end; i++) {
      if (a[i] !== b[i]) return false;
    }
    return true;
  }

  /**
   * Sends a single cmd 0x09 page sequentially and paces against the keyboard MCU's
   * own 0x09 inputreport ACK (~1-2ms on USB) so we NEVER overflow the AT32 HID RX FIFO
   * or drop rows during fast animations. Auto-falls back if firmware doesn't echo ACKs.
   */
  private async sendPageSequentially(pageBody: Uint8Array<ArrayBuffer>): Promise<void> {
    if (!this.device || !this.device.opened) return;
    assertSafeLedPacket(pageBody, 0);

    if (this.ackSupported === false) {
      await this.device.sendReport(this.reportId, pageBody);
      return;
    }

    let timerId: ReturnType<typeof setTimeout> | null = null;
    const ackPromise = new Promise<boolean>((resolve) => {
      this.ackResolver = (gotAck: boolean) => {
        if (timerId !== null) {
          clearTimeout(timerId);
          timerId = null;
        }
        resolve(gotAck);
      };
      timerId = setTimeout(() => {
        timerId = null;
        if (this.ackResolver) {
          this.ackResolver = null;
          resolve(false);
        }
      }, 10);
    });

    try {
      await this.device.sendReport(this.reportId, pageBody);
      const gotAck = await ackPromise;
      if (gotAck) {
        this.ackSupported = true;
        this.consecutiveAckTimeouts = 0;
      } else {
        this.consecutiveAckTimeouts++;
        if (this.ackSupported === null && this.consecutiveAckTimeouts >= 6) {
          this.ackSupported = false;
        }
      }
    } catch (err) {
      if (timerId !== null) clearTimeout(timerId);
      this.ackResolver = null;
      throw err;
    }
  }

  async sendPerKeyFrame(colors: RGB[], ledIndexMap?: number[]): Promise<void> {
    if (!this.device || !this.device.opened) return;
    this.lastColors = colors;

    // Must enter hardware Custom Mode (mode=10) before 0x09 per-key colors become visible
    if (!this.inCustomMode) {
      await this.enterCustomMode();
    }

    const pages = this.encodeCustomLightPages(colors, ledIndexMap, 0);
    const logThis = this.frameCounter % 90 === 0;
    this.frameCounter++;

    // On first frame after entering Custom Mode, prime all 8 pages (0..7) so unused slots are zeroed.
    // On subsequent frames, only Pages 1..6 contain the 61 physical keys (slots 22..122).
    const startPage = this.hasPrimedAllPages ? 1 : 0;
    const endPage = this.hasPrimedAllPages ? 6 : 7;

    let sentCount = 0;
    let firstSentPage: Uint8Array<ArrayBuffer> | null = null;

    for (let p = startPage; p <= endPage; p++) {
      const committed = this.committedPages[p];
      if (!committed || !this.pagesEqual(committed, pages[p])) {
        await this.sendPageSequentially(pages[p]);
        // Only mark page as committed AFTER successful USB write!
        this.committedPages[p] = pages[p];
        if (!firstSentPage) firstSentPage = pages[p];
        sentCount++;
      }
    }

    if (!this.hasPrimedAllPages) {
      this.hasPrimedAllPages = true;
    }

    if (sentCount > 0 && logThis && firstSentPage) {
      this.context?.logTraffic(
        'tx',
        this.reportId,
        firstSentPage,
        `Stream #${this.frameCounter}: ${sentCount}/${endPage - startPage + 1} pages (ACK=${this.ackSupported ? 'ON' : 'OFF'})`
      );
    }
  }

  async forcePushFullFrame(colors: RGB[], ledIndexMap?: number[]): Promise<void> {
    this.inCustomMode = false;
    this.hasPrimedAllPages = false;
    this.committedPages.fill(null);
    await this.enterCustomMode();
    const pages = this.encodeCustomLightPages(colors, ledIndexMap, 0);
    for (let p = 0; p < pages.length; p++) {
      await this.sendPageSequentially(pages[p]);
      this.committedPages[p] = pages[p];
      this.context?.logTraffic(
        'tx',
        this.reportId,
        pages[p],
        `Force Push Custom RGB (0x09) page ${p + 1}/${pages.length}`
      );
    }
    this.hasPrimedAllPages = true;
    this.lastColors = colors;
  }

  async saveToOnboardMemory(): Promise<void> {
    if (!this.device || !this.device.opened) return;
    const colors =
      this.lastColors ??
      new Array<RGB>(TOTAL_KEYS).fill({ r: 6, g: 182, b: 212 });
    await this.forcePushFullFrame(colors);
    this.context?.logTraffic(
      'info',
      this.reportId,
      null,
      'Saved 396B custom per-key RGB palette to WIN60 HE onboard Custom Slot 0 (mode=10)'
    );
  }

  async resetLighting(): Promise<void> {
    if (!this.device || !this.device.opened) return;
    this.inCustomMode = false;
    this.hasPrimedAllPages = false;
    this.committedPages.fill(null);
    await this.sendLightCommand({
      mode: 2, // Factory Wave Rainbow
      brightness: WIN60_FF1B_PROTOCOL.LIGHT_MAX_LEVEL,
      speed: 2,
      fg: { r: 255, g: 255, b: 255 },
      bg: { r: 0, g: 0, b: 0 },
      direction: 0,
      fullColor: true,
      powerOn: true,
    });
  }

  async disconnect(): Promise<void> {
    if (this.device && typeof this.device.removeEventListener === 'function') {
      this.device.removeEventListener('inputreport', this.onInputReport);
    }
    if (this.ackResolver) {
      const resolve = this.ackResolver;
      this.ackResolver = null;
      resolve(false);
    }
    this.inCustomMode = false;
    this.hasPrimedAllPages = false;
    this.committedPages.fill(null);
    this.device = null;
    this.context = null;
  }
}
