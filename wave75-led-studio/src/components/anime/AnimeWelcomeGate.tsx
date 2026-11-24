import React, { useState } from 'react';
import {
  Usb,
  Sparkles,
  AlertTriangle,
  Cpu,
  Languages,
  Eye,
  Heart,
  Zap,
  MousePointer2,
  Sliders,
} from 'lucide-react';
import { waveHidManager, type WaveHidState } from '../../core/hid/hidManager';
import { useWaveStore } from '../../store/useWaveStore';
import {
  WAVE_MODEL_SPECS,
  WAVE_MODELS_ORDER,
  type WaveModelId,
} from '../../core/protocols/types';
import { SakuraPetalsBackdrop } from './SakuraPetalsBackdrop';
import { AnimeCharacterStage } from './AnimeCharacterStage';
import {
  ANIME_CHARACTERS,
  type AnimeCharacterId,
  type AnimeCharacterProfile,
  type AnimeStageSettings,
} from './animeCharacters';

interface AnimeWelcomeGateProps {
  hidState: WaveHidState;
  character: AnimeCharacterProfile;
  stageSettings: AnimeStageSettings;
  onSelectCharacter: (id: AnimeCharacterId) => void;
  onOpenMotionEditor: () => void;
  onEnterPreview: () => void;
  animeCursor: boolean;
  onToggleCursor: () => void;
}

