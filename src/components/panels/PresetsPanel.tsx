import React, { useEffect, useRef, useState } from 'react';
import { Sparkles, Send, Radio, Clock } from 'lucide-react';
import {
  PRESET_EFFECTS,
  type EffectDirection,
  type EffectColorMode,
} from '../../core/engines/effectEngine';
import { useStudioStore } from '../../store/useStudioStore';
import { TRANSLATIONS } from '../../i18n';
import { ColorPicker } from '../common/ColorPicker';
import { hidManager, type HidConnectionState } from '../../core/hid/hidManager';

interface PresetsPanelProps {
  hidState: HidConnectionState;
}

const DIRECTIONS: EffectDirection[] = [
  'left_to_right',
  'right_to_left',
  'top_to_bottom',
  'bottom_to_top',
  'outward',
  'inward',
];

const COLOR_MODES: EffectColorMode[] = ['solid', 'dual', 'rainbow'];
const SLEEP_OPTIONS = [0, 1, 3, 5, 10, 30];

export const PresetsPanel: React.FC<PresetsPanelProps> = ({ hidState }) => {
  const language = useStudioStore((s) => s.language);
  const effectParams = useStudioStore((s) => s.effectParams);
  const updateEffectParams = useStudioStore((s) => s.updateEffectParams);
  const liveStreamPresets = useStudioStore((s) => s.liveStreamPresets);
  const setLiveStreamPresets = useStudioStore((s) => s.setLiveStreamPresets);

  const [syncNotice, setSyncNotice] = useState<string | null>(null);
  const syncTimerRef = useRef<number | null>(null);
  const lastSyncedSigRef = useRef<string>('');
  const t = TRANSLATIONS[language];

  // When Live Stream is OFF (Hardware Native Mode), automatically sync any mode/brightness/speed/direction/color
  // change to the keyboard MCU (cmd 0x07) — deduplicated so clicking a preset never double-sends or blinks!
  useEffect(() => {
    if (!hidState.connected || liveStreamPresets || !hidState.capabilities.supportsHardwarePresets) {
      lastSyncedSigRef.current = '';
      return;
    }

    const sig = JSON.stringify(effectParams);
    if (sig === lastSyncedSigRef.current) return;

    if (syncTimerRef.current !== null) window.clearTimeout(syncTimerRef.current);
    const delayMs = lastSyncedSigRef.current === '' ? 0 : 60;
    syncTimerRef.current = window.setTimeout(() => {
      syncTimerRef.current = null;
      lastSyncedSigRef.current = sig;
      const def = PRESET_EFFECTS.find((e) => e.id === effectParams.mode);
      hidManager.setLightingMode(def?.hardwareModeId ?? 0x01, effectParams).catch(() => {});
    }, delayMs);

    return () => {
      if (syncTimerRef.current !== null) window.clearTimeout(syncTimerRef.current);
    };
  }, [hidState.connected, hidState.capabilities.supportsHardwarePresets, liveStreamPresets, effectParams]);

  const handleSelectMode = async (mode: (typeof PRESET_EFFECTS)[number]) => {
    const nextParams = { ...effectParams, mode: mode.id };
    if (hidState.connected && !liveStreamPresets && hidState.capabilities.supportsHardwarePresets) {
      // Mark signature before store update so the debounced effect won't fire a duplicate cmd 0x07
      lastSyncedSigRef.current = JSON.stringify(nextParams);
      if (syncTimerRef.current !== null) {
        window.clearTimeout(syncTimerRef.current);
        syncTimerRef.current = null;
      }
      updateEffectParams({ mode: mode.id });
      try {
        await hidManager.setLightingMode(mode.hardwareModeId, nextParams);
      } catch {
        lastSyncedSigRef.current = '';
      }
      return;
    }
    updateEffectParams({ mode: mode.id });
  };

  const handleSyncHardware = async () => {
    const def = PRESET_EFFECTS.find((e) => e.id === effectParams.mode);
    try {
      await hidManager.setLightingMode(def?.hardwareModeId ?? 0x01, effectParams);
      await hidManager.setBrightness(effectParams.brightness);
      await hidManager.setSpeed(effectParams.speed);
      setSyncNotice(
        language === 'vi'
          ? 'Đã gửi lệnh hiệu ứng xuống bàn phím!'
          : 'Hardware mode command dispatched!'
      );
      window.setTimeout(() => setSyncNotice(null), 2500);
    } catch (err) {
      setSyncNotice(err instanceof Error ? err.message : 'Sync failed');
    }
  };

  return (
    <div className="grid gap-5 lg:grid-cols-12">
      {/* Left: 14 Built-in Effects Grid */}
      <div className="space-y-4 lg:col-span-7">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 text-sm font-bold text-slate-100">
            <Sparkles className="h-4 w-4 text-cyan-400" />
            {t.presets.title}
          </h2>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setLiveStreamPresets(!liveStreamPresets)}
              title={
                language === 'vi'
                  ? 'Tắt = Chạy thẳng trên chip bàn phím (siêu mượt 120+ FPS). Bật = Stream từng phím qua USB (60 FPS).'
                  : 'Off = Native MCU hardware effects (120+ FPS). On = Per-key USB streaming (60 FPS).'
              }
              className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium transition ${
                liveStreamPresets
                  ? 'border-cyan-400/40 bg-cyan-500/15 text-cyan-200'
                  : 'border-emerald-400/35 bg-emerald-500/10 text-emerald-200'
              }`}
            >
              <Radio className="h-3.5 w-3.5" />
              {liveStreamPresets
                ? `${t.presets.streamLive} (USB)`
                : language === 'vi'
                  ? 'Chip phím (120+ FPS)'
                  : 'Hardware MCU (120+ FPS)'}
            </button>
            <button
              type="button"
              onClick={handleSyncHardware}
              className="inline-flex items-center gap-1.5 rounded-lg border border-violet-400/40 bg-violet-500/15 px-3 py-1 text-xs font-semibold text-violet-200 transition hover:bg-violet-500/25"
            >
              <Send className="h-3.5 w-3.5" />
              {t.presets.syncHardware}
            </button>
          </div>
        </div>

        {syncNotice && (
          <div className="rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-3 py-1.5 text-xs text-cyan-200">
            {syncNotice}
          </div>
        )}

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
          {PRESET_EFFECTS.map((effect, idx) => {
            const active = effectParams.mode === effect.id;
            return (
              <button
                key={effect.id}
                type="button"
                onClick={() => void handleSelectMode(effect)}
                className={`group flex flex-col items-start rounded-xl border p-3 text-left transition ${
                  active
                    ? 'border-cyan-400/70 bg-gradient-to-br from-cyan-500/20 via-violet-500/10 to-transparent shadow-[0_0_20px_rgba(6,182,212,0.18)]'
                    : 'border-white/[0.07] bg-[#0B0E14]/70 hover:border-white/20 hover:bg-white/[0.04]'
                }`}
              >
                <div className="flex w-full items-center justify-between">
                  <span className="font-mono text-[10px] text-slate-500">
                    {String(idx + 1).padStart(2, '0')}
                  </span>
                  {effect.isReactive && (
                    <span className="rounded bg-violet-500/20 px-1.5 py-0.5 text-[9px] font-semibold uppercase text-violet-300">
                      Key
                    </span>
                  )}
                </div>
                <span
                  className={`mt-1.5 text-xs font-semibold ${
                    active ? 'text-cyan-200' : 'text-slate-200'
                  }`}
                >
                  {t.presets.effects[effect.id]}
                </span>
              </button>
            );
          })}
        </div>

        {/* Sliders & Direction & Sleep Timer */}
        <div className="grid gap-4 rounded-xl border border-white/[0.07] bg-[#0B0E14]/65 p-4 sm:grid-cols-2">
          <div>
            <div className="mb-1.5 flex items-center justify-between text-xs">
              <span className="font-medium text-slate-300">{t.presets.brightness}</span>
              <span className="font-mono text-cyan-300">{effectParams.brightness}%</span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              value={effectParams.brightness}
              onChange={(e) => {
                const v = Number(e.target.value);
                updateEffectParams({ brightness: v });
              }}
              className="studio-slider w-full"
            />
          </div>

          <div>
            <div className="mb-1.5 flex items-center justify-between text-xs">
              <span className="font-medium text-slate-300">{t.presets.speed}</span>
              <span className="font-mono text-cyan-300">{effectParams.speed} / 5</span>
            </div>
            <input
              type="range"
              min={1}
              max={5}
              step={1}
              value={effectParams.speed}
              onChange={(e) => updateEffectParams({ speed: Number(e.target.value) })}
              className="studio-slider w-full"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-300">
              {t.presets.direction}
            </label>
            <select
              value={effectParams.direction}
              onChange={(e) =>
                updateEffectParams({ direction: e.target.value as EffectDirection })
              }
              className="w-full rounded-lg border border-white/10 bg-[#131822] px-3 py-2 text-xs text-slate-200 focus:border-cyan-400 focus:outline-none"
            >
              {DIRECTIONS.map((dir) => (
                <option key={dir} value={dir}>
                  {t.presets.directions[dir]}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-slate-300">
              <Clock className="h-3.5 w-3.5 text-slate-400" />
              {t.presets.sleepTimer}
            </label>
            <select
              value={effectParams.sleepTimeoutMinutes}
              onChange={(e) =>
                updateEffectParams({ sleepTimeoutMinutes: Number(e.target.value) })
              }
              className="w-full rounded-lg border border-white/10 bg-[#131822] px-3 py-2 text-xs text-slate-200 focus:border-cyan-400 focus:outline-none"
            >
              {SLEEP_OPTIONS.map((mins) => (
                <option key={mins} value={mins}>
                  {mins === 0
                    ? t.presets.sleepOff
                    : `${mins} ${t.presets.minutes}`}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Right: Color Mode & Primary/Secondary Pickers */}
      <div className="space-y-4 rounded-xl border border-white/[0.07] bg-[#0B0E14]/65 p-4 lg:col-span-5">
        <div>
          <span className="mb-2 block text-xs font-medium text-slate-300">
            {t.presets.colorMode}
          </span>
          <div className="grid grid-cols-3 gap-1.5">
            {COLOR_MODES.map((cm) => (
              <button
                key={cm}
                type="button"
                onClick={() => updateEffectParams({ colorMode: cm })}
                className={`rounded-lg border px-2.5 py-2 text-xs font-medium transition ${
                  effectParams.colorMode === cm
                    ? 'border-cyan-400/60 bg-cyan-500/15 text-cyan-200'
                    : 'border-white/10 bg-[#131822] text-slate-400 hover:text-slate-200'
                }`}
              >
                {t.presets.colorModes[cm]}
              </button>
            ))}
          </div>
        </div>

        <ColorPicker
          label={t.presets.primaryColor}
          color={effectParams.primaryColor}
          onChange={(primaryColor) => updateEffectParams({ primaryColor })}
          compact
        />

        {effectParams.colorMode === 'dual' && (
          <div className="border-t border-white/10 pt-3">
            <ColorPicker
              label={t.presets.secondaryColor}
              color={effectParams.secondaryColor}
              onChange={(secondaryColor) => updateEffectParams({ secondaryColor })}
              compact
            />
          </div>
        )}
      </div>
    </div>
  );
};

