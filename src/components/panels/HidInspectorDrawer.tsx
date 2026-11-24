import React, { useState } from 'react';
import {
  X,
  Download,
  Search,
  Usb,
  Pause,
  Play,
  Trash2,
  Copy,
  Check,
  Crosshair,
  ShieldCheck,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { useStudioStore } from '../../store/useStudioStore';
import { TRANSLATIONS } from '../../i18n';
import { hidManager, type HidConnectionState } from '../../core/hid/hidManager';
import type { HidTrafficEntry } from '../../core/protocols/types';
import { downloadUsbDiagnosticJson } from '../../core/hid/usbDiagnostics';

interface HidInspectorDrawerProps {
  hidState: HidConnectionState;
  traffic: HidTrafficEntry[];
}

export const HidInspectorDrawer: React.FC<HidInspectorDrawerProps> = ({
  hidState,
  traffic,
}) => {
  const language = useStudioStore((s) => s.language);
  const inspectorOpen = useStudioStore((s) => s.inspectorOpen);
  const setInspectorOpen = useStudioStore((s) => s.setInspectorOpen);
  const selectedModel = useStudioStore((s) => s.selectedModel);

  const calibrationActive = useStudioStore((s) => s.calibrationActive);
  const calibrationLedIndex = useStudioStore((s) => s.calibrationLedIndex);
  const setCalibrationActive = useStudioStore((s) => s.setCalibrationActive);
  const setCalibrationLedIndex = useStudioStore((s) => s.setCalibrationLedIndex);
  const resetLedIndexMap = useStudioStore((s) => s.resetLedIndexMap);

  const customProtocolConfig = useStudioStore((s) => s.customProtocolConfig);
  const updateCustomProtocolConfig = useStudioStore((s) => s.updateCustomProtocolConfig);

  const [paused, setPaused] = useState(false);
  const [copied, setCopied] = useState(false);
  const [inspectNotice, setInspectNotice] = useState<string | null>(null);
  const t = TRANSLATIONS[language];

  if (!inspectorOpen) return null;

  const handleReadOnlyInspect = async () => {
    setInspectNotice(null);
    try {
      const report = await hidManager.inspectAnyUsbDevice();
      if (report) {
        setInspectNotice(
          `${report.device.productName} (${report.device.vendorIdHex}:${report.device.productIdHex}) — ${report.collections.length} HID collections`
        );
      }
    } catch (err) {
      setInspectNotice(err instanceof Error ? err.message : 'Inspect cancelled');
    }
  };

  const handleManualConnect = async () => {
    setInspectNotice(null);
    try {
      await hidManager.connectDevice(selectedModel, true);
    } catch (err) {
      setInspectNotice(err instanceof Error ? err.message : 'Connection failed');
    }
  };

  const handleCopyLog = async () => {
    const text = traffic
      .map(
        (e) =>
          `[${e.timestamp}] ${e.direction.toUpperCase()} rep=0x${e.reportId
            .toString(16)
            .padStart(2, '0')} (${e.bytesLength}B) | ${e.summary} | ${e.hex}`
      )
      .join('\n');
    await navigator.clipboard.writeText(text);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  const handleUpdateCustom = (partial: Partial<typeof customProtocolConfig>) => {
    updateCustomProtocolConfig(partial);
    hidManager.updateCustomProtocolConfig(partial);
  };

  const info = hidState.deviceInfo;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-xs">
      <aside className="flex h-full w-full max-w-xl flex-col border-l border-white/10 bg-[#10151F] shadow-2xl">
        {/* Drawer Header */}
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <div>
            <h2 className="text-base font-bold text-slate-100">{t.inspector.title}</h2>
            <p className="text-[11px] text-slate-400">
              WebHID Diagnostics • Calibration • Protocol Config
            </p>
          </div>
          <button
            type="button"
            onClick={() => setInspectorOpen(false)}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-white/5 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto p-5">
          {/* Safety Banner */}
          <div className="flex items-center gap-2.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-2.5 text-xs text-emerald-200">
            <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-400" />
            <span>{t.inspector.safetyBanner}</span>
          </div>

          {/* Device Metadata */}
          <div className="space-y-3 rounded-xl border border-white/10 bg-[#0B0E14] p-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
              {t.inspector.deviceMeta}
            </h3>

            {!hidState.connected && (
              <p className="text-xs text-slate-400">{t.inspector.noRealDevice}</p>
            )}

            {info && (
              <div className="grid grid-cols-2 gap-2 font-mono text-[11px]">
                <div className="rounded-lg bg-[#131822] p-2">
                  <span className="block text-[10px] text-slate-500">Product Name</span>
                  <span className="text-slate-100">{info.productName}</span>
                </div>
                <div className="rounded-lg bg-[#131822] p-2">
                  <span className="block text-[10px] text-slate-500">VID : PID</span>
                  <span className="text-cyan-300">
                    {info.vendorIdHex} : {info.productIdHex}
                  </span>
                </div>
                <div className="rounded-lg bg-[#131822] p-2">
                  <span className="block text-[10px] text-slate-500">UsagePage / Usage</span>
                  <span className="text-violet-300">
                    {info.usagePageHex} / {info.usageHex}
                  </span>
                </div>
                <div className="rounded-lg bg-[#131822] p-2">
                  <span className="block text-[10px] text-slate-500">Report / Packet</span>
                  <span className="text-slate-200">
                    ID {info.outputReportId} • {info.transport.toUpperCase()} • {info.packetSize}B
                  </span>
                </div>
              </div>
            )}

            {inspectNotice && (
              <div className="rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-3 py-1.5 font-mono text-[11px] text-cyan-200">
                {inspectNotice}
              </div>
            )}

            {hidState.lastError && (
              <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-1.5 text-xs text-rose-200">
                {hidState.lastError}
              </div>
            )}

            <div className="flex flex-wrap gap-2 pt-1">
              <button
                type="button"
                onClick={() => void handleReadOnlyInspect()}
                className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-400/40 bg-cyan-500/15 px-3 py-1.5 text-xs font-semibold text-cyan-200 hover:bg-cyan-500/25"
              >
                <Search className="h-3.5 w-3.5" />
                {t.inspector.readOnlyInspect}
              </button>
              <button
                type="button"
                onClick={() => void handleManualConnect()}
                className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-[#131822] px-3 py-1.5 text-xs font-medium text-slate-200 hover:border-cyan-400/50"
              >
                <Usb className="h-3.5 w-3.5" />
                {t.inspector.manualConnect}
              </button>
              {hidState.lastDiagnosticReport && (
                <button
                  type="button"
                  onClick={() =>
                    downloadUsbDiagnosticJson(hidState.lastDiagnosticReport!)
                  }
                  className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-400/40 bg-emerald-500/15 px-3 py-1.5 text-xs font-semibold text-emerald-200 hover:bg-emerald-500/25"
                >
                  <Download className="h-3.5 w-3.5" />
                  {t.inspector.downloadReport}
                </button>
              )}
            </div>
          </div>

          {/* LED Index Calibration Mode */}
          <div className="space-y-3 rounded-xl border border-white/10 bg-[#0B0E14] p-4">
            <div className="flex items-center justify-between">
              <h3 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-amber-300">
                <Crosshair className="h-4 w-4" />
                {t.inspector.calibrationTitle}
              </h3>
              <button
                type="button"
                onClick={resetLedIndexMap}
                className="inline-flex items-center gap-1 text-[11px] text-slate-400 hover:text-cyan-300"
              >
                <RotateCcw className="h-3 w-3" />
                {t.inspector.resetMapping}
              </button>
            </div>
            <p className="text-xs leading-relaxed text-slate-400">
              {t.inspector.calibrationDesc}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setCalibrationActive(!calibrationActive)}
                className={`rounded-lg px-3.5 py-2 text-xs font-semibold transition ${
                  calibrationActive
                    ? 'bg-amber-500/25 text-amber-200 ring-1 ring-amber-400/60'
                    : 'bg-white/5 text-slate-200 ring-1 ring-white/15 hover:bg-white/10'
                }`}
              >
                {calibrationActive
                  ? t.inspector.stopCalibration
                  : t.inspector.startCalibration}
              </button>

              {calibrationActive && (
                <div className="flex items-center gap-1.5 rounded-lg border border-amber-400/40 bg-amber-500/10 px-2.5 py-1.5 font-mono text-xs text-amber-200">
                  <button
                    type="button"
                    onClick={() => setCalibrationLedIndex(calibrationLedIndex - 1)}
                    className="rounded p-0.5 hover:bg-white/10"
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                  </button>
                  <span>
                    {t.inspector.currentLedIndex}: <strong>#{calibrationLedIndex}</strong> / 60
                  </span>
                  <button
                    type="button"
                    onClick={() => setCalibrationLedIndex(calibrationLedIndex + 1)}
                    className="rounded p-0.5 hover:bg-white/10"
                  >
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Custom Generic Protocol Settings */}
          <div className="space-y-3 rounded-xl border border-white/10 bg-[#0B0E14] p-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
              {t.inspector.customProtocolTitle}
            </h3>
            <div className="grid grid-cols-2 gap-2.5 text-xs">
              <label className="space-y-1">
                <span className="text-[11px] text-slate-400">Report ID (Dec)</span>
                <input
                  type="number"
                  min={0}
                  max={255}
                  value={customProtocolConfig.reportId}
                  onChange={(e) =>
                    handleUpdateCustom({ reportId: Number(e.target.value) || 0 })
                  }
                  className="w-full rounded-lg border border-white/10 bg-[#131822] px-2.5 py-1.5 font-mono text-slate-100"
                />
              </label>
              <label className="space-y-1">
                <span className="text-[11px] text-slate-400">Transport</span>
                <select
                  value={customProtocolConfig.transport}
                  onChange={(e) =>
                    handleUpdateCustom({
                      transport: e.target.value as 'output' | 'feature',
                    })
                  }
                  className="w-full rounded-lg border border-white/10 bg-[#131822] px-2.5 py-1.5 font-mono text-slate-100"
                >
                  <option value="output">Output Report</option>
                  <option value="feature">Feature Report</option>
                </select>
              </label>
              <label className="space-y-1">
                <span className="text-[11px] text-slate-400">Header Bytes (Hex)</span>
                <input
                  type="text"
                  value={customProtocolConfig.headerHex}
                  onChange={(e) =>
                    handleUpdateCustom({ headerHex: e.target.value })
                  }
                  className="w-full rounded-lg border border-white/10 bg-[#131822] px-2.5 py-1.5 font-mono text-slate-100"
                />
              </label>
              <label className="space-y-1">
                <span className="text-[11px] text-slate-400">Packet Size (Bytes)</span>
                <input
                  type="number"
                  min={32}
                  max={64}
                  value={customProtocolConfig.packetSize}
                  onChange={(e) =>
                    handleUpdateCustom({
                      packetSize: Number(e.target.value) || 64,
                    })
                  }
                  className="w-full rounded-lg border border-white/10 bg-[#131822] px-2.5 py-1.5 font-mono text-slate-100"
                />
              </label>
            </div>
          </div>

          {/* HID Packet Traffic Log */}
          <div className="space-y-2.5 rounded-xl border border-white/10 bg-[#0B0E14] p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                {t.inspector.trafficTitle} ({traffic.length})
              </h3>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    const next = !paused;
                    setPaused(next);
                    hidManager.setTrafficPaused(next);
                  }}
                  className="inline-flex items-center gap-1 rounded border border-white/10 bg-[#131822] px-2 py-1 text-[11px] text-slate-300 hover:text-white"
                >
                  {paused ? <Play className="h-3 w-3" /> : <Pause className="h-3 w-3" />}
                  {paused ? t.inspector.resume : t.inspector.pause}
                </button>
                <button
                  type="button"
                  onClick={() => void handleCopyLog()}
                  className="inline-flex items-center gap-1 rounded border border-white/10 bg-[#131822] px-2 py-1 text-[11px] text-slate-300 hover:text-cyan-300"
                >
                  {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                  {copied ? t.inspector.copied : t.inspector.copy}
                </button>
                <button
                  type="button"
                  onClick={() => hidManager.clearTrafficLog()}
                  className="inline-flex items-center gap-1 rounded border border-white/10 bg-[#131822] px-2 py-1 text-[11px] text-slate-300 hover:text-rose-300"
                >
                  <Trash2 className="h-3 w-3" />
                  {t.inspector.clear}
                </button>
              </div>
            </div>

            <div className="max-h-64 space-y-1.5 overflow-y-auto rounded-lg bg-[#070A0F] p-2.5 font-mono text-[10.5px]">
              {traffic.length === 0 ? (
                <div className="py-6 text-center text-slate-500">No HID packets logged yet.</div>
              ) : (
                traffic.map((entry) => {
                  const badgeColor =
                    entry.direction === 'tx'
                      ? 'bg-cyan-500/20 text-cyan-300'
                      : entry.direction === 'rx'
                        ? 'bg-violet-500/20 text-violet-300'
                        : entry.direction === 'error'
                          ? 'bg-rose-500/20 text-rose-300'
                          : entry.direction === 'warn'
                            ? 'bg-amber-500/20 text-amber-300'
                            : 'bg-slate-700/60 text-slate-300';
                  return (
                    <div
                      key={entry.id}
                      className="rounded border border-white/[0.05] bg-[#0E131D] p-2"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`rounded px-1.5 py-0.5 text-[9px] font-bold uppercase ${badgeColor}`}
                          >
                            {entry.direction}
                          </span>
                          <span className="text-slate-200">{entry.summary}</span>
                        </div>
                        <span className="text-[9.5px] text-slate-500">
                          {entry.timestamp}
                        </span>
                      </div>
                      {entry.hex !== '—' && (
                        <div className="mt-1 break-all text-[10px] text-slate-400">
                          {entry.hex}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
};

