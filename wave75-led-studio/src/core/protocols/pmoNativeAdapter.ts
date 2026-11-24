import {
  WAVE75_GAP_LIGHT_INDEX,
  WAVE75_KEY_COUNT,
  WAVE75_ONBOARD_SLOTS,
  WAVE75_SYNC_LED_SLOTS,
  logicalKeyToDefaultLightIndex,
} from '../layout/wave75Layout';
import { BLACK, RGB, clamp, clampByte, rgbToRgb565LE } from '../utils/color';
import {
  AdapterContext,
  FlashSaveResult,
  KeyboardLightingAdapter,
  LogoSettings,
  NativeHardwarePresetConfig,
  QmkLightingState,
  WaveCapabilities,
  assertSafeWavePacket,
} from './types';
import { bytesToHex } from '../hid/usbDiagnostics';

/**
 * Official 20 built-in hardware lighting modes for PMO WAVE75 (verified from pmohub.cn kb-wave75 config).
 * Saved directly to MCU Flash via SET_FUNC_INFO (0x15) + STOP_COMM (0x11) — runs forever with app closed!
 */
export const WAVE75_NATIVE_HARDWARE_MODES: Array<{
  id: number;
  nameVi: string;
  nameEn: string;
  supportsColor: boolean;
}> = [
  { id: 1, nameVi: '01 • Sóng cầu vồng (Flowing Rainbow)', nameEn: '01 • Flowing Rainbow', supportsColor: true },
  { id: 2, nameVi: '02 • Sắc màu luân chuyển (Spectrum)', nameEn: '02 • Colorful Spectrum', supportsColor: false },
  { id: 3, nameVi: '03 • Nhịp thở (Breathing)', nameEn: '03 • Breathing', supportsColor: true },
  { id: 4, nameVi: '04 • Sáng tĩnh 1 màu (Static Solid)', nameEn: '04 • Static Solid', supportsColor: true },
  { id: 5, nameVi: '05 • Gõ đâu sáng đó (Reactive Fade)', nameEn: '05 • Reactive Fade', supportsColor: true },
  { id: 6, nameVi: '06 • Gợn sóng lan tỏa (Ripple)', nameEn: '06 • Reactive Ripple', supportsColor: false },
  { id: 7, nameVi: '07 • Vòng xoáy (Rotating Vortex)', nameEn: '07 • Rotating Vortex', supportsColor: true },
  { id: 8, nameVi: '08 • Sao băng (Meteor Shower)', nameEn: '08 • Meteor Shower', supportsColor: true },
  { id: 9, nameVi: '09 • Rồng bay (Dragon Leap)', nameEn: '09 • Dragon Leap', supportsColor: true },
  { id: 10, nameVi: '10 • Suối phun (Fountain Stream)', nameEn: '10 • Fountain Stream', supportsColor: true },
  { id: 11, nameVi: '11 • Cánh chim lan rộng (Spread)', nameEn: '11 • Spreading Wings', supportsColor: true },
  { id: 12, nameVi: '12 • Hoa nở rực rỡ (Blooming)', nameEn: '12 • Blooming Flowers', supportsColor: false },
  { id: 13, nameVi: '13 • Mưa rơi (Falling Rain)', nameEn: '13 • Falling Rain', supportsColor: true },
  { id: 14, nameVi: '14 • Bùng nổ phím bấm (Trigger Burst)', nameEn: '14 • Trigger Burst', supportsColor: true },
  { id: 15, nameVi: '15 • Quét ngang (Sweeping Wave)', nameEn: '15 • Sweeping Wave', supportsColor: true },
  { id: 16, nameVi: '16 • Thu phóng (Expand & Gather)', nameEn: '16 • Expand & Gather', supportsColor: true },
  { id: 17, nameVi: '17 • Song long (Twin Dragons)', nameEn: '17 • Twin Dragons', supportsColor: true },
  { id: 18, nameVi: '18 • Giao cắt ngang dọc (Cross Grid)', nameEn: '18 • Cross Grid', supportsColor: true },
  { id: 19, nameVi: '19 • Hai nguồn sáng (Dual Fountain)', nameEn: '19 • Dual Fountain', supportsColor: true },
  { id: 20, nameVi: '20 • Giọt nước (Water Drop)', nameEn: '20 • Water Drop', supportsColor: true },
];

/**
 * PMO WAVE75 — RDR vendor protocol (stock firmware), VID 0x36B0 / PID 0x3009, interface MI_01.
 *
 * Frame layout follows the reference implementation verified on real WAVE75 hardware
 * (hogancv/pmo-keyboard-light-playground):
 *
 *   sendReport(reportId, payload[64])
 *   payload[0] = 0xAA (magic)
 *   payload[1] = cmd
 *   payload[2..3] = offset (LE)
 *   payload[4] = len
 *   payload[5..7] = 0
 *   payload[8..63] = data (max 56 bytes)
 *
 * Reply: payload[0] = 0xAA, payload[1] = cmd, payload[7] = status (0x55 OK / 0x0F rejected),
 * data from payload[8].
 *
 * Live per-key colours only show after the lighting parameter table ("funcInfo", 64 bytes)
 * is switched to lightMode = 253 and committed with STOP_COMM.
 */
