import React, { useEffect, useState } from 'react';
import {
  Usb,
  RotateCcw,
  Wrench,
  Keyboard,
  Languages,
  Cpu,
  AlertTriangle,
  Rocket,
  CheckCircle2,
  MousePointer2,
  Sparkles,
} from 'lucide-react';
import { useWaveStore } from '../../store/useWaveStore';
import { TRANSLATIONS } from '../../i18n';
import {
  WAVE_MODEL_SPECS,
  WAVE_MODELS_ORDER,
  type WaveModelId,
} from '../../core/protocols/types';
import { waveHidManager, type WaveHidState } from '../../core/hid/hidManager';
import {
  refreshBackgroundDriverStatus,
  subscribeDriverStatus,
  type BackgroundDriverStatus,
} from '../../core/hid/backgroundDriverClient';
import type { AnimeCharacterProfile } from '../anime/animeCharacters';

interface HeaderProps {
  hidState: WaveHidState;
  animeCursor: boolean;
  onToggleCursor: () => void;
  onReturnToGate?: () => void;
  character: AnimeCharacterProfile;
}

const BackgroundDriverBadge: React.FC = React.memo(() => {
  const [st, setSt] = useState<BackgroundDriverStatus | null>(null);
  useEffect(() => {
    const unsub = subscribeDriverStatus(setSt);
    void refreshBackgroundDriverStatus();
    return unsub;
  }, []);
  if (!st || !st.installed) return null;
  return (
    <span
      title={`Driver chạy ngầm (${st.running ? 'Đang chạy' : 'Tạm dừng'}): ${st.effectName ?? 'Custom'}`}
      className={`hidden items-center gap-1.5 rounded-full border px-3 py-1 font-mono text-[11px] font-bold md:inline-flex ${
        st.running
          ? 'border-emerald-400/50 bg-emerald-500/15 text-emerald-200'
          : 'border-amber-400/40 bg-amber-500/10 text-amber-200'
      }`}
    >
      <Rocket className="h-3.5 w-3.5" />
      {st.running ? `Tự chạy: ${st.effectName ?? 'Custom'}` : 'Tạm dừng tự chạy'}
    </span>
  );
});

