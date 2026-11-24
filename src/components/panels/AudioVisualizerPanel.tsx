import React, { useState } from 'react';
import { Mic, MonitorSpeaker, Music, Square, AlertCircle } from 'lucide-react';
import {
  sharedAudioEngine,
  type AudioPaletteId,
  type AudioSourceType,
  type AudioVisualizerMode,
} from '../../core/engines/audioEngine';
import { useStudioStore } from '../../store/useStudioStore';
import { TRANSLATIONS } from '../../i18n';

interface AudioVisualizerPanelProps {
  audioSource: AudioSourceType;
  onAudioSourceChange: (src: AudioSourceType) => void;
  bandsPreview: number[];
}

const AUDIO_MODES: AudioVisualizerMode[] = [
  'spectrum_bars',
  'bass_pulse',
  'center_wave',
  'frequency_heatmap',
];

const PALETTE_LIST: Array<{ id: AudioPaletteId; label: string; css: string }> = [
  { id: 'neon_cyan', label: 'Neon Cyan', css: 'linear-gradient(90deg, #0ea5e9, #06f0ff, #ec4899)' },
  { id: 'fire', label: 'Fire Heat', css: 'linear-gradient(90deg, #b91c1c, #f97316, #fef08a)' },
  { id: 'rainbow', label: 'Rainbow', css: 'linear-gradient(90deg, #ff0055, #ffb400, #00ff78, #00d2ff, #9146ff)' },
  { id: 'vaporwave', label: 'Vaporwave', css: 'linear-gradient(90deg, #ff71ce, #b967ff, #01cdfe)' },
  { id: 'matrix', label: 'Matrix', css: 'linear-gradient(90deg, #065f46, #10b981, #6ee7b7)' },
];