export const PMO_NATIVE_PROTOCOL = {
  VENDOR_ID: 0x36b0,
  PRODUCT_ID: 0x3009,
  MAGIC: 0xaa,
  PAYLOAD_SIZE: 64,
  HEADER_SIZE: 8,
  CHUNK: 56,
  SYNC_LED_COUNT: WAVE75_SYNC_LED_SLOTS, // 82
  SYNC_FRAME_BYTES: WAVE75_SYNC_LED_SLOTS * 2, // 164 -> 56 + 56 + 52
  ONBOARD_SLOT_BYTES: WAVE75_ONBOARD_SLOTS * 3, // 384
  FUNC_INFO_BYTES: 64,
  CUSTOM_LIGHT_MODE: 253,
  STATUS_INDEX: 7,
  STATUS_OK: 0x55,
  STATUS_REJECTED: 0x0f,
  // Offsets inside 64-byte funcInfo (verified from official pmohub.cn kb-wave75 protocol)
  FUNC: {
    LIGHT_SWITCH: 1,       // 0 = on, 1 = off
    LIGHT_MODE: 2,         // 1..20 native hardware presets, 253 = Custom Slot / Live Sync
    BRIGHTNESS: 3,         // 0..maxBright (160)
    SPEED_REV: 4,          // maxSpeed - speed
    MIX_COLOR: 5,          // 0 = solid RGB, 1 = rainbow / colorful
    COLOR_INDEX: 6,        // 0..7
    R_VALUE: 7,
    G_VALUE: 8,
    B_VALUE: 9,
    CUSTOM_INDEX: 10,      // 0..4 -> custom slot 1..5
    // CNC Wave Logo LED registers (f[11..19]) — persisted in keyboard Flash on STOP_COMM
    LOGO_SWITCH: 11,       // 0 = on, 1 = off
    LOGO_MODE: 12,         // 1 = Flowing Rainbow, 2 = Colorful, 3 = Breathing, 4 = Static Solid
    LOGO_BRIGHTNESS: 13,   // 0..logoMaxBright (160)
    LOGO_SPEED_REV: 14,    // logoMaxSpeed - speed
    LOGO_MIX_COLOR: 15,    // 0 = solid RGB, 1 = rainbow / colorful
    LOGO_COLOR_INDEX: 16,  // 0..7
    LOGO_R_VALUE: 17,
    LOGO_G_VALUE: 18,
    LOGO_B_VALUE: 19,
  },
  CMD: {
    START_COMM: 0x10,
    STOP_COMM: 0x11,
    GET_DEVICE_INFO: 0x12,
    GET_FUNC_INFO: 0x14,
    SET_FUNC_INFO: 0x15,
    SET_LIGHT_SYNC: 0x2e,
    CLOSE_LIGHT_SYNC: 0x2f,
    GET_LIGHT_MATRIX: 0x32,
    GET_CURRENT_RGB: 0x34,
  },
  SLOT_READ: [0x22, 0x24, 0x26, 0x28, 0x2a],
  SLOT_WRITE: [0x23, 0x25, 0x27, 0x29, 0x2b],
} as const;

const P = PMO_NATIVE_PROTOCOL;

interface Reply {
  status: number;
  base: number;
  frame: Uint8Array;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function hex2(n: number): string {
  return `0x${n.toString(16).toUpperCase().padStart(2, '0')}`;
}

function parseReply(r: Uint8Array): Reply {
  if (r[0] === P.MAGIC) return { status: r[7], base: 8, frame: r };
  if (r[1] === P.MAGIC) return { status: r[8], base: 9, frame: r };
  return { status: -1, base: 0, frame: r };
}

/** Largest output report from the HID descriptor; 65 bytes (incl. report ID) -> 64-byte payload. */
function readOutputReportInfo(device: HIDDevice): { reportId: number; payload: number } {
  let best: { reportId: number; bytes: number } | null = null;
  for (const c of device.collections ?? []) {
    for (const r of c.outputReports ?? []) {
      let bytes = 0;
      for (const it of r.items ?? []) {
        bytes += Math.ceil(((it.reportSize ?? 0) * (it.reportCount ?? 0)) / 8);
      }
      if (!best || bytes > best.bytes) best = { reportId: r.reportId ?? 0, bytes };
    }
  }
  if (!best) return { reportId: 0, payload: P.PAYLOAD_SIZE };
  let payload = best.bytes === 65 ? 64 : best.bytes;
  if (payload < 32) payload = P.PAYLOAD_SIZE;
  return { reportId: best.reportId, payload };
}

export class PmoNativeAdapter implements KeyboardLightingAdapter {
  readonly transportMode = 'pmo_native' as const;
  readonly displayName = 'PMO WAVE75 RDR (0x36B0:0x3009)';

  private device: HIDDevice | null = null;
  private context: AdapterContext | null = null;
  private reportId = 0;
  private payloadSize: number = P.PAYLOAD_SIZE;

  private rx: Uint8Array[] = [];
  private rxListener: ((ev: Event) => void) | null = null;
  private logRx = false;

  private lockChain: Promise<void> = Promise.resolve();
  private locked = false;

  private armed = false;
  private handedBack = false;
  private maxBright = 160;
  private maxSpeed = 4;
  private logoMaxBright = 160;
  private logoMaxSpeed = 4;
  private original: { mode: number; lightSwitch: number; customIndex: number } | null = null;
  private frameCounter = 0;

  // ---------------------------------------------------------------- binding / IO

