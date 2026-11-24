import React, { useEffect, useState } from 'react';
import {
  MousePointer2,
  Paintbrush,
  PaintBucket,
  Pipette,
  Eraser,
  Undo2,
  Redo2,
  HardDriveUpload,
  HardDriveDownload,
  CheckCircle2,
  AlertTriangle,
  Wand2,
  Trash2,
  Sparkles,
  Send,
  Gamepad2,
} from 'lucide-react';
import { useWaveStore, type EditorTool } from '../../store/useWaveStore';
import {
  hexToRgb,
  rgbToHex,
  type RGB,
} from '../../core/utils/color';
import {
  WAVE75_KEYS,
  getWaveQuickSelection,
  type WaveQuickGroup,
} from '../../core/layout/wave75Layout';
import { ColorPicker } from '../common/ColorPicker';
import { AutoStartDriverCard } from '../common/AutoStartDriverCard';
import { buildWave75PerKeyDriver } from '../../core/engines/driverExporter';
import { waveHidManager, type WaveHidState } from '../../core/hid/hidManager';

interface PerKeyEditorPanelProps {
  hidState: WaveHidState;
}

const PRIMARY_TOOLS: Array<{
  id: EditorTool;
  icon: React.ComponentType<{ className?: string }>;
  labelVi: string;
  labelEn: string;
  hintVi: string;
  hintEn: string;
}> = [
  {
    id: 'brush',
    icon: Paintbrush,
    labelVi: 'Cọ tô',
    labelEn: 'Brush',
    hintVi: 'Bấm hoặc giữ kéo chuột lên các phím ở trên để tô màu ngay • Chuột phải để tắt đèn phím đó.',
    hintEn: 'Click or drag across keys above to paint live • Right-click any key to erase.',
  },
  {
    id: 'eraser',
    icon: Eraser,
    labelVi: 'Tẩy đèn',
    labelEn: 'Eraser',
    hintVi: 'Bấm hoặc kéo chuột lên các phím để tắt đèn LED của phím đó.',
    hintEn: 'Click or drag across keys to turn off their LEDs.',
  },
  {
    id: 'bucket',
    icon: PaintBucket,
    labelVi: 'Tô tất cả',
    labelEn: 'Fill All',
    hintVi: 'Bấm vào bất kỳ phím nào ở trên để tô toàn bộ 81 phím bằng màu đang chọn.',
    hintEn: 'Click anywhere on the keyboard to fill all 81 keys with your active color.',
  },
  {
    id: 'eyedropper',
    icon: Pipette,
    labelVi: 'Hút màu',
    labelEn: 'Pick Color',
    hintVi: 'Bấm vào 1 phím có sẵn màu đẹp để sao chép màu đó sang Cọ tô.',
    hintEn: 'Click any key to copy its color directly to your Brush.',
  },
];

interface QuickZoneItem {
  group: WaveQuickGroup;
  icon: string;
  labelVi: string;
  labelEn: string;
}

const QUICK_ZONES: QuickZoneItem[] = [
  { group: 'wasd', icon: '🎮', labelVi: 'Cụm WASD', labelEn: 'WASD Keys' },
  { group: 'arrows', icon: '⬆️', labelVi: '4 Mũi tên', labelEn: 'Arrows' },
  { group: 'numbers', icon: '🔢', labelVi: 'Hàng số 1–0', labelEn: 'Number Row' },
  { group: 'fn_row', icon: '⌨️', labelVi: 'Hàng F1–F12', labelEn: 'F1–F12 Row' },
  { group: 'alphas', icon: '🔤', labelVi: 'Cụm chữ A–Z', labelEn: 'Letters A–Z' },
  { group: 'modifiers', icon: '🔲', labelVi: 'Phím viền & Space', labelEn: 'Modifiers' },
];

interface DesignerPalette {
  id: string;
  nameVi: string;
  nameEn: string;
  preview: string;
  apply: (
    paintKeys: (idx: number[], c: RGB, record?: boolean) => void,
    setLogo: (c: RGB) => void,
    applyGrad: (stops: RGB[], angle: number, radial: boolean) => void
  ) => void;
}