export const Header: React.FC<HeaderProps> = ({
  hidState,
  animeCursor,
  onToggleCursor,
  onReturnToGate,
  character,
}) => {
  const language = useWaveStore((s) => s.language);
  const setLanguage = useWaveStore((s) => s.setLanguage);
  const activeModel = useWaveStore((s) => s.activeModel);
  const setActiveModel = useWaveStore((s) => s.setActiveModel);
  const setDiagnosticsOpen = useWaveStore((s) => s.setDiagnosticsOpen);
  const setShortcutsOpen = useWaveStore((s) => s.setShortcutsOpen);

  const t = TRANSLATIONS[language];
  const spec = WAVE_MODEL_SPECS[activeModel];
  const webHidOk = waveHidManager.isWebHidSupported();

  const handleModelSwitch = (m: WaveModelId) => {
    setActiveModel(m);
    waveHidManager.switchSimulatedModel(m);
  };

  return (
    <header
      className="sticky top-0 z-30 border-b backdrop-blur-xl transition-colors duration-300"
      style={{
        backgroundColor: `${character.theme.bg}dc`,
        borderColor: `rgba(${character.theme.primaryRgb}, 0.24)`,
        boxShadow: `0 6px 30px rgba(0,0,0,0.45)`,
      }}
    >
      {!webHidOk && (
        <div className="border-b border-amber-500/30 bg-amber-500/10 px-4 py-2 text-xs text-amber-200">
          <div className="mx-auto flex max-w-7xl items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400" />
            <span>
              <strong>{t.browserWarning.title}:</strong> {t.browserWarning.body}
            </span>
          </div>
        </div>
      )}

      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3">
        {/* Brand + Anime Avatar + Connection Pill */}
        <div className="flex items-center gap-3.5">
          <button
            type="button"
            onClick={onReturnToGate}
            title={language === 'vi' ? 'Về màn hình chào Anime' : 'Back to Anime Welcome Screen'}
            className="group relative h-11 w-11 overflow-hidden rounded-2xl border-2 transition hover:scale-105"
            style={{
              borderColor: character.theme.primary,
              boxShadow: `0 0 22px rgba(${character.theme.primaryRgb}, 0.45)`,
            }}
          >
            <img
              src={character.avatarImage}
              alt={character.name}
              className="h-full w-full object-cover object-top"
            />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1
                className={`bg-gradient-to-r ${character.accentGradient} bg-clip-text text-lg font-black tracking-tight text-transparent`}
              >
                {t.app.title}
              </h1>
              <span className="anime-badge-themed hidden items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wider sm:inline-flex">
                <Sparkles className="h-2.5 w-2.5" />
                {character.shortName}
              </span>
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                  hidState.connected
                    ? 'bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-400/40'
                    : 'bg-white/[0.08] text-slate-200 ring-1 ring-white/15'
                }`}
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    hidState.connected ? 'animate-pulse bg-emerald-400' : 'bg-slate-400'
                  }`}
                />
                {hidState.connected ? t.app.liveMode : t.app.simulatorMode}
              </span>
            </div>
            <p className="text-xs text-slate-300/70">{t.app.subtitle}</p>
          </div>
        </div>

        {/* Center-Right: Prominent Primary Connection Button + Compact Secondary Utilities */}
        <div className="flex flex-wrap items-center gap-2">
          <BackgroundDriverBadge />

          {/* Hero Primary USB Connect / Disconnect CTA */}
          {!hidState.connected ? (
            <button
              type="button"
              onClick={() => {
                waveHidManager.connectDevice(activeModel).catch(() => {});
              }}
              className="anime-btn-primary anime-btn-shimmer inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold text-white transition hover:scale-[1.02] active:scale-[0.99]"
            >
              <Usb className="h-4 w-4" />
              {t.app.connectNative}
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <span className="hidden items-center gap-1.5 rounded-xl border border-emerald-400/40 bg-emerald-500/15 px-3 py-2 text-xs font-bold text-emerald-200 sm:inline-flex">
                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                {spec.shortName}
              </span>
              <button
                type="button"
                onClick={() => void waveHidManager.handBackAndDisconnect()}
                className="inline-flex items-center gap-1.5 rounded-xl border border-amber-400/45 bg-amber-500/15 px-3.5 py-2 text-xs font-bold text-amber-200 transition hover:bg-amber-500/25"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                {t.app.handBackBtn}
              </button>
            </div>
          )}

          {/* Compact Secondary Controls Divider */}
          <div className="hidden h-6 w-px bg-rose-300/15 sm:block" />

          <select
            value={activeModel}
            onChange={(e) => handleModelSwitch(e.target.value as WaveModelId)}
            aria-label="WAVE75 Model Selector"
            className="rounded-xl border border-rose-300/20 bg-[#1a0c17] px-2.5 py-2 text-xs font-medium text-rose-100 focus:border-rose-400 focus:outline-none"
          >
            {WAVE_MODELS_ORDER.map((id) => (
              <option key={id} value={id} className="bg-[#1a0c17]">
                {WAVE_MODEL_SPECS[id].shortName}
              </option>
            ))}
          </select>

          {!hidState.connected && (
            <button
              type="button"
              onClick={() => {
                waveHidManager
                  .connectDevice(activeModel, { preferQmkVia: true })
                  .catch(() => {});
              }}
              title="Kết nối qua chế độ QMK / VIA"
              className="inline-flex items-center gap-1 rounded-xl border border-rose-300/20 bg-[#1a0c17] px-2.5 py-2 text-xs font-medium text-rose-200/80 transition hover:border-rose-400/50 hover:text-white"
            >
              <Cpu className="h-3.5 w-3.5" />
              <span className="hidden xl:inline">QMK</span>
            </button>
          )}

          <button
            type="button"
            onClick={onToggleCursor}
            title={language === 'vi' ? 'Bật / Tắt trỏ chuột Anime' : 'Toggle Anime Cursor'}
            className={`inline-flex items-center gap-1 rounded-xl border px-2.5 py-2 text-xs font-medium transition ${
              animeCursor
                ? 'border-rose-400/50 bg-rose-500/20 text-rose-100'
                : 'border-rose-300/20 bg-[#1a0c17] text-rose-200/70 hover:border-rose-400/40'
            }`}
          >
            <MousePointer2 className="h-3.5 w-3.5" />
          </button>

          <button
            type="button"
            onClick={() => setShortcutsOpen(true)}
            title={t.app.shortcutsBtn}
            className="inline-flex items-center gap-1 rounded-xl border border-rose-300/20 bg-[#1a0c17] px-2.5 py-2 text-xs font-medium text-rose-200/80 transition hover:border-rose-400/50 hover:text-white"
          >
            <Keyboard className="h-3.5 w-3.5" />
          </button>

          <button
            type="button"
            onClick={() => setDiagnosticsOpen(true)}
            title={t.app.hidDiagnostics}
            className="inline-flex items-center gap-1 rounded-xl border border-rose-300/20 bg-[#1a0c17] px-2.5 py-2 text-xs font-medium text-rose-200/70 transition hover:border-rose-400/50 hover:text-white"
          >
            <Wrench className="h-3.5 w-3.5" />
          </button>

          <button
            type="button"
            onClick={() => setLanguage(language === 'vi' ? 'en' : 'vi')}
            className="inline-flex items-center gap-1 rounded-xl border border-rose-300/20 bg-[#1a0c17] px-2.5 py-2 font-mono text-xs font-bold text-amber-300 transition hover:border-rose-400/50"
          >
            <Languages className="h-3.5 w-3.5" />
            {language.toUpperCase()}
          </button>
        </div>
      </div>

      {/* Live WebHID Error Banner */}
      {hidState.lastError && (
        <div className="border-t border-rose-500/35 bg-rose-500/15 px-4 py-2 text-xs text-rose-200">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0 text-rose-400" />
              <span>{hidState.lastError}</span>
            </div>
            <button
              type="button"
              onClick={() => setDiagnosticsOpen(true)}
              className="shrink-0 rounded-lg border border-rose-400/40 bg-rose-500/20 px-2.5 py-1 text-[11px] font-semibold text-rose-100 hover:bg-rose-500/30"
            >
              {t.app.hidDiagnostics}
            </button>
          </div>
        </div>
      )}
    </header>
  );
};