  private bind(device: HIDDevice, context: AdapterContext): void {
    this.context = context;
    if (this.device === device && this.rxListener) return;
    this.unbind();
    this.device = device;
    const info = readOutputReportInfo(device);
    this.reportId = info.reportId;
    this.payloadSize = info.payload;
    this.rxListener = (ev: Event) => {
      const e = ev as HIDInputReportEvent;
      const u = new Uint8Array(e.data.buffer.slice(e.data.byteOffset, e.data.byteOffset + e.data.byteLength));
      this.rx.push(u);
      if (this.rx.length > 64) this.rx.shift();
      if (this.logRx) {
        const p = parseReply(u);
        const tag =
          p.status === P.STATUS_OK
            ? ('0x55 OK' as const)
            : p.status === P.STATUS_REJECTED
              ? ('0x0F REJECTED' as const)
              : undefined;
        this.context?.logTraffic(
          p.status === P.STATUS_REJECTED ? 'warn' : 'rx',
          hex2(u[0] === P.MAGIC ? u[1] : u[2] ?? 0),
          u,
          tag ? `Reply (${tag})` : 'Input report',
          tag
        );
      }
    };
    device.addEventListener('inputreport', this.rxListener);
    this.rx = [];
  }

  private unbind(): void {
    if (this.device && this.rxListener) {
      try {
        this.device.removeEventListener('inputreport', this.rxListener);
      } catch {
        // ignore
      }
    }
    this.rxListener = null;
    this.rx = [];
  }

  private build(cmd: number, offset: number, len: number, data?: Uint8Array | number[]): Uint8Array<ArrayBuffer> {
    assertSafeWavePacket(cmd);
    const b = new Uint8Array(new ArrayBuffer(this.payloadSize));
    b[0] = P.MAGIC;
    b[1] = cmd & 0xff;
    b[2] = offset & 0xff;
    b[3] = (offset >> 8) & 0xff;
    b[4] = len & 0xff;
    if (data) {
      for (let i = 0; i < len && i < data.length && 8 + i < b.length; i++) {
        b[8 + i] = data[i] & 0xff;
      }
    }
    return b;
  }

  private async rawSend(
    cmd: number,
    offset: number,
    len: number,
    data: Uint8Array | number[] | undefined,
    summary: string | null
  ): Promise<void> {
    if (!this.device || !this.device.opened) throw new Error('WAVE75 HID device is not open.');
    const pkt = this.build(cmd, offset, len, data);
    await this.device.sendReport(this.reportId, pkt);
    if (summary !== null) this.context?.logTraffic('tx', hex2(cmd), pkt, summary);
  }

  private drain(): void {
    this.rx.length = 0;
  }

  private waitInput(timeoutMs: number): Promise<Uint8Array> {
    const deadline = performance.now() + timeoutMs;
    return new Promise((resolve, reject) => {
      const iv = window.setInterval(() => {
        if (this.rx.length) {
          window.clearInterval(iv);
          resolve(this.rx.shift()!);
        } else if (performance.now() > deadline) {
          window.clearInterval(iv);
          reject(new Error('timeout'));
        }
      }, 4);
    });
  }

  /** Send a command and wait for the reply that belongs to it. Returns null on timeout. */
  private async request(
    cmd: number,
    offset: number,
    len: number,
    data: Uint8Array | number[] | undefined,
    timeoutMs: number,
    summary: string
  ): Promise<Reply | null> {
    this.drain();
    this.logRx = true;
    try {
      await this.rawSend(cmd, offset, len, data, summary);
      const deadline = performance.now() + timeoutMs;
      while (performance.now() < deadline) {
        let cand: Uint8Array;
        try {
          cand = await this.waitInput(Math.max(50, deadline - performance.now()));
        } catch {
          break;
        }
        if (cand[0] === P.MAGIC && cand[1] === cmd) return parseReply(cand);
        if (cand[1] === P.MAGIC && cand[2] === cmd) return parseReply(cand);
        // reply to some other command (e.g. a streamed 0x2E) — keep waiting
      }
      this.context?.logTraffic('warn', hex2(cmd), null, `${summary} — no matching reply (timeout)`);
      return null;
    } finally {
      this.logRx = false;
    }
  }

  private requireOk(r: Reply | null, what: string): Reply {
    if (!r) throw new Error(`${what}: bàn phím không phản hồi (timeout).`);
    if (r.status !== P.STATUS_OK) {
      throw new Error(`${what}: firmware từ chối (status ${hex2(r.status & 0xff)}).`);
    }
    return r;
  }

  private async readChunked(cmd: number, total: number, waitMs: number, label: string): Promise<number[]> {
    const out: number[] = [];
    let miss = 0;
    while (out.length < total && miss < 4) {
      const off = out.length;
      const n = Math.min(P.CHUNK, total - off);
      const r = await this.request(cmd, off, n, undefined, waitMs, `${label} @${off}`);
      if (!r || r.status === P.STATUS_REJECTED) {
        miss++;
        await sleep(40);
        continue;
      }
      for (let i = 0; i < n; i++) out.push(r.frame[r.base + i] ?? 0);
      miss = 0;
    }
    return out;
  }

  private async withLock<T>(fn: () => Promise<T>): Promise<T> {
    const prev = this.lockChain;
    let release!: () => void;
    this.lockChain = new Promise<void>((r) => (release = r));
    await prev;
    this.locked = true;
    try {
      return await fn();
    } finally {
      this.locked = false;
      release();
    }
  }

  // ---------------------------------------------------------------- funcInfo helpers

  private async readFuncInfo(): Promise<number[] | null> {
    const f = await this.readChunked(P.CMD.GET_FUNC_INFO, P.FUNC_INFO_BYTES, 800, 'GET_FUNC_INFO (0x14)');
    return f.length >= P.FUNC_INFO_BYTES ? f : null;
  }

