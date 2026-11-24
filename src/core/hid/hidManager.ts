import type { EffectParams } from '../engines/effectEngine';
import type { RGB } from '../utils/color';
import { clamp } from '../utils/color';
import {
  AdapterContext,
  CapabilityFlags,
  ConcreteModelId,
  CustomProtocolConfig,
  DEFAULT_CUSTOM_PROTOCOL_CONFIG,
  HidDeviceInfo,
  HidTrafficEntry,
  KeyboardModelId,
  KeyboardProtocolAdapter,
} from '../protocols/types';
import {
  KNOWN_WEBHID_FILTERS,
  createAdapterForModel,
  createSimulatorAdapter,
  detectModelFromDevice,
} from '../protocols/registry';
import { CustomGenericAdapter } from '../protocols/customGenericAdapter';
import {
  UsbDiagnosticReport,
  buildHidDeviceInfo,
  bytesToHex,
  extractUsbDiagnosticReport,
  selectBestVendorDevice,
} from './usbDiagnostics';

export interface HidConnectionState {
  mode: 'simulator' | 'live';
  connected: boolean;
  detectedModel: ConcreteModelId;
  deviceInfo: HidDeviceInfo | null;
  capabilities: CapabilityFlags;
  lastDiagnosticReport: UsbDiagnosticReport | null;
  lastError: string | null;
}

export interface HidStreamTelemetry {
  actualFps: number;
  avgTxMs: number;
  targetFps: number;
}

type StateListener = (state: HidConnectionState) => void;
type TrafficListener = (entries: HidTrafficEntry[]) => void;
type TelemetryListener = (telemetry: HidStreamTelemetry) => void;

const MAX_TRAFFIC_LOG = 150;

class HidManager {
  private device: HIDDevice | null = null;
  private adapter: KeyboardProtocolAdapter;
  private customConfig: CustomProtocolConfig = { ...DEFAULT_CUSTOM_PROTOCOL_CONFIG };
  private state: HidConnectionState;

  private stateListeners = new Set<StateListener>();
  private trafficListeners = new Set<TrafficListener>();
  private telemetryListeners = new Set<TelemetryListener>();
  private trafficLog: HidTrafficEntry[] = [];
  private trafficSeq = 1;
  private trafficPaused = false;
  private trafficEmitTimer: number | null = null;

  // Zero-setTimeout VSync/ACK-Paced USB Frame Scheduler + Telemetry
  private maxFps = 60;
  private isSendingFrame = false;
  private lastFrameStartedAt = 0;
  private emaTxMs = 8.8;
  private framesInWindow = 0;
  private fpsWindowStart = 0;
  private telemetry: HidStreamTelemetry = { actualFps: 0, avgTxMs: 0, targetFps: 60 };
  private pendingFrame: { colors: RGB[]; ledIndexMap?: number[] } | null = null;

