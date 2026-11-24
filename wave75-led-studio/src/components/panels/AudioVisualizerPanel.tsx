import React, { useState } from 'react';
import { Mic, MonitorSpeaker, Music, Square, AlertCircle } from 'lucide-react';
import {
  waveAudioEngine,
  type AudioPaletteId,
  type AudioSourceType,
  type AudioVisualizerMode,
} from '../../core/engines/audioEngine';
import { useWaveStore } from '../../store/useWaveStore';
import { TRANSLATIONS } from '../../i18n';

interface AudioVisualizerPanelProps {
  source: AudioSourceType;
  onSourceChange: (src: AudioSourceType) => void;
  bands: number[];
}

const MODES: AudioVisualizerMode[] = [
  'spectrum_bars',
  'bass_pulse',
  'center_wave',
  'frequency_heatmap',
];

const PALETTES: Array<{ id: AudioPaletteId; label: string; css: string }> = [
  { id: 'neon_cyan', label: 'Neon', css: 'linear-gradient(90deg, #0ea5e9, #38f0ff, #ec4899)' },
  { id: 'fire', label: 'Fire', css: 'linear-gradient(90deg, #b91c1c, #f97316, #fef08a)' },
  { id: 'rainbow', label: 'Rainbow', css: 'linear-gradient(90deg, #ff0055, #ffb400, #00ff78, #00d2ff, #9146ff)' },
  { id: 'vaporwave', label: 'Vapor', css: 'linear-gradient(90deg, #ff71ce, #b967ff, #01cdfe)' },
  { id: 'matrix', label: 'Matrix', css: 'linear-gradient(90deg, #065f46, #10b981, #6ee7b7)' },
];