  private async writeFuncInfo(f: number[]): Promise<number[]> {
    const res: number[] = [];
    for (let off = 0; off < f.length; off += P.CHUNK) {
      const n = Math.min(P.CHUNK, f.length - off);
      const r = await this.request(
        P.CMD.SET_FUNC_INFO,
        off,
        n,
        f.slice(off, off + n),
        1200,
        `SET_FUNC_INFO (0x15) @${off}`
      );
      res.push(r ? r.status : -1);
      await sleep(15);
    }
    return res;
  }

  /** Firmware only applies the parameter table after STOP_COMM; reopen the session afterwards. */
  private async commitSession(): Promise<void> {
    await this.request(P.CMD.STOP_COMM, 0, 0, undefined, 700, 'STOP_COMM (0x11) — commit');
    await sleep(80);
    await this.request(P.CMD.START_COMM, 0, 0, undefined, 900, 'START_COMM (0x10)');
    await sleep(60);
  }

  private async readDeviceInfoRaw(): Promise<number[] | null> {
    const d = await this.readChunked(P.CMD.GET_DEVICE_INFO, 56, 800, 'GET_DEVICE_INFO (0x12)');
    if (d.length < 24) return null;
    if (d[16]) this.maxBright = Math.min(255, d[16]);
    if (d[17]) this.maxSpeed = clamp(d[17], 1, 10);
    // Official pmohub.cn wave75LogoRemap: keyboardType=103 reads logoMaxBright from d[31], fallback d[21] || 160
    const isWave75Type = d[11] === 103 || (d[4] | (d[5] << 8)) === P.PRODUCT_ID;
    const rawLogoBright = isWave75Type ? (d[31] || d[21]) : d[21];
    if (rawLogoBright) this.logoMaxBright = Math.min(255, rawLogoBright);
    if (d[22]) this.logoMaxSpeed = clamp(d[22], 1, 10);
    return d;
  }

  /** Maps UI LogoSettings onto official pmohub.cn funcInfo[11..19] bytes. */
  private writeLogoToFuncInfo(f: number[], settings: LogoSettings): void {
    const isOff = settings.effect === 'off' || settings.brightness <= 0;
    const modeMap: Record<LogoSettings['effect'], number> = {
      rainbow: 1,    // 1 = 流光溢彩 (Flowing Rainbow)
      neon_pulse: 2, // 2 = 五彩缤纷 (Colorful Spectrum)
      breathing: 3,  // 3 = 呼吸 (Breathing)
      static: 4,     // 4 = 常亮 (Static Solid)
      off: 4,
    };
    const bri = clamp(Math.round((settings.brightness / 100) * this.logoMaxBright), 0, this.logoMaxBright);
    const spd = clamp(Math.round(((settings.speed - 1) / 4) * this.logoMaxSpeed), 0, this.logoMaxSpeed);
    const rainbow = settings.effect === 'rainbow' || settings.effect === 'neon_pulse';

    f[P.FUNC.LOGO_SWITCH] = isOff ? 1 : 0; // 0 = ON, 1 = OFF
    f[P.FUNC.LOGO_MODE] = modeMap[settings.effect] ?? 4;
    f[P.FUNC.LOGO_BRIGHTNESS] = isOff ? 0 : Math.max(10, bri);
    f[P.FUNC.LOGO_SPEED_REV] = clamp(this.logoMaxSpeed - spd, 0, this.logoMaxSpeed);
    f[P.FUNC.LOGO_MIX_COLOR] = rainbow ? 1 : 0;
    f[P.FUNC.LOGO_COLOR_INDEX] = 0;
    f[P.FUNC.LOGO_R_VALUE] = clampByte(settings.color.r);
    f[P.FUNC.LOGO_G_VALUE] = clampByte(settings.color.g);
    f[P.FUNC.LOGO_B_VALUE] = clampByte(settings.color.b);
  }

  // ---------------------------------------------------------------- public: probing / arming

  /**
   * Checks whether this HID interface is the RDR vendor channel (answers START + GET_DEVICE_INFO
   * with an 0xAA frame). The device must already be open.
   */
  async probe(device: HIDDevice, context: AdapterContext): Promise<boolean> {
    this.bind(device, context);
    try {
      this.drain();
      await this.rawSend(P.CMD.START_COMM, 0, 0, undefined, 'Probe: START_COMM (0x10)');
      await sleep(100);
      this.drain();
      await this.rawSend(P.CMD.GET_DEVICE_INFO, 0, 32, undefined, 'Probe: GET_DEVICE_INFO (0x12)');
      const r = await this.waitInput(700);
      const ok = r[0] === P.MAGIC || r[1] === P.MAGIC;
      context.logTraffic(
        ok ? 'info' : 'warn',
        '0x12',
        r,
        ok ? 'Probe OK — RDR vendor interface found' : 'Probe: reply without 0xAA — not the lighting interface'
      );
      return ok;
    } catch (e) {
      context.logTraffic(
        'warn',
        '0x10',
        null,
        `Probe failed on this interface (${e instanceof Error ? e.message : String(e)})`
      );
      return false;
    }
  }