export const AudioVisualizerPanel: React.FC<AudioVisualizerPanelProps> = ({
  audioSource,
  onAudioSourceChange,
  bandsPreview,
}) => {
  const language = useStudioStore((s) => s.language);
  const audioConfig = useStudioStore((s) => s.audioConfig);
  const updateAudioConfig = useStudioStore((s) => s.updateAudioConfig);
  const [error, setError] = useState<string | null>(null);
  const t = TRANSLATIONS[language];

  const handleStartMic = async () => {
    setError(null);
    try {
      await sharedAudioEngine.startMicrophone();
      onAudioSourceChange('microphone');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Microphone permission denied.');
    }
  };

  const handleStartSystem = async () => {
    setError(null);
    try {
      await sharedAudioEngine.startSystemAudio();
      onAudioSourceChange('system');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'System audio capture cancelled.');
    }
  };

  const handleStartDemo = () => {
    setError(null);
    sharedAudioEngine.startDemoBeat();
    onAudioSourceChange('demo_beat');
  };

  const handleStop = () => {
    sharedAudioEngine.stop();
    onAudioSourceChange('none');
  };

  return (
    <div className="grid gap-5 lg:grid-cols-12">
      {/* Left: Audio Sources + 15-Band Live Spectrum Meter */}
      <div className="space-y-4 rounded-xl border border-white/[0.07] bg-[#0B0E14]/65 p-4 lg:col-span-6">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-100">{t.audio.title}</h2>
          <span
            className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium ${
              audioSource !== 'none'
                ? 'bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-400/40'
                : 'bg-white/5 text-slate-400'
            }`}
          >
            {audioSource !== 'none' ? t.audio.activeStatus : t.audio.idleStatus}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <button
            type="button"
            onClick={() => void handleStartMic()}
            className={`flex flex-col items-center gap-1.5 rounded-xl border p-3 text-xs font-semibold transition ${
              audioSource === 'microphone'
                ? 'border-cyan-400 bg-cyan-500/20 text-cyan-200'
                : 'border-white/10 bg-[#131822] text-slate-300 hover:border-cyan-400/40'
            }`}
          >
            <Mic className="h-4 w-4" />
            <span className="text-center">{t.audio.micBtn}</span>
          </button>

          <button
            type="button"
            onClick={() => void handleStartSystem()}
            className={`flex flex-col items-center gap-1.5 rounded-xl border p-3 text-xs font-semibold transition ${
              audioSource === 'system'
                ? 'border-cyan-400 bg-cyan-500/20 text-cyan-200'
                : 'border-white/10 bg-[#131822] text-slate-300 hover:border-cyan-400/40'
            }`}
          >
            <MonitorSpeaker className="h-4 w-4" />
            <span className="text-center">{t.audio.systemBtn}</span>
          </button>

          <button
            type="button"
            onClick={handleStartDemo}
            className={`flex flex-col items-center gap-1.5 rounded-xl border p-3 text-xs font-semibold transition ${
              audioSource === 'demo_beat'
                ? 'border-violet-400 bg-violet-500/20 text-violet-200'
                : 'border-white/10 bg-[#131822] text-slate-300 hover:border-violet-400/40'
            }`}
          >
            <Music className="h-4 w-4" />
            <span className="text-center">{t.audio.demoBtn}</span>
          </button>

          <button
            type="button"
            disabled={audioSource === 'none'}
            onClick={handleStop}
            className="flex flex-col items-center gap-1.5 rounded-xl border border-rose-500/35 bg-rose-500/10 p-3 text-xs font-semibold text-rose-200 transition hover:bg-rose-500/20 disabled:opacity-35"
          >
            <Square className="h-4 w-4" />
            <span>{t.audio.stopBtn}</span>
          </button>
        </div>

        {error && (
          <div className="flex items-center gap-2 rounded-lg border border-rose-500/35 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        {/* 15-Column Live FFT Spectrum Monitor */}
        <div className="rounded-xl border border-white/10 bg-[#080B10] p-3">
          <div className="mb-2 flex justify-between font-mono text-[10px] text-slate-500">
            <span>BASS (60Hz)</span>
            <span>MID (1kHz)</span>
            <span>TREBLE (12kHz)</span>
          </div>
          <div className="flex h-24 items-end gap-1.5">
            {Array.from({ length: 15 }).map((_, idx) => {
              const val = Math.max(0.05, bandsPreview[idx] ?? 0);
              return (
                <div
                  key={idx}
                  className="flex-1 rounded-t-md bg-gradient-to-t from-cyan-500 via-violet-500 to-pink-500 transition-[height] duration-75"
                  style={{ height: `${Math.round(val * 100)}%` }}
                />
              );
            })}
          </div>
        </div>
      </div>

      {/* Right: Modes, Gain, Smoothing, Palette */}
      <div className="space-y-4 rounded-xl border border-white/[0.07] bg-[#0B0E14]/65 p-4 lg:col-span-6">
        <div>
          <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-300">
            {t.audio.modeTitle}
          </h3>
          <div className="grid grid-cols-2 gap-2">
            {AUDIO_MODES.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => updateAudioConfig({ mode: m })}
                className={`rounded-xl border px-3 py-2.5 text-left text-xs font-semibold transition ${
                  audioConfig.mode === m
                    ? 'border-cyan-400/70 bg-cyan-500/15 text-cyan-200'
                    : 'border-white/10 bg-[#131822] text-slate-300 hover:border-white/20'
                }`}
              >
                {t.audio.modes[m]}
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <div className="mb-1 flex justify-between text-xs">
              <span className="text-slate-300">{t.audio.sensitivity}</span>
              <span className="font-mono text-cyan-300">
                {audioConfig.sensitivity.toFixed(2)}x
              </span>
            </div>
            <input
              type="range"
              min={0.3}
              max={3.0}
              step={0.05}
              value={audioConfig.sensitivity}
              onChange={(e) =>
                updateAudioConfig({ sensitivity: Number(e.target.value) })
              }
              className="studio-slider w-full"
            />
          </div>

          <div>
            <div className="mb-1 flex justify-between text-xs">
              <span className="text-slate-300">{t.audio.smoothing}</span>
              <span className="font-mono text-cyan-300">
                {Math.round(audioConfig.smoothing * 100)}%
              </span>
            </div>
            <input
              type="range"
              min={0.1}
              max={0.92}
              step={0.02}
              value={audioConfig.smoothing}
              onChange={(e) =>
                updateAudioConfig({ smoothing: Number(e.target.value) })
              }
              className="studio-slider w-full"
            />
          </div>
        </div>

        <div>
          <span className="mb-2 block text-xs font-medium text-slate-300">
            {t.audio.palette}
          </span>
          <div className="grid grid-cols-5 gap-2">
            {PALETTE_LIST.map((pal) => (
              <button
                key={pal.id}
                type="button"
                onClick={() => updateAudioConfig({ palette: pal.id })}
                className={`overflow-hidden rounded-lg border text-center transition ${
                  audioConfig.palette === pal.id
                    ? 'border-cyan-400 ring-1 ring-cyan-400/50'
                    : 'border-white/10'
                }`}
              >
                <div className="h-6 w-full" style={{ background: pal.css }} />
                <div className="bg-[#131822] py-1 text-[10px] font-medium text-slate-300">
                  {pal.label}
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