export const AudioVisualizerPanel: React.FC<AudioVisualizerPanelProps> = ({
  source,
  onSourceChange,
  bands,
}) => {
  const language = useWaveStore((s) => s.language);
  const audioConfig = useWaveStore((s) => s.audioConfig);
  const updateAudioConfig = useWaveStore((s) => s.updateAudioConfig);
  const [err, setErr] = useState<string | null>(null);
  const t = TRANSLATIONS[language];

  const startMic = async () => {
    setErr(null);
    try {
      await waveAudioEngine.startMicrophone();
      onSourceChange('microphone');
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Microphone denied');
    }
  };

  const startSys = async () => {
    setErr(null);
    try {
      await waveAudioEngine.startSystemAudio();
      onSourceChange('system');
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'System audio cancelled');
    }
  };

  return (
    <div className="grid gap-5 lg:grid-cols-12">
      <div className="space-y-4 rounded-xl border border-white/[0.07] bg-[#0A0D12]/65 p-4 lg:col-span-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-bold text-slate-100">{t.audio.title}</h2>
          <span
            className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium ${
              source !== 'none'
                ? 'bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-400/40'
                : 'bg-white/5 text-slate-400'
            }`}
          >
            {source !== 'none' ? t.audio.active : t.audio.idle}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <button
            type="button"
            onClick={() => void startMic()}
            className={`flex flex-col items-center gap-1.5 rounded-xl border p-3 text-xs font-semibold ${
              source === 'microphone'
                ? 'border-sky-400 bg-sky-500/20 text-sky-200'
                : 'border-white/10 bg-[#121721] text-slate-300 hover:border-sky-400/40'
            }`}
          >
            <Mic className="h-4 w-4" />
            <span>{t.audio.mic}</span>
          </button>

          <button
            type="button"
            onClick={() => void startSys()}
            className={`flex flex-col items-center gap-1.5 rounded-xl border p-3 text-xs font-semibold ${
              source === 'system'
                ? 'border-sky-400 bg-sky-500/20 text-sky-200'
                : 'border-white/10 bg-[#121721] text-slate-300 hover:border-sky-400/40'
            }`}
          >
            <MonitorSpeaker className="h-4 w-4" />
            <span className="text-center">{t.audio.system}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setErr(null);
              waveAudioEngine.startDemoBeat();
              onSourceChange('demo_beat');
            }}
            className={`flex flex-col items-center gap-1.5 rounded-xl border p-3 text-xs font-semibold ${
              source === 'demo_beat'
                ? 'border-indigo-400 bg-indigo-500/20 text-indigo-200'
                : 'border-white/10 bg-[#121721] text-slate-300 hover:border-indigo-400/40'
            }`}
          >
            <Music className="h-4 w-4" />
            <span className="text-center">{t.audio.demo}</span>
          </button>

          <button
            type="button"
            disabled={source === 'none'}
            onClick={() => {
              waveAudioEngine.stop();
              onSourceChange('none');
            }}
            className="flex flex-col items-center gap-1.5 rounded-xl border border-rose-500/35 bg-rose-500/10 p-3 text-xs font-semibold text-rose-200 hover:bg-rose-500/20 disabled:opacity-35"
          >
            <Square className="h-4 w-4" />
            <span>{t.audio.stop}</span>
          </button>
        </div>

        {err && (
          <div className="flex items-center gap-2 rounded-lg border border-rose-500/35 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
            <AlertCircle className="h-4 w-4" />
            {err}
          </div>
        )}

        <div className="rounded-xl border border-white/10 bg-[#070A0F] p-3">
          <div className="mb-2 flex justify-between font-mono text-[10px] text-slate-500">
            <span>BASS</span>
            <span>MID</span>
            <span>TREBLE (16 COLS)</span>
          </div>
          <div className="flex h-24 items-end gap-1">
            {Array.from({ length: 16 }).map((_, idx) => (
              <div
                key={idx}
                className="flex-1 rounded-t bg-gradient-to-t from-sky-500 via-indigo-500 to-pink-500 transition-[height] duration-75"
                style={{ height: `${Math.round(Math.max(0.05, bands[idx] ?? 0) * 100)}%` }}
              />
            ))}
          </div>
        </div>
      </div>

      <div className="space-y-4 rounded-xl border border-white/[0.07] bg-[#0A0D12]/65 p-4 lg:col-span-6">
        <div className="grid grid-cols-2 gap-2">
          {MODES.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => updateAudioConfig({ mode: m })}
              className={`rounded-xl border px-3 py-2.5 text-left text-xs font-semibold ${
                audioConfig.mode === m
                  ? 'border-sky-400/70 bg-sky-500/15 text-sky-200'
                  : 'border-white/10 bg-[#121721] text-slate-300'
              }`}
            >
              {t.audio.modes[m]}
            </button>
          ))}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <div className="mb-1 flex justify-between text-xs">
              <span className="text-slate-300">{t.audio.sensitivity}</span>
              <span className="font-mono text-sky-300">{audioConfig.sensitivity.toFixed(2)}x</span>
            </div>
            <input
              type="range"
              min={0.3}
              max={3.0}
              step={0.05}
              value={audioConfig.sensitivity}
              onChange={(e) => updateAudioConfig({ sensitivity: Number(e.target.value) })}
              className="wave-slider w-full"
            />
          </div>

          <div>
            <div className="mb-1 flex justify-between text-xs">
              <span className="text-slate-300">{t.audio.smoothing}</span>
              <span className="font-mono text-sky-300">
                {Math.round(audioConfig.smoothing * 100)}%
              </span>
            </div>
            <input
              type="range"
              min={0.1}
              max={0.92}
              step={0.02}
              value={audioConfig.smoothing}
              onChange={(e) => updateAudioConfig({ smoothing: Number(e.target.value) })}
              className="wave-slider w-full"
            />
          </div>
        </div>

        <div>
          <span className="mb-2 block text-xs font-medium text-slate-300">{t.audio.palette}</span>
          <div className="grid grid-cols-5 gap-2">
            {PALETTES.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => updateAudioConfig({ palette: p.id })}
                className={`overflow-hidden rounded-lg border text-center ${
                  audioConfig.palette === p.id ? 'border-sky-400' : 'border-white/10'
                }`}
              >
                <div className="h-6 w-full" style={{ background: p.css }} />
                <div className="bg-[#121721] py-1 text-[10px] font-medium text-slate-300">
                  {p.label}
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

