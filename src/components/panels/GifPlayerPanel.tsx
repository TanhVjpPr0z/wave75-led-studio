import React, { useEffect, useRef, useState } from 'react';
import { Upload, Play, Pause, Radio, Film, AlertCircle } from 'lucide-react';
import {
  BUILTIN_GIF_PRESETS,
  decodeMediaFile,
  type FitMode,
  type LoadedMedia,
} from '../../core/engines/gifEngine';
import { useStudioStore } from '../../store/useStudioStore';
import { TRANSLATIONS } from '../../i18n';
import { hidManager } from '../../core/hid/hidManager';

interface GifPlayerPanelProps {
  media: LoadedMedia | null;
  currentFrameIdx: number;
  onSeekFrame: (frameIndex: number) => void;
  onMediaUploaded: (media: LoadedMedia) => void;
  onSelectBuiltIn: (presetId: string) => void;
}

const FIT_MODES: FitMode[] = ['cover', 'contain', 'stretch'];
const QUANT_OPTIONS = [0, 8, 16, 32];

export const GifPlayerPanel: React.FC<GifPlayerPanelProps> = ({
  media,
  currentFrameIdx,
  onSeekFrame,
  onMediaUploaded,
  onSelectBuiltIn,
}) => {
  const language = useStudioStore((s) => s.language);
  const gifPresetId = useStudioStore((s) => s.gifPresetId);
  const gifFitMode = useStudioStore((s) => s.gifFitMode);
  const setGifFitMode = useStudioStore((s) => s.setGifFitMode);
  const gifSpeed = useStudioStore((s) => s.gifSpeed);
  const setGifSpeed = useStudioStore((s) => s.setGifSpeed);
  const gifPlaying = useStudioStore((s) => s.gifPlaying);
  const setGifPlaying = useStudioStore((s) => s.setGifPlaying);
  const gifLiveStream = useStudioStore((s) => s.gifLiveStream);
  const setGifLiveStream = useStudioStore((s) => s.setGifLiveStream);
  const gifAdjustments = useStudioStore((s) => s.gifAdjustments);
  const updateGifAdjustments = useStudioStore((s) => s.updateGifAdjustments);
  const usbFpsLimit = useStudioStore((s) => s.usbFpsLimit);
  const setUsbFpsLimit = useStudioStore((s) => s.setUsbFpsLimit);

  const [uploadError, setUploadError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const t = TRANSLATIONS[language];

  // Draw current decoded frame onto preview canvas
  useEffect(() => {
    const canvas = previewCanvasRef.current;
    if (!canvas || !media || media.frames.length === 0) return;
    const frame = media.frames[currentFrameIdx % media.frames.length];
    if (!frame) return;
    canvas.width = media.width;
    canvas.height = media.height;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.putImageData(frame.imageData, 0, 0);
    }
  }, [media, currentFrameIdx]);

  const handleFile = async (file: File) => {
    setUploadError(null);
    try {
      const decoded = await decodeMediaFile(file);
      onMediaUploaded(decoded);
    } catch (err) {
      setUploadError(
        err instanceof Error ? err.message : 'Unable to decode image/GIF file.'
      );
    }
  };

  const frameTotal = media?.frames.length ?? 1;

  return (
    <div className="grid gap-5 lg:grid-cols-12">
      {/* Left: Upload + Preview + Timeline + Built-in Gallery */}
      <div className="space-y-4 lg:col-span-7">
        {/* Upload Dropzone & Live Preview */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              const file = e.dataTransfer.files?.[0];
              if (file) void handleFile(file);
            }}
            onClick={() => fileInputRef.current?.click()}
            className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-5 text-center transition ${
              dragging
                ? 'border-cyan-400 bg-cyan-500/15'
                : 'border-white/15 bg-[#0B0E14]/70 hover:border-cyan-400/50 hover:bg-white/[0.03]'
            }`}
          >
            <Upload className="mb-2 h-7 w-7 text-cyan-400" />
            <span className="text-xs font-semibold text-slate-200">
              {t.gif.uploadTitle}
            </span>
            <span className="mt-1 text-[11px] text-slate-400">{t.gif.uploadHint}</span>
            <input
              ref={fileInputRef}
              type="file"
              accept=".gif,.png,.webp,.jpg,.jpeg,image/*"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handleFile(file);
                e.target.value = '';
              }}
              className="hidden"
            />
          </div>

          {/* Preview Monitor */}
          <div className="flex flex-col justify-between rounded-xl border border-white/[0.08] bg-[#0B0E14]/80 p-3">
            <div className="mb-2 flex items-center justify-between text-[11px]">
              <span className="flex items-center gap-1.5 font-semibold text-slate-200">
                <Film className="h-3.5 w-3.5 text-violet-400" />
                {media ? media.name : 'Preview'}
              </span>
              <span className="font-mono text-slate-400">
                {media ? `${media.width}×${media.height}` : '—'}
              </span>
            </div>
            <div className="flex h-24 items-center justify-center overflow-hidden rounded-lg border border-white/10 bg-black">
              <canvas
                ref={previewCanvasRef}
                className="h-full w-full object-contain"
                style={{ imageRendering: 'pixelated' }}
              />
            </div>
            <div className="mt-2.5 flex items-center gap-2">
              <button
                type="button"
                onClick={() => setGifPlaying(!gifPlaying)}
                className="inline-flex items-center gap-1 rounded-lg bg-cyan-500/20 px-2.5 py-1 text-xs font-semibold text-cyan-200 ring-1 ring-cyan-400/40 hover:bg-cyan-500/30"
              >
                {gifPlaying ? (
                  <>
                    <Pause className="h-3.5 w-3.5" /> {t.gif.pause}
                  </>
                ) : (
                  <>
                    <Play className="h-3.5 w-3.5" /> {t.gif.play}
                  </>
                )}
              </button>
              <input
                type="range"
                min={0}
                max={Math.max(0, frameTotal - 1)}
                value={Math.min(currentFrameIdx, frameTotal - 1)}
                onChange={(e) => onSeekFrame(Number(e.target.value))}
                className="studio-slider flex-1"
              />
              <span className="font-mono text-[10px] text-slate-400">
                {currentFrameIdx + 1}/{frameTotal}
              </span>
            </div>
          </div>
        </div>

        {uploadError && (
          <div className="flex items-center gap-2 rounded-lg border border-rose-500/35 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {uploadError}
          </div>
        )}

        {/* Built-in Procedural GIFs */}
        <div className="space-y-2.5 rounded-xl border border-white/[0.07] bg-[#0B0E14]/65 p-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
              {t.gif.builtInTitle}
            </h3>
            <button
              type="button"
              onClick={() => setGifLiveStream(!gifLiveStream)}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-semibold transition ${
                gifLiveStream
                  ? 'border-emerald-400/50 bg-emerald-500/15 text-emerald-200'
                  : 'border-white/10 bg-[#131822] text-slate-400'
              }`}
            >
              <Radio className="h-3.5 w-3.5" />
              {t.gif.liveStream}
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {BUILTIN_GIF_PRESETS.map((preset) => {
              const active = media?.isBuiltIn && gifPresetId === preset.id;
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => onSelectBuiltIn(preset.id)}
                  className={`overflow-hidden rounded-xl border text-left transition ${
                    active
                      ? 'border-cyan-400 shadow-[0_0_16px_rgba(6,182,212,0.25)]'
                      : 'border-white/10 hover:border-white/25'
                  }`}
                >
                  <div
                    className="h-10 w-full"
                    style={{ background: preset.previewGradient }}
                  />
                  <div className="bg-[#131822] px-2.5 py-1.5 text-[11px] font-medium text-slate-200">
                    {language === 'vi' ? preset.nameVi : preset.nameEn}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Right: Image-to-LED Matrix Adjustments */}
      <div className="space-y-4 rounded-xl border border-white/[0.07] bg-[#0B0E14]/65 p-4 lg:col-span-5">
        <div>
          <span className="mb-1.5 block text-xs font-medium text-slate-300">
            {t.gif.fitMode}
          </span>
          <div className="grid grid-cols-3 gap-1.5">
            {FIT_MODES.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setGifFitMode(m)}
                className={`rounded-lg border px-2 py-1.5 text-xs font-medium transition ${
                  gifFitMode === m
                    ? 'border-cyan-400/60 bg-cyan-500/15 text-cyan-200'
                    : 'border-white/10 bg-[#131822] text-slate-400'
                }`}
              >
                {t.gif.fitModes[m]}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="mb-1 flex justify-between text-xs">
              <span className="text-slate-300">{t.gif.playbackSpeed}</span>
              <span className="font-mono text-cyan-300">{gifSpeed.toFixed(2)}x</span>
            </div>
            <input
              type="range"
              min={0.25}
              max={2.5}
              step={0.05}
              value={gifSpeed}
              onChange={(e) => setGifSpeed(Number(e.target.value))}
              className="studio-slider w-full"
            />
          </div>

          <div>
            <div className="mb-1 flex justify-between text-xs">
              <span className="text-slate-300">{t.gif.usbFps}</span>
              <span className="font-mono text-cyan-300">{usbFpsLimit} FPS</span>
            </div>
            <input
              type="range"
              min={10}
              max={90}
              step={5}
              value={usbFpsLimit}
              onChange={(e) => {
                const fps = Number(e.target.value);
                setUsbFpsLimit(fps);
                hidManager.setMaxFps(fps);
              }}
              className="studio-slider w-full"
            />
          </div>
        </div>

        {/* Brightness, Contrast, Saturation, Gamma */}
        <div className="space-y-3 border-t border-white/10 pt-3">
          <div>
            <div className="mb-1 flex justify-between text-xs">
              <span className="text-slate-300">{t.gif.brightness}</span>
              <span className="font-mono text-cyan-300">
                {gifAdjustments.brightness}%
              </span>
            </div>
            <input
              type="range"
              min={20}
              max={180}
              value={gifAdjustments.brightness}
              onChange={(e) =>
                updateGifAdjustments({ brightness: Number(e.target.value) })
              }
              className="studio-slider w-full"
            />
          </div>

          <div>
            <div className="mb-1 flex justify-between text-xs">
              <span className="text-slate-300">{t.gif.contrast}</span>
              <span className="font-mono text-cyan-300">
                {gifAdjustments.contrast}%
              </span>
            </div>
            <input
              type="range"
              min={40}
              max={180}
              value={gifAdjustments.contrast}
              onChange={(e) =>
                updateGifAdjustments({ contrast: Number(e.target.value) })
              }
              className="studio-slider w-full"
            />
          </div>

          <div>
            <div className="mb-1 flex justify-between text-xs">
              <span className="text-slate-300">{t.gif.saturation}</span>
              <span className="font-mono text-cyan-300">
                {gifAdjustments.saturation}%
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={200}
              value={gifAdjustments.saturation}
              onChange={(e) =>
                updateGifAdjustments({ saturation: Number(e.target.value) })
              }
              className="studio-slider w-full"
            />
          </div>

          <div>
            <div className="mb-1 flex justify-between text-xs">
              <span className="text-slate-300">{t.gif.gamma}</span>
              <span className="font-mono text-cyan-300">
                {gifAdjustments.gamma.toFixed(2)}
              </span>
            </div>
            <input
              type="range"
              min={0.4}
              max={2.6}
              step={0.05}
              value={gifAdjustments.gamma}
              onChange={(e) =>
                updateGifAdjustments({ gamma: Number(e.target.value) })
              }
              className="studio-slider w-full"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs text-slate-300">
              {t.gif.quantization}
            </label>
            <div className="grid grid-cols-4 gap-1.5">
              {QUANT_OPTIONS.map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => updateGifAdjustments({ quantizeLevels: q })}
                  className={`rounded-lg border py-1.5 font-mono text-[11px] transition ${
                    gifAdjustments.quantizeLevels === q
                      ? 'border-cyan-400/60 bg-cyan-500/15 text-cyan-200'
                      : 'border-white/10 bg-[#131822] text-slate-400'
                  }`}
                >
                  {q === 0 ? t.gif.quantOff.split(' ')[0] : `${q} lvl`}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

