import React, { useRef } from 'react';
import {
  Sliders,
  Upload,
  RotateCcw,
  Sparkles,
  Play,
  X,
} from 'lucide-react';
import {
  ANIME_CHARACTERS,
  ANIME_MOTION_PRESETS,
  DEFAULT_ANIME_STAGE_SETTINGS,
  type AnimeCharacterId,
  type AnimeStageSettings,
} from './animeCharacters';

interface AnimeMotionPopoverProps {
  open: boolean;
  onClose: () => void;
  characterId: AnimeCharacterId;
  onSelectCharacter: (id: AnimeCharacterId) => void;
  settings: AnimeStageSettings;
  onUpdateSettings: (partial: Partial<AnimeStageSettings>) => void;
  onTestTransition: () => void;
  isVi: boolean;
}

export const AnimeMotionPopover: React.FC<AnimeMotionPopoverProps> = ({
  open,
  onClose,
  characterId,
  onSelectCharacter,
  settings,
  onUpdateSettings,
  onTestTransition,
  isVi,
}) => {
  const fileRef = useRef<HTMLInputElement | null>(null);

  if (!open) return null;

  const handleUploadCustomImage = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        onUpdateSettings({ customImageUrl: reader.result });
      }
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/65 px-4">
      <div className="anime-panel-enter anime-glass relative w-full max-w-lg rounded-3xl p-5 text-rose-50">
        {/* Header */}
        <div className="mb-4 flex items-center justify-between border-b border-rose-300/15 pb-3">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-rose-500/35 to-amber-500/25 ring-1 ring-rose-400/50">
              <Sliders className="h-4.5 w-4.5 text-amber-200" />
            </span>
            <div>
              <h3 className="text-sm font-black text-white">
                {isVi ? 'Chỉnh Nhân vật & Chuyển động Live2D' : 'Character & Live2D Motion Editor'}
              </h3>
              <p className="text-[11px] text-rose-200/70">
                {isVi
                  ? 'Tất cả chuyển động chạy GPU 120 FPS siêu mượt'
                  : '100% GPU-composited silky motion'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-white/15 bg-white/5 p-1.5 text-rose-200 hover:bg-rose-500/25 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4">
          {/* 1. Character Selector + Upload Custom Anime Girl / GIF */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-bold text-rose-200">
                {isVi ? 'Nhân vật Anime nổi tiếng' : 'Featured Anime Characters'}
              </span>
              <div className="flex items-center gap-1.5">
                {settings.customImageUrl && (
                  <button
                    type="button"
                    onClick={() => onUpdateSettings({ customImageUrl: null })}
                    className="inline-flex items-center gap-1 rounded-lg border border-rose-400/40 bg-rose-500/15 px-2 py-1 text-[10px] font-bold text-rose-200 hover:bg-rose-500/25"
                  >
                    <RotateCcw className="h-3 w-3" />
                    {isVi ? 'Bỏ ảnh riêng' : 'Clear custom'}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="inline-flex items-center gap-1 rounded-lg border border-amber-400/45 bg-amber-500/15 px-2.5 py-1 text-[11px] font-bold text-amber-200 transition hover:bg-amber-500/25"
                >
                  <Upload className="h-3 w-3" />
                  {isVi ? 'Tải ảnh / GIF riêng' : 'Upload Image/GIF'}
                </button>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*,.gif,.webp,.png,.jpg"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleUploadCustomImage(f);
                    e.target.value = '';
                  }}
                />
              </div>
            </div>

            <div className="grid grid-cols-5 gap-2">
              {ANIME_CHARACTERS.map((ch) => {
                const active = !settings.customImageUrl && ch.id === characterId;
                return (
                  <button
                    key={ch.id}
                    type="button"
                    onClick={() => {
                      onUpdateSettings({ customImageUrl: null });
                      onSelectCharacter(ch.id);
                    }}
                    className={`flex flex-col items-center gap-1 rounded-xl border p-1.5 transition ${
                      active
                        ? 'anime-pill-active'
                        : 'border-white/10 bg-black/30 text-slate-300/80 hover:border-white/35'
                    }`}
                  >
                    <img
                      src={ch.avatarImage}
                      alt={ch.shortName}
                      className="h-10 w-10 rounded-full border-2 object-cover object-top"
                      style={{ borderColor: ch.theme.primary }}
                    />
                    <span className="truncate text-[10px] font-bold">{ch.shortName}</span>
                    <span
                      className="h-1.5 w-6 rounded-full"
                      style={{
                        background: `linear-gradient(90deg, ${ch.theme.primary}, ${ch.theme.accent})`,
                      }}
                    />
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2. 6 Live2D Motion Presets */}
          <div>
            <span className="mb-2 flex items-center gap-1.5 text-xs font-bold text-rose-200">
              <Sparkles className="h-3.5 w-3.5 text-amber-300" />
              {isVi ? 'Kiểu chuyển động nhân vật (2.5D Live2D)' : '2.5D Character Motion Style'}
            </span>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {ANIME_MOTION_PRESETS.map((m) => {
                const active = settings.motionMode === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => onUpdateSettings({ motionMode: m.id })}
                    className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-left text-xs font-bold transition ${
                      active
                        ? 'border-rose-400 bg-rose-500/25 text-white shadow-[0_0_14px_rgba(244,63,94,0.3)]'
                        : 'border-white/10 bg-black/30 text-rose-100/75 hover:border-rose-400/40'
                    }`}
                  >
                    <span>{m.icon}</span>
                    <span className="truncate">{isVi ? m.nameVi : m.nameEn}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 3. Fine Tuning Sliders */}
          <div className="space-y-3 rounded-2xl border border-rose-300/15 bg-black/30 p-3.5">
            <div>
              <div className="mb-1 flex justify-between text-xs">
                <span className="text-rose-200">
                  {isVi ? 'Cường độ chuyển động & lắc 3D' : 'Motion & 3D Tilt Intensity'}
                </span>
                <span className="font-mono font-bold text-amber-300">
                  {Math.round(settings.intensity * 100)}%
                </span>
              </div>
              <input
                type="range"
                min={0.4}
                max={1.8}
                step={0.1}
                value={settings.intensity}
                onChange={(e) => onUpdateSettings({ intensity: Number(e.target.value) })}
                className="wave-slider w-full"
              />
            </div>

            <div>
              <div className="mb-1 flex justify-between text-xs">
                <span className="text-rose-200">
                  {isVi ? 'Phóng to / Thu nhỏ nhân vật' : 'Character Zoom'}
                </span>
                <span className="font-mono font-bold text-amber-300">{settings.zoom}%</span>
              </div>
              <input
                type="range"
                min={100}
                max={132}
                step={1}
                value={settings.zoom}
                onChange={(e) => onUpdateSettings({ zoom: Number(e.target.value) })}
                className="wave-slider w-full"
              />
            </div>

            <div>
              <div className="mb-1 flex justify-between text-xs">
                <span className="text-rose-200">
                  {isVi ? 'Độ rõ hình nhân vật trong Studio' : 'Studio Backdrop Visibility'}
                </span>
                <span className="font-mono font-bold text-amber-300">
                  {settings.studioBackdropOpacity}%
                </span>
              </div>
              <input
                type="range"
                min={10}
                max={65}
                step={1}
                value={settings.studioBackdropOpacity}
                onChange={(e) =>
                  onUpdateSettings({ studioBackdropOpacity: Number(e.target.value) })
                }
                className="wave-slider w-full"
              />
            </div>
          </div>

          {/* Footer Actions: Test Silky Transition + Reset */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            <button
              type="button"
              onClick={() => onUpdateSettings(DEFAULT_ANIME_STAGE_SETTINGS)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-xs font-semibold text-rose-200 hover:bg-white/10"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              {isVi ? 'Mặc định' : 'Reset'}
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onTestTransition();
                }}
                className="inline-flex items-center gap-1.5 rounded-xl border border-rose-400/50 bg-rose-500/20 px-3.5 py-2 text-xs font-bold text-rose-100 transition hover:bg-rose-500/35"
              >
                <Play className="h-3.5 w-3.5" />
                {isVi ? 'Xem chuyển cảnh mượt' : 'Test Transition'}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="anime-btn-primary rounded-xl px-4 py-2 text-xs font-extrabold text-white"
              >
                {isVi ? 'Xong' : 'Done'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
