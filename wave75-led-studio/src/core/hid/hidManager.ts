import type { RGB } from '../utils/color';
import { clamp } from '../utils/color';
import {
  AdapterContext,
  FlashSaveResult,
  HidTrafficPacket,
  KeyboardLightingAdapter,
  LogoSettings,
  NativeHardwarePresetConfig,
  QmkLightingState,
  WaveCapabilities,
  WaveDeviceInfo,
  WaveModelId,
} from '../protocols/types';
import { PmoNativeAdapter, PMO_NATIVE_PROTOCOL } from '../protocols/pmoNativeAdapter';
import { QmkViaLightingAdapter, QMK_VIA_PROTOCOL } from '../protocols/qmkViaAdapter';
import { LogoOnlyAdapter } from '../protocols/logoOnlyAdapter';
import { WaveSimulatorAdapter } from '../protocols/simulatorAdapter';
import {
  WaveUsbDiagnosticReport,
  buildWaveDeviceInfo,
  bytesToHex,
  extractWaveDiagnosticReport,
  selectBestWaveDevice,
} from './usbDiagnostics';
import { stopBackgroundDriverIfRunning } from './backgroundDriverClient';

export interface WaveHidState {
  mode: 'simulator' | 'live';
  connected: boolean;
  activeModel: WaveModelId;
  deviceInfo: WaveDeviceInfo;
  capabilities: WaveCapabilities;
  lastDiagnosticReport: WaveUsbDiagnosticReport | null;
  lastError: string | null;
  isBusyFlashing: boolean;
}

type StateSub = (state: WaveHidState) => void;
type TrafficSub = (packets: HidTrafficPacket[]) => void;

const KNOWN_WAVE75_FILTERS: HIDDeviceFilter[] = [
  // Verified PMO WAVE75 hardware vendor ID (wired 0x3009, P75, etc.)
  { vendorId: PMO_NATIVE_PROTOCOL.VENDOR_ID },
  // OEM / sister boards
  { vendorId: 0x320f },
  { vendorId: 0x1ca6 },
  { vendorId: 0x1ca5 },
  // Vendor-defined HID fallback
  { usagePage: 0xff00 },
  { usagePage: 0xff60, usage: 0x61 },
  { usagePage: 0xff60 },
];

const MAX_LOG = 160;

function scoreCandidateDevice(dev: HIDDevice, preferQmk: boolean): number {
  let score = 0;
  // Strongly prefer wired WAVE75 PID 0x3009 over 2.4G dongle PID 0x3002
  if (dev.vendorId === 0x36b0 && dev.productId === 0x3009) score += 200;
  else if (dev.vendorId === 0x36b0 && dev.productId === 0x3002) score -= 40;
  else if (dev.vendorId === 0x36b0) score += 60;

  for (const c of dev.collections ?? []) {
    const isQmk = c.usagePage === 0xff60 && c.usage === 0x61;
    const hasOut = (c.outputReports?.length ?? 0) > 0;
    const hasIn = (c.inputReports?.length ?? 0) > 0;

    if (preferQmk && isQmk && hasOut) score += 250;
    else if (!preferQmk && c.usagePage >= 0xff00 && !isQmk && hasOut && hasIn) score += 150;
    else if (c.usagePage >= 0xff00 && hasOut) score += 90;

    // Penalize standard Keyboard/Mouse/Consumer/System interfaces
    if (c.usagePage === 0x01 || c.usagePage === 0x0c) score -= 80;
  }
  return score;
}

class WaveHidManager {
  private device: HIDDevice | null = null;
  private adapter: KeyboardLightingAdapter;
  private state: WaveHidState;

  private stateSubs = new Set<StateSub>();
  private trafficSubs = new Set<TrafficSub>();
  private trafficLog: HidTrafficPacket[] = [];
  private seq = 1;
  private trafficPaused = false;

  // Non-overlapping latest-frame-wins packet queue (5-30 FPS, default 20 FPS)
  private maxFps = 20;
  private sendingSync = false;
  private lastSyncAt = 0;
  private pendingSync: { keys: RGB[]; logo: RGB; lightIndexMap?: number[] } | null = null;
  private throttleTimer: number | null = null;