  constructor() {
    const sim = createSimulatorAdapter('win60he_max');
    this.adapter = sim;
    this.state = {
      mode: 'simulator',
      connected: false,
      detectedModel: 'win60he_max',
      deviceInfo: this.buildVirtualDeviceInfo('win60he_max'),
      capabilities: sim.getCapabilities(),
      lastDiagnosticReport: null,
      lastError: null,
    };

    // Bind simulator context so simulator traffic shows up in inspector
    sim.connect({} as HIDDevice, this.createContext(this.state.deviceInfo!)).catch(() => {});

    // Hardware safety: bind automatic disconnect & page unload cleanup
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', this.handleBeforeUnload);
      if (navigator.hid) {
        navigator.hid.addEventListener('disconnect', this.handleHidDisconnect);
      }
    }
  }

  private buildVirtualDeviceInfo(model: ConcreteModelId): HidDeviceInfo {
    const isSE = model === 'win60_se';
    const isStd = model === 'win60he_standard';
    const vid = isSE ? 0x38a6 : isStd ? 0x258a : 0x8089;
    const pid = isSE ? 0x291a : isStd ? 0x0060 : 0x0009;
    return {
      vendorId: vid,
      productId: pid,
      vendorIdHex: `0x${vid.toString(16).toUpperCase().padStart(4, '0')}`,
      productIdHex: `0x${pid.toString(16).toUpperCase().padStart(4, '0')}`,
      productName: `Virtual ${model.replace('_', ' ').toUpperCase()}`,
      usagePage: 0xff1b,
      usagePageHex: '0xFF1B',
      usage: 0x91,
      usageHex: '0x91',
      outputReportId: 0x00,
      featureReportId: 0x00,
      packetSize: 64,
      transport: 'virtual',
      firmwareVersion: 'SIM-v2.4.0',
    };
  }

  private handleHidDisconnect = (event: Event) => {
    const hidEv = event as HIDConnectionEvent;
    if (this.device && hidEv.device === this.device) {
      this.logTraffic(
        'warn',
        0x00,
        null,
        `USB device disconnected: ${hidEv.device.productName || 'Keyboard'}`
      );
      void this.disconnect();
    }
  };

  private handleBeforeUnload = () => {
    this.clearThrottleQueue();
    if (this.device && this.device.opened) {
      this.device.close().catch(() => {});
    }
  };

  isWebHidSupported(): boolean {
    return typeof navigator !== 'undefined' && 'hid' in navigator && !!navigator.hid;
  }

  getState(): HidConnectionState {
    return this.state;
  }

  getTrafficLog(): HidTrafficEntry[] {
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
    const cap = this.state.capabilities.maxSafeFps || 90;
    this.maxFps = clamp(Math.round(fps), 5, cap);
    this.telemetry = { ...this.telemetry, targetFps: this.maxFps };
    this.emitTelemetry();
  }

  getMaxFps(): number {
    return this.maxFps;
  }

  getStreamTelemetry(): HidStreamTelemetry {
    return this.telemetry;
  }

  subscribeTelemetry(listener: TelemetryListener): () => void {
    this.telemetryListeners.add(listener);
    listener(this.telemetry);
    return () => this.telemetryListeners.delete(listener);
  }

  private emitTelemetry(): void {
    if (this.telemetryListeners.size === 0) return;
    const snap = { ...this.telemetry };
    this.telemetryListeners.forEach((fn) => fn(snap));
  }

  updateCustomProtocolConfig(next: Partial<CustomProtocolConfig>): void {
    this.customConfig = { ...this.customConfig, ...next };
    if (this.adapter instanceof CustomGenericAdapter) {
      this.adapter.updateConfig(this.customConfig);
    }
  }

  getCustomProtocolConfig(): CustomProtocolConfig {
    return this.customConfig;
  }

  subscribeState(listener: StateListener): () => void {
    this.stateListeners.add(listener);
    listener(this.state);
    return () => this.stateListeners.delete(listener);
  }

  subscribeTraffic(listener: TrafficListener): () => void {
    this.trafficListeners.add(listener);
    listener(this.trafficLog);
    return () => this.trafficListeners.delete(listener);
  }

  private emitState(): void {
    const snapshot = { ...this.state };
    this.stateListeners.forEach((fn) => fn(snapshot));
  }

  private emitTraffic(): void {
    // Throttle React log listener notifications to max 5 Hz so HID bursts never starve the 60 FPS UI/USB loop
    if (this.trafficEmitTimer !== null) return;
    this.trafficEmitTimer = window.setTimeout(() => {
      this.trafficEmitTimer = null;
      const snapshot = [...this.trafficLog];
      this.trafficListeners.forEach((fn) => fn(snapshot));
    }, 200);
  }

  private logTraffic(
    direction: HidTrafficEntry['direction'],
    reportId: number,
    bytes: Uint8Array | null,
    summary: string
  ): void {
    if (this.trafficPaused && (direction === 'tx' || direction === 'rx')) return;
    const now = new Date();
    const ts = `${now.toTimeString().slice(0, 8)}.${String(now.getMilliseconds()).padStart(3, '0')}`;
    const entry: HidTrafficEntry = {
      id: this.trafficSeq++,
      timestamp: ts,
      direction,
      reportId,
      hex: bytes ? bytesToHex(bytes, 32) : '—',
      summary,
      bytesLength: bytes ? bytes.length : 0,
    };
    this.trafficLog.unshift(entry);
    if (this.trafficLog.length > MAX_TRAFFIC_LOG) {
      this.trafficLog.length = MAX_TRAFFIC_LOG;
    }
    this.emitTraffic();
  }

  private createContext(deviceInfo: HidDeviceInfo): AdapterContext {
    return {
      deviceInfo,
      logTraffic: (dir, repId, bytes, summary) =>
        this.logTraffic(dir, repId, bytes, summary),
    };
  }

  /**
   * Switch virtual simulator model when not connected to physical hardware.
   */
  switchSimulatedModel(modelId: KeyboardModelId): void {
    if (this.state.mode === 'live' && this.state.connected) return;
    const concrete: ConcreteModelId = modelId === 'auto' ? 'win60he_max' : modelId;
    const sim = createSimulatorAdapter(concrete);
    const info = this.buildVirtualDeviceInfo(concrete);
    this.adapter = sim;
    sim.connect({} as HIDDevice, this.createContext(info)).catch(() => {});
    this.state = {
      ...this.state,
      mode: 'simulator',
      connected: false,
      detectedModel: concrete,
      deviceInfo: info,
      capabilities: sim.getCapabilities(),
      lastError: null,
    };
    this.setMaxFps(Math.min(this.maxFps, this.state.capabilities.maxSafeFps));
    this.emitState();
  }

  /**
   * Read-only USB diagnostic inspection (filters: []) — writes ZERO bytes.
   */
  async inspectAnyUsbDevice(): Promise<UsbDiagnosticReport | null> {
    if (!this.isWebHidSupported() || !navigator.hid) {
      throw new Error('WebHID API is not supported in this browser. Use Chrome or Edge Desktop.');
    }
    const devices = await navigator.hid.requestDevice({ filters: [] });
    if (devices.length === 0) return null;

    const best = selectBestVendorDevice(devices) ?? devices[0];
    const report = extractUsbDiagnosticReport(best);
    this.state = {
      ...this.state,
      lastDiagnosticReport: report,
    };
    this.logTraffic(
      'info',
      0x00,
      null,
      `Captured read-only USB Diagnostic Report for ${report.device.productName} (${report.device.vendorIdHex}:${report.device.productIdHex})`
    );
    this.emitState();
    return report;
  }

  /**
   * Connect to real hardware via WebHID (known filters or manual fallback filters: []).
   */
  async connectDevice(
    preferredModel: KeyboardModelId = 'auto',
    manualSelection = false
  ): Promise<HidConnectionState> {
    if (!this.isWebHidSupported() || !navigator.hid) {
      const msg =
        'WebHID API không được hỗ trợ trên trình duyệt này. Vui lòng dùng Chrome hoặc Edge trên máy tính.';
      this.state = { ...this.state, lastError: msg };
      this.emitState();
      throw new Error(msg);
    }

    try {
      const requested = await navigator.hid.requestDevice({
        filters: manualSelection ? [] : KNOWN_WEBHID_FILTERS,
      });

      const authorized = await navigator.hid.getDevices();
      const merged = Array.from(new Set<HIDDevice>([...requested, ...authorized])).filter(
        (d) =>
          manualSelection
            ? requested.length === 0 || requested.includes(d)
            : requested.includes(d) ||
              d.vendorId === 0x2e3c ||
              (d.collections ?? []).some((c) => c.usagePage === 0xff1b)
      );

      if (merged.length === 0) {
        return this.state;
      }

      // Close previous live device cleanly if any
      if (this.device) {
        await this.disconnect();
      }

      const targetDevice = selectBestVendorDevice(merged) ?? merged[0];
      const diagReport = extractUsbDiagnosticReport(targetDevice);

      if (!targetDevice.opened) {
        await targetDevice.open();
      }

      const info = buildHidDeviceInfo(targetDevice);
      const resolvedModel: ConcreteModelId =
        preferredModel === 'auto'
          ? detectModelFromDevice(targetDevice)
          : preferredModel;

      const adapter = createAdapterForModel(resolvedModel, this.customConfig);
      const context = this.createContext(info);
      const capabilities = await adapter.connect(targetDevice, context);

      // Listen for incoming HID input reports, ignoring high-frequency cmd 0x09 stream ACKs
      // (2E3C:C365 echoes an ACK for every 0x09 page — logging 180+ ACKs/s starves the event loop!)
      targetDevice.oninputreport = (ev: HIDInputReportEvent) => {
        const bytes = new Uint8Array(
          ev.data.buffer,
          ev.data.byteOffset,
          ev.data.byteLength
        );
        if (bytes[0] === 0x09) return;
        this.logTraffic('rx', ev.reportId, bytes, `Input Report (cmd 0x${(bytes[0] ?? 0).toString(16).padStart(2, '0')})`);
      };

      this.device = targetDevice;
      this.adapter = adapter;

      try {
        const devMeta = await adapter.readDeviceInfo();
        if (devMeta.firmwareVersion) {
          info.firmwareVersion = devMeta.firmwareVersion;
        }
      } catch (readErr) {
        this.logTraffic(
          'warn',
          info.outputReportId,
          null,
          `Device info query optional warning: ${(readErr as Error).message}`
        );
      }

      this.state = {
        mode: 'live',
        connected: true,
        detectedModel: resolvedModel,
        deviceInfo: info,
        capabilities,
        lastDiagnosticReport: diagReport,
        lastError: null,
      };
      this.setMaxFps(Math.min(this.maxFps, capabilities.maxSafeFps));
      this.emitState();
      return this.state;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logTraffic('error', 0x00, null, `Connection failed: ${message}`);
      this.state = { ...this.state, lastError: message };
      this.emitState();
      throw err;
    }
  }

  async disconnect(): Promise<void> {
    this.clearThrottleQueue();
    if (this.device) {
      try {
        this.device.oninputreport = null;
        await this.adapter.disconnect();
        if (this.device.opened) {
          await this.device.close();
        }
      } catch {
        // Ignore close errors if device was physically unplugged
      }
      this.device = null;
    }

    const simModel = this.state.detectedModel;
    const sim = createSimulatorAdapter(simModel);
    const info = this.buildVirtualDeviceInfo(simModel);
    this.adapter = sim;
    await sim.connect({} as HIDDevice, this.createContext(info));

    this.state = {
      ...this.state,
      mode: 'simulator',
      connected: false,
      deviceInfo: info,
      capabilities: sim.getCapabilities(),
      lastError: null,
    };
    this.emitState();
  }

  private clearThrottleQueue(): void {
    this.pendingFrame = null;
    this.isSendingFrame = false;
    this.lastFrameStartedAt = 0;
    this.framesInWindow = 0;
    this.fpsWindowStart = 0;
    if (this.telemetry.actualFps !== 0) {
      this.telemetry = { ...this.telemetry, actualFps: 0 };
      this.emitTelemetry();
    }
  }

  /**
   * Queues a 61-key RGB frame with zero-setTimeout VSync/ACK pacing & latest-frame-wins drop strategy
   * so 8000Hz USB keyboards hit locked 60-90 FPS matching real hardware ACK throughput (~8.8ms/frame).
   */
  enqueuePerKeyFrame(colors: RGB[], ledIndexMap?: number[]): void {
    this.pendingFrame = { colors, ledIndexMap };
    this.pumpFrameQueue();
  }

  private pumpFrameQueue(): void {
    if (this.isSendingFrame || !this.pendingFrame) return;

    const now = performance.now();
    // Never use Windows setTimeout(1..15ms) which snaps to 15.625ms ticks!
    // At >=90 FPS (MAX mode): fire back-to-back as fast as hardware ACKs complete.
    // At 60 FPS: use 13.5ms guard so 60Hz VSync ticks (16.67ms) NEVER drop to 30 FPS.
    const minIntervalMs =
      this.maxFps >= 90
        ? 0
        : this.maxFps >= 60
          ? 13.5
          : Math.max(0, 1000 / this.maxFps - 2.5);

    if (this.lastFrameStartedAt > 0 && now - this.lastFrameStartedAt < minIntervalMs) {
      return;
    }

    const job = this.pendingFrame;
    this.pendingFrame = null;
    this.isSendingFrame = true;
    this.lastFrameStartedAt = now;

    const txStart = now;
    this.adapter
      .sendPerKeyFrame(job.colors, job.ledIndexMap)
      .then(() => {
        const txEnd = performance.now();
        const txMs = Math.max(1, txEnd - txStart);
        this.emaTxMs = this.emaTxMs * 0.8 + txMs * 0.2;

        if (this.fpsWindowStart === 0) {
          this.fpsWindowStart = txEnd;
        }
        this.framesInWindow++;
        const windowElapsed = txEnd - this.fpsWindowStart;
        if (windowElapsed >= 500) {
          const actualFps = Math.round((this.framesInWindow * 1000) / windowElapsed);
          this.framesInWindow = 0;
          this.fpsWindowStart = txEnd;
          this.telemetry = {
            actualFps,
            avgTxMs: Math.round(this.emaTxMs * 10) / 10,
            targetFps: this.maxFps,
          };
          this.emitTelemetry();
        }
      })
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : String(err);
        this.logTraffic('error', 0x00, null, `Frame TX error: ${msg}`);
      })
      .finally(() => {
        this.isSendingFrame = false;
        // If a newer frame arrived while TX was in flight and interval has elapsed, pump immediately
        if (this.pendingFrame && performance.now() - this.lastFrameStartedAt >= minIntervalMs) {
          queueMicrotask(() => this.pumpFrameQueue());
        }
      });
  }

  async setLightingMode(modeId: number, params: EffectParams): Promise<void> {
    // Discard any pending per-key frame so it cannot immediately overwrite hardware preset mode (cmd 0x07)
    this.pendingFrame = null;
    await this.adapter.setLightingMode(modeId, params);
  }

  async setBrightness(level: number): Promise<void> {
    await this.adapter.setBrightness(level);
  }

  async setSpeed(level: number): Promise<void> {
    await this.adapter.setSpeed(level);
  }

  async saveToOnboardMemory(): Promise<void> {
    await this.adapter.saveToOnboardMemory();
  }

  async resetLighting(): Promise<void> {
    await this.adapter.resetLighting();
  }

  async forcePushPerKeyNow(colors: RGB[], ledIndexMap?: number[]): Promise<void> {
    if (!this.state.connected) {
      throw new Error('Chưa kết nối bàn phím USB. Hãy bấm "Kết nối bàn phím USB" ở thanh trên cùng.');
    }
    this.clearThrottleQueue();
    if ('forcePushFullFrame' in this.adapter && typeof (this.adapter as { forcePushFullFrame?: unknown }).forcePushFullFrame === 'function') {
      await (this.adapter as { forcePushFullFrame: (c: RGB[], m?: number[]) => Promise<void> }).forcePushFullFrame(colors, ledIndexMap);
      return;
    }
    await this.adapter.sendPerKeyFrame(colors, ledIndexMap);
  }
}

export const hidManager = new HidManager();

