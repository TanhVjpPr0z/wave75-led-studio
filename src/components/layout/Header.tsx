import React, { useEffect, useState } from 'react';
import {
  Cpu,
  Usb,
  Unplug,
  Wrench,
  ShieldCheck,
  Languages,
  Activity,
} from 'lucide-react';
import { useStudioStore } from '../../store/useStudioStore';
import { TRANSLATIONS } from '../../i18n';
import {
  MODEL_SPECS,
  SELECTABLE_MODELS,
} from '../../core/protocols/registry';
import type { KeyboardModelId } from '../../core/protocols/types';
import {
  hidManager,
  type HidConnectionState,
  type HidStreamTelemetry,
} from '../../core/hid/hidManager';

const UsbTelemetryBadge: React.FC<{ connected: boolean }> = React.memo(({ connected }) => {
  const [telem, setTelem] = useState<HidStreamTelemetry>(() => hidManager.getStreamTelemetry());
  const usbFpsLimit = useStudioStore((s) => s.usbFpsLimit);
  const setUsbFpsLimit = useStudioStore((s) => s.setUsbFpsLimit);

  useEffect(() => {
    if (!connected) return;
    return hidManager.subscribeTelemetry(setTelem);
  }, [connected]);

  if (!connected || telem.actualFps <= 0) return null;

  const cycleFps = () => {
    const next = usbFpsLimit >= 90 ? 60 : 90;
    setUsbFpsLimit(next);
    hidManager.setMaxFps(next);
  };

  return (
    <button
      type="button"
      onClick={cycleFps}
      title="Nhấn để chuyển 60 FPS / MAX (90 FPS) • Hiển thị FPS thực tế & độ trễ ACK phần cứng"
      className="hidden items-center gap-1 rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-2 py-1 font-mono text-[10px] font-semibold text-cyan-300 transition hover:bg-cyan-500/20 md:inline-flex"
    >
      <Activity className="h-3 w-3" />
      {telem.actualFps} FPS • {telem.avgTxMs}ms ({usbFpsLimit >= 90 ? 'MAX' : `${usbFpsLimit}`})
    </button>
  );
});

interface HeaderProps {
  hidState: HidConnectionState;
}