  async connect(device: HIDDevice, context: AdapterContext): Promise<WaveCapabilities> {
    this.bind(device, context);
    this.handedBack = false;
    const applied = await this.withLock(() => this.arm());
    context.logTraffic(
      applied ? 'info' : 'warn',
      '0x15',
      null,
      applied
        ? 'Live lighting channel enabled (lightMode=253). Per-key frames now show on the keyboard.'
        : 'lightMode read-back did not confirm 253 — frames may not display. Check diagnostics.'
    );
    return {
      supportsPerKeySync: true,
      supportsOnboardSlots: true,
      supportsQmkLighting: false,
      logoOnly: false,
      maxSafeFps: 30,
      slotCount: 5,
      protocolName: 'PMO RDR (0xAA frames · 0x2E RGB565 · 0x23 RGB888)',
    };
  }

  /** Switch the parameter table to lightMode 253 so 0x2E frames are rendered. */
  private async arm(): Promise<boolean> {
    const started = await this.request(P.CMD.START_COMM, 0, 0, undefined, 900, 'START_COMM (0x10)');
    if (!started) {
      throw new Error(
        'Bàn phím không phản hồi trên giao diện HID này. Hãy bấm Kết nối lại và chọn mục cùng tên khác trong hộp thoại, đồng thời tắt pmohub.cn / PMO Hub / SignalRGB.'
      );
    }

    await this.readDeviceInfoRaw();

    const f = await this.readFuncInfo();
    if (!f) {
      throw new Error(
        'Không đọc được bảng tham số đèn (0x14). Hãy chắc chắn PMO Hub / pmohub.cn không đang giữ bàn phím rồi thử lại.'
      );
    }

    if (this.original === null) {
      this.original = {
        mode: f[P.FUNC.LIGHT_MODE],
        lightSwitch: f[P.FUNC.LIGHT_SWITCH],
        customIndex: f[P.FUNC.CUSTOM_INDEX],
      };
    }

    f[P.FUNC.LIGHT_SWITCH] = 0;
    f[P.FUNC.LIGHT_MODE] = P.CUSTOM_LIGHT_MODE;
    f[P.FUNC.CUSTOM_INDEX] = clamp(f[P.FUNC.CUSTOM_INDEX] | 0, 0, 4);
    if (!f[P.FUNC.BRIGHTNESS]) f[P.FUNC.BRIGHTNESS] = this.maxBright;
    // Ensure CNC Wave Logo LED is switched ON when arming if it was previously turned off or 0 brightness
    if (f[P.FUNC.LOGO_SWITCH] === 1 || !f[P.FUNC.LOGO_BRIGHTNESS]) {
      f[P.FUNC.LOGO_SWITCH] = 0;
      if (!f[P.FUNC.LOGO_MODE]) f[P.FUNC.LOGO_MODE] = 1; // Flowing Rainbow default
      f[P.FUNC.LOGO_BRIGHTNESS] = Math.min(this.logoMaxBright, 140);
    }

    await this.writeFuncInfo(f);
    await this.commitSession();

    const chk = await this.readFuncInfo();
    const applied = !!chk && chk[P.FUNC.LIGHT_MODE] === P.CUSTOM_LIGHT_MODE;
    this.armed = true;
    this.frameCounter = 0;
    return applied;
  }

  private async restoreOriginalMode(): Promise<void> {
    if (!this.original) return;
    const f = await this.readFuncInfo();
    if (f && f[P.FUNC.LIGHT_MODE] === P.CUSTOM_LIGHT_MODE) {
      f[P.FUNC.LIGHT_MODE] = this.original.mode;
      if (this.original.lightSwitch === 1) f[P.FUNC.LIGHT_SWITCH] = 1;
      f[P.FUNC.CUSTOM_INDEX] = this.original.customIndex;
      await this.writeFuncInfo(f);
      await this.commitSession();
      this.context?.logTraffic('info', '0x15', null, `Restored original lightMode=${this.original.mode}`);
    }
    this.original = null;
  }

  /** Point lightMode=253 at custom slot `slotIdx` (0..4) and optionally persist CNC Logo LED color. */
  private async enterSlotMode(slotIdx: number, logoColor?: RGB): Promise<boolean> {
    const want = clamp(slotIdx | 0, 0, 4);
    const started = await this.request(P.CMD.START_COMM, 0, 0, undefined, 900, 'START_COMM (0x10)');
    if (!started || started.status !== P.STATUS_OK) return false;
    const f = await this.readFuncInfo();
    if (!f) return false;
    f[P.FUNC.LIGHT_SWITCH] = 0;
    f[P.FUNC.LIGHT_MODE] = P.CUSTOM_LIGHT_MODE;
    f[P.FUNC.CUSTOM_INDEX] = want;
    f[P.FUNC.BRIGHTNESS] = f[P.FUNC.BRIGHTNESS] || this.maxBright;
    if (logoColor) {
      const lit = logoColor.r > 2 || logoColor.g > 2 || logoColor.b > 2;
      this.writeLogoToFuncInfo(f, {
        color: logoColor,
        brightness: lit ? 100 : 0,
        speed: 3,
        saturation: 100,
        effect: lit ? 'static' : 'off',
      });
    }
    const written = await this.writeFuncInfo(f);
    await this.commitSession();
    const chk = await this.readFuncInfo();
    const ok =
      written.every((s) => s === P.STATUS_OK) &&
      !!chk &&
      chk[P.FUNC.LIGHT_MODE] === P.CUSTOM_LIGHT_MODE &&
      (chk[P.FUNC.CUSTOM_INDEX] | 0) === want;
    if (ok) this.armed = true;
    return ok;
  }

  // ---------------------------------------------------------------- encoding

