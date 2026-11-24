import React, { useState } from 'react';
import {
  X,
  ShieldCheck,
  Search,
  Usb,
  Download,
  Crosshair,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  Pause,
  Play,
  Trash2,
  Copy,
  Check,
} from 'lucide-react';
import { useWaveStore } from '../../store/useWaveStore';
import { TRANSLATIONS } from '../../i18n';
import { waveHidManager, type WaveHidState } from '../../core/hid/hidManager';
import type { HidTrafficPacket } from '../../core/protocols/types';
import { downloadWaveDiagnosticJson } from '../../core/hid/usbDiagnostics';

interface HidDiagnosticsDrawerProps {
  hidState: WaveHidState;
  traffic: HidTrafficPacket[];
}

export const HidDiagnosticsDrawer: React.FC<HidDiagnosticsDrawerProps> = ({
  hidState,
  traffic,
}) => {
  const language = useWaveStore((s) => s.language);
  const open = useWaveStore((s) => s.diagnosticsOpen);
  const setOpen = useWaveStore((s) => s.setDiagnosticsOpen);
  const activeModel = useWaveStore((s) => s.activeModel);

  const calibrationActive = useWaveStore((s) => s.calibrationActive);
  const calibrationLightIndex = useWaveStore((s) => s.calibrationLightIndex);
  const setCalibrationActive = useWaveStore((s) => s.setCalibrationActive);
  const stepCalibrationIndex = useWaveStore((s) => s.stepCalibrationIndex);
  const resetLightIndexMap = useWaveStore((s) => s.resetLightIndexMap);

  const [paused, setPaused] = useState(false);
  const [copied, setCopied] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const t = TRANSLATIONS[language];

  if (!open) return null;

  const info = hidState.deviceInfo;

  const handleInspect = async () => {
    setMsg(null);
    try {
      const rep = await waveHidManager.inspectUsbReadOnly();
      if (rep) {
        setMsg(
          `${rep.device.productName} (${rep.device.vendorIdHex}:${rep.device.productIdHex}) • ${rep.collections.length} collections (${rep.detectedProtocol})`
        );
      }
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Inspect failed');
    }
  };

  const handleCopy = async () => {
    const txt = traffic
      .map(
        (p) =>
          `[${p.timestamp}] ${p.direction.toUpperCase()} ${p.opcodeHex} ${
            p.statusTag ? `[${p.statusTag}] ` : ''
          }| ${p.summary} | ${p.hex}`
      )
      .join('\n');
    await navigator.clipboard.writeText(txt);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/65 backdrop-blur-xs">
      <aside className="flex h-full w-full max-w-xl flex-col border-l border-white/10 bg-[#0F141E] shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <div>
            <h2 className="text-base font-bold text-slate-100">{t.diagnostics.title}</h2>
            <p className="font-mono text-[11px] text-slate-400">
              0x36B0:0x3009 • Gap #46 Guard • RGB565/RGB888
            </p>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-white/5 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto p-5">
          <div className="flex items-start gap-2.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-200">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
            <span>{t.diagnostics.safety}</span>
          </div>

          {/* USB Descriptor Metadata */}
          <div className="space-y-3 rounded-xl border border-white/10 bg-[#0A0D12] p-4">
            <div className="grid grid-cols-2 gap-2 font-mono text-[11px]">
              <div className="rounded-lg bg-[#121721] p-2.5">
                <span className="block text-[10px] text-slate-500">Product Name</span>
                <span className="text-slate-100">{info.productName}</span>
              </div>
              <div className="rounded-lg bg-[#121721] p-2.5">
                <span className="block text-[10px] text-slate-500">VID : PID</span>
                <span className="text-sky-300">
                  {info.vendorIdHex} : {info.productIdHex}
                </span>
              </div>
              <div className="rounded-lg bg-[#121721] p-2.5">
                <span className="block text-[10px] text-slate-500">UsagePage / Usage</span>
                <span className="text-indigo-300">
                  {info.usagePageHex} / {info.usageHex}
                </span>
              </div>
              <div className="rounded-lg bg-[#121721] p-2.5">
                <span className="block text-[10px] text-slate-500">Report ID / Size</span>
                <span className="text-slate-200">
                  ID {info.reportId} • {info.packetSize}B ({info.transportMode})
                </span>
              </div>
            </div>

            {msg && (
              <div className="rounded-lg border border-sky-400/30 bg-sky-500/10 px-3 py-1.5 font-mono text-[11px] text-sky-200">
                {msg}
              </div>
            )}
            {hidState.lastError && (
              <div className="rounded-lg border border-rose-500/35 bg-rose-500/10 px-3 py-1.5 text-xs text-rose-200">
                {hidState.lastError}
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void handleInspect()}
                className="inline-flex items-center gap-1.5 rounded-lg border border-sky-400/40 bg-sky-500/15 px-3 py-1.5 text-xs font-semibold text-sky-200 hover:bg-sky-500/25"
              >
                <Search className="h-3.5 w-3.5" />
                {t.diagnostics.readOnlyInspect}
              </button>
              <button
                type="button"
                onClick={() =>
                  void waveHidManager.connectDevice(activeModel, { manualAllHid: true })
                }
                className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-[#121721] px-3 py-1.5 text-xs font-medium text-slate-200 hover:border-sky-400/50"
              >
                <Usb className="h-3.5 w-3.5" />
                {t.diagnostics.manualConnect}
              </button>
              {hidState.lastDiagnosticReport && (
                <button
                  type="button"
                  onClick={() =>
                    downloadWaveDiagnosticJson(hidState.lastDiagnosticReport!)
                  }
                  className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-400/40 bg-emerald-500/15 px-3 py-1.5 text-xs font-semibold text-emerald-200 hover:bg-emerald-500/25"
                >
                  <Download className="h-3.5 w-3.5" />
                  {t.diagnostics.downloadReport}
                </button>
              )}
            </div>
          </div>

          {/* LED Index Calibrator (0..81, Skipping #46) */}
          <div className="space-y-3 rounded-xl border border-white/10 bg-[#0A0D12] p-4">
            <div className="flex items-center justify-between gap-2">
              <h3 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-amber-300">
                <Crosshair className="h-4 w-4" />
                {t.diagnostics.calibratorTitle}
              </h3>
              <button
                type="button"
                onClick={resetLightIndexMap}
                className="inline-flex items-center gap-1 text-[11px] text-slate-400 hover:text-sky-300"
              >
                <RotateCcw className="h-3 w-3" />
                {t.diagnostics.resetMap}
              </button>
            </div>
            <p className="text-xs leading-relaxed text-slate-400">
              {t.diagnostics.calibratorDesc}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setCalibrationActive(!calibrationActive)}
                className={`rounded-lg px-3.5 py-2 text-xs font-semibold ${
                  calibrationActive
                    ? 'bg-amber-500/25 text-amber-200 ring-1 ring-amber-400/60'
                    : 'bg-white/5 text-slate-200 ring-1 ring-white/15 hover:bg-white/10'
                }`}
              >
                {calibrationActive ? t.diagnostics.stopCal : t.diagnostics.startCal}
              </button>

              {calibrationActive && (
                <div className="flex items-center gap-1.5 rounded-lg border border-amber-400/40 bg-amber-500/10 px-2.5 py-1.5 font-mono text-xs text-amber-200">
                  <button
                    type="button"
                    onClick={() => stepCalibrationIndex(-1)}
                    className="rounded p-0.5 hover:bg-white/10"
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                  </button>
                  <span>
                    lightIndex <strong>#{calibrationLightIndex}</strong> / 81
                  </span>
                  <button
                    type="button"
                    onClick={() => stepCalibrationIndex(1)}
                    className="rounded p-0.5 hover:bg-white/10"
                  >
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* HID Packet Monitor */}
          <div className="space-y-2.5 rounded-xl border border-white/10 bg-[#0A0D12] p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                {t.diagnostics.trafficTitle} ({traffic.length})
              </h3>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    const next = !paused;
                    setPaused(next);
                    waveHidManager.setTrafficPaused(next);
                  }}
                  className="inline-flex items-center gap-1 rounded border border-white/10 bg-[#121721] px-2 py-1 text-[11px] text-slate-300"
                >
                  {paused ? <Play className="h-3 w-3" /> : <Pause className="h-3 w-3" />}
                </button>
                <button
                  type="button"
                  onClick={() => void handleCopy()}
                  className="inline-flex items-center gap-1 rounded border border-white/10 bg-[#121721] px-2 py-1 text-[11px] text-slate-300"
                >
                  {copied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                </button>
                <button
                  type="button"
                  onClick={() => waveHidManager.clearTrafficLog()}
                  className="inline-flex items-center gap-1 rounded border border-white/10 bg-[#121721] px-2 py-1 text-[11px] text-slate-300 hover:text-rose-300"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            </div>

            <div className="max-h-72 space-y-1.5 overflow-y-auto rounded-lg bg-[#06080D] p-2.5 font-mono text-[10.5px]">
              {traffic.map((p) => (
                <div
                  key={p.id}
                  className="rounded border border-white/[0.05] bg-[#0D121C] p-2"
                >
                  <div className="flex flex-wrap items-center justify-between gap-1.5">
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`rounded px-1.5 py-0.5 text-[9px] font-bold uppercase ${
                          p.direction === 'tx'
                            ? 'bg-sky-500/20 text-sky-300'
                            : p.direction === 'rx'
                              ? 'bg-indigo-500/20 text-indigo-300'
                              : p.direction === 'error'
                                ? 'bg-rose-500/20 text-rose-300'
                                : 'bg-slate-700/60 text-slate-300'
                        }`}
                      >
                        {p.direction} {p.opcodeHex}
                      </span>
                      {p.statusTag && (
                        <span
                          className={`rounded px-1.5 py-0.5 text-[9px] font-bold ${
                            p.statusTag === '0x55 OK'
                              ? 'bg-emerald-500/20 text-emerald-300'
                              : 'bg-rose-500/25 text-rose-200'
                          }`}
                        >
                          {p.statusTag}
                        </span>
                      )}
                      <span className="text-slate-200">{p.summary}</span>
                    </div>
                    <span className="text-[9.5px] text-slate-500">{p.timestamp}</span>
                  </div>
                  {p.hex !== '—' && (
                    <div className="mt-1 break-all text-[10px] text-slate-400">{p.hex}</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
};