export const Header: React.FC<HeaderProps> = ({ hidState }) => {
  const language = useStudioStore((s) => s.language);
  const setLanguage = useStudioStore((s) => s.setLanguage);
  const selectedModel = useStudioStore((s) => s.selectedModel);
  const setSelectedModel = useStudioStore((s) => s.setSelectedModel);
  const setInspectorOpen = useStudioStore((s) => s.setInspectorOpen);
  const setSafetyModalOpen = useStudioStore((s) => s.setSafetyModalOpen);

  const t = TRANSLATIONS[language];
  const activeSpec = MODEL_SPECS[hidState.detectedModel];

  const handleModelChange = (nextModel: KeyboardModelId) => {
    setSelectedModel(nextModel);
    if (hidState.mode === 'simulator') {
      hidManager.switchSimulatedModel(nextModel);
    }
  };

  const handleConnectClick = async () => {
    try {
      await hidManager.connectDevice(selectedModel, false);
    } catch {
      // Errors are surfaced cleanly inside HID Inspector & connection badge
    }
  };

  const handleManualConnect = async () => {
    try {
      await hidManager.connectDevice(selectedModel, true);
    } catch {
      // Handled by hidManager state
    }
  };

  return (
    <header className="sticky top-0 z-30 border-b border-white/[0.08] bg-[#0B0E14]/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3">
        {/* Brand Logo */}
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500/25 via-violet-500/20 to-transparent ring-1 ring-cyan-400/40 shadow-[0_0_20px_rgba(6,182,212,0.2)]">
            <Cpu className="h-5 w-5 text-cyan-300" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-extrabold tracking-tight text-white">
                {t.app.title}
              </h1>
              <span className="rounded bg-cyan-500/15 px-1.5 py-0.5 font-mono text-[10px] font-bold text-cyan-300 ring-1 ring-cyan-400/30">
                {activeSpec.badge}
              </span>
            </div>
            <p className="text-[11px] text-slate-400">{t.app.subtitle}</p>
          </div>
        </div>

        {/* Center-Right Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Model Selector */}
          <select
            value={selectedModel}
            onChange={(e) => handleModelChange(e.target.value as KeyboardModelId)}
            aria-label="Model Selector"
            className="rounded-xl border border-white/10 bg-[#131822] px-3 py-2 text-xs font-medium text-slate-200 focus:border-cyan-400 focus:outline-none"
          >
            {SELECTABLE_MODELS.map((m) => (
              <option key={m} value={m}>
                {m === 'auto' ? t.app.modelAuto : MODEL_SPECS[m].shortName}
              </option>
            ))}
          </select>

          {/* Connection Status Pill */}
          <div
            className={`flex items-center gap-2 rounded-xl border px-3 py-1.5 text-xs ${
              hidState.connected
                ? 'border-emerald-500/35 bg-emerald-500/10 text-emerald-300'
                : 'border-violet-500/30 bg-violet-500/10 text-violet-200'
            }`}
          >
            <span
              className={`h-2 w-2 rounded-full ${
                hidState.connected
                  ? 'animate-pulse bg-emerald-400 shadow-[0_0_8px_#34D399]'
                  : 'bg-violet-400'
              }`}
            />
            <div className="flex flex-col leading-tight">
              <span className="font-semibold">
                {hidState.connected ? t.app.liveMode : t.app.simulatorMode}
              </span>
              <span className="font-mono text-[10px] opacity-80">
                {hidState.deviceInfo
                  ? `${hidState.deviceInfo.vendorIdHex}:${hidState.deviceInfo.productIdHex}`
                  : activeSpec.shortName}
              </span>
            </div>
          </div>

          <UsbTelemetryBadge connected={hidState.connected} />

          {/* Primary USB Connect / Disconnect Button */}
          {!hidState.connected ? (
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={handleConnectClick}
                className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-cyan-500 to-violet-500 px-3.5 py-2 text-xs font-semibold text-white shadow-lg shadow-cyan-500/20 transition hover:brightness-110"
              >
                <Usb className="h-3.5 w-3.5" />
                {t.app.connectUsb}
              </button>
              <button
                type="button"
                onClick={handleManualConnect}
                title={t.app.manualConnect}
                className="inline-flex items-center gap-1 rounded-xl border border-white/10 bg-[#131822] px-2.5 py-2 text-xs font-medium text-slate-300 transition hover:border-cyan-400/40 hover:text-cyan-200"
              >
                <Activity className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => void hidManager.disconnect()}
              className="inline-flex items-center gap-1.5 rounded-xl border border-rose-500/40 bg-rose-500/15 px-3.5 py-2 text-xs font-semibold text-rose-200 transition hover:bg-rose-500/25"
            >
              <Unplug className="h-3.5 w-3.5" />
              {t.app.disconnectUsb}
            </button>
          )}

          {/* HID Diagnostics Drawer Trigger */}
          <button
            type="button"
            onClick={() => setInspectorOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-[#131822] px-3 py-2 text-xs font-medium text-slate-300 transition hover:border-cyan-400/40 hover:text-cyan-200"
          >
            <Wrench className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{t.app.hidInspector}</span>
          </button>

          {/* Safety Modal Trigger */}
          <button
            type="button"
            onClick={() => setSafetyModalOpen(true)}
            title={t.app.safetyGuide}
            className="rounded-xl border border-white/10 bg-[#131822] p-2 text-emerald-400 transition hover:border-emerald-400/40 hover:bg-emerald-500/10"
          >
            <ShieldCheck className="h-4 w-4" />
          </button>

          {/* Language Toggle VI / EN */}
          <button
            type="button"
            onClick={() => setLanguage(language === 'vi' ? 'en' : 'vi')}
            className="inline-flex items-center gap-1 rounded-xl border border-white/10 bg-[#131822] px-2.5 py-2 font-mono text-xs font-bold text-cyan-300 transition hover:border-cyan-400/40"
          >
            <Languages className="h-3.5 w-3.5" />
            {language.toUpperCase()}
          </button>
        </div>
      </div>

      {/* Model Capabilities Strip */}
      <div className="border-t border-white/[0.04] bg-[#0F141D]/90 px-4 py-1.5">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <span>
              <strong className="text-slate-200">{activeSpec.fullName}</strong>
            </span>
            <span className="font-mono text-slate-500">
              Platform: <span className="text-cyan-300/90">{activeSpec.driverPlatform}</span>
            </span>
            <span className="font-mono text-slate-500">
              Polling: <span className="text-slate-300">{hidState.capabilities.pollingRateLabel}</span>
            </span>
          </div>
          <span className="text-slate-400">
            {language === 'vi' ? activeSpec.notesVi : activeSpec.notesEn}
          </span>
        </div>
      </div>

      {/* Prominent WebHID Error Banner */}
      {hidState.lastError && (
        <div className="border-t border-rose-500/35 bg-rose-500/15 px-4 py-2 text-xs text-rose-200">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-3">
            <span>{hidState.lastError}</span>
            <button
              type="button"
              onClick={() => setInspectorOpen(true)}
              className="shrink-0 rounded-lg border border-rose-400/40 bg-rose-500/20 px-2.5 py-1 text-[11px] font-semibold text-rose-100 hover:bg-rose-500/30"
            >
              {t.app.hidInspector}
            </button>
          </div>
        </div>
      )}
    </header>
  );
};

