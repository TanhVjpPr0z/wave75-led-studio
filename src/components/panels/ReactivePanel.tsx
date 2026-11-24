import React from 'react';
import { Keyboard, RotateCcw, Flame } from 'lucide-react';
import {
  sharedReactiveEngine,
  type ReactiveMode,
  type ReactiveStats,
} from '../../core/engines/reactiveEngine';
import { useStudioStore } from '../../store/useStudioStore';
import { TRANSLATIONS } from '../../i18n';
import { ColorPicker } from '../common/ColorPicker';

interface ReactivePanelProps {
  stats: ReactiveStats;
}

const REACTIVE_MODES: ReactiveMode[] = ['ripple', 'cross', 'trail', 'heatmap'];

export const ReactivePanel: React.FC<ReactivePanelProps> = ({ stats }) => {
  const language = useStudioStore((s) => s.language);
  const reactiveConfig = useStudioStore((s) => s.reactiveConfig);
  const updateReactiveConfig = useStudioStore((s) => s.updateReactiveConfig);
  const t = TRANSLATIONS[language];

  return (
    <div className="grid gap-5 lg:grid-cols-12">
      {/* Left: Modes & Typing Stats */}
      <div className="space-y-4 lg:col-span-7">
        <div className="rounded-xl border border-white/[0.07] bg-[#0B0E14]/65 p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="flex items-center gap-2 text-sm font-bold text-slate-100">
                <Keyboard className="h-4 w-4 text-cyan-400" />
                {t.reactive.title}
              </h2>
              <p className="mt-0.5 text-xs text-slate-400">{t.reactive.hint}</p>
            </div>
            <button
              type="button"
              onClick={() => sharedReactiveEngine.resetHeatmap()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-[#131822] px-3 py-1.5 text-xs font-medium text-slate-300 transition hover:border-cyan-400/50 hover:text-cyan-200"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              {t.reactive.resetHeatmap}
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {REACTIVE_MODES.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => updateReactiveConfig({ mode: m })}
                className={`rounded-xl border p-3 text-left text-xs font-semibold transition ${
                  reactiveConfig.mode === m
                    ? 'border-cyan-400/70 bg-cyan-500/15 text-cyan-200'
                    : 'border-white/10 bg-[#131822] text-slate-300 hover:border-white/20'
                }`}
              >
                {t.reactive.modes[m]}
              </button>
            ))}
          </div>

          {/* Live Session Telemetry */}
          <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            <div className="rounded-xl border border-white/[0.06] bg-[#131822] p-3">
              <span className="text-[10px] uppercase tracking-wider text-slate-400">
                {t.reactive.statsTotal}
              </span>
              <div className="mt-1 font-mono text-xl font-bold text-cyan-300">
                {stats.totalPresses}
              </div>
            </div>
            <div className="rounded-xl border border-white/[0.06] bg-[#131822] p-3">
              <span className="text-[10px] uppercase tracking-wider text-slate-400">
                {t.reactive.statsKpm}
              </span>
              <div className="mt-1 font-mono text-xl font-bold text-violet-300">
                {stats.recentKpm}
              </div>
            </div>
            <div className="rounded-xl border border-white/[0.06] bg-[#131822] p-3">
              <span className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-slate-400">
                <Flame className="h-3 w-3 text-amber-400" />
                {t.reactive.statsHotKey}
              </span>
              <div className="mt-1 font-mono text-xl font-bold text-amber-300">
                {stats.mostPressedKeyLabel}
                {stats.maxKeyCount > 0 && (
                  <span className="ml-1 text-xs text-slate-400">
                    ({stats.maxKeyCount})
                  </span>
                )}
              </div>
            </div>
            <div className="rounded-xl border border-white/[0.06] bg-[#131822] p-3">
              <span className="text-[10px] uppercase tracking-wider text-slate-400">
                {t.reactive.statsHolding}
              </span>
              <div className="mt-1 font-mono text-xl font-bold text-emerald-300">
                {stats.activePressedCount}
              </div>
            </div>
          </div>

          {/* Sliders & Rainbow Toggle */}
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <div className="mb-1 flex justify-between text-xs">
                <span className="text-slate-300">{t.reactive.decaySpeed}</span>
                <span className="font-mono text-cyan-300">
                  {reactiveConfig.decaySpeed} / 5
                </span>
              </div>
              <input
                type="range"
                min={1}
                max={5}
                value={reactiveConfig.decaySpeed}
                onChange={(e) =>
                  updateReactiveConfig({ decaySpeed: Number(e.target.value) })
                }
                className="studio-slider w-full"
              />
            </div>

            <div>
              <div className="mb-1 flex justify-between text-xs">
                <span className="text-slate-300">{t.reactive.baseBrightness}</span>
                <span className="font-mono text-cyan-300">
                  {reactiveConfig.baseBrightness}%
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                value={reactiveConfig.baseBrightness}
                onChange={(e) =>
                  updateReactiveConfig({ baseBrightness: Number(e.target.value) })
                }
                className="studio-slider w-full"
              />
            </div>
          </div>

          <label className="mt-4 flex cursor-pointer items-center gap-2 text-xs text-slate-300">
            <input
              type="checkbox"
              checked={reactiveConfig.rainbowHits}
              onChange={(e) =>
                updateReactiveConfig({ rainbowHits: e.target.checked })
              }
              className="h-4 w-4 rounded accent-cyan-400"
            />
            <span>{t.reactive.rainbowHits}</span>
          </label>
        </div>
      </div>

      {/* Right: Base & Accent Colors */}
      <div className="space-y-4 rounded-xl border border-white/[0.07] bg-[#0B0E14]/65 p-4 lg:col-span-5">
        <ColorPicker
          label={t.reactive.activeColor}
          color={reactiveConfig.activeColor}
          onChange={(activeColor) => updateReactiveConfig({ activeColor })}
          compact
        />
        <div className="border-t border-white/10 pt-3">
          <ColorPicker
            label={t.reactive.baseColor}
            color={reactiveConfig.baseColor}
            onChange={(baseColor) => updateReactiveConfig({ baseColor })}
            compact
          />
        </div>
      </div>
    </div>
  );
};

