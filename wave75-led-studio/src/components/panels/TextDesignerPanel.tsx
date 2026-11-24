import React, { useRef } from 'react';
import {
  Type,
  Clock,
  Sparkles,
  Paintbrush,
  Eraser,
  Trash2,
  ArrowLeftRight,
  Radio,
  Zap,
} from 'lucide-react';
import {
  PIXEL_ART_PRESETS,
  PIXEL_GRID_COLS,
  PIXEL_GRID_ROWS,
  QUICK_TEXT_PRESETS,
  type TextBackgroundStyle,
  type TextColorStyle,
  type TextLedMode,
} from '../../core/engines/textLedEngine';
import { buildWave75TextLedDriver } from '../../core/engines/driverExporter';
import { useWaveStore } from '../../store/useWaveStore';
import { rgbToHex } from '../../core/utils/color';
import { ColorPicker } from '../common/ColorPicker';
import { AutoStartDriverCard } from '../common/AutoStartDriverCard';
import { waveHidManager } from '../../core/hid/hidManager';

const TEXT_MODES: Array<{
  id: TextLedMode;
  vi: string;
  en: string;
  descVi: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { id: 'marquee', vi: 'Chữ chạy ngang', en: 'Scroll Marquee', descVi: 'Chữ chạy mượt qua phím', icon: Type },
  { id: 'bounce', vi: 'Chữ lắc qua lại', en: 'Bounce Text', descVi: 'Đảo chiều qua lại', icon: ArrowLeftRight },
  { id: 'pulse', vi: 'Chữ nhấp nháy', en: 'Pulse Letters', descVi: 'Hiện lớn từng chữ giữa phím', icon: Zap },
  { id: 'clock', vi: 'Đồng hồ LED', en: 'Live Clock', descVi: 'Chạy giờ thực tế HH:MM', icon: Clock },
  { id: 'pixel_art', vi: 'Hình vẽ & Icon', en: 'Pixel Art', descVi: '8 mẫu đẹp & Tự vẽ 16×6', icon: Sparkles },
];

const COLOR_STYLES: Array<{ id: TextColorStyle; vi: string; en: string }> = [
  { id: 'rainbow', vi: 'Cầu vồng', en: 'Rainbow' },
  { id: 'gradient', vi: 'Chuyển 2 màu', en: '2-Color Grad' },
  { id: 'solid', vi: '1 màu đơn', en: 'Solid' },
  { id: 'fire', vi: 'Lửa rực cháy', en: 'Fire' },
];

const BG_STYLES: Array<{ id: TextBackgroundStyle; vi: string; en: string }> = [
  { id: 'black', vi: 'Đen (Nổi nhất)', en: 'Black (Crisp)' },
  { id: 'dim_solid', vi: 'Nền dịu', en: 'Dim Solid' },
  { id: 'aurora', vi: 'Cực quang nhẹ', en: 'Soft Aurora' },
  { id: 'rainbow_dim', vi: 'Cầu vồng mờ', en: 'Dim Rainbow' },
];