const DESIGNER_PALETTES: DesignerPalette[] = [
  {
    id: 'samurai_red_white',
    nameVi: '⚔️ Samurai Đỏ-Trắng',
    nameEn: '⚔️ Red & White Katana',
    preview: 'linear-gradient(135deg, #b91c1c 0%, #dc2626 55%, #ffffff 100%)',
    apply: (paintKeys, setLogo) => {
      paintKeys(WAVE75_KEYS.map((k) => k.index), { r: 225, g: 18, b: 28 }, true);
      const highlight = [
        ...getWaveQuickSelection('wasd'),
        ...getWaveQuickSelection('arrows'),
        0, // Esc
        40, // Enter
      ];
      paintKeys(highlight, { r: 255, g: 255, b: 255 }, false);
      setLogo({ r: 255, g: 255, b: 255 });
    },
  },
  {
    id: 'imperial_red_gold',
    nameVi: '👑 Đỏ Hoàng Kim',
    nameEn: '👑 Imperial Red-Gold',
    preview: 'linear-gradient(135deg, #991b1b 0%, #dc2626 50%, #fbbf24 100%)',
    apply: (paintKeys, setLogo) => {
      paintKeys(WAVE75_KEYS.map((k) => k.index), { r: 210, g: 16, b: 24 }, true);
      const gold = [
        ...getWaveQuickSelection('wasd'),
        ...getWaveQuickSelection('arrows'),
        ...getWaveQuickSelection('fn_row'),
      ];
      paintKeys(gold, { r: 255, g: 196, b: 20 }, false);
      setLogo({ r: 255, g: 200, b: 30 });
    },
  },
  {
    id: 'elaina_amethyst',
    nameVi: '💜 Elaina Tím-Bạc',
    nameEn: '💜 Elaina Amethyst',
    preview: 'linear-gradient(135deg, #6d28d9, #a78bfa, #f5f3ff)',
    apply: (_paintKeys, setLogo, applyGrad) => {
      applyGrad(
        [
          { r: 124, g: 58, b: 237 },
          { r: 196, g: 181, b: 253 },
          { r: 255, g: 245, b: 230 },
        ],
        18,
        false
      );
      setLogo({ r: 216, g: 180, b: 254 });
    },
  },
  {
    id: 'miku_cobalt',
    nameVi: '🎧 Miku Xanh Băng',
    nameEn: '🎧 Miku Ice Cobalt',
    preview: 'linear-gradient(135deg, #0284c7, #38bdf8, #a5f3fc)',
    apply: (_paintKeys, setLogo, applyGrad) => {
      applyGrad(
        [
          { r: 14, g: 116, b: 230 },
          { r: 56, g: 189, b: 248 },
          { r: 186, g: 245, b: 255 },
        ],
        15,
        false
      );
      setLogo({ r: 56, g: 189, b: 248 });
    },
  },
  {
    id: 'sakura_blossom',
    nameVi: '🌸 Sakura Hồng Đào',
    nameEn: '🌸 Sakura Blossom',
    preview: 'linear-gradient(135deg, #ec4899, #f9a8d4, #fff1f2)',
    apply: (_paintKeys, setLogo, applyGrad) => {
      applyGrad(
        [
          { r: 236, g: 72, b: 153 },
          { r: 251, g: 182, b: 206 },
          { r: 255, g: 241, b: 242 },
        ],
        20,
        false
      );
      setLogo({ r: 244, g: 114, b: 182 });
    },
  },
  {
    id: 'cyber_neon',
    nameVi: '🌃 Cyberpunk Neon',
    nameEn: '🌃 Cyberpunk Neon',
    preview: 'linear-gradient(135deg, #ec4899, #8b5cf6, #06b6d4)',
    apply: (_paintKeys, setLogo, applyGrad) => {
      applyGrad(
        [
          { r: 255, g: 0, b: 128 },
          { r: 139, g: 92, b: 246 },
          { r: 0, g: 240, b: 255 },
        ],
        18,
        false
      );
      setLogo({ r: 0, g: 240, b: 255 });
    },
  },
  {
    id: 'fps_gaming_pro',
    nameVi: '🎯 Gaming FPS Pro',
    nameEn: '🎯 FPS Gaming Pro',
    preview: 'linear-gradient(135deg, #111827 0%, #ef4444 45%, #22d3ee 100%)',
    apply: (paintKeys, setLogo) => {
      paintKeys(WAVE75_KEYS.map((k) => k.index), { r: 22, g: 8, b: 16 }, true);
      paintKeys(getWaveQuickSelection('wasd'), { r: 255, g: 45, b: 55 }, false);
      paintKeys(getWaveQuickSelection('arrows'), { r: 0, g: 235, b: 255 }, false);
      paintKeys(getWaveQuickSelection('numbers'), { r: 255, g: 190, b: 35 }, false);
      setLogo({ r: 255, g: 45, b: 55 });
    },
  },
  {
    id: 'warm_white',
    nameVi: '🤍 Trắng Ấm Sang',
    nameEn: '🤍 Warm Studio White',
    preview: 'linear-gradient(135deg, #fffbeb, #fde68a, #fed7aa)',
    apply: (paintKeys, setLogo) => {
      paintKeys(WAVE75_KEYS.map((k) => k.index), { r: 255, g: 232, b: 196 }, true);
      setLogo({ r: 255, g: 240, b: 215 });
    },
  },
];

