import React, { useEffect, useRef, useState } from 'react';
import {
  Upload,
  Play,
  Pause,
  Radio,
  Film,
  AlertCircle,
  HardDriveUpload,
  Download,
  CheckCircle2,
  Shuffle,
} from 'lucide-react';
import {
  BUILTIN_WAVE_GIFS,
  GIF_CATEGORIES,
  decodeGifOrImage,
  sampleFrameTo81Keys,
  type FitMode,
  type GifCategory,
  type LoadedGifMedia,
} from '../../core/engines/gifEngine';
import {
  buildWave75GifDriverPs1,
  triggerTextDownload,
} from '../../core/engines/driverExporter';
import { AutoStartDriverCard } from '../common/AutoStartDriverCard';
import { useWaveStore } from '../../store/useWaveStore';
import { TRANSLATIONS } from '../../i18n';
import { waveHidManager } from '../../core/hid/hidManager';

interface GifMatrixPanelProps {
  media: LoadedGifMedia | null;
  frameIdx: number;
  onSeek: (idx: number) => void;
  onUploaded: (media: LoadedGifMedia) => void;
  onSelectBuiltIn: (presetId: string) => void;
}

const FITS: FitMode[] = ['cover', 'contain', 'stretch'];

export const GifMatrixPanel: React.FC<GifMatrixPanelProps> = ({
  media,
  frameIdx,
  onSeek,
  onUploaded,
  onSelectBuiltIn,
}) => {
  const language = useWaveStore((s) => s.language);
  const gifPresetId = useWaveStore((s) => s.gifPresetId);
  const gifFitMode = useWaveStore((s) => s.gifFitMode);
  const setGifFitMode = useWaveStore((s) => s.setGifFitMode);
  const gifSpeed = useWaveStore((s) => s.gifSpeed);
  const setGifSpeed = useWaveStore((s) => s.setGifSpeed);
  const gifPlaying = useWaveStore((s) => s.gifPlaying);
  const setGifPlaying = useWaveStore((s) => s.setGifPlaying);
  const gifLiveStream = useWaveStore((s) => s.gifLiveStream);
  const setGifLiveStream = useWaveStore((s) => s.setGifLiveStream);
  const gifAdjustments = useWaveStore((s) => s.gifAdjustments);
  const updateGifAdjustments = useWaveStore((s) => s.updateGifAdjustments);
  const usbFps = useWaveStore((s) => s.usbFps);
  const setUsbFps = useWaveStore((s) => s.setUsbFps);
  const lightIndexMap = useWaveStore((s) => s.lightIndexMap);
  const logoSettings = useWaveStore((s) => s.logoSettings);
  const updateLogoSettings = useWaveStore((s) => s.updateLogoSettings);
  const setCaseSkin = useWaveStore((s) => s.setCaseSkin);
  const activeSlot = useWaveStore((s) => s.activeSlot);

  const [err, setErr] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [savingFlash, setSavingFlash] = useState(false);
  const [drag, setDrag] = useState(false);
  const [activeCategory, setActiveCategory] = useState<GifCategory>('red_edition');
  const inputRef = useRef<HTMLInputElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const t = TRANSLATIONS[language];

  const applyRedLogoPreset = async (
    label: string,
    color: { r: number; g: number; b: number },
    effect: 'static' | 'breathing'
  ) => {
    setCaseSkin('anodized_red');
    const next = {
      ...logoSettings,
      color,
      brightness: 100,
      speed: 3,
      saturation: color.r === color.g && color.g === color.b ? 0 : 100,
      effect,
    };
    updateLogoSettings(next);
    try {
      await waveHidManager.applyLogoSettings(next);
      setNotice(
        language === 'vi'
          ? `Đã bật vỏ xem trước Đỏ CNC & đồng bộ Đèn Logo CNC sang "${label}"!`
          : `Switched preview to Red CNC & synced CNC Logo LED to "${label}"!`
      );
    } catch {
      setNotice(
        language === 'vi'
          ? `Đã chuyển giao diện sang Đỏ CNC & đặt sẵn Logo "${label}" (sẽ đồng bộ khi kết nối phím).`
          : `Set Red CNC preview & queued "${label}" Logo (will sync on connect).`
      );
    }
  };

  const filteredGifs =
    activeCategory === 'all'
      ? BUILTIN_WAVE_GIFS
      : BUILTIN_WAVE_GIFS.filter((g) => g.category === activeCategory);

  const handleRandomGif = () => {
    const pool = filteredGifs.length > 1 ? filteredGifs.filter((g) => g.id !== gifPresetId) : BUILTIN_WAVE_GIFS;
    const pick = pool[Math.floor(Math.random() * pool.length)];
    if (pick) onSelectBuiltIn(pick.id);
  };

  const handleSaveCurrentFrameToFlash = async () => {
    if (!media || media.frames.length === 0) return;
    setSavingFlash(true);
    setErr(null);
    setNotice(null);
    try {
      const f = media.frames[frameIdx % media.frames.length];
      const sampled = sampleFrameTo81Keys(f.imageData, gifFitMode, gifAdjustments);
      const res = await waveHidManager.saveOnboardSlotSafe(
        activeSlot,
        sampled.keys,
        sampled.logo,
        lightIndexMap
      );
      setNotice(res.message);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Lưu khung GIF vào Flash thất bại');
    } finally {
      setSavingFlash(false);
    }
  };

  const handleExportBackgroundDriver = () => {
    if (!media || media.frames.length === 0) return;
    setErr(null);
    const { filename, ps1Content, frameCount } = buildWave75GifDriverPs1({
      media,
      fitMode: gifFitMode,
      adjustments: gifAdjustments,
      gifSpeed,
      logoSettings,
      lightIndexMap,
    });
    triggerTextDownload(filename, ps1Content);
    setNotice(
      language === 'vi'
        ? `Đã tải "${filename}" (${frameCount} frame GIF + Đèn Logo CNC)! Đóng trang web rồi chuột phải -> "Run with PowerShell" (hoặc đặt vào shell:startup) để GIF tự chạy ngầm mãi mãi không cần mở trình duyệt.`
        : `Downloaded "${filename}" (${frameCount} GIF frames + CNC Logo)! Close this tab and run with PowerShell (or add to shell:startup) for standalone background playback.`
    );
  };

  useEffect(() => {
    const c = canvasRef.current;
    if (!c || !media || media.frames.length === 0) return;
    const f = media.frames[frameIdx % media.frames.length];
    if (!f) return;
    c.width = media.width;
    c.height = media.height;
    const ctx = c.getContext('2d');
    if (ctx) ctx.putImageData(f.imageData, 0, 0);
  }, [media, frameIdx]);

  const handleFile = async (file: File) => {
    setErr(null);
    try {
      const decoded = await decodeGifOrImage(file);
      onUploaded(decoded);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Decode failed');
    }
  };

  const totalFrames = media?.frames.length ?? 1;

  return (
    <div className="grid gap-5 lg:grid-cols-12">
      <div className="space-y-4 lg:col-span-7">
        <div className="grid gap-4 sm:grid-cols-2">
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDrag(true);
            }}
            onDragLeave={() => setDrag(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDrag(false);
              const f = e.dataTransfer.files?.[0];
              if (f) void handleFile(f);
            }}
            onClick={() => inputRef.current?.click()}
            className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-5 text-center transition ${
              drag
                ? 'border-sky-400 bg-sky-500/15'
                : 'border-white/15 bg-[#0A0D12]/70 hover:border-sky-400/50'
            }`}
          >
            <Upload className="mb-2 h-7 w-7 text-sky-400" />
            <span className="text-xs font-semibold text-slate-200">{t.gif.uploadTitle}</span>
            <span className="mt-1 text-[11px] text-slate-400">{t.gif.uploadHint}</span>
            <input
              ref={inputRef}
              type="file"
              accept=".gif,.png,.webp,.jpg,.jpeg,image/*"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void handleFile(f);
                e.target.value = '';
              }}
              className="hidden"
            />
          </div>

          <div className="flex flex-col justify-between rounded-xl border border-white/[0.08] bg-[#0A0D12]/80 p-3">
            <div className="mb-2 flex items-center justify-between text-[11px]">
              <span className="flex items-center gap-1.5 font-semibold text-slate-200">
                <Film className="h-3.5 w-3.5 text-indigo-400" />
                {media?.name ?? 'Preview'}
              </span>
              <span className="font-mono text-slate-400">
                {media ? `${media.width}×${media.height}` : '—'}
              </span>
            </div>
            <div className="flex h-24 items-center justify-center overflow-hidden rounded-lg border border-white/10 bg-black">
              <canvas
                ref={canvasRef}
                className="h-full w-full object-contain"
                style={{ imageRendering: 'pixelated' }}
              />
            </div>
            <div className="mt-2.5 flex items-center gap-2">
              <button
                type="button"
                onClick={() => setGifPlaying(!gifPlaying)}
                className="inline-flex items-center gap-1 rounded-lg bg-sky-500/20 px-2.5 py-1 text-xs font-semibold text-sky-200 ring-1 ring-sky-400/40"
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
                max={Math.max(0, totalFrames - 1)}
                value={Math.min(frameIdx, totalFrames - 1)}
                onChange={(e) => onSeek(Number(e.target.value))}
                className="wave-slider flex-1"
              />
              <span className="font-mono text-[10px] text-slate-400">
                {frameIdx + 1}/{totalFrames}
              </span>
            </div>
          </div>
        </div>

        {err && (
          <div className="flex items-center gap-2 rounded-lg border border-rose-500/35 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {err}
          </div>
        )}

        {notice && (
          <div className="flex items-start gap-2 rounded-lg border border-emerald-500/35 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-200">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
            <span>{notice}</span>
          </div>
        )}

        {/* 34 Built-In GIF Gallery with Category Filters */}
        <div className="space-y-3 rounded-xl border border-white/[0.08] bg-[#0A0D12]/70 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200">
              {t.gif.builtInTitle}{' '}
              <span className="ml-1 rounded-full bg-sky-500/20 px-2 py-0.5 text-[10px] font-bold text-sky-300">
                {BUILTIN_WAVE_GIFS.length}
              </span>
            </h3>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleRandomGif}
                className="inline-flex items-center gap-1.5 rounded-lg border border-fuchsia-400/40 bg-fuchsia-500/15 px-2.5 py-1 text-xs font-semibold text-fuchsia-200 transition hover:bg-fuchsia-500/25"
              >
                <Shuffle className="h-3.5 w-3.5" />
                {language === 'vi' ? 'Ngẫu nhiên' : 'Random'}
              </button>
              <button
                type="button"
                onClick={() => {
                  const next = !gifLiveStream;
                  setGifLiveStream(next);
                  if (next) void waveHidManager.ensureLiveArmed().catch(() => {});
                }}
                className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-semibold ${
                  gifLiveStream
                    ? 'border-emerald-400/50 bg-emerald-500/15 text-emerald-200'
                    : 'border-white/10 bg-[#121721] text-slate-400'
                }`}
              >
                <Radio className="h-3.5 w-3.5" />
                {t.gif.liveStream}
              </button>
            </div>
          </div>

          {/* Category Filter Pills */}
          <div className="flex flex-wrap gap-1.5">
            {GIF_CATEGORIES.map((cat) => {
              const count =
                cat.id === 'all'
                  ? BUILTIN_WAVE_GIFS.length
                  : BUILTIN_WAVE_GIFS.filter((g) => g.category === cat.id).length;
              const isSelected = activeCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setActiveCategory(cat.id)}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition ${
                    isSelected
                      ? cat.id === 'red_edition'
                        ? 'border-red-400/80 bg-gradient-to-r from-red-600/35 to-amber-500/25 text-red-100 shadow-[0_0_14px_rgba(239,68,68,0.35)]'
                        : cat.id === 'love'
                          ? 'border-rose-400/70 bg-rose-500/20 text-rose-100 shadow-[0_0_12px_rgba(244,63,94,0.25)]'
                          : 'border-sky-400/70 bg-sky-500/20 text-sky-100 shadow-[0_0_12px_rgba(56,189,248,0.2)]'
                      : cat.id === 'red_edition'
                        ? 'border-red-500/35 bg-red-950/30 text-red-200 hover:border-red-400/60'
                        : 'border-white/10 bg-[#121721] text-slate-400 hover:border-white/25 hover:text-slate-200'
                  }`}
                >
                  <span>{cat.icon}</span>
                  <span>{language === 'vi' ? cat.nameVi : cat.nameEn}</span>
                  <span className="rounded-full bg-black/30 px-1.5 text-[10px] opacity-80">
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {activeCategory === 'red_edition' && (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-red-500/30 bg-gradient-to-r from-red-950/50 via-[#15090d] to-amber-950/30 px-3 py-2">
              <span className="text-[11px] font-medium text-red-100">
                {language === 'vi'
                  ? '🔴 Chọn riêng cho vỏ phím Đỏ CNC — Đồng bộ nhanh Đèn Logo CNC:'
                  : '🔴 Tuned for Red CNC Case — Quick CNC Logo LED Match:'}
              </span>
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => void applyRedLogoPreset('Trắng Tuyết', { r: 255, g: 255, b: 255 }, 'static')}
                  className="inline-flex items-center gap-1 rounded-lg border border-white/30 bg-white/10 px-2 py-1 text-[11px] font-semibold text-white transition hover:bg-white/20"
                >
                  <span className="h-2.5 w-2.5 rounded-full bg-white shadow-[0_0_6px_#fff]" />
                  {language === 'vi' ? 'Logo Trắng' : 'White'}
                </button>
                <button
                  type="button"
                  onClick={() => void applyRedLogoPreset('Vàng 24K', { r: 251, g: 191, b: 36 }, 'breathing')}
                  className="inline-flex items-center gap-1 rounded-lg border border-amber-400/45 bg-amber-500/15 px-2 py-1 text-[11px] font-semibold text-amber-200 transition hover:bg-amber-500/25"
                >
                  <span className="h-2.5 w-2.5 rounded-full bg-amber-400 shadow-[0_0_6px_#fbbf24]" />
                  {language === 'vi' ? 'Logo Vàng' : 'Gold'}
                </button>
                <button
                  type="button"
                  onClick={() => void applyRedLogoPreset('Đỏ Ruby', { r: 239, g: 68, b: 68 }, 'breathing')}
                  className="inline-flex items-center gap-1 rounded-lg border border-red-400/45 bg-red-500/15 px-2 py-1 text-[11px] font-semibold text-red-200 transition hover:bg-red-500/25"
                >
                  <span className="h-2.5 w-2.5 rounded-full bg-red-500 shadow-[0_0_6px_#ef4444]" />
                  {language === 'vi' ? 'Logo Đỏ' : 'Ruby'}
                </button>
              </div>
            </div>
          )}

          {/* GIF Cards Grid */}
          <div className="grid max-h-[340px] grid-cols-2 gap-2 overflow-y-auto pr-1 sm:grid-cols-3 md:grid-cols-4">
            {filteredGifs.map((p) => {
              const active = media?.isBuiltIn && gifPresetId === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => onSelectBuiltIn(p.id)}
                  className={`group relative overflow-hidden rounded-xl border text-left transition ${
                    active
                      ? 'border-sky-400 ring-1 ring-sky-400/50 shadow-[0_0_16px_rgba(56,189,248,0.3)]'
                      : 'border-white/10 hover:border-white/30'
                  }`}
                >
                  <div
                    className="relative flex h-10 w-full items-center justify-between px-2"
                    style={{ background: p.previewGradient }}
                  >
                    <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-black/35 text-sm backdrop-blur-sm">
                      {p.icon}
                    </span>
                    {p.isNew && (
                      <span className="rounded-full bg-black/55 px-1.5 py-0.5 text-[9px] font-bold tracking-wide text-amber-300 backdrop-blur-sm">
                        {language === 'vi' ? 'MỚI' : 'NEW'}
                      </span>
                    )}
                  </div>
                  <div className="truncate bg-[#121721] px-2.5 py-1.5 text-xs font-medium text-slate-200 group-hover:text-white">
                    {language === 'vi' ? p.nameVi : p.nameEn}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* 1-Click Persistent Auto-Start Driver for Animated GIF + Flash Snapshot */}
        <AutoStartDriverCard
          titleVi="Khóa GIF động này chạy mãi mãi khi bật phím / mở máy"
          titleEn="Lock This GIF Forever (Auto-Start + Flash)"
          descVi="Nhúng toàn bộ khung hình GIF + Đèn Logo CNC vào driver chạy ngầm ẩn khởi động cùng Windows & ghi sẵn khung đầu vào Flash Slot 1. Bật phím WAVE75 lên là chạy GIF này ngay không cần mở trình duyệt!"
          descEn="Embeds all GIF frames + CNC Logo into a silent Windows auto-start daemon and primes Flash Slot 1 for instant boot playback!"
          buildPayload={() => {
            if (!media || media.frames.length === 0) return null;
            return buildWave75GifDriverPs1({
              media,
              fitMode: gifFitMode,
              adjustments: gifAdjustments,
              gifSpeed,
              logoSettings,
              lightIndexMap,
            });
          }}
        />

        {/* Additional Actions: Static Flash Snapshot + Raw .ps1 Download */}
        <div className="grid gap-2.5 sm:grid-cols-2">
          <button
            type="button"
            disabled={savingFlash || !media}
            onClick={() => void handleSaveCurrentFrameToFlash()}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-sky-400/45 bg-sky-500/15 px-3.5 py-2 text-xs font-semibold text-sky-100 transition hover:bg-sky-500/25 disabled:opacity-45"
          >
            <HardDriveUpload className="h-4 w-4 text-sky-300" />
            {savingFlash
              ? language === 'vi'
                ? 'Đang ghi Flash...'
                : 'Saving Flash...'
              : language === 'vi'
                ? `Lưu 1 khung tĩnh vào Flash (Khe ${activeSlot})`
                : `Save 1 Static Frame to Flash (Slot ${activeSlot})`}
          </button>

          <button
            type="button"
            disabled={!media}
            onClick={handleExportBackgroundDriver}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/15 bg-[#121721] px-3.5 py-2 text-xs font-semibold text-slate-200 transition hover:border-emerald-400/50 hover:text-emerald-200 disabled:opacity-45"
          >
            <Download className="h-4 w-4" />
            {language === 'vi'
              ? 'Tải mã nguồn Driver (.ps1)'
              : 'Download Driver Script (.ps1)'}
          </button>
        </div>
      </div>

      {/* Right: Fit Mode & Matrix Adjustments */}
      <div className="space-y-4 rounded-xl border border-white/[0.07] bg-[#0A0D12]/65 p-4 lg:col-span-5">
        <div>
          <span className="mb-1.5 block text-xs font-medium text-slate-300">{t.gif.fitMode}</span>
          <div className="grid grid-cols-3 gap-1.5">
            {FITS.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setGifFitMode(m)}
                className={`rounded-lg border py-1.5 text-xs font-medium ${
                  gifFitMode === m
                    ? 'border-sky-400/60 bg-sky-500/15 text-sky-200'
                    : 'border-white/10 bg-[#121721] text-slate-400'
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
              <span className="text-slate-300">{t.gif.speed}</span>
              <span className="font-mono text-sky-300">{gifSpeed.toFixed(2)}x</span>
            </div>
            <input
              type="range"
              min={0.25}
              max={2.5}
              step={0.05}
              value={gifSpeed}
              onChange={(e) => setGifSpeed(Number(e.target.value))}
              className="wave-slider w-full"
            />
          </div>

          <div>
            <div className="mb-1 flex justify-between text-xs">
              <span className="text-slate-300">{t.gif.usbFps}</span>
              <span className="font-mono text-sky-300">{usbFps} FPS</span>
            </div>
            <input
              type="range"
              min={5}
              max={30}
              value={usbFps}
              onChange={(e) => {
                const f = Number(e.target.value);
                setUsbFps(f);
                waveHidManager.setMaxFps(f);
              }}
              className="wave-slider w-full"
            />
          </div>
        </div>

        <div className="space-y-3 border-t border-white/10 pt-3">
          {(
            [
              ['brightness', t.gif.brightness, 20, 180, 1, '%'],
              ['contrast', t.gif.contrast, 40, 180, 1, '%'],
              ['saturation', t.gif.saturation, 0, 200, 1, '%'],
              ['gamma', t.gif.gamma, 0.4, 2.6, 0.05, ''],
            ] as const
          ).map(([key, label, min, max, step, unit]) => (
            <div key={key}>
              <div className="mb-1 flex justify-between text-xs">
                <span className="text-slate-300">{label}</span>
                <span className="font-mono text-sky-300">
                  {key === 'gamma'
                    ? gifAdjustments[key].toFixed(2)
                    : `${gifAdjustments[key]}${unit}`}
                </span>
              </div>
              <input
                type="range"
                min={min}
                max={max}
                step={step}
                value={gifAdjustments[key]}
                onChange={(e) => updateGifAdjustments({ [key]: Number(e.target.value) })}
                className="wave-slider w-full"
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