  constructor() {
    const sim = new WaveSimulatorAdapter('wave75_pro_rgb');
    const virtualInfo = this.buildVirtualInfo('wave75_pro_rgb');
    this.adapter = sim;
    this.state = {
      mode: 'simulator',
      connected: false,
      activeModel: 'wave75_pro_rgb',
      deviceInfo: virtualInfo,
      capabilities: sim.getCapabilities(),
      lastDiagnosticReport: null,
      lastError: null,
      isBusyFlashing: false,
    };
    sim.connect({} as HIDDevice, this.createContext(virtualInfo)).catch(() => {});

    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', this.handleBeforeUnload);
      if (navigator.hid) {
        navigator.hid.addEventListener('disconnect', this.handleDisconnectEvent);
      }
    }
  }

  private buildVirtualInfo(model: WaveModelId): WaveDeviceInfo {
    const isLogoOnly = model === 'wave75_non_rgb';
    return {
      vendorId: PMO_NATIVE_PROTOCOL.VENDOR_ID,
      productId: PMO_NATIVE_PROTOCOL.PRODUCT_ID,
      vendorIdHex: '0x36B0',
      productIdHex: '0x3009',
      productName: `Virtual ${model.replace(/_/g, ' ').toUpperCase()}`,
      usagePage: isLogoOnly ? 0xff60 : 0xff00,
      usagePageHex: isLogoOnly ? '0xFF60' : '0xFF00',
      usage: isLogoOnly ? 0x61 : 0x01,
      usageHex: isLogoOnly ? '0x61' : '0x01',
      reportId: 0x00,
      packetSize: isLogoOnly ? 32 : 64,
      transportMode: 'simulator',
      firmwareVersion: 'SIM-RDR-v2.1',
    };
  }

  private handleDisconnectEvent = (ev: Event) => {
    const hidEv = ev as HIDConnectionEvent;
    if (this.device && hidEv.device === this.device) {
      this.logTraffic('warn', '0x11', null, 'USB keyboard physically disconnected.');
      void this.disconnect();
    }
  };

  private handleBeforeUnload = () => {
    this.clearQueue();
    if (this.device && this.device.opened) {
      void this.adapter.handBackToFirmware().finally(() => {
        this.device?.close().catch(() => {});
      });
    }
  };

  isWebHidSupported(): boolean {
    return typeof navigator !== 'undefined' && 'hid' in navigator && !!navigator.hid;
  }

  getState(): WaveHidState {
    return this.state;
  }

  getTrafficLog(): HidTrafficPacket[] {
    return this.trafficLog;
  }

  setTrafficPaused(paused: boolean): void {
    this.trafficPaused = paused;
  }

  clearTrafficLog(): void {
    this.trafficLog = [];
    this.emitTraffic();
  }

  setMaxFps(fps: number): void {
    this.maxFps = clamp(Math.round(fps), 5, 30);
  }

  subscribeState(fn: StateSub): () => void {
    this.stateSubs.add(fn);
    fn(this.state);
    return () => this.stateSubs.delete(fn);
  }

  subscribeTraffic(fn: TrafficSub): () => void {
    this.trafficSubs.add(fn);
    fn(this.trafficLog);
    return () => this.trafficSubs.delete(fn);
  }

  private emitState(): void {
    const snap = { ...this.state };
    this.stateSubs.forEach((fn) => fn(snap));
  }

  private emitTraffic(): void {
    const snap = [...this.trafficLog];
    this.trafficSubs.forEach((fn) => fn(snap));
  }

  private logTraffic(
    direction: HidTrafficPacket['direction'],
    opcodeHex: string,
    bytes: Uint8Array | null,
    summary: string,
    statusTag?: HidTrafficPacket['statusTag']
  ): void {
    if (this.trafficPaused && (direction === 'tx' || direction === 'rx')) return;
    const now = new Date();
    const ts = `${now.toTimeString().slice(0, 8)}.${String(now.getMilliseconds()).padStart(3, '0')}`;
    this.trafficLog.unshift({
      id: this.seq++,
      timestamp: ts,
      direction,
      opcodeHex,
      statusTag,
      hex: bytes ? bytesToHex(bytes, 28) : '—',
      summary,
      bytesLength: bytes ? bytes.length : 0,
    });
    if (this.trafficLog.length > MAX_LOG) this.trafficLog.length = MAX_LOG;
    this.emitTraffic();
  }

  private createContext(deviceInfo: WaveDeviceInfo): AdapterContext {
    return {
      deviceInfo,
      logTraffic: (dir, op, bytes, summary, tag) =>
        this.logTraffic(dir, op, bytes, summary, tag),
    };
  }

  switchSimulatedModel(model: WaveModelId): void {
    if (this.state.mode === 'live' && this.state.connected) {
      this.state = { ...this.state, activeModel: model };
      this.emitState();
      return;
    }
    const sim = new WaveSimulatorAdapter(model);
    const info = this.buildVirtualInfo(model);
    this.adapter = sim;
    sim.connect({} as HIDDevice, this.createContext(info)).catch(() => {});
    this.state = {
      ...this.state,
      mode: 'simulator',
      connected: false,
      activeModel: model,
      deviceInfo: info,
      capabilities: sim.getCapabilities(),
      lastError: null,
    };
    this.emitState();
  }

  async inspectUsbReadOnly(): Promise<WaveUsbDiagnosticReport | null> {
    if (!this.isWebHidSupported() || !navigator.hid) {
      throw new Error('WebHID is unavailable. Use Chrome or Edge Desktop.');
    }
    const devices = await navigator.hid.requestDevice({ filters: [] });
    if (devices.length === 0) return null;
    const best = selectBestWaveDevice(devices) ?? devices[0];
    const report = extractWaveDiagnosticReport(best);
    this.state = { ...this.state, lastDiagnosticReport: report };
    this.logTraffic(
      'info',
      'DIAG',
      null,
      `Captured read-only USB report: ${report.device.productName} (${report.device.vendorIdHex}:${report.device.productIdHex})`
    );
    this.emitState();
    return report;
  }

  async connectDevice(
    model: WaveModelId,
    options: { manualAllHid?: boolean; preferQmkVia?: boolean } = {}
  ): Promise<WaveHidState> {
    if (!this.isWebHidSupported() || !navigator.hid) {
      const msg = 'Trình duyệt không hỗ trợ WebHID. Vui lòng dùng Chrome hoặc Edge Desktop.';
      this.state = { ...this.state, lastError: msg };
      this.emitState();
      throw new Error(msg);
    }

    try {
      // Automatically pause any running WAVE75 background driver so WebHID can take over cleanly
      await stopBackgroundDriverIfRunning();

      const filters = options.manualAllHid
        ? []
        : options.preferQmkVia
          ? [{ usagePage: QMK_VIA_PROTOCOL.USAGE_PAGE, usage: QMK_VIA_PROTOCOL.USAGE }]
          : KNOWN_WAVE75_FILTERS;

      const requested = await navigator.hid.requestDevice({ filters });
      // Merge with already-authorized HID interfaces so MI_01 is always included even if Chrome splits them
      const authorized = await navigator.hid.getDevices();
      const mergedSet = new Set<HIDDevice>([...requested, ...authorized]);
      const candidates = Array.from(mergedSet).filter((d) => {
        if (options.manualAllHid) return requested.length === 0 || requested.includes(d);
        return (
          requested.includes(d) ||
          d.vendorId === PMO_NATIVE_PROTOCOL.VENDOR_ID ||
          (d.collections ?? []).some((c) => c.usagePage >= 0xff00)
        );
      });

      if (candidates.length === 0) return this.state;

      if (this.device) await this.disconnect();

      const preferQmk = model === 'wave75_non_rgb' || !!options.preferQmkVia;
      candidates.sort(
        (a, b) => scoreCandidateDevice(b, preferQmk) - scoreCandidateDevice(a, preferQmk)
      );

      this.logTraffic(
        'info',
        'HID',
        null,
        `Found ${candidates.length} HID interface(s), probing for WAVE75 lighting channel...`
      );

      // Native PMO RDR path: actively probe each candidate until one answers 0xAA!
      if (!preferQmk) {
        let pickedDevice: HIDDevice | null = null;
        let pickedAdapter: PmoNativeAdapter | null = null;
        let pickedInfo: WaveDeviceInfo | null = null;

        for (const dev of candidates) {
          // Skip interfaces that have no output reports at all
          const hasOut = (dev.collections ?? []).some((c) => (c.outputReports?.length ?? 0) > 0);
          if (!hasOut) continue;

          const info = buildWaveDeviceInfo(dev, 'pmo_native');
          const probeAdapter = new PmoNativeAdapter();
          try {
            if (!dev.opened) await dev.open();
            const ok = await probeAdapter.probe(dev, this.createContext(info));
            if (ok) {
              pickedDevice = dev;
              pickedAdapter = probeAdapter;
              pickedInfo = info;
              break;
            }
          } catch (e) {
            this.logTraffic(
              'warn',
              'HID',
              null,
              `Skip ${dev.productName} (${info.vendorIdHex}:${info.productIdHex}): ${
                e instanceof Error ? e.message : String(e)
              }`
            );
          }
          try {
            if (dev.opened) await dev.close();
          } catch {
            // ignore
          }
        }

        if (!pickedDevice || !pickedAdapter || !pickedInfo) {
          const msg =
            'Không tìm thấy cổng điều khiển LED RDR (không có interface nào hồi đáp 0xAA). Hãy cắm dây USB-C, nhấn Fn+5 sang Wired Mode, đóng PMO Hub / pmohub.cn / SignalRGB, rồi bấm Kết nối và chọn mục PID 0x3009 (giao diện vendor MI_01).';
          this.logTraffic('error', '0x10', null, msg);
          this.state = { ...this.state, lastError: msg };
          this.emitState();
          throw new Error(msg);
        }

        const diag = extractWaveDiagnosticReport(pickedDevice);
        const caps = await pickedAdapter.connect(pickedDevice, this.createContext(pickedInfo));
        const meta = await pickedAdapter.readDeviceInfo();
        if (meta.firmwareVersion) pickedInfo.firmwareVersion = meta.firmwareVersion;

        this.device = pickedDevice;
        this.adapter = pickedAdapter;
        this.state = {
          mode: 'live',
          connected: true,
          activeModel: model,
          deviceInfo: pickedInfo,
          capabilities: caps,
          lastDiagnosticReport: diag,
          lastError: null,
          isBusyFlashing: false,
        };
        this.emitState();
        return this.state;
      }

      // QMK / VIA or Non-RGB Logo-only path
      const target = candidates[0];
      const diag = extractWaveDiagnosticReport(target);
      if (!target.opened) await target.open();

      const isLogoOnly = model === 'wave75_non_rgb';
      const transportMode = isLogoOnly ? 'logo_only' : 'qmk_via';
      const info = buildWaveDeviceInfo(target, transportMode);
      const adapter: KeyboardLightingAdapter = isLogoOnly
        ? new LogoOnlyAdapter()
        : new QmkViaLightingAdapter();

      const caps = await adapter.connect(target, this.createContext(info));
      const meta = await adapter.readDeviceInfo();
      if (meta.firmwareVersion) info.firmwareVersion = meta.firmwareVersion;

      this.device = target;
      this.adapter = adapter;
      this.state = {
        mode: 'live',
        connected: true,
        activeModel: model,
        deviceInfo: info,
        capabilities: caps,
        lastDiagnosticReport: diag,
        lastError: null,
        isBusyFlashing: false,
      };
      this.emitState();
      return this.state;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logTraffic('error', 'ERR', null, `WebHID connect error: ${message}`);
      this.state = { ...this.state, lastError: message };
      this.emitState();
      throw err;
    }
  }

  /**
   * Explicit "Stop & Hand Back to Firmware" (0x2F -> 0x15 original mode -> 0x11 -> close)
   */
  async handBackAndDisconnect(): Promise<void> {
    this.clearQueue();
    await this.adapter.handBackToFirmware();
    if (this.state.connected) {
      await this.disconnect();
    }
  }

  /**
   * Releases WebHID without reverting keyboard lighting so the persistent Windows background driver
   * can immediately claim MI_01 and keep running the installed custom effect forever.
   */
  async disconnectForBackgroundDriver(): Promise<void> {
    this.clearQueue();
    if (this.device) {
      try {
        if (this.adapter instanceof PmoNativeAdapter) {
          await this.adapter.releaseForBackgroundDriver();
        }
        if (this.device.opened) await this.device.close();
      } catch {
        // ignore
      }
      this.device = null;
    }

    const sim = new WaveSimulatorAdapter(this.state.activeModel);
    const info = this.buildVirtualInfo(this.state.activeModel);
    this.adapter = sim;
    await sim.connect({} as HIDDevice, this.createContext(info));
    this.state = {
      ...this.state,
      mode: 'simulator',
      connected: false,
      deviceInfo: info,
      capabilities: sim.getCapabilities(),
      isBusyFlashing: false,
    };
    this.emitState();
  }

  async disconnect(): Promise<void> {
    this.clearQueue();
    if (this.device) {
      try {
        await this.adapter.disconnect();
        if (this.device.opened) await this.device.close();
      } catch {
        // Ignore unplugged close error
      }
      this.device = null;
    }

    const sim = new WaveSimulatorAdapter(this.state.activeModel);
    const info = this.buildVirtualInfo(this.state.activeModel);
    this.adapter = sim;
    await sim.connect({} as HIDDevice, this.createContext(info));
    this.state = {
      ...this.state,
      mode: 'simulator',
      connected: false,
      deviceInfo: info,
      capabilities: sim.getCapabilities(),
      isBusyFlashing: false,
    };
    this.emitState();
  }

  private clearQueue(): void {
    this.pendingSync = null;
    if (this.throttleTimer !== null) {
      window.clearTimeout(this.throttleTimer);
      this.throttleTimer = null;
    }
    this.sendingSync = false;
  }

  enqueueSyncFrame(keys: RGB[], logo: RGB, lightIndexMap?: number[]): void {
    if (this.state.isBusyFlashing) return;
    if (!this.state.capabilities.supportsPerKeySync) return;
    this.pendingSync = { keys, logo, lightIndexMap };
    this.pumpQueue();
  }

  /**
   * Immediately sends 3 consecutive 0x2E RGB565 frames (verified on real WAVE75
   * so single frames are never dropped as partial packets by firmware).
   */
  async forcePushFrameNow(keys: RGB[], logo: RGB, lightIndexMap?: number[]): Promise<void> {
    if (!this.state.connected) {
      throw new Error('Chưa kết nối bàn phím USB. Hãy bấm "Kết nối WAVE75 USB" ở thanh trên cùng.');
    }
    if (!this.state.capabilities.supportsPerKeySync) {
      throw new Error('Giao thức hiện tại không hỗ trợ đẩy frame 0x2E (cần kênh PMO Native).');
    }
    this.clearQueue();
    if (this.adapter instanceof PmoNativeAdapter) {
      await this.adapter.ensureLiveArmed();
    }
    for (let i = 0; i < 3; i++) {
      await this.adapter.sendPerKeySyncFrame(keys, logo, lightIndexMap);
      await new Promise((r) => setTimeout(r, 35));
    }
  }

  private pumpQueue(): void {
    if (this.sendingSync || !this.pendingSync || this.state.isBusyFlashing) return;
    const minMs = Math.max(33, Math.floor(1000 / this.maxFps));
    const now = performance.now();
    const elapsed = now - this.lastSyncAt;

    if (elapsed < minMs) {
      if (this.throttleTimer === null) {
        this.throttleTimer = window.setTimeout(() => {
          this.throttleTimer = null;
          this.pumpQueue();
        }, minMs - elapsed);
      }
      return;
    }

    const job = this.pendingSync;
    this.pendingSync = null;
    this.sendingSync = true;
    this.lastSyncAt = now;

    this.adapter
      .sendPerKeySyncFrame(job.keys, job.logo, job.lightIndexMap)
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : String(err);
        this.logTraffic('error', '0x2E', null, `Sync TX error: ${msg}`);
      })
      .finally(() => {
        this.sendingSync = false;
        if (this.pendingSync && !this.state.isBusyFlashing) {
          this.pumpQueue();
        }
      });
  }

  async readOnboardSlot(slot: number, lightIndexMap?: number[]) {
    this.clearQueue();
    return this.adapter.readOnboardSlot(slot, lightIndexMap);
  }

  async selectOnboardSlot(slot: number): Promise<void> {
    await this.adapter.selectOnboardSlot(slot);
  }

  async saveOnboardSlotSafe(
    slot: number,
    keyColors: RGB[],
    logoColor: RGB,
    lightIndexMap?: number[]
  ): Promise<FlashSaveResult> {
    this.state = { ...this.state, isBusyFlashing: true };
    this.emitState();
    this.clearQueue();
    await new Promise((r) => setTimeout(r, 60));

    try {
      return await this.adapter.saveOnboardSlotWithVerify(
        slot,
        keyColors,
        logoColor,
        lightIndexMap
      );
    } finally {
      this.state = { ...this.state, isBusyFlashing: false };
      this.emitState();
    }
  }

  async applyQmkLighting(state: QmkLightingState): Promise<void> {
    await this.adapter.applyQmkLighting(state);
  }

  async applyLogoSettings(settings: LogoSettings): Promise<void> {
    this.state = { ...this.state, isBusyFlashing: true };
    this.emitState();
    this.clearQueue();
    try {
      await this.adapter.applyLogoSettings(settings);
    } finally {
      this.state = { ...this.state, isBusyFlashing: false };
      this.emitState();
    }
  }

  async applyNativePresetToFlash(config: NativeHardwarePresetConfig): Promise<string> {
    if (!this.state.connected) {
      throw new Error('Chưa kết nối bàn phím WAVE75 USB.');
    }
    if (!this.adapter.applyNativePresetToFlash) {
      throw new Error('Chế độ kết nối hiện tại không dùng giao thức RDR gốc WAVE75.');
    }
    this.state = { ...this.state, isBusyFlashing: true };
    this.emitState();
    this.clearQueue();
    await new Promise((r) => setTimeout(r, 40));
    try {
      return await this.adapter.applyNativePresetToFlash(config);
    } finally {
      this.state = { ...this.state, isBusyFlashing: false };
      this.emitState();
    }
  }

  async ensureLiveArmed(): Promise<void> {
    if (this.adapter instanceof PmoNativeAdapter) {
      await this.adapter.ensureLiveArmed();
    }
  }
}

export const waveHidManager = new WaveHidManager();
