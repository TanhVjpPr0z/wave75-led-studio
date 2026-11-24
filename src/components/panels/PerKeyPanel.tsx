import React, { useState } from 'react';
import {
  MousePointer2,
  Paintbrush,
  PaintBucket,
  Pipette,
  Eraser,
  Undo2,
  Redo2,
  Trash2,
  Plus,
  X,
  Wand2,
} from 'lucide-react';
import { useStudioStore, type PerKeyTool } from '../../store/useStudioStore';
import { TRANSLATIONS } from '../../i18n';
import { QUICK_COLOR_PRESETS, rgbToHex } from '../../core/utils/color';
import { ColorPicker } from '../common/ColorPicker';
import { hidManager } from '../../core/hid/hidManager';

const TOOLS: Array<{ id: PerKeyTool; icon: React.ComponentType<{ className?: string }> }> = [
  { id: 'select', icon: MousePointer2 },
  { id: 'brush', icon: Paintbrush },
  { id: 'bucket', icon: PaintBucket },
  { id: 'eyedropper', icon: Pipette },
  { id: 'eraser', icon: Eraser },
];

export const PerKeyPanel: React.FC = () => {
  const language = useStudioStore((s) => s.language);
  const perKeyTool = useStudioStore((s) => s.perKeyTool);
  const setPerKeyTool = useStudioStore((s) => s.setPerKeyTool);
  const brushColor = useStudioStore((s) => s.brushColor);
  const setBrushColor = useStudioStore((s) => s.setBrushColor);
  const selectedKeys = useStudioStore((s) => s.selectedKeys);
  const paintKeys = useStudioStore((s) => s.paintKeys);
  const clearAllPerKeyColors = useStudioStore((s) => s.clearAllPerKeyColors);
  const undoStack = useStudioStore((s) => s.undoStack);
  const redoStack = useStudioStore((s) => s.redoStack);
  const undoPerKey = useStudioStore((s) => s.undoPerKey);
  const redoPerKey = useStudioStore((s) => s.redoPerKey);

  const gradientConfig = useStudioStore((s) => s.gradientConfig);
  const updateGradientConfig = useStudioStore((s) => s.updateGradientConfig);
  const applyGradientToSelection = useStudioStore((s) => s.applyGradientToSelection);
  const applyQuickColorTheme = useStudioStore((s) => s.applyQuickColorTheme);
  const perKeyColors = useStudioStore((s) => s.perKeyColors);
  const ledIndexMap = useStudioStore((s) => s.ledIndexMap);

  const [editingStopIndex, setEditingStopIndex] = useState<number | null>(null);
  const [pushStatus, setPushStatus] = useState<{ ok: boolean; text: string } | null>(null);
  const t = TRANSLATIONS[language];

  const handlePushNow = async () => {
    setPushStatus(null);
    try {
      await hidManager.forcePushPerKeyNow(perKeyColors, ledIndexMap);
      setPushStatus({
        ok: true,
        text:
          language === 'vi'
            ? 'Đã gửi bảng màu 61 phím (396B, 8 trang cmd 0x09) lên AULA WIN 60 HE!'
            : 'Sent 61-key RGB matrix (396B, 8 pages cmd 0x09) to AULA WIN 60 HE!',
      });
    } catch (e) {
      setPushStatus({
        ok: false,
        text: e instanceof Error ? e.message : 'Push failed',
      });
    }
  };

  const activePickerColor =
    editingStopIndex !== null && gradientConfig.stops[editingStopIndex]
      ? gradientConfig.stops[editingStopIndex]
      : brushColor;

  const handlePickerChange = (nextColor: typeof brushColor) => {
    if (editingStopIndex !== null && gradientConfig.stops[editingStopIndex]) {
      const nextStops = gradientConfig.stops.map((s, idx) =>
        idx === editingStopIndex ? nextColor : s
      );
      updateGradientConfig({ stops: nextStops });
    } else {
      setBrushColor(nextColor);
    }
  };

  const handleAddStop = () => {
    if (gradientConfig.stops.length >= 4) return;
    const nextStops = [...gradientConfig.stops, { ...brushColor }];
    updateGradientConfig({ stops: nextStops });
    setEditingStopIndex(nextStops.length - 1);
  };

  const handleRemoveStop = (idx: number) => {
    if (gradientConfig.stops.length <= 2) return;
    const nextStops = gradientConfig.stops.filter((_, i) => i !== idx);
    updateGradientConfig({ stops: nextStops });
    setEditingStopIndex(null);
  };

  const gradientCss = gradientConfig.radial
    ? `radial-gradient(circle, ${gradientConfig.stops.map(rgbToHex).join(', ')})`
    : `linear-gradient(${gradientConfig.angle}deg, ${gradientConfig.stops
        .map(rgbToHex)
        .join(', ')})`;

  return (
    <div className="grid gap-5 lg:grid-cols-12">
      {/* Left: Tools + Color Picker */}
      <div className="space-y-4 rounded-xl border border-white/[0.07] bg-[#0B0E14]/65 p-4 lg:col-span-5">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-100">{t.perkey.toolsTitle}</h2>
          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={undoStack.length === 0}
              onClick={undoPerKey}
              title={`${t.perkey.undo} (${undoStack.length})`}
              className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-[#131822] px-2 py-1 text-xs text-slate-300 transition hover:border-cyan-400/40 disabled:opacity-35"
            >
              <Undo2 className="h-3.5 w-3.5" />
              <span className="font-mono text-[10px]">{undoStack.length}</span>
            </button>
            <button
              type="button"
              disabled={redoStack.length === 0}
              onClick={redoPerKey}
              title={`${t.perkey.redo} (${redoStack.length})`}
              className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-[#131822] px-2 py-1 text-xs text-slate-300 transition hover:border-cyan-400/40 disabled:opacity-35"
            >
              <Redo2 className="h-3.5 w-3.5" />
              <span className="font-mono text-[10px]">{redoStack.length}</span>
            </button>
          </div>
        </div>

        {/* 5 Drawing Tools */}
        <div className="grid grid-cols-5 gap-1.5">
          {TOOLS.map(({ id, icon: Icon }) => {
            const active = perKeyTool === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => {
                  setPerKeyTool(id);
                  setEditingStopIndex(null);
                }}
                title={t.perkey.tools[id]}
                className={`flex flex-col items-center justify-center gap-1 rounded-xl border py-2 text-[10px] font-medium transition ${
                  active
                    ? 'border-cyan-400/70 bg-cyan-500/20 text-cyan-200'
                    : 'border-white/10 bg-[#131822] text-slate-400 hover:border-white/20 hover:text-slate-200'
                }`}
              >
                <Icon className="h-4 w-4" />
                <span className="truncate px-1">{t.perkey.tools[id].split(' ')[0]}</span>
              </button>
            );
          })}
        </div>

        {/* Color Picker (Brush or Selected Gradient Stop) */}
        <div className="rounded-xl border border-white/[0.06] bg-[#131822]/80 p-3">
          {editingStopIndex !== null && (
            <div className="mb-2 flex items-center justify-between rounded-md bg-violet-500/15 px-2.5 py-1 text-[11px] text-violet-200">
              <span>Gradient Stop #{editingStopIndex + 1}</span>
              <button
                type="button"
                onClick={() => setEditingStopIndex(null)}
                className="text-xs underline hover:text-white"
              >
                Brush
              </button>
            </div>
          )}
          <ColorPicker
            label={
              editingStopIndex !== null
                ? `Stop #${editingStopIndex + 1}`
                : t.perkey.activeColor
            }
            color={activePickerColor}
            onChange={handlePickerChange}
          />
        </div>

        {/* Direct Action Buttons */}
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void handlePushNow()}
            className="w-full rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 px-3 py-2 text-xs font-semibold text-white shadow-lg shadow-cyan-500/20 transition hover:brightness-110"
          >
            {language === 'vi'
              ? 'Gửi màu lên bàn phím ngay (0x07 + 0x09)'
              : 'Push Per-Key Colors to Keyboard Now'}
          </button>
          <button
            type="button"
            disabled={selectedKeys.length === 0}
            onClick={() => paintKeys(selectedKeys, brushColor, true)}
            className="flex-1 rounded-xl bg-cyan-500/20 px-3 py-2 text-xs font-semibold text-cyan-200 ring-1 ring-cyan-400/40 transition hover:bg-cyan-500/30 disabled:opacity-40"
          >
            {t.perkey.applyToSelected} ({selectedKeys.length})
          </button>
          <button
            type="button"
            onClick={clearAllPerKeyColors}
            className="inline-flex items-center gap-1.5 rounded-xl border border-rose-500/35 bg-rose-500/10 px-3 py-2 text-xs font-medium text-rose-200 transition hover:bg-rose-500/20"
          >
            <Trash2 className="h-3.5 w-3.5" />
            {t.perkey.clearAll}
          </button>
        </div>

        {pushStatus && (
          <div
            className={`rounded-lg border px-3 py-2 text-xs ${
              pushStatus.ok
                ? 'border-emerald-500/35 bg-emerald-500/10 text-emerald-200'
                : 'border-rose-500/35 bg-rose-500/10 text-rose-200'
            }`}
          >
            {pushStatus.text}
          </div>
        )}
      </div>

      {/* Right: Gradient Painter + Quick Themes */}
      <div className="space-y-5 lg:col-span-7">
        {/* Gradient Painter Card */}
        <div className="space-y-4 rounded-xl border border-white/[0.07] bg-[#0B0E14]/65 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="flex items-center gap-2 text-sm font-bold text-slate-100">
              <Wand2 className="h-4 w-4 text-violet-400" />
              {t.perkey.gradientTitle}
            </h3>
            <div className="flex rounded-lg border border-white/10 bg-[#131822] p-0.5 text-xs">
              <button
                type="button"
                onClick={() => updateGradientConfig({ radial: false })}
                className={`rounded-md px-2.5 py-1 transition ${
                  !gradientConfig.radial
                    ? 'bg-cyan-500/20 text-cyan-200'
                    : 'text-slate-400'
                }`}
              >
                {t.perkey.gradientLinear}
              </button>
              <button
                type="button"
                onClick={() => updateGradientConfig({ radial: true })}
                className={`rounded-md px-2.5 py-1 transition ${
                  gradientConfig.radial
                    ? 'bg-cyan-500/20 text-cyan-200'
                    : 'text-slate-400'
                }`}
              >
                {t.perkey.gradientRadial}
              </button>
            </div>
          </div>

          {/* Live Gradient Bar */}
          <div
            className="h-8 w-full rounded-lg border border-white/15 shadow-inner"
            style={{ background: gradientCss }}
          />

          {/* Color Stops (2..4) */}
          <div className="flex flex-wrap items-center gap-2">
            {gradientConfig.stops.map((stop, idx) => (
              <div
                key={idx}
                className={`flex items-center gap-1.5 rounded-lg border px-2 py-1.5 text-xs transition ${
                  editingStopIndex === idx
                    ? 'border-cyan-400 bg-cyan-500/15'
                    : 'border-white/10 bg-[#131822]'
                }`}
              >
                <button
                  type="button"
                  onClick={() => setEditingStopIndex(idx)}
                  className="flex items-center gap-1.5"
                >
                  <span
                    className="h-4 w-4 rounded border border-white/25"
                    style={{ backgroundColor: rgbToHex(stop) }}
                  />
                  <span className="font-mono text-[11px] text-slate-200">
                    {rgbToHex(stop)}
                  </span>
                </button>
                {gradientConfig.stops.length > 2 && (
                  <button
                    type="button"
                    onClick={() => handleRemoveStop(idx)}
                    className="text-slate-500 hover:text-rose-300"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>
            ))}

            {gradientConfig.stops.length < 4 && (
              <button
                type="button"
                onClick={handleAddStop}
                className="inline-flex items-center gap-1 rounded-lg border border-dashed border-white/20 px-2.5 py-1.5 text-xs text-slate-300 transition hover:border-cyan-400 hover:text-cyan-200"
              >
                <Plus className="h-3.5 w-3.5" />
                {t.perkey.addStop}
              </button>
            )}
          </div>

          {/* Angle Slider + Apply */}
          <div className="flex flex-wrap items-center gap-4">
            {!gradientConfig.radial && (
              <div className="min-w-[180px] flex-1">
                <div className="mb-1 flex justify-between text-xs">
                  <span className="text-slate-400">{t.perkey.gradientAngle}</span>
                  <span className="font-mono text-cyan-300">{gradientConfig.angle}°</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={360}
                  value={gradientConfig.angle}
                  onChange={(e) =>
                    updateGradientConfig({ angle: Number(e.target.value) })
                  }
                  className="studio-slider w-full"
                />
              </div>
            )}

            <button
              type="button"
              onClick={applyGradientToSelection}
              className="rounded-xl bg-gradient-to-r from-cyan-500 to-violet-500 px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-cyan-500/20 transition hover:brightness-110"
            >
              {t.perkey.applyGradient}
            </button>
          </div>
        </div>

        {/* Quick Color Themes Grid */}
        <div className="space-y-3 rounded-xl border border-white/[0.07] bg-[#0B0E14]/65 p-4">
          <h3 className="text-sm font-bold text-slate-100">{t.perkey.presetsTitle}</h3>
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            {QUICK_COLOR_PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => applyQuickColorTheme(preset.id)}
                className="group overflow-hidden rounded-xl border border-white/10 bg-[#131822] text-left transition hover:border-cyan-400/60"
              >
                <div
                  className="h-9 w-full transition-transform duration-200 group-hover:scale-105"
                  style={{
                    background: `linear-gradient(${preset.angle}deg, ${preset.stops
                      .map(rgbToHex)
                      .join(', ')})`,
                  }}
                />
                <div className="px-2.5 py-2 text-xs font-medium text-slate-200">
                  {preset.name}
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