  /** 82 sync slots × RGB565 LE = 164 bytes. Slot #46 has no LED and stays 0x0000. */
  encodeSyncFrame164(keyColors: RGB[], lightIndexMap?: number[]): Uint8Array {
    const buffer = new Uint8Array(P.SYNC_FRAME_BYTES);
    for (let keyIdx = 0; keyIdx < WAVE75_KEY_COUNT; keyIdx++) {
      const li = lightIndexMap ? lightIndexMap[keyIdx] : logicalKeyToDefaultLightIndex(keyIdx);
      if (li === WAVE75_GAP_LIGHT_INDEX || li < 0 || li >= P.SYNC_LED_COUNT) continue;
      const [lo, hi] = rgbToRgb565LE(keyColors[keyIdx] ?? BLACK);
      buffer[li * 2] = lo;
      buffer[li * 2 + 1] = hi;
    }
    return buffer;
  }

  /** 128 entries × RGB888 = 384 bytes, indexed directly by lightIndex. */
  encodeOnboard384(keyColors: RGB[], lightIndexMap?: number[]): Uint8Array {
    const buffer = new Uint8Array(P.ONBOARD_SLOT_BYTES);
    for (let keyIdx = 0; keyIdx < WAVE75_KEY_COUNT; keyIdx++) {
      const li = lightIndexMap ? lightIndexMap[keyIdx] : logicalKeyToDefaultLightIndex(keyIdx);
      if (li === WAVE75_GAP_LIGHT_INDEX || li < 0 || li >= WAVE75_ONBOARD_SLOTS) continue;
      const c = keyColors[keyIdx] ?? BLACK;
      buffer[li * 3] = clampByte(c.r);
      buffer[li * 3 + 1] = clampByte(c.g);
      buffer[li * 3 + 2] = clampByte(c.b);
    }
    return buffer;
  }

  decodeOnboard384(buffer: ArrayLike<number>, lightIndexMap?: number[]): RGB[] {
    const keys = new Array<RGB>(WAVE75_KEY_COUNT);
    for (let keyIdx = 0; keyIdx < WAVE75_KEY_COUNT; keyIdx++) {
      const li = lightIndexMap ? lightIndexMap[keyIdx] : logicalKeyToDefaultLightIndex(keyIdx);
      const off = li * 3;
      keys[keyIdx] =
        off >= 0 && off + 2 < buffer.length
          ? { r: buffer[off], g: buffer[off + 1], b: buffer[off + 2] }
          : { ...BLACK };
    }
    return keys;
  }

  // ---------------------------------------------------------------- KeyboardLightingAdapter

  async readDeviceInfo(): Promise<{ modelName: string; firmwareVersion?: string }> {
    return {
      modelName: this.device?.productName || 'PMO WAVE75',
      firmwareVersion: `RDR · maxBright ${this.maxBright}`,
    };
  }

  /** Live frame: 164 bytes in 3 reports (56 + 56 + 52). Skipped while another operation holds the channel. */
  async sendPerKeySyncFrame(keyColors: RGB[], _logoColor: RGB, lightIndexMap?: number[]): Promise<void> {
    if (!this.device || !this.device.opened || !this.armed || this.locked) return;
    await this.withLock(async () => {
      if (!this.armed) return;
      const frame = this.encodeSyncFrame164(keyColors, lightIndexMap);
      const logThis = this.frameCounter % 40 === 0;
      this.frameCounter++;
      for (let off = 0; off < frame.length; off += P.CHUNK) {
        const len = Math.min(P.CHUNK, frame.length - off);
        await this.rawSend(
          P.CMD.SET_LIGHT_SYNC,
          off,
          len,
          frame.subarray(off, off + len),
          logThis ? `SET_LIGHT_SYNC (0x2E) frame #${this.frameCounter} chunk @${off} (${len}B)` : null
        );
      }
      // Replies to 0x2E are not needed; keep the queue from growing.
      if (this.rx.length > 32) this.rx.splice(0, this.rx.length - 8);
    });
  }

  /** Re-arms live 0x2E sync channel (lightMode=253) after a standalone Flash preset was saved. */
  async ensureLiveArmed(): Promise<void> {
    if (!this.device || !this.device.opened || this.armed) return;
    await this.withLock(() => this.arm());
  }

  async readOnboardSlot(slot: number, lightIndexMap?: number[]): Promise<{ keys: RGB[]; logo: RGB }> {
    const idx = clamp(Math.round(slot), 1, 5) - 1;
    return this.withLock(async () => {
      await this.request(P.CMD.START_COMM, 0, 0, undefined, 900, 'START_COMM (0x10)');
      const data = await this.readChunked(
        P.SLOT_READ[idx],
        P.ONBOARD_SLOT_BYTES,
        900,
        `GET_USERLIGHT_${idx + 1} (${hex2(P.SLOT_READ[idx])})`
      );
      if (data.length !== P.ONBOARD_SLOT_BYTES) {
        throw new Error(
          `Không đọc được Khe ${idx + 1} (${data.length}/384 byte). Firmware WAVE75 có thể chỉ hỗ trợ Khe 1.`
        );
      }
      return { keys: this.decodeOnboard384(data, lightIndexMap), logo: { ...BLACK } };
    });
  }

  async selectOnboardSlot(slot: number): Promise<void> {
    const idx = clamp(Math.round(slot), 1, 5) - 1;
    const ok = await this.withLock(() => this.enterSlotMode(idx));
    if (!ok) throw new Error(`Không chuyển được sang Khe ${idx + 1} (firmware không xác nhận).`);
    // Keyboard now renders this slot; do not revert to the old animation on hand-back.
    this.original = null;
  }