export const TextDesignerPanel: React.FC = () => {
  const language = useWaveStore((s) => s.language);
  const textLedConfig = useWaveStore((s) => s.textLedConfig);
  const updateTextLedConfig = useWaveStore((s) => s.updateTextLedConfig);
  const textLiveStream = useWaveStore((s) => s.textLiveStream);
  const setTextLiveStream = useWaveStore((s) => s.setTextLiveStream);
  const setCustomPixelCell = useWaveStore((s) => s.setCustomPixelCell);
  const clearCustomPixelGrid = useWaveStore((s) => s.clearCustomPixelGrid);
  const logoSettings = useWaveStore((s) => s.logoSettings);
  const lightIndexMap = useWaveStore((s) => s.lightIndexMap);
  const usbFps = useWaveStore((s) => s.usbFps);

  const isDrawingRef = useRef(false);
  const isVi = language === 'vi';

  return (
    <div className="grid gap-5 lg:grid-cols-12">
      {/* Left Column: Mode Selector + Big Text Input or Pixel Art Studio */}
      <div className="space-y-4 lg:col-span-7">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="flex items-center gap-2 text-base font-bold text-white">
              <Type className="h-4.5 w-4.5 text-sky-400" />
              {isVi ? 'Thiết kế Chữ chạy & Biểu tượng LED' : 'LED Text Marquee & Pixel Art Designer'}
            </h2>
            <p className="mt-0.5 text-xs text-slate-400">
              {isVi
                ? 'Gõ chữ bất kỳ để chạy trên 81 phím hoặc chọn / tự vẽ biểu tượng LED siêu nổi bật.'
                : 'Type any scrolling message across all 81 keys or pick / draw your own glowing pixel art.'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              const next = !textLiveStream;
              setTextLiveStream(next);
              if (next) void waveHidManager.ensureLiveArmed().catch(() => {});
            }}
            className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition ${
              textLiveStream
                ? 'border-emerald-400/50 bg-emerald-500/15 text-emerald-200'
                : 'border-white/10 bg-[#0A0D12] text-slate-400'
            }`}
          >
            <Radio className="h-3.5 w-3.5" />
            {isVi ? 'Phát lên bàn phím' : 'Live on Keyboard'}
          </button>
        </div>

        {/* 5 Visual Mode Cards */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          {TEXT_MODES.map(({ id, vi, en, icon: Icon }) => {
            const active = textLedConfig.mode === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => updateTextLedConfig({ mode: id })}
                className={`flex flex-col items-center gap-1.5 rounded-xl border px-2.5 py-3 text-center transition ${
                  active
                    ? 'border-sky-400 bg-sky-500/20 text-white shadow-[0_0_20px_rgba(56,189,248,0.22)]'
                    : 'border-white/[0.08] bg-[#0A0D12]/80 text-slate-300 hover:border-white/25 hover:bg-white/[0.04]'
                }`}
              >
                <Icon className={`h-4.5 w-4.5 ${active ? 'text-sky-300' : 'text-slate-400'}`} />
                <span className="text-[11.5px] font-bold leading-tight">{isVi ? vi : en}</span>
              </button>
            );
          })}
        </div>

        {/* Text Input Box & Quick Phrase Chips */}
        {textLedConfig.mode !== 'pixel_art' && textLedConfig.mode !== 'clock' && (
          <div className="space-y-3 rounded-2xl border border-white/[0.08] bg-[#0A0D12]/80 p-4">
            <label className="block text-xs font-bold text-slate-200">
              {isVi
                ? 'Nhập dòng chữ bạn muốn chạy trên bàn phím:'
                : 'Type the message to display on your keyboard:'}
            </label>
            <input
              type="text"
              maxLength={40}
              value={textLedConfig.text}
              onChange={(e) => updateTextLedConfig({ text: e.target.value })}
              placeholder="Ví dụ: WAVE 75 <3  hoặc  PRO GAMER *"
              className="w-full rounded-xl border border-sky-400/40 bg-[#121826] px-4 py-3 font-mono text-base font-bold tracking-wider text-white placeholder:text-slate-500 focus:border-sky-400 focus:ring-2 focus:ring-sky-400/25 focus:outline-none"
            />
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="mr-1 text-[11px] font-medium text-slate-400">
                {isVi ? 'Mẫu nhanh:' : 'Quick text:'}
              </span>
              {QUICK_TEXT_PRESETS.map((p) => (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => updateTextLedConfig({ text: p.text })}
                  className="rounded-lg border border-white/10 bg-[#151C2B] px-2.5 py-1 font-mono text-[11px] font-semibold text-sky-200 transition hover:border-sky-400/60 hover:bg-sky-500/15"
                >
                  {p.label}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-slate-400">
              {isVi
                ? 'Mẹo hay: Gõ <3 để ra trái tim ♥, gõ * để ra ngôi sao ★, gõ :) để ra mặt cười ☺. Tiếng Việt tự bỏ dấu để hiển thị rõ nét nhất trên 6 hàng phím!'
                : 'Tip: Type <3 for ♥, * for ★, :) for ☺.'}
            </p>
          </div>
        )}

        {/* Clock Mode Info */}
        {textLedConfig.mode === 'clock' && (
          <div className="rounded-2xl border border-sky-400/30 bg-sky-500/10 p-4 text-xs text-sky-100">
            <strong className="block text-sm text-white">
              {isVi ? 'Chế độ Đồng hồ LED thời gian thực (HH:MM)' : 'Real-Time LED Clock (HH:MM)'}
            </strong>
            <p className="mt-1 text-sky-200/85">
              {isVi
                ? 'Tự động lấy giờ hiện tại trên máy tính và cho chạy mượt ngang qua 81 phím của WAVE75 với dấu hai chấm nhấp nháy theo giây.'
                : 'Streams your live PC clock across all 81 keys with a blinking colon.'}
            </p>
          </div>
        )}

        {/* Pixel Art Gallery & Interactive 16x6 Freehand Canvas */}
        {textLedConfig.mode === 'pixel_art' && (
          <div className="space-y-4 rounded-2xl border border-white/[0.08] bg-[#0A0D12]/80 p-4">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {PIXEL_ART_PRESETS.map((art) => {
                const active = textLedConfig.pixelArtId === art.id;
                return (
                  <button
                    key={art.id}
                    type="button"
                    onClick={() => updateTextLedConfig({ pixelArtId: art.id })}
                    className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-left transition ${
                      active
                        ? 'border-sky-400 bg-sky-500/20 text-white shadow-[0_0_16px_rgba(56,189,248,0.2)]'
                        : 'border-white/10 bg-[#121721] text-slate-300 hover:border-white/25'
                    }`}
                  >
                    <span className="text-base">{art.icon}</span>
                    <span className="text-xs font-semibold leading-tight">
                      {isVi ? art.nameVi : art.nameEn}
                    </span>
                  </button>
                );
              })}
            </div>

            {textLedConfig.pixelArtId === 'custom_draw' && (
              <div
                className="space-y-3 rounded-xl border border-white/10 bg-[#111622] p-3.5"
                onPointerUp={() => {
                  isDrawingRef.current = false;
                }}
                onPointerLeave={() => {
                  isDrawingRef.current = false;
                }}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-bold text-slate-200">
                    {isVi ? 'Bảng vẽ tự do 16×6 (nhấn & kéo chuột để vẽ lên phím)' : '16×6 Freehand Pixel Grid (click & drag)'}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => updateTextLedConfig({ drawBrushSlot: 1 })}
                      className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] font-semibold ${
                        textLedConfig.drawBrushSlot === 1
                          ? 'border-sky-400 bg-sky-500/20 text-white'
                          : 'border-white/10 bg-[#0A0D12] text-slate-400'
                      }`}
                    >
                      <Paintbrush className="h-3 w-3" />
                      <span
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: rgbToHex(textLedConfig.primaryColor) }}
                      />
                      {isVi ? 'Màu 1' : 'Color 1'}
                    </button>
                    <button
                      type="button"
                      onClick={() => updateTextLedConfig({ drawBrushSlot: 2 })}
                      className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] font-semibold ${
                        textLedConfig.drawBrushSlot === 2
                          ? 'border-pink-400 bg-pink-500/20 text-white'
                          : 'border-white/10 bg-[#0A0D12] text-slate-400'
                      }`}
                    >
                      <Paintbrush className="h-3 w-3" />
                      <span
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: rgbToHex(textLedConfig.secondaryColor) }}
                      />
                      {isVi ? 'Màu 2' : 'Color 2'}
                    </button>
                    <button
                      type="button"
                      onClick={() => updateTextLedConfig({ drawBrushSlot: 0 })}
                      className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-[11px] font-semibold ${
                        textLedConfig.drawBrushSlot === 0
                          ? 'border-amber-400 bg-amber-500/20 text-amber-200'
                          : 'border-white/10 bg-[#0A0D12] text-slate-400'
                      }`}
                    >
                      <Eraser className="h-3 w-3" />
                      {isVi ? 'Tẩy' : 'Erase'}
                    </button>
                    <button
                      type="button"
                      onClick={clearCustomPixelGrid}
                      className="inline-flex items-center gap-1 rounded-lg border border-rose-500/30 bg-rose-500/10 px-2.5 py-1 text-[11px] font-semibold text-rose-200 hover:bg-rose-500/20"
                    >
                      <Trash2 className="h-3 w-3" />
                      {isVi ? 'Xóa' : 'Clear'}
                    </button>
                  </div>
                </div>

                <div
                  className="grid gap-1 select-none"
                  style={{ gridTemplateColumns: `repeat(${PIXEL_GRID_COLS}, minmax(0, 1fr))` }}
                >
                  {Array.from({ length: PIXEL_GRID_ROWS * PIXEL_GRID_COLS }).map((_, idx) => {
                    const col = idx % PIXEL_GRID_COLS;
                    const row = Math.floor(idx / PIXEL_GRID_COLS);
                    const cell = textLedConfig.customGrid[idx] ?? 0;
                    const bg =
                      cell === 1
                        ? rgbToHex(textLedConfig.primaryColor)
                        : cell === 2
                          ? rgbToHex(textLedConfig.secondaryColor)
                          : '#182032';
                    return (
                      <div
                        key={idx}
                        onPointerDown={() => {
                          isDrawingRef.current = true;
                          setCustomPixelCell(col, row, textLedConfig.drawBrushSlot);
                        }}
                        onPointerEnter={() => {
                          if (isDrawingRef.current) {
                            setCustomPixelCell(col, row, textLedConfig.drawBrushSlot);
                          }
                        }}
                        style={{
                          backgroundColor: bg,
                          boxShadow: cell > 0 ? `0 0 10px ${bg}` : 'none',
                        }}
                        className="aspect-square cursor-pointer rounded-[5px] border border-white/10 transition hover:scale-105"
                      />
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* 1-Click Save Forever Card */}
        <AutoStartDriverCard
          titleVi="Lưu thiết kế Chữ chạy / Hình vẽ này chạy mãi mãi"
          titleEn="Save This Text / Pixel Design Forever"
          descVi="Cài chạy ngầm tự động cùng Windows & lưu sẵn khung đầu vào Flash bàn phím — mỗi khi bật WAVE75 là dòng chữ / biểu tượng của bạn tự chạy ngay lập tức!"
          descEn="Installs your scrolling text or pixel art into the silent Windows auto-boot driver & primes Flash Slot 1."
          buildPayload={() =>
            buildWave75TextLedDriver({
              textConfig: textLedConfig,
              logoSettings,
              lightIndexMap,
              fps: Math.max(20, Math.min(30, usbFps)),
            })
          }
        />
      </div>

      {/* Right Column: Clean Visual Styling Controls */}
      <div className="space-y-4 rounded-2xl border border-white/[0.08] bg-[#0A0D12]/80 p-4 lg:col-span-5">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="mb-1 flex justify-between text-xs">
              <span className="font-medium text-slate-300">{isVi ? 'Độ sáng' : 'Brightness'}</span>
              <span className="font-mono font-bold text-sky-300">{textLedConfig.brightness}%</span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              value={textLedConfig.brightness}
              onChange={(e) => updateTextLedConfig({ brightness: Number(e.target.value) })}
              className="wave-slider w-full"
            />
          </div>
          <div>
            <div className="mb-1 flex justify-between text-xs">
              <span className="font-medium text-slate-300">{isVi ? 'Tốc độ chạy' : 'Scroll Speed'}</span>
              <span className="font-mono font-bold text-sky-300">{textLedConfig.speed} / 10</span>
            </div>
            <input
              type="range"
              min={1}
              max={10}
              value={textLedConfig.speed}
              onChange={(e) => updateTextLedConfig({ speed: Number(e.target.value) })}
              className="wave-slider w-full"
            />
          </div>
        </div>

        {(textLedConfig.mode === 'marquee' || textLedConfig.mode === 'clock') && (
          <div>
            <span className="mb-1.5 block text-xs font-medium text-slate-300">
              {isVi ? 'Chiều chữ chạy' : 'Scroll Direction'}
            </span>
            <div className="grid grid-cols-2 gap-2">
              {(
                [
                  ['rtl', isVi ? 'Phải → Trái (Dễ đọc)' : 'Right → Left'],
                  ['ltr', isVi ? 'Trái → Phải' : 'Left → Right'],
                ] as const
              ).map(([dir, label]) => (
                <button
                  key={dir}
                  type="button"
                  onClick={() => updateTextLedConfig({ direction: dir })}
                  className={`rounded-xl border py-2 text-xs font-semibold transition ${
                    textLedConfig.direction === dir
                      ? 'border-sky-400 bg-sky-500/20 text-white'
                      : 'border-white/10 bg-[#121721] text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}

        <div>
          <span className="mb-1.5 block text-xs font-medium text-slate-300">
            {isVi ? 'Kiểu màu chữ / nét vẽ' : 'Text Color Style'}
          </span>
          <div className="grid grid-cols-2 gap-1.5">
            {COLOR_STYLES.map((cs) => (
              <button
                key={cs.id}
                type="button"
                onClick={() => updateTextLedConfig({ colorStyle: cs.id })}
                className={`rounded-xl border py-2 text-xs font-semibold transition ${
                  textLedConfig.colorStyle === cs.id
                    ? 'border-sky-400 bg-sky-500/20 text-white'
                    : 'border-white/10 bg-[#121721] text-slate-400 hover:text-slate-200'
                }`}
              >
                {isVi ? cs.vi : cs.en}
              </button>
            ))}
          </div>
        </div>

        <div>
          <span className="mb-1.5 block text-xs font-medium text-slate-300">
            {isVi ? 'Kiểu nền phía sau' : 'Background Style'}
          </span>
          <div className="grid grid-cols-2 gap-1.5">
            {BG_STYLES.map((bs) => (
              <button
                key={bs.id}
                type="button"
                onClick={() => updateTextLedConfig({ backgroundStyle: bs.id })}
                className={`rounded-xl border py-2 text-xs font-semibold transition ${
                  textLedConfig.backgroundStyle === bs.id
                    ? 'border-indigo-400 bg-indigo-500/20 text-white'
                    : 'border-white/10 bg-[#121721] text-slate-400 hover:text-slate-200'
                }`}
              >
                {isVi ? bs.vi : bs.en}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-3 border-t border-white/10 pt-3">
          <ColorPicker
            label={isVi ? 'Màu chính (Chữ / Cọ 1)' : 'Primary Color'}
            color={textLedConfig.primaryColor}
            onChange={(c) => updateTextLedConfig({ primaryColor: c })}
            compact
          />
          <ColorPicker
            label={isVi ? 'Màu phụ (Gradient / Cọ 2)' : 'Secondary Color'}
            color={textLedConfig.secondaryColor}
            onChange={(c) => updateTextLedConfig({ secondaryColor: c })}
            compact
          />
          {textLedConfig.backgroundStyle === 'dim_solid' && (
            <ColorPicker
              label={isVi ? 'Màu nền dịu' : 'Dim Background Color'}
              color={textLedConfig.backgroundColor}
              onChange={(c) => updateTextLedConfig({ backgroundColor: c })}
              compact
            />
          )}
        </div>
      </div>
    </div>
  );
};