export const AnimeWelcomeGate: React.FC<AnimeWelcomeGateProps> = ({
  hidState,
  character,
  stageSettings,
  onSelectCharacter,
  onOpenMotionEditor,
  onEnterPreview,
  animeCursor,
  onToggleCursor,
}) => {
  const language = useWaveStore((s) => s.language);
  const setLanguage = useWaveStore((s) => s.setLanguage);
  const activeModel = useWaveStore((s) => s.activeModel);
  const setActiveModel = useWaveStore((s) => s.setActiveModel);

  const [connecting, setConnecting] = useState(false);

  const isVi = language === 'vi';
  const webHidOk = waveHidManager.isWebHidSupported();

  const handleConnect = async (preferQmkVia = false) => {
    setConnecting(true);
    try {
      await waveHidManager.connectDevice(activeModel, { preferQmkVia });
    } catch {
      // Error surfaced cleanly via hidState.lastError
    } finally {
      setConnecting(false);
    }
  };

  return (
    <div className="relative flex min-h-screen w-full flex-col justify-between overflow-hidden bg-[#090408] text-rose-50 select-none">
      {/* 2.5D Live2D GPU-Composited Character Stage (Zero React Re-Renders!) */}
      <AnimeCharacterStage
        character={character}
        settings={stageSettings}
        variant="gate"
      />

      {/* Cinematic Vignette keeping Left Controls Super Readable while Character Shines */}
      <div
        className="pointer-events-none absolute inset-0 z-[1]"
        style={{
          background: `linear-gradient(100deg, ${character.theme.bg}f2 0%, ${character.theme.bg}d6 38%, rgba(12,8,16,0.32) 68%, ${character.theme.bg}6e 100%)`,
        }}
      />
      <div
        className="pointer-events-none absolute inset-0 z-[1] transition-all duration-500"
        style={{
          background: `radial-gradient(circle at 20% 50%, rgba(${character.theme.primaryRgb}, 0.22), transparent 56%), radial-gradient(circle at 82% 20%, rgba(${character.theme.accentRgb}, 0.14), transparent 46%)`,
        }}
      />

      {/* Floating Petals Layer in Character Signature Colors */}
      <SakuraPetalsBackdrop
        density={24}
        zIndexClass="z-10"
        colors={character.theme.particleColors}
      />

      {/* Top Floating Bar */}
      <header className="relative z-20 mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-3 px-6 py-5">
        <div className="flex items-center gap-3">
          <div
            className="h-10 w-10 overflow-hidden rounded-2xl border-2 transition-all duration-300"
            style={{
              borderColor: character.theme.primary,
              boxShadow: `0 0 22px rgba(${character.theme.primaryRgb}, 0.5)`,
            }}
          >
            <img
              src={stageSettings.customImageUrl || character.avatarImage}
              alt={character.name}
              className="h-full w-full object-cover object-top"
            />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-black tracking-wider text-white">
                WAVE75 STUDIO
              </span>
              <span className="anime-badge-themed inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-bold tracking-wider backdrop-blur-md">
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: character.theme.primary }}
                />
                {isVi ? character.theme.themeNameVi : character.theme.themeNameEn}
              </span>
            </div>
            <p className="font-mono text-[10px] tracking-[0.18em] text-slate-300/80">
              {character.jpTag}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onOpenMotionEditor}
            className="inline-flex items-center gap-1.5 rounded-xl border border-amber-400/45 bg-amber-500/15 px-3 py-1.5 text-xs font-bold text-amber-100 backdrop-blur-md transition hover:bg-amber-500/25"
          >
            <Sliders className="h-3.5 w-3.5 text-amber-300" />
            <span>{isVi ? 'Chỉnh chuyển động' : 'Edit Motion'}</span>
          </button>

          <button
            type="button"
            onClick={onToggleCursor}
            title={isVi ? 'Bật / Tắt con trỏ Anime' : 'Toggle Anime Cursor'}
            className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold backdrop-blur-md transition ${
              animeCursor
                ? 'border-rose-400/55 bg-rose-500/20 text-rose-100'
                : 'border-white/15 bg-black/45 text-slate-300 hover:border-rose-400/40'
            }`}
          >
            <MousePointer2 className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">
              {isVi ? 'Trỏ Anime' : 'Anime Cursor'}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setLanguage(isVi ? 'en' : 'vi')}
            className="inline-flex items-center gap-1.5 rounded-xl border border-rose-300/25 bg-black/45 px-3 py-1.5 font-mono text-xs font-bold text-rose-200 backdrop-blur-md transition hover:border-rose-400/60"
          >
            <Languages className="h-3.5 w-3.5" />
            {language.toUpperCase()}
          </button>
        </div>
      </header>

      {/* Main Left-Aligned Welcome Stage */}
      <main className="relative z-20 mx-auto flex w-full max-w-7xl flex-1 items-center px-6 py-4">
        <div className="max-w-xl space-y-5">
          {/* Character Switcher Strip right on Welcome Gate */}
          <div className="anime-gate-stagger-1">
            <div className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-rose-200/80">
              <Sparkles className="h-3.5 w-3.5 text-amber-300" />
              {isVi ? 'Chọn nhân vật đồng hành:' : 'Choose Anime Companion:'}
            </div>
            <div className="flex flex-wrap gap-2">
              {ANIME_CHARACTERS.map((ch) => {
                const active = ch.id === character.id;
                return (
                  <button
                    key={ch.id}
                    type="button"
                    onClick={() => onSelectCharacter(ch.id)}
                    className={`inline-flex items-center gap-2 rounded-full border py-1 pl-1 pr-3 text-xs font-bold backdrop-blur-md transition ${
                      active
                        ? 'anime-pill-active'
                        : 'border-white/15 bg-black/45 text-slate-200/80 hover:border-white/40 hover:text-white'
                    }`}
                  >
                    <img
                      src={ch.avatarImage}
                      alt={ch.shortName}
                      className="h-6 w-6 rounded-full border border-white/30 object-cover object-top"
                    />
                    <span>{ch.shortName}</span>
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ backgroundColor: ch.theme.primary }}
                    />
                  </button>
                );
              })}
            </div>
          </div>

          {/* Stagger 2: Glowing Title */}
          <div className="anime-gate-stagger-2 space-y-2">
            <div className="anime-badge-themed inline-flex items-center gap-2 rounded-full px-3.5 py-1 text-xs font-bold backdrop-blur-md">
              <Heart
                className="h-3.5 w-3.5"
                style={{ fill: character.theme.primary, color: character.theme.primary }}
              />
              {isVi
                ? 'Kết nối bàn phím WAVE75 để mở khóa toàn bộ Studio'
                : 'Connect your WAVE75 keyboard to unlock Studio'}
            </div>

            <h1 className="text-3xl font-black leading-[1.1] tracking-tight text-white sm:text-5xl">
              <span
                className={`block bg-gradient-to-r ${character.accentGradient} bg-clip-text text-transparent`}
              >
                {isVi ? character.welcomeTitleVi : character.welcomeTitleEn}
              </span>
            </h1>
          </div>

          {/* Stagger 3: Authentic Character Visual Novel Dialogue Card */}
          <div className="anime-gate-stagger-3 anime-glass flex items-center gap-4 rounded-2xl p-4">
            <div
              className="anime-float relative h-16 w-16 shrink-0 overflow-hidden rounded-2xl border-2"
              style={{
                borderColor: character.theme.primary,
                boxShadow: `0 0 22px rgba(${character.theme.primaryRgb}, 0.5)`,
              }}
            >
              <img
                src={stageSettings.customImageUrl || character.avatarImage}
                alt={character.name}
                className="h-full w-full object-cover object-top"
              />
              <span className="absolute bottom-1 right-1 h-2.5 w-2.5 rounded-full border border-black bg-emerald-400 shadow-[0_0_8px_#34d399]" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="mb-1 flex flex-wrap items-center gap-2">
                <span
                  className="rounded-md px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-white"
                  style={{
                    background: `linear-gradient(90deg, ${character.theme.primary}, ${character.theme.accent})`,
                  }}
                >
                  {character.name}
                </span>
                <span className="text-[11px] font-medium" style={{ color: character.theme.secondary }}>
                  {isVi ? character.seriesVi : character.seriesEn}
                </span>
              </div>
              <p
                key={`${character.id}-${connecting}-${Boolean(hidState.lastError)}`}
                className="anime-panel-enter text-xs leading-relaxed text-rose-50/95 sm:text-[13px]"
              >
                {connecting
                  ? isVi
                    ? 'Đang mở cổng kết nối WebHID... Chọn thiết bị WAVE75 trong bảng hiện lên nhé! ⚡'
                    : 'Opening WebHID popup... Select your WAVE75 device now! ⚡'
                  : hidState.lastError
                    ? isVi
                      ? 'Chưa bắt tay USB được rồi! Cậu nhớ cắm cáp USB-C, bấm Fn+5 sang chế độ có dây rồi thử lại nha~ ✨'
                      : 'Connection not completed yet! Plug in USB-C, press Fn+5 for wired mode and try again~ ✨'
                    : isVi
                      ? character.gateIdleVi
                      : character.gateIdleEn}
              </p>
            </div>
          </div>

          {/* WebHID Warning / Error */}
          {(!webHidOk || hidState.lastError) && (
            <div className="flex items-start gap-2.5 rounded-xl border border-amber-400/40 bg-amber-500/15 px-3.5 py-2.5 text-xs text-amber-100 backdrop-blur-md">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
              <span>
                {!webHidOk
                  ? isVi
                    ? 'Trình duyệt hiện tại chưa hỗ trợ WebHID. Hãy mở bằng Google Chrome hoặc Microsoft Edge!'
                    : 'WebHID unavailable in this browser. Please use Google Chrome or Microsoft Edge!'
                  : hidState.lastError}
              </span>
            </div>
          )}

          {/* Stagger 4: Primary Hero Connection CTA + Model Picker */}
          <div className="anime-gate-stagger-4 space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                disabled={connecting || !webHidOk}
                onClick={() => void handleConnect(false)}
                className="anime-btn-primary anime-btn-shimmer anime-cta-glow group inline-flex flex-1 items-center justify-center gap-2.5 rounded-2xl px-7 py-4 text-base font-black tracking-wide text-white transition duration-200 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-55 sm:flex-none"
              >
                {connecting ? (
                  <>
                    <Zap className="h-5 w-5 animate-spin" />
                    {isVi ? 'Đang kết nối WAVE75...' : 'Connecting WAVE75...'}
                  </>
                ) : (
                  <>
                    <Usb className="h-5 w-5 transition-transform group-hover:rotate-12" />
                    {isVi ? 'Kết nối Bàn phím & Vào Studio' : 'Connect Keyboard & Enter Studio'}
                  </>
                )}
              </button>

              <button
                type="button"
                disabled={connecting || !webHidOk}
                onClick={() => void handleConnect(true)}
                title={isVi ? 'Kết nối qua giao thức QMK / VIA' : 'Connect via QMK / VIA'}
                className="inline-flex items-center gap-1.5 rounded-2xl border border-rose-300/25 bg-black/50 px-4 py-4 text-xs font-bold text-rose-200 backdrop-blur-md transition hover:border-rose-400/60 hover:bg-rose-500/20 disabled:opacity-45"
              >
                <Cpu className="h-4 w-4" />
                QMK / VIA
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 pt-0.5">
              <div className="flex items-center gap-2 rounded-xl border border-rose-300/20 bg-black/45 px-3 py-1.5 text-xs backdrop-blur-md">
                <span className="text-rose-200/70">
                  {isVi ? 'Dòng phím:' : 'Model:'}
                </span>
                <select
                  value={activeModel}
                  onChange={(e) => {
                    const m = e.target.value as WaveModelId;
                    setActiveModel(m);
                    waveHidManager.switchSimulatedModel(m);
                  }}
                  className="bg-transparent font-bold text-rose-100 focus:outline-none"
                >
                  {WAVE_MODELS_ORDER.map((id) => (
                    <option key={id} value={id} className="bg-[#180a14] text-rose-50">
                      {WAVE_MODEL_SPECS[id].shortName}
                    </option>
                  ))}
                </select>
              </div>

              <span className="rounded-xl border border-rose-400/25 bg-rose-500/15 px-2.5 py-1.5 text-[11px] font-semibold text-rose-100 backdrop-blur-md">
                🔴 8 GIF Hợp Phím Đỏ
              </span>
              <span className="rounded-xl border border-amber-400/25 bg-amber-500/15 px-2.5 py-1.5 text-[11px] font-semibold text-amber-100 backdrop-blur-md">
                ✨ 42 GIF & Chữ chạy LED
              </span>
            </div>
          </div>
        </div>
      </main>

      {/* Bottom Bar: Discreet Preview Fallback */}
      <footer className="relative z-20 mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-3 px-6 py-4 text-xs text-rose-100/65">
        <div className="flex items-center gap-3">
          <span>PMO WAVE75 • VID 0x36B0 / PID 0x3009</span>
          <span className="hidden h-3 w-px bg-rose-300/25 sm:inline-block" />
          <span className="hidden sm:inline">
            {isVi ? 'An toàn tuyệt đối • Không can thiệp firmware gốc' : 'Safe LED-only protocol'}
          </span>
        </div>

        <button
          type="button"
          onClick={onEnterPreview}
          className="inline-flex items-center gap-1.5 rounded-lg bg-black/35 px-2.5 py-1 text-[11px] font-medium text-rose-100/75 backdrop-blur-sm transition hover:bg-rose-500/20 hover:text-white"
        >
          <Eye className="h-3.5 w-3.5" />
          {isVi ? 'Chưa cắm phím? Vào chế độ xem thử' : 'No keyboard plugged in? Preview UI'}
        </button>
      </footer>
    </div>
  );
};
