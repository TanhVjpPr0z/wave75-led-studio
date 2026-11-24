import React, { useEffect, useState } from 'react';
import {
  Sparkles,
  Radio,
  RotateCcw,
  Gamepad2,
  Trophy,
  Play,
  Pause,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  Bot,
  Infinity as InfinityIcon,
  ShieldAlert,
} from 'lucide-react';
import {
  PROCEDURAL_EFFECTS,
  type EffectDirection,
} from '../../core/engines/proceduralEffects';
import {
  SNAKE_SKINS,
  waveSnakeEngine,
  type SnakeHudState,
} from '../../core/engines/snakeGameEngine';
import { useWaveStore } from '../../store/useWaveStore';
import { TRANSLATIONS } from '../../i18n';
import { ColorPicker } from '../common/ColorPicker';
import { AutoStartDriverCard } from '../common/AutoStartDriverCard';
import { buildWave75LiveEffectDriver } from '../../core/engines/driverExporter';
import { waveHidManager } from '../../core/hid/hidManager';

const DIRECTIONS: EffectDirection[] = ['ltr', 'rtl', 'ttb', 'btt', 'outward', 'inward'];

const SnakeArcadePanel: React.FC<{ isVi: boolean }> = ({ isVi }) => {
  const [hud, setHud] = useState<SnakeHudState>(() => waveSnakeEngine.getHudState());

  useEffect(() => {
    return waveSnakeEngine.subscribe(setHud);
  }, []);

  const statusText =
    hud.status === 'gameover'
      ? isVi
        ? '💥 Thua rồi! Nhấn Space hoặc bấm Chơi lại'
        : '💥 Game Over! Press Space or Restart'
      : hud.status === 'victory'
        ? isVi
          ? '🏆 Phá đảo bàn phím 60/60 phím!!'
          : '🏆 Keyboard Cleared 60/60!!'
        : hud.status === 'paused'
          ? isVi
            ? '⏸️ Đang tạm dừng — Nhấn Space để chơi tiếp'
            : '⏸️ Paused — Press Space to resume'
          : hud.status === 'playing'
            ? hud.aiMode
              ? isVi
                ? '🤖 AI đang tự săn mồi (Bấm ↑↓←→ hoặc WASD để giành quyền điều khiển!)'
                : '🤖 AI Auto-Play (Press Arrows or WASD anytime to take over!)'
              : isVi
                ? '🐍 Đang chơi trực tiếp trên phím! Dùng ↑↓←→ hoặc WASD để ăn mồi'
                : '🐍 Playing live on your keys! Steer with Arrows or WASD'
            : isVi
              ? '✨ Sẵn sàng! Bấm phím ↑ ↓ ← → hoặc W A S D trên bàn phím để bắt đầu ăn mồi!'
              : '✨ Ready! Press Arrow keys or W A S D to start eating apples!';

  return (
    <div className="anime-panel-enter space-y-3.5 rounded-2xl border border-emerald-400/40 bg-gradient-to-br from-emerald-950/55 via-[#0b1318]/90 to-black/75 p-4 shadow-[0_0_28px_rgba(16,185,129,0.16)]">
      {/* Header + Live Scoreboard */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/20 text-xl ring-1 ring-emerald-400/50">
            🐍
          </span>
          <div>
            <h3 className="flex items-center gap-2 text-sm font-black text-white">
              {isVi ? 'Rắn Săn Mồi Trên Phím LED WAVE75' : 'WAVE75 Interactive LED Snake'}
              {hud.hasBonusFruit && (
                <span className="animate-pulse rounded-full bg-amber-400/20 px-2 py-0.5 text-[10px] font-extrabold text-amber-300 ring-1 ring-amber-400/50">
                  ★ MỒI VÀNG +3!
                </span>
              )}
            </h3>
            <p className="text-xs text-emerald-200/85">{statusText}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="rounded-xl border border-emerald-400/35 bg-black/45 px-3 py-1.5 text-center">
            <span className="block text-[9px] font-bold uppercase tracking-wider text-emerald-300/75">
              {isVi ? 'Điểm' : 'Score'}
            </span>
            <span className="font-mono text-lg font-black text-white">{hud.score}</span>
          </div>
          <div className="rounded-xl border border-amber-400/35 bg-black/45 px-3 py-1.5 text-center">
            <span className="flex items-center justify-center gap-1 text-[9px] font-bold uppercase tracking-wider text-amber-300/80">
              <Trophy className="h-2.5 w-2.5" />
              {isVi ? 'Kỷ lục' : 'Best'}
            </span>
            <span className="font-mono text-lg font-black text-amber-300">{hud.highScore}</span>
          </div>
          <div className="hidden rounded-xl border border-white/15 bg-black/45 px-3 py-1.5 text-center sm:block">
            <span className="block text-[9px] font-bold uppercase tracking-wider text-slate-400">
              {isVi ? 'Độ dài' : 'Len'}
            </span>
            <span className="font-mono text-lg font-black text-sky-300">{hud.length}</span>
          </div>
        </div>
      </div>

      {/* Controls Row: Play/Pause, Restart, AI Toggle, Wall Wrap Toggle + Clickable D-Pad */}
      <div className="grid gap-3 md:grid-cols-12">
        <div className="space-y-2.5 md:col-span-8">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => waveSnakeEngine.togglePlayOrRestart()}
              className="anime-btn-primary inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-extrabold text-white"
            >
              {hud.status === 'playing' ? (
                <>
                  <Pause className="h-3.5 w-3.5" />
                  {isVi ? 'Tạm dừng (Space)' : 'Pause (Space)'}
                </>
              ) : (
                <>
                  <Play className="h-3.5 w-3.5" />
                  {hud.status === 'gameover'
                    ? isVi
                      ? 'Chơi lại (Space)'
                      : 'Restart (Space)'
                    : isVi
                      ? 'Bắt đầu chơi'
                      : 'Start Game'}
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => waveSnakeEngine.reset(true)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-white/15 bg-white/[0.06] px-3 py-2 text-xs font-bold text-slate-200 transition hover:border-white/35 hover:text-white"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              {isVi ? 'Làm mới (R)' : 'Reset (R)'}
            </button>

            <button
              type="button"
              onClick={() => waveSnakeEngine.setAiMode(!hud.aiMode)}
              className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-bold transition ${
                hud.aiMode
                  ? 'border-sky-400/70 bg-sky-500/25 text-sky-100'
                  : 'border-white/15 bg-white/[0.05] text-slate-300 hover:border-sky-400/45'
              }`}
            >
              <Bot className="h-3.5 w-3.5" />
              {hud.aiMode
                ? isVi
                  ? 'AI đang tự chơi'
                  : 'AI Auto: ON'
                : isVi
                  ? 'Tự điều khiển'
                  : 'Manual Control'}
            </button>

            <button
              type="button"
              onClick={() => waveSnakeEngine.setWrapWalls(!hud.wrapWalls)}
              className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-bold transition ${
                hud.wrapWalls
                  ? 'border-emerald-400/55 bg-emerald-500/15 text-emerald-200'
                  : 'border-rose-400/55 bg-rose-500/15 text-rose-200'
              }`}
            >
              {hud.wrapWalls ? (
                <>
                  <InfinityIcon className="h-3.5 w-3.5" />
                  {isVi ? 'Xuyên tường' : 'Wrap Walls'}
                </>
              ) : (
                <>
                  <ShieldAlert className="h-3.5 w-3.5" />
                  {isVi ? 'Đập tường thua' : 'Solid Walls'}
                </>
              )}
            </button>
          </div>

          {/* 4 Snake Color Skins */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="mr-1 text-[11px] font-bold text-slate-300">
              {isVi ? 'Màu rắn:' : 'Skin:'}
            </span>
            {SNAKE_SKINS.map((sk) => {
              const active = hud.skin === sk.id;
              return (
                <button
                  key={sk.id}
                  type="button"
                  onClick={() => waveSnakeEngine.setSkin(sk.id)}
                  className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] font-bold transition ${
                    active
                      ? 'anime-pill-active'
                      : 'border-white/10 bg-black/40 text-slate-300 hover:border-white/30'
                  }`}
                >
                  <span
                    className="h-2.5 w-4 rounded-full"
                    style={{ background: sk.preview }}
                  />
                  {isVi ? sk.nameVi : sk.nameEn}
                </button>
              );
            })}
          </div>
        </div>

        {/* Clickable On-Screen Arcade D-Pad */}
        <div className="flex flex-col items-center justify-center gap-1 rounded-xl border border-white/10 bg-black/40 p-2.5 md:col-span-4">
          <button
            type="button"
            onClick={() => waveSnakeEngine.steer('up')}
            aria-label="Up"
            className="flex h-8 w-10 items-center justify-center rounded-lg border border-white/15 bg-white/[0.08] text-white transition hover:border-emerald-400 hover:bg-emerald-500/25 active:scale-95"
          >
            <ArrowUp className="h-4 w-4" />
          </button>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => waveSnakeEngine.steer('left')}
              aria-label="Left"
              className="flex h-8 w-10 items-center justify-center rounded-lg border border-white/15 bg-white/[0.08] text-white transition hover:border-emerald-400 hover:bg-emerald-500/25 active:scale-95"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => waveSnakeEngine.steer('down')}
              aria-label="Down"
              className="flex h-8 w-10 items-center justify-center rounded-lg border border-white/15 bg-white/[0.08] text-white transition hover:border-emerald-400 hover:bg-emerald-500/25 active:scale-95"
            >
              <ArrowDown className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => waveSnakeEngine.steer('right')}
              aria-label="Right"
              className="flex h-8 w-10 items-center justify-center rounded-lg border border-white/15 bg-white/[0.08] text-white transition hover:border-emerald-400 hover:bg-emerald-500/25 active:scale-95"
            >
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
          <span className="mt-0.5 text-[10px] text-slate-400">
            {isVi ? 'Bấm phím ↑↓←→ hoặc WASD' : 'Use Arrows or WASD'}
          </span>
        </div>
      </div>
    </div>
  );
};

export const LiveEffectsPanel: React.FC = () => {
  const language = useWaveStore((s) => s.language);
  const effectParams = useWaveStore((s) => s.effectParams);
  const updateEffectParams = useWaveStore((s) => s.updateEffectParams);
  const usbFps = useWaveStore((s) => s.usbFps);
  const setUsbFps = useWaveStore((s) => s.setUsbFps);
  const liveStreamEffects = useWaveStore((s) => s.liveStreamEffects);
  const setLiveStreamEffects = useWaveStore((s) => s.setLiveStreamEffects);
  const logoSettings = useWaveStore((s) => s.logoSettings);
  const lightIndexMap = useWaveStore((s) => s.lightIndexMap);

  const t = TRANSLATIONS[language];
  const isVi = language === 'vi';
  const spectrumList = PROCEDURAL_EFFECTS.filter((e) => e.category === 'spectrum');
  const simList = PROCEDURAL_EFFECTS.filter((e) => e.category === 'simulation');
  const isSnakeActive = effectParams.effectId === 'snake';

  return (
    <div className="grid gap-5 lg:grid-cols-12">
      {/* Left: 24+ Procedural 2D Effects + Interactive Snake Arcade HUD */}
      <div className="space-y-4 lg:col-span-8">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 text-sm font-bold text-slate-100">
            <Sparkles className="h-4 w-4 text-amber-300" />
            {t.effects.title}
          </h2>
          <div className="flex flex-wrap items-center gap-2">
            {!isSnakeActive && (
              <button
                type="button"
                onClick={() => {
                  updateEffectParams({ effectId: 'snake' });
                  waveSnakeEngine.reset(false);
                }}
                className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-400/55 bg-emerald-500/15 px-3 py-1.5 text-xs font-extrabold text-emerald-200 transition hover:bg-emerald-500/25"
              >
                <Gamepad2 className="h-3.5 w-3.5" />
                {isVi ? '🐍 Chơi Rắn Săn Mồi' : '🐍 Play LED Snake'}
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                const next = !liveStreamEffects;
                setLiveStreamEffects(next);
                if (next) void waveHidManager.ensureLiveArmed().catch(() => {});
              }}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition ${
                liveStreamEffects
                  ? 'border-emerald-400/50 bg-emerald-500/15 text-emerald-200'
                  : 'border-white/10 bg-[#0A0D12] text-slate-400'
              }`}
            >
              <Radio className="h-3.5 w-3.5" />
              {t.effects.liveStream}
            </button>
            <button
              type="button"
              onClick={() => void waveHidManager.handBackAndDisconnect()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-amber-400/40 bg-amber-500/10 px-2.5 py-1.5 text-xs font-semibold text-amber-200 transition hover:bg-amber-500/20"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              {t.app.handBackBtn}
            </button>
          </div>
        </div>

        {/* Interactive Snake Game HUD appears prominently when Snake effect is active! */}
        {isSnakeActive && <SnakeArcadePanel isVi={isVi} />}

        {/* Group 1: Spectrum & Waves */}
        <div>
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            {t.effects.spectrumGroup} (12)
          </div>
          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 md:grid-cols-4">
            {spectrumList.map((e, i) => {
              const active = effectParams.effectId === e.id;
              return (
                <button
                  key={e.id}
                  type="button"
                  onClick={() => updateEffectParams({ effectId: e.id })}
                  className={`rounded-xl border px-3 py-2 text-left transition ${
                    active
                      ? 'anime-pill-active'
                      : 'border-white/[0.08] bg-black/40 text-slate-300 hover:border-white/25 hover:bg-white/[0.05]'
                  }`}
                >
                  <span className="block font-mono text-[9.5px] opacity-60">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <span className="text-xs font-semibold">{t.effects.names[e.id]}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Group 2: Live 2D Simulations & Interactive Games */}
        <div>
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            {t.effects.simGroup} (12)
          </div>
          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 md:grid-cols-4">
            {simList.map((e, i) => {
              const active = effectParams.effectId === e.id;
              const isSnake = e.id === 'snake';
              return (
                <button
                  key={e.id}
                  type="button"
                  onClick={() => {
                    updateEffectParams({ effectId: e.id });
                    if (isSnake) waveSnakeEngine.reset(false);
                  }}
                  className={`relative rounded-xl border px-3 py-2 text-left transition ${
                    active
                      ? 'anime-pill-active'
                      : isSnake
                        ? 'border-emerald-400/40 bg-emerald-950/35 text-emerald-100 hover:border-emerald-400/75'
                        : 'border-white/[0.08] bg-black/40 text-slate-300 hover:border-white/25 hover:bg-white/[0.05]'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[9.5px] opacity-60">
                      {String(i + 13).padStart(2, '0')}
                    </span>
                    {isSnake && (
                      <span className="rounded-full bg-emerald-500/25 px-1.5 py-0.5 text-[9px] font-extrabold text-emerald-300">
                        GAME 🐍
                      </span>
                    )}
                  </div>
                  <span className="text-xs font-semibold">{t.effects.names[e.id]}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* 1-Click Persistent Auto-Start Driver for ANY of the 24 Live 2D Effects */}
        <AutoStartDriverCard
          titleVi="Khóa hiệu ứng 2D này chạy mãi mãi (Auto-Start + Flash)"
          titleEn="Lock This 2D Effect Forever (Auto-Start + Flash)"
          descVi="Đóng gói hiệu ứng 2D bạn vừa custom + Đèn Logo CNC vào dịch vụ chạy ngầm ẩn (không cửa sổ đen) & nạp sẵn khung đầu vào Flash Slot 1. Mỗi khi bật máy hoặc bật công tắc phím WAVE75 là chạy đúng hiệu ứng này ngay lập tức — chỉ đổi khi bạn custom lại!"
          descEn="Bakes your current 2D effect + CNC Logo into a silent Windows auto-start daemon and primes Flash Slot 1. Automatically takes over whenever WAVE75 powers on!"
          buildPayload={() =>
            buildWave75LiveEffectDriver({
              effectName: t.effects.names[effectParams.effectId] || effectParams.effectId,
              effectParams,
              logoSettings,
              lightIndexMap,
              fps: Math.max(20, Math.min(30, usbFps)),
            })
          }
        />
      </div>

      {/* Right: Controls & Color Palette */}
      <div className="space-y-4 rounded-xl border border-white/[0.08] bg-black/35 p-4 lg:col-span-4">
        <div className="space-y-3">
          <div>
            <div className="mb-1 flex justify-between text-xs">
              <span className="text-slate-300">{t.effects.brightness}</span>
              <span className="font-mono text-amber-300">{effectParams.brightness}%</span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              value={effectParams.brightness}
              onChange={(e) => updateEffectParams({ brightness: Number(e.target.value) })}
              className="wave-slider w-full"
            />
          </div>

          <div>
            <div className="mb-1 flex justify-between text-xs">
              <span className="text-slate-300">
                {isSnakeActive
                  ? isVi
                    ? 'Tốc độ rắn bò'
                    : 'Snake Speed'
                  : t.effects.speed}
              </span>
              <span className="font-mono text-amber-300">{effectParams.speed} / 10</span>
            </div>
            <input
              type="range"
              min={1}
              max={10}
              value={effectParams.speed}
              onChange={(e) => updateEffectParams({ speed: Number(e.target.value) })}
              className="wave-slider w-full"
            />
          </div>

          <div>
            <div className="mb-1 flex justify-between text-xs">
              <span className="text-slate-300">{t.effects.usbFps}</span>
              <span className="font-mono text-amber-300">{usbFps} FPS</span>
            </div>
            <input
              type="range"
              min={5}
              max={30}
              value={usbFps}
              onChange={(e) => {
                const fps = Number(e.target.value);
                setUsbFps(fps);
                waveHidManager.setMaxFps(fps);
              }}
              className="wave-slider w-full"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs text-slate-300">{t.effects.direction}</label>
            <select
              value={effectParams.direction}
              onChange={(e) =>
                updateEffectParams({ direction: e.target.value as EffectDirection })
              }
              className="w-full rounded-lg border border-white/10 bg-[#121721] px-2.5 py-1.5 text-xs text-slate-200 focus:border-rose-400 focus:outline-none"
            >
              {DIRECTIONS.map((d) => (
                <option key={d} value={d}>
                  {t.effects.directions[d]}
                </option>
              ))}
            </select>
          </div>

          <label className="flex cursor-pointer items-center gap-2 text-xs text-slate-300">
            <input
              type="checkbox"
              checked={effectParams.useRainbow}
              onChange={(e) => updateEffectParams({ useRainbow: e.target.checked })}
              className="h-4 w-4 rounded accent-rose-400"
            />
            <span>{t.effects.useRainbow}</span>
          </label>
        </div>

        <div className="border-t border-white/10 pt-3">
          <ColorPicker
            label={t.effects.primaryColor}
            color={effectParams.primaryColor}
            onChange={(primaryColor) => updateEffectParams({ primaryColor })}
            compact
          />
        </div>

        <div className="border-t border-white/10 pt-3">
          <ColorPicker
            label={t.effects.secondaryColor}
            color={effectParams.secondaryColor}
            onChange={(secondaryColor) => updateEffectParams({ secondaryColor })}
            compact
          />
        </div>
      </div>
    </div>
  );
};