export const PerKeyEditorPanel: React.FC<PerKeyEditorPanelProps> = ({ hidState }) => {
  const language = useWaveStore((s) => s.language);
  const activeSlot = useWaveStore((s) => s.activeSlot);
  const slots = useWaveStore((s) => s.slots);
  const setActiveSlot = useWaveStore((s) => s.setActiveSlot);
  const loadSlotDataFromHardware = useWaveStore((s) => s.loadSlotDataFromHardware);
  const markSlotVerified = useWaveStore((s) => s.markSlotVerified);
  const lightIndexMap = useWaveStore((s) => s.lightIndexMap);

  const editorTool = useWaveStore((s) => s.editorTool);
  const setEditorTool = useWaveStore((s) => s.setEditorTool);
  const brushColor = useWaveStore((s) => s.brushColor);
  const setBrushColor = useWaveStore((s) => s.setBrushColor);
  const setSlotLogoColor = useWaveStore((s) => s.setSlotLogoColor);
  const selectedKeys = useWaveStore((s) => s.selectedKeys);
  const paintKeys = useWaveStore((s) => s.paintKeys);
  const clearSelectedOrAll = useWaveStore((s) => s.clearSelectedOrAll);

  const undoStack = useWaveStore((s) => s.undoStack);
  const redoStack = useWaveStore((s) => s.redoStack);
  const undoPerKey = useWaveStore((s) => s.undoPerKey);
  const redoPerKey = useWaveStore((s) => s.redoPerKey);

  const gradientSpec = useWaveStore((s) => s.gradientSpec);
  const updateGradientSpec = useWaveStore((s) => s.updateGradientSpec);
  const applyGradient = useWaveStore((s) => s.applyGradient);

  const [flashStatus, setFlashStatus] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const isVi = language === 'vi';
  const curSlot = slots[activeSlot];

  // Auto-switch from 'select' to 'brush' on first visit if user hasn't selected anything,
  // so clicking any key immediately paints!
  useEffect(() => {
    if (editorTool === 'select' && selectedKeys.length === 0) {
      setEditorTool('brush');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const gradStartHex = rgbToHex(gradientSpec.stops[0] ?? { r: 244, g: 63, b: 94 });
  const gradEndHex = rgbToHex(
    gradientSpec.stops[gradientSpec.stops.length - 1] ?? { r: 251, g: 191, b: 36 }
  );

  const handlePickBrushColor = (c: RGB) => {
    setBrushColor(c);
    // If user was on Eraser and picks a color, automatically return to Brush!
    if (editorTool === 'eraser') {
      setEditorTool('brush');
    }
  };

  const handlePaintZone = (group: WaveQuickGroup, label: string) => {
    const indices = getWaveQuickSelection(group);
    if (indices.length === 0) return;
    paintKeys(indices, brushColor, true);
    setFlashStatus({
      type: 'ok',
      text: isVi
        ? `Đã tô ${indices.length} phím vùng "${label}"! Bạn có thể tiếp tục tô vùng khác hoặc bấm "Lưu vào bộ nhớ phím".`
        : `Painted ${indices.length} keys in "${label}"!`,
    });
  };

  const handleSelectSlot = async (slotNum: number) => {
    setActiveSlot(slotNum);
    setFlashStatus(null);
    if (hidState.connected && hidState.capabilities.supportsOnboardSlots) {
      try {
        await waveHidManager.selectOnboardSlot(slotNum);
        const hwData = await waveHidManager.readOnboardSlot(slotNum, lightIndexMap);
        loadSlotDataFromHardware(slotNum, hwData.keys, hwData.logo);
        setFlashStatus({
          type: 'ok',
          text: isVi
            ? `Đã tải màu đang lưu từ Khe ${slotNum} trên bàn phím!`
            : `Loaded saved colors from Slot ${slotNum}!`,
        });
      } catch (err) {
        setFlashStatus({
          type: 'err',
          text: err instanceof Error ? err.message : `Không thể đọc Khe ${slotNum}`,
        });
      }
    }
  };

  const handleReadSlot = async () => {
    setFlashStatus(null);
    try {
      const hwData = await waveHidManager.readOnboardSlot(activeSlot, lightIndexMap);
      loadSlotDataFromHardware(activeSlot, hwData.keys, hwData.logo);
      setFlashStatus({
        type: 'ok',
        text: isVi
          ? `Đã đọc bảng màu hiện tại từ Khe ${activeSlot} trên bàn phím!`
          : `Loaded colors from Slot ${activeSlot}.`,
      });
    } catch (err) {
      setFlashStatus({
        type: 'err',
        text: err instanceof Error ? err.message : 'Đọc màu thất bại',
      });
    }
  };

  const handleSaveFlash = async () => {
    setBusy(true);
    setFlashStatus(null);
    try {
      const res = await waveHidManager.saveOnboardSlotSafe(
        activeSlot,
        curSlot.keys,
        curSlot.logo,
        lightIndexMap
      );
      if (res.verified) {
        markSlotVerified(activeSlot);
        setFlashStatus({ type: 'ok', text: res.message });
      }
    } catch (err) {
      setFlashStatus({
        type: 'err',
        text: err instanceof Error ? err.message : 'Lưu vào phím thất bại',
      });
    } finally {
      setBusy(false);
    }
  };

  const handlePushNow = async () => {
    setFlashStatus(null);
    try {
      await waveHidManager.forcePushFrameNow(curSlot.keys, curSlot.logo, lightIndexMap);
      setFlashStatus({
        type: 'ok',
        text: isVi
          ? 'Đã gửi bảng màu trực tiếp lên bàn phím WAVE75!'
          : 'Synced colors to WAVE75!',
      });
    } catch (err) {
      setFlashStatus({
        type: 'err',
        text: err instanceof Error ? err.message : 'Gửi màu thất bại',
      });
    }
  };

  const activeToolInfo =
    PRIMARY_TOOLS.find((item) => item.id === editorTool) ?? PRIMARY_TOOLS[0];

  return (
    <div className="space-y-4">
      {/* Friendly Live Instruction Banner + Quick Save Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/35 p-3.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold text-slate-200">
            {isVi ? 'Khe lưu trên phím:' : 'Onboard Slots:'}
          </span>
          {[1, 2, 3, 4, 5].map((num) => {
            const active = activeSlot === num;
            const slotDirty = slots[num]?.dirty;
            return (
              <button
                key={num}
                type="button"
                onClick={() => void handleSelectSlot(num)}
                className={`relative rounded-xl border px-3 py-1.5 text-xs font-bold transition ${
                  active
                    ? 'anime-pill-active'
                    : 'border-white/10 bg-black/40 text-slate-300 hover:border-white/30 hover:text-white'
                }`}
              >
                {isVi ? `Khe ${num}` : `Slot ${num}`}
                {slotDirty && (
                  <span className="ml-1.5 inline-block h-1.5 w-1.5 rounded-full bg-amber-400" />
                )}
              </button>
            );
          })}

          <span
            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
              curSlot.dirty
                ? 'bg-amber-500/15 text-amber-200'
                : 'bg-emerald-500/15 text-emerald-300'
            }`}
          >
            {curSlot.dirty ? (
              <>
                <AlertTriangle className="h-3.5 w-3.5" />
                {isVi ? 'Chưa lưu vào phím' : 'Unsaved'}
              </>
            ) : (
              <>
                <CheckCircle2 className="h-3.5 w-3.5" />
                {isVi ? 'Đã lưu an toàn' : 'Saved'}
              </>
            )}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void handlePushNow()}
            className="inline-flex items-center gap-1.5 rounded-xl border border-white/15 bg-white/[0.05] px-3 py-2 text-xs font-semibold text-slate-200 transition hover:border-white/35 hover:text-white"
          >
            <Send className="h-3.5 w-3.5" />
            {isVi ? 'Xem trên phím' : 'Sync Live'}
          </button>

          <button
            type="button"
            onClick={() => void handleReadSlot()}
            className="inline-flex items-center gap-1.5 rounded-xl border border-white/15 bg-white/[0.05] px-3 py-2 text-xs font-semibold text-slate-200 transition hover:border-white/35 hover:text-white"
          >
            <HardDriveDownload className="h-3.5 w-3.5" />
            {isVi ? 'Đọc từ phím' : 'Read'}
          </button>

          <button
            type="button"
            disabled={busy || !hidState.capabilities.supportsOnboardSlots}
            onClick={() => void handleSaveFlash()}
            className="anime-btn-primary anime-btn-shimmer inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-extrabold text-white transition hover:scale-[1.02] disabled:opacity-45"
          >
            <HardDriveUpload className="h-4 w-4" />
            {busy
              ? isVi
                ? 'Đang lưu...'
                : 'Saving...'
              : isVi
                ? `Lưu vào bộ nhớ phím (Khe ${activeSlot})`
                : `Save to Keyboard (Slot ${activeSlot})`}
          </button>
        </div>
      </div>

      {/* Clear, Friendly Step Hint Strip */}
      <div className="anime-badge-themed flex flex-wrap items-center justify-between gap-2 rounded-xl px-3.5 py-2 text-xs font-medium">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 shrink-0" />
          <span>
            {editorTool === 'select'
              ? isVi
                ? 'Chế độ Khung chọn: Kéo bao quanh nhiều phím rồi bấm nút "Tô vùng đang chọn".'
                : 'Select Mode: Drag a box around keys then click "Fill Selected".'
              : isVi
                ? activeToolInfo.hintVi
                : activeToolInfo.hintEn}
          </span>
        </div>
        {selectedKeys.length > 0 && (
          <button
            type="button"
            onClick={() => paintKeys(selectedKeys, brushColor, true)}
            className="anime-btn-primary rounded-lg px-3 py-1 text-[11px] font-extrabold text-white"
          >
            {isVi ? `Tô ${selectedKeys.length} phím đang chọn` : `Fill ${selectedKeys.length} Selected`}
          </button>
        )}
      </div>

      {flashStatus && (
        <div
          className={`anime-panel-enter flex items-center gap-2 rounded-xl border px-3.5 py-2 text-xs font-medium ${
            flashStatus.type === 'ok'
              ? 'border-emerald-500/35 bg-emerald-500/10 text-emerald-200'
              : 'border-rose-500/35 bg-rose-500/10 text-rose-200'
          }`}
        >
          {flashStatus.type === 'ok' ? (
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
          ) : (
            <AlertTriangle className="h-4 w-4 shrink-0 text-rose-400" />
          )}
          <span>{flashStatus.text}</span>
        </div>
      )}

      {/* Main 2-Column Intuitive Workspace */}
      <div className="grid gap-5 lg:grid-cols-12">
        {/* LEFT COLUMN: Tools + Brush Color + CNC Logo */}
        <div className="space-y-4 rounded-2xl border border-white/10 bg-black/35 p-4 lg:col-span-5">
          {/* 4 Big Primary Tools */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
                {isVi ? '1. Chọn công cụ tô' : '1. Pick Tool'}
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setEditorTool(editorTool === 'select' ? 'brush' : 'select')}
                  className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[11px] font-semibold transition ${
                    editorTool === 'select'
                      ? 'anime-pill-active'
                      : 'border-white/10 bg-black/40 text-slate-400 hover:text-white'
                  }`}
                >
                  <MousePointer2 className="h-3 w-3" />
                  {isVi ? 'Khung chọn' : 'Select'}
                </button>
                <button
                  type="button"
                  disabled={undoStack.length === 0}
                  onClick={undoPerKey}
                  title={isVi ? 'Hoàn tác (Ctrl+Z)' : 'Undo (Ctrl+Z)'}
                  className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-black/40 px-2 py-1 text-[11px] font-semibold text-slate-200 hover:border-white/30 disabled:opacity-35"
                >
                  <Undo2 className="h-3.5 w-3.5" />
                  {isVi ? 'Hoàn tác' : 'Undo'}
                </button>
                <button
                  type="button"
                  disabled={redoStack.length === 0}
                  onClick={redoPerKey}
                  title={isVi ? 'Làm lại (Ctrl+Y)' : 'Redo (Ctrl+Y)'}
                  className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-black/40 px-2 py-1 text-[11px] font-semibold text-slate-200 hover:border-white/30 disabled:opacity-35"
                >
                  <Redo2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-4 gap-2">
              {PRIMARY_TOOLS.map(({ id, icon: Icon, labelVi, labelEn }) => {
                const active = editorTool === id;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setEditorTool(id)}
                    className={`flex flex-col items-center justify-center gap-1.5 rounded-xl border py-2.5 text-xs font-bold transition ${
                      active
                        ? 'anime-pill-active scale-[1.02]'
                        : 'border-white/10 bg-black/40 text-slate-300 hover:border-white/30 hover:text-white'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    <span>{isVi ? labelVi : labelEn}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Brush Color Picker */}
          <div className="border-t border-white/10 pt-3">
            <ColorPicker
              label={isVi ? '2. Chọn màu muốn tô' : '2. Pick Brush Color'}
              color={brushColor}
              onChange={handlePickBrushColor}
            />
          </div>

          {/* 1-Click CNC Logo Color Sync */}
          <div className="flex items-center justify-between gap-2 rounded-xl border border-white/10 bg-black/45 px-3 py-2.5">
            <div className="flex items-center gap-2.5">
              <span
                className="h-5 w-5 rounded-full border-2 border-white/40"
                style={{
                  backgroundColor: rgbToHex(curSlot.logo),
                  boxShadow: `0 0 10px ${rgbToHex(curSlot.logo)}`,
                }}
              />
              <div className="text-xs">
                <span className="block font-bold text-slate-100">
                  {isVi ? 'Đèn Logo CNC trên góc phím' : 'CNC Wave Logo LED'}
                </span>
                <span className="text-[10px] text-slate-400">
                  {isVi ? 'Tô màu đang chọn cho đèn Logo' : 'Apply brush color to Logo'}
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={async () => {
                setSlotLogoColor(brushColor);
                if (hidState.connected) {
                  try {
                    const lit = brushColor.r > 2 || brushColor.g > 2 || brushColor.b > 2;
                    await waveHidManager.applyLogoSettings({
                      color: brushColor,
                      brightness: lit ? 100 : 0,
                      speed: 3,
                      saturation: brushColor.r === brushColor.g && brushColor.g === brushColor.b ? 0 : 100,
                      effect: lit ? 'static' : 'off',
                    });
                    setFlashStatus({
                      type: 'ok',
                      text: isVi
                        ? 'Đã đổi màu Đèn Logo CNC lên bàn phím thành công!'
                        : 'Updated CNC Logo LED!',
                    });
                  } catch (err) {
                    setFlashStatus({
                      type: 'err',
                      text: err instanceof Error ? err.message : 'Đổi màu Logo thất bại',
                    });
                  }
                }
              }}
              className="anime-badge-themed shrink-0 rounded-lg px-3 py-1.5 text-xs font-bold transition hover:brightness-115"
            >
              {isVi ? 'Tô Logo' : 'Paint Logo'}
            </button>
          </div>
        </div>

        {/* RIGHT COLUMN: 1-Click Paint Zones + Designer Presets + 2-Color Gradient */}
        <div className="space-y-4 lg:col-span-7">
          {/* 1-Click Zone Painter */}
          <div className="rounded-2xl border border-white/10 bg-black/35 p-4">
            <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
              <h3 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-200">
                <Gamepad2 className="h-4 w-4 text-amber-300" />
                {isVi ? 'Tô nhanh cả vùng phím bằng màu đang chọn (1 Click)' : '1-Click Paint Zones'}
              </h3>
              <span
                className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-black/45 px-2.5 py-0.5 text-[10px] font-bold text-slate-200"
              >
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: rgbToHex(brushColor) }}
                />
                {rgbToHex(brushColor)}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {QUICK_ZONES.map((z) => (
                <button
                  key={z.group}
                  type="button"
                  onClick={() => handlePaintZone(z.group, isVi ? z.labelVi : z.labelEn)}
                  className="flex items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-bold text-slate-100 transition hover:border-white/35 hover:bg-white/[0.1]"
                >
                  <span>{z.icon}</span>
                  <span className="truncate">{isVi ? z.labelVi : z.labelEn}</span>
                </button>
              ))}

              <button
                type="button"
                onClick={() =>
                  paintKeys(
                    WAVE75_KEYS.map((k) => k.index),
                    brushColor,
                    true
                  )
                }
                className="anime-badge-themed flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-extrabold transition hover:brightness-115"
              >
                <PaintBucket className="h-3.5 w-3.5" />
                {isVi ? 'Tô tất cả 81 phím' : 'Fill All 81'}
              </button>

              <button
                type="button"
                onClick={() => clearSelectedOrAll(true)}
                className="flex items-center justify-center gap-1.5 rounded-xl border border-rose-500/35 bg-rose-500/10 px-3 py-2 text-xs font-bold text-rose-200 transition hover:bg-rose-500/20"
              >
                <Trash2 className="h-3.5 w-3.5" />
                {isVi ? 'Tắt hết đèn' : 'Clear All'}
              </button>
            </div>
          </div>

          {/* 8 Ready-Made 1-Click Designer Palettes (Red Keyboard + Anime!) */}
          <div className="rounded-2xl border border-white/10 bg-black/35 p-4">
            <h3 className="mb-2.5 text-xs font-bold uppercase tracking-wider text-slate-200">
              {isVi ? 'Bộ phối màu đẹp sẵn — Bấm là đẹp ngay (1 Click)' : '1-Click Designer Palettes'}
            </h3>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {DESIGNER_PALETTES.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    p.apply(paintKeys, setSlotLogoColor, (stops, angle, radial) => {
                      updateGradientSpec({ stops, angle, radial });
                      applyGradient();
                    });
                    setFlashStatus({
                      type: 'ok',
                      text: isVi
                        ? `Đã áp dụng bộ màu "${p.nameVi}"! Bấm "Lưu vào bộ nhớ phím" để giữ màu nhé.`
                        : `Applied "${p.nameEn}"! Click Save to keep it.`,
                    });
                  }}
                  className="group overflow-hidden rounded-xl border border-white/10 bg-black/45 text-left transition hover:scale-[1.02] hover:border-white/35"
                >
                  <div className="h-7 w-full" style={{ background: p.preview }} />
                  <div className="truncate px-2 py-1.5 text-[11px] font-bold text-slate-200 group-hover:text-white">
                    {isVi ? p.nameVi : p.nameEn}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Simple Editable 2-Color Gradient Builder */}
          <div className="rounded-2xl border border-white/10 bg-black/35 p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h3 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-200">
                <Wand2 className="h-3.5 w-3.5 text-amber-300" />
                {isVi ? 'Tự phối chuyển sắc 2 màu (Gradient)' : '2-Color Gradient Maker'}
              </h3>
              <div className="flex gap-1">
                {[
                  { label: isVi ? 'Ngang' : 'Horiz', angle: 0, radial: false },
                  { label: isVi ? 'Chéo' : 'Diag', angle: 25, radial: false },
                  { label: isVi ? 'Dọc' : 'Vert', angle: 90, radial: false },
                  { label: isVi ? 'Tỏa tròn' : 'Radial', angle: 0, radial: true },
                ].map((d) => {
                  const isAct =
                    d.radial ? gradientSpec.radial : !gradientSpec.radial && gradientSpec.angle === d.angle;
                  return (
                    <button
                      key={d.label}
                      type="button"
                      onClick={() => updateGradientSpec({ angle: d.angle, radial: d.radial })}
                      className={`rounded-lg border px-2 py-1 text-[11px] font-bold transition ${
                        isAct
                          ? 'anime-pill-active'
                          : 'border-white/10 bg-black/40 text-slate-300 hover:border-white/30'
                      }`}
                    >
                      {d.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {/* Start Color */}
              <label className="flex items-center gap-2 rounded-xl border border-white/15 bg-black/45 px-2.5 py-1.5 text-xs font-semibold text-slate-200">
                <input
                  type="color"
                  value={gradStartHex}
                  onChange={(e) =>
                    updateGradientSpec({
                      stops: [hexToRgb(e.target.value), hexToRgb(gradEndHex)],
                    })
                  }
                  className="h-6 w-6 cursor-pointer rounded border-0 bg-transparent p-0"
                />
                <span>{isVi ? 'Màu 1' : 'Color 1'}</span>
              </label>

              {/* Live Gradient Bar Preview */}
              <div
                className="h-8 min-w-[100px] flex-1 rounded-xl border border-white/15"
                style={{
                  background: gradientSpec.radial
                    ? `radial-gradient(circle, ${gradStartHex}, ${gradEndHex})`
                    : `linear-gradient(${gradientSpec.angle}deg, ${gradStartHex}, ${gradEndHex})`,
                }}
              />

              {/* End Color */}
              <label className="flex items-center gap-2 rounded-xl border border-white/15 bg-black/45 px-2.5 py-1.5 text-xs font-semibold text-slate-200">
                <input
                  type="color"
                  value={gradEndHex}
                  onChange={(e) =>
                    updateGradientSpec({
                      stops: [hexToRgb(gradStartHex), hexToRgb(e.target.value)],
                    })
                  }
                  className="h-6 w-6 cursor-pointer rounded border-0 bg-transparent p-0"
                />
                <span>{isVi ? 'Màu 2' : 'Color 2'}</span>
              </label>

              <button
                type="button"
                onClick={applyGradient}
                className="anime-btn-primary rounded-xl px-4 py-2 text-xs font-extrabold text-white"
              >
                {isVi ? 'Tô chuyển sắc' : 'Apply Gradient'}
              </button>
            </div>
          </div>

          {/* 1-Click Auto-Start Driver Card */}
          <AutoStartDriverCard
            titleVi="Khóa bảng màu từng phím này tự chạy khi mở máy"
            titleEn="Lock This Per-Key Map Forever (Auto-Start)"
            descVi="Ngoài lưu thẳng vào bộ nhớ Khe 1–5 trên phím, bạn có thể cài tự nạp lại bảng màu + Đèn Logo CNC mỗi khi bật máy tính."
            descEn="Automatically restores this exact per-key color map + CNC Logo LED on boot."
            buildPayload={() =>
              buildWave75PerKeyDriver({
                slotName: `Tô từng phím (Khe ${activeSlot})`,
                keyColors: curSlot.keys,
                logoSettings: {
                  color: curSlot.logo,
                  brightness:
                    curSlot.logo.r > 2 || curSlot.logo.g > 2 || curSlot.logo.b > 2 ? 100 : 0,
                  speed: 3,
                  saturation:
                    curSlot.logo.r === curSlot.logo.g && curSlot.logo.g === curSlot.logo.b
                      ? 0
                      : 100,
                  effect:
                    curSlot.logo.r > 2 || curSlot.logo.g > 2 || curSlot.logo.b > 2
                      ? 'static'
                      : 'off',
                },
                lightIndexMap,
              })
            }
          />
        </div>
      </div>
    </div>
  );
};