  /**
   * Save sequence used by PMO Hub: CLOSE_LIGHT_SYNC → STOP → START → write 384B → STOP → START →
   * read back all 384 bytes → point lightMode=253 at the slot.
   */
  async saveOnboardSlotWithVerify(
    slot: number,
    keyColors: RGB[],
    logoColor: RGB,
    lightIndexMap?: number[]
  ): Promise<FlashSaveResult> {
    const idx = clamp(Math.round(slot), 1, 5) - 1;
    const writeOp = P.SLOT_WRITE[idx];
    const readOp = P.SLOT_READ[idx];
    const buf = this.encodeOnboard384(keyColors, lightIndexMap);

    return this.withLock(async () => {
      try {
        this.requireOk(
          await this.request(P.CMD.CLOSE_LIGHT_SYNC, 0, P.CHUNK, undefined, 700, 'CLOSE_LIGHT_SYNC (0x2F)'),
          'CLOSE_LIGHT_SYNC'
        );
        this.requireOk(
          await this.request(P.CMD.STOP_COMM, 0, P.CHUNK, undefined, 700, 'STOP_COMM (0x11)'),
          'STOP_COMM'
        );
        this.requireOk(
          await this.request(P.CMD.START_COMM, 0, 0, undefined, 900, 'START_COMM (0x10)'),
          'START_COMM'
        );

        for (let off = 0; off < P.ONBOARD_SLOT_BYTES; off += P.CHUNK) {
          const len = Math.min(P.CHUNK, P.ONBOARD_SLOT_BYTES - off);
          this.requireOk(
            await this.request(
              writeOp,
              off,
              len,
              buf.subarray(off, off + len),
              1000,
              `SET_USERLIGHT_${idx + 1} (${hex2(writeOp)}) @${off} (${len}B)`
            ),
            `Ghi Khe ${idx + 1} @${off}`
          );
          await sleep(12);
        }

        this.requireOk(await this.request(P.CMD.STOP_COMM, 0, 0, undefined, 700, 'STOP_COMM (0x11)'), 'STOP_COMM');
        this.requireOk(await this.request(P.CMD.START_COMM, 0, 0, undefined, 900, 'START_COMM (0x10)'), 'START_COMM');

        const saved = await this.readChunked(readOp, P.ONBOARD_SLOT_BYTES, 900, `VERIFY ${hex2(readOp)}`);
        let mismatch = saved.length === P.ONBOARD_SLOT_BYTES ? 0 : P.ONBOARD_SLOT_BYTES;
        if (!mismatch) {
          for (let i = 0; i < P.ONBOARD_SLOT_BYTES; i++) if (saved[i] !== buf[i]) mismatch++;
        }
        if (mismatch) {
          throw new Error(`Đọc ngược không khớp (${mismatch}/384 byte). Hãy lưu lại Khe ${idx + 1}.`);
        }

        if (!(await this.enterSlotMode(idx, logoColor))) {
          throw new Error(`Đã ghi nhưng firmware không xác nhận chuyển sang Khe ${idx + 1}.`);
        }
        // Keep the saved slot + CNC Logo LED as the keyboard's standalone lighting after closing the app.
        this.original = null;

        return {
          slot: idx + 1,
          verified: true,
          bytesWritten: P.ONBOARD_SLOT_BYTES,
          message: `Đã lưu & xác thực 384/384 byte + Đèn Logo CNC vào Khe ${idx + 1} (Flash). Tắt app/rút cáp vẫn giữ nguyên màu!`,
        };
      } catch (e) {
        // Leave the session usable for live frames again.
        try {
          await this.request(P.CMD.START_COMM, 0, 0, undefined, 700, 'START_COMM (0x10) — recover');
        } catch {
          // ignore
        }
        throw e;
      }
    });
  }

  async readHardwareMatrix(): Promise<number[]> {
    return this.withLock(() => this.readChunked(P.CMD.GET_LIGHT_MATRIX, 128, 800, 'GET_LIGHT_MATRIX (0x32)'));
  }

  async applyQmkLighting(_state: QmkLightingState): Promise<void> {
    throw new Error(
      'Bàn phím đang dùng firmware gốc PMO (giao thức RDR). Hãy dùng mục "Lưu 20 Hiệu ứng Chip WAVE75 vào Flash" ngay bên trên!'
    );
  }

  /**
   * Controls the real physical CNC Wave Logo LED via official pmohub.cn funcInfo[11..19]
   * (logoLightSwitch, logoLightMode 1..4, logoLightBrightness, logoLightSpeed, logoLightMixColor, RGB)
   * and commits to onboard Flash via STOP_COMM (0x11) so it stays lit even after closing the app!
   */
  async applyLogoSettings(settings: LogoSettings): Promise<void> {
    if (!this.device || !this.device.opened) {
      throw new Error('Chưa kết nối bàn phím WAVE75 USB.');
    }
    await this.withLock(async () => {
      await this.request(P.CMD.START_COMM, 0, 0, undefined, 900, 'START_COMM (0x10) — Logo');
      const f = await this.readFuncInfo();
      if (!f) {
        throw new Error('Không đọc được funcInfo (0x14) để cập nhật Đèn Logo CNC.');
      }
      this.writeLogoToFuncInfo(f, settings);
      const written = await this.writeFuncInfo(f);
      if (!written.every((s) => s === P.STATUS_OK)) {
        throw new Error('Firmware từ chối ghi tham số Đèn Logo CNC (0x15).');
      }
      await this.commitSession();
      const chk = await this.readFuncInfo();
      this.context?.logTraffic(
        'info',
        '0x15',
        null,
        `Đã ghi Đèn Logo CNC vào Flash: switch=${chk ? chk[P.FUNC.LOGO_SWITCH] : f[P.FUNC.LOGO_SWITCH]} mode=${chk ? chk[P.FUNC.LOGO_MODE] : f[P.FUNC.LOGO_MODE]} bri=${chk ? chk[P.FUNC.LOGO_BRIGHTNESS] : f[P.FUNC.LOGO_BRIGHTNESS]}/${this.logoMaxBright} rgb=(${settings.color.r},${settings.color.g},${settings.color.b})`
      );
    });
  }

  /**
   * Saves one of the 20 official WAVE75 hardware effects (+ optional CNC Logo LED) directly into
   * keyboard onboard Flash via SET_FUNC_INFO (0x15) + STOP_COMM (0x11).
   * Runs forever on the keyboard MCU even when browser/PC driver is closed!
   */
  async applyNativePresetToFlash(config: NativeHardwarePresetConfig): Promise<string> {
    if (!this.device || !this.device.opened) {
      throw new Error('Chưa kết nối bàn phím WAVE75 USB.');
    }
    return this.withLock(async () => {
      // Exit live 0x2E streaming first so hardware preset takes over immediately
      this.armed = false;
      try {
        await this.request(P.CMD.CLOSE_LIGHT_SYNC, 0, 0, undefined, 500, 'CLOSE_LIGHT_SYNC (0x2F)');
      } catch {
        // optional
      }
      await this.request(P.CMD.START_COMM, 0, 0, undefined, 900, 'START_COMM (0x10) — Save Native Preset');
      const f = await this.readFuncInfo();
      if (!f) {
        throw new Error('Không đọc được bảng tham số funcInfo (0x14).');
      }

      const mode = clamp(Math.round(config.modeId), 1, 20);
      const isOff = config.brightness <= 0;
      const bri = clamp(Math.round((config.brightness / 100) * this.maxBright), 0, this.maxBright);
      const spd = clamp(Math.round(((config.speed - 1) / 4) * this.maxSpeed), 0, this.maxSpeed);

      f[P.FUNC.LIGHT_SWITCH] = isOff ? 1 : 0;
      f[P.FUNC.LIGHT_MODE] = mode;
      f[P.FUNC.BRIGHTNESS] = isOff ? 0 : Math.max(10, bri);
      f[P.FUNC.SPEED_REV] = clamp(this.maxSpeed - spd, 0, this.maxSpeed);
      f[P.FUNC.MIX_COLOR] = config.rainbow ? 1 : 0;
      f[P.FUNC.COLOR_INDEX] = 0;
      f[P.FUNC.R_VALUE] = clampByte(config.color.r);
      f[P.FUNC.G_VALUE] = clampByte(config.color.g);
      f[P.FUNC.B_VALUE] = clampByte(config.color.b);

      if (config.logo) {
        this.writeLogoToFuncInfo(f, config.logo);
      }

      const written = await this.writeFuncInfo(f);
      if (!written.every((s) => s === P.STATUS_OK)) {
        throw new Error('Firmware từ chối ghi hiệu ứng vào bộ nhớ (0x15).');
      }
      await this.commitSession();

      const chk = await this.readFuncInfo();
      const confirmed = !!chk && chk[P.FUNC.LIGHT_MODE] === mode;
      // Do NOT revert this saved hardware preset when disconnecting/closing the browser!
      this.original = null;

      const label =
        WAVE75_NATIVE_HARDWARE_MODES.find((m) => m.id === mode)?.nameVi ?? `Mode #${mode}`;
      const msg = confirmed
        ? `Đã lưu vĩnh viễn "${label}" + Đèn Logo CNC vào Flash WAVE75! Bạn có thể tắt trình duyệt, phím vẫn chạy mãi.`
        : `Đã gửi lệnh lưu "${label}" (chưa đọc lại được xác nhận mode=${mode}).`;
      this.context?.logTraffic('info', '0x15', null, msg);
      return msg;
    });
  }

  /** Stop streaming and give the lighting back to the firmware (restores the original lightMode). */
  async handBackToFirmware(): Promise<void> {
    if (!this.device || !this.device.opened || this.handedBack) return;
    await this.withLock(async () => {
      this.armed = false;
      try {
        await this.restoreOriginalMode();
      } catch {
        // best effort
      }
      try {
        await this.request(P.CMD.CLOSE_LIGHT_SYNC, 0, 0, undefined, 400, 'CLOSE_LIGHT_SYNC (0x2F)');
        await sleep(20);
        await this.request(P.CMD.STOP_COMM, 0, 0, undefined, 400, 'STOP_COMM (0x11)');
      } catch {
        // best effort
      }
      this.handedBack = true;
    });
  }

  /** Releases the WebHID handle without reverting to factory mode so the background driver takes over cleanly. */
  async releaseForBackgroundDriver(): Promise<void> {
    this.original = null;
    this.armed = false;
    this.handedBack = true;
    this.unbind();
    this.device = null;
    this.context = null;
  }

  async disconnect(): Promise<void> {
    await this.handBackToFirmware();
    this.unbind();
    this.device = null;
    this.context = null;
  }

  /** Debug helper for the diagnostics drawer. */
  describe(): string {
    return `reportId=${this.reportId} payload=${this.payloadSize}B armed=${this.armed} ${bytesToHex(
      this.build(P.CMD.START_COMM, 0, 0),
      8
    )}`;
  }
}
