import React, { useRef, useState } from 'react';
import { Sparkles, Crosshair, Info } from 'lucide-react';
import {
  WAVE75_KEYS,
  WAVE75_WIDTH_U,
  WAVE75_HEIGHT_U,
  getWaveQuickSelection,
  type WaveQuickGroup,
} from '../../core/layout/wave75Layout';
import { BLACK, RGB, isColorLit, rgbaToCss, rgbToCss } from '../../core/utils/color';
import { useWaveStore, type WaveCaseSkin } from '../../store/useWaveStore';
import { TRANSLATIONS } from '../../i18n';
import { waveReactiveEngine } from '../../core/engines/reactiveEngine';
import { waveHidManager } from '../../core/hid/hidManager';
import { CaseSkinSwitcher } from './CaseSkinSwitcher';

interface Wave75CanvasProps {
  keyColors: RGB[];
  logoColor: RGB;
}

const UNIT_PX = 53;
const GAP_PX = 4;
const BOARD_W = WAVE75_WIDTH_U * UNIT_PX; // 848px
const BOARD_H = WAVE75_HEIGHT_U * UNIT_PX; // 318px

const QUICK_GROUPS: WaveQuickGroup[] = [
  'all',
  'wasd',
  'arrows',
  'fn_row',
  'numbers',
  'modifiers',
  'nav',
  'alphas',
  'none',
];

function getCncCaseStyle(skin: WaveCaseSkin) {
  switch (skin) {
    case 'anodized_silver':
      return {
        chassis: 'linear-gradient(180deg, #E2E8F0 0%, #CBD5E1 45%, #94A3B8 100%)',
        bezelBorder: 'rgba(255, 255, 255, 0.7)',
        brandText: '#334155',
        plate: '#1E293B',
        keyBody: 'linear-gradient(180deg, #F8FAFC 0%, #E2E8F0 100%)',
        keyTop: 'linear-gradient(180deg, #FFFFFF 0%, #F1F5F9 100%)',
        modBody: 'linear-gradient(180deg, #64748B 0%, #475569 100%)',
        modTop: 'linear-gradient(180deg, #78889F 0%, #526278 100%)',
        textAlpha: '#1E293B',
        textMod: '#F8FAFC',
      };
    case 'anodized_red':
      return {
        chassis: 'linear-gradient(180deg, #B91C1C 0%, #991B1B 55%, #7F1D1D 100%)',
        bezelBorder: 'rgba(252, 165, 165, 0.35)',
        brandText: '#FECACA',
        plate: '#180B0D',
        keyBody: 'linear-gradient(180deg, #27272A 0%, #18181B 100%)',
        keyTop: 'linear-gradient(180deg, #27272A 0%, #1F1F23 100%)',
        modBody: 'linear-gradient(180deg, #450A0A 0%, #2B0707 100%)',
        modTop: 'linear-gradient(180deg, #581010 0%, #3A0A0A 100%)',
        textAlpha: '#E4E4E7',
        textMod: '#FCA5A5',
      };
    case 'ecoat_purple':
      return {
        chassis: 'linear-gradient(180deg, #C4B5FD 0%, #A78BFA 50%, #7C3AED 100%)',
        bezelBorder: 'rgba(237, 233, 254, 0.55)',
        brandText: '#F5F3FF',
        plate: '#1E1533',
        keyBody: 'linear-gradient(180deg, #F5F3FF 0%, #DDD6FE 100%)',
        keyTop: 'linear-gradient(180deg, #FFFFFF 0%, #EDE9FE 100%)',
        modBody: 'linear-gradient(180deg, #7C3AED 0%, #5B21B6 100%)',
        modTop: 'linear-gradient(180deg, #8B5CF6 0%, #6D28D9 100%)',
        textAlpha: '#2E1065',
        textMod: '#F5F3FF',
      };
    case 'spray_cream':
      return {
        chassis: 'linear-gradient(180deg, #F7F1E8 0%, #E7DCCB 55%, #D3C3AB 100%)',
        bezelBorder: 'rgba(255, 252, 245, 0.85)',
        brandText: '#57534E',
        plate: '#292524',
        keyBody: 'linear-gradient(180deg, #FAF7F2 0%, #EAE2D6 100%)',
        keyTop: 'linear-gradient(180deg, #FFFDF9 0%, #F2ECE1 100%)',
        modBody: 'linear-gradient(180deg, #A89F91 0%, #8A8174 100%)',
        modTop: 'linear-gradient(180deg, #B8AFA2 0%, #968D80 100%)',
        textAlpha: '#292524',
        textMod: '#FAF7F2',
      };
    case 'anodized_black':
    default:
      return {
        chassis: 'linear-gradient(180deg, #212734 0%, #141822 50%, #0D1017 100%)',
        bezelBorder: 'rgba(255, 255, 255, 0.14)',
        brandText: '#94A3B8',
        plate: '#070A0F',
        keyBody: 'linear-gradient(180deg, #232A38 0%, #121620 100%)',
        keyTop: 'linear-gradient(180deg, #1E2432 0%, #161B26 100%)',
        modBody: 'linear-gradient(180deg, #1A202D 0%, #0F131C 100%)',
        modTop: 'linear-gradient(180deg, #171D29 0%, #11151F 100%)',
        textAlpha: '#CBD5E1',
        textMod: '#94A3B8',
      };
  }
}

export const Wave75Canvas: React.FC<Wave75CanvasProps> = ({ keyColors, logoColor }) => {
  const language = useWaveStore((s) => s.language);
  const activeModel = useWaveStore((s) => s.activeModel);
  const activeTab = useWaveStore((s) => s.activeTab);
  const caseSkin = useWaveStore((s) => s.caseSkin);
  const selectedKeys = useWaveStore((s) => s.selectedKeys);
  const setSelectedKeys = useWaveStore((s) => s.setSelectedKeys);
  const toggleSelectedKey = useWaveStore((s) => s.toggleSelectedKey);
  const logoSelected = useWaveStore((s) => s.logoSelected);
  const setLogoSelected = useWaveStore((s) => s.setLogoSelected);
  const editorTool = useWaveStore((s) => s.editorTool);
  const setEditorTool = useWaveStore((s) => s.setEditorTool);
  const brushColor = useWaveStore((s) => s.brushColor);
  const setBrushColor = useWaveStore((s) => s.setBrushColor);
  const paintKeys = useWaveStore((s) => s.paintKeys);
  const setSlotLogoColor = useWaveStore((s) => s.setSlotLogoColor);
  const pushUndoSnapshot = useWaveStore((s) => s.pushUndoSnapshot);

  const calibrationActive = useWaveStore((s) => s.calibrationActive);
  const calibrationLightIndex = useWaveStore((s) => s.calibrationLightIndex);
  const lightIndexMap = useWaveStore((s) => s.lightIndexMap);
  const assignCalibratedKey = useWaveStore((s) => s.assignCalibratedKey);

  const t = TRANSLATIONS[language];
  const isNonRgb = activeModel === 'wave75_non_rgb';
  const skinStyle = getCncCaseStyle(caseSkin);

  const boardRef = useRef<HTMLDivElement | null>(null);
  const brushingRef = useRef(false);
  const marqueeInitialSelectionRef = useRef<number[]>([]);
  const marqueeModifierRef = useRef<'replace' | 'add' | 'invert'>('replace');

  const [marquee, setMarquee] = useState<{
    sx: number;
    sy: number;
    cx: number;
    cy: number;
  } | null>(null);

  const selectedSet = new Set(selectedKeys);

  const handleKeyPointerDown = (e: React.PointerEvent, keyIndex: number) => {
    e.stopPropagation();

    if (calibrationActive) {
      assignCalibratedKey(keyIndex);
      return;
    }

    if (activeTab === 'effects') {
      waveReactiveEngine.triggerByIndex(keyIndex, performance.now());
    }

    if (isNonRgb) return;

    if (activeTab === 'perkey') {
      // Right-click on any key immediately turns off (erases) that key!
      if (e.button === 2) {
        pushUndoSnapshot();
        paintKeys([keyIndex], BLACK, false);
        return;
      }
      if (editorTool === 'brush') {
        pushUndoSnapshot();
        brushingRef.current = true;
        paintKeys([keyIndex], brushColor, false);
        return;
      }
      if (editorTool === 'eraser') {
        pushUndoSnapshot();
        brushingRef.current = true;
        paintKeys([keyIndex], BLACK, false);
        return;
      }
      if (editorTool === 'eyedropper') {
        const picked = keyColors[keyIndex];
        if (picked) setBrushColor({ ...picked });
        setEditorTool('brush');
        return;
      }
      if (editorTool === 'bucket') {
        const targets =
          selectedKeys.length > 0 && selectedSet.has(keyIndex)
            ? selectedKeys
            : WAVE75_KEYS.map((k) => k.index);
        paintKeys(targets, brushColor, true);
        return;
      }
      // Select tool
      if (e.ctrlKey || e.metaKey) {
        toggleSelectedKey(keyIndex);
      } else if (e.shiftKey) {
        if (!selectedSet.has(keyIndex)) setSelectedKeys([...selectedKeys, keyIndex]);
      } else {
        setSelectedKeys([keyIndex]);
        setLogoSelected(false);
      }
      return;
    }

    if (e.ctrlKey || e.metaKey || e.shiftKey) {
      toggleSelectedKey(keyIndex);
    }
  };

  const handleKeyPointerEnter = (e: React.PointerEvent, keyIndex: number) => {
    if (!brushingRef.current || e.buttons !== 1 || isNonRgb) {
      brushingRef.current = false;
      return;
    }
    if (activeTab === 'perkey') {
      if (editorTool === 'brush') paintKeys([keyIndex], brushColor, false);
      else if (editorTool === 'eraser') paintKeys([keyIndex], BLACK, false);
    }
  };

  const handleBoardPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (calibrationActive || isNonRgb) return;
    if (activeTab === 'perkey' && (editorTool === 'brush' || editorTool === 'eraser')) return;

    const rect = boardRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    marqueeInitialSelectionRef.current = [...selectedKeys];
    marqueeModifierRef.current = e.shiftKey
      ? 'add'
      : e.ctrlKey || e.metaKey
        ? 'invert'
        : 'replace';

    if (marqueeModifierRef.current === 'replace') {
      setSelectedKeys([]);
      setLogoSelected(false);
    }

    setMarquee({ sx: x, sy: y, cx: x, cy: y });
  };

  const handleBoardPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!marquee) return;
    const rect = boardRef.current?.getBoundingClientRect();
    if (!rect) return;
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;
    setMarquee({ ...marquee, cx, cy });

    const scaleX = BOARD_W / rect.width;
    const scaleY = BOARD_H / rect.height;
    const x1 = Math.min(marquee.sx, cx) * scaleX;
    const x2 = Math.max(marquee.sx, cx) * scaleX;
    const y1 = Math.min(marquee.sy, cy) * scaleY;
    const y2 = Math.max(marquee.sy, cy) * scaleY;

    const hits = new Set<number>();
    for (const k of WAVE75_KEYS) {
      const kx1 = k.x * UNIT_PX;
      const kx2 = (k.x + k.w) * UNIT_PX;
      const ky1 = k.y * UNIT_PX;
      const ky2 = (k.y + k.h) * UNIT_PX;
      if (kx2 >= x1 && kx1 <= x2 && ky2 >= y1 && ky1 <= y2) {
        hits.add(k.index);
      }
    }

    const base = new Set(marqueeInitialSelectionRef.current);
    const mod = marqueeModifierRef.current;
    if (mod === 'replace') {
      setSelectedKeys(Array.from(hits));
    } else if (mod === 'add') {
      hits.forEach((h) => base.add(h));
      setSelectedKeys(Array.from(base));
    } else {
      // Ctrl invert
      hits.forEach((h) => {
        if (base.has(h)) base.delete(h);
        else base.add(h);
      });
      setSelectedKeys(Array.from(base));
    }
  };

  const endDrag = () => {
    brushingRef.current = false;
    if (marquee) setMarquee(null);
  };

  const logoLit = isColorLit(logoColor);

  return (
    <section
      onPointerUp={endDrag}
      onPointerLeave={endDrag}
      className="rounded-2xl border border-white/[0.08] bg-[#121721]/95 p-4 shadow-2xl shadow-black/50 sm:p-5"
    >
      {/* Top Bar: Spec Badge + CNC Case Switcher */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-lg bg-white/[0.04] px-2.5 py-1 font-mono text-[11px] font-semibold tracking-wider text-sky-300 ring-1 ring-white/10">
            <Sparkles className="h-3.5 w-3.5" />
            75% CNC ALUMINUM • 81 KEYS + WAVE LOGO
          </span>
          {selectedKeys.length > 0 && (
            <span className="rounded-lg bg-sky-500/15 px-2.5 py-1 text-xs font-semibold text-sky-200 ring-1 ring-sky-400/40">
              {t.keyboard.selected}: {selectedKeys.length} {t.keyboard.keys}
            </span>
          )}
        </div>
        <CaseSkinSwitcher />
      </div>

      {/* Non-RGB Notice or Calibration Banner */}
      {isNonRgb && (
        <div className="mb-4 flex items-center gap-2.5 rounded-xl border border-violet-400/35 bg-violet-500/10 px-4 py-2.5 text-xs text-violet-200">
          <Info className="h-4 w-4 shrink-0 text-violet-300" />
          <span>{t.keyboard.nonRgbNotice}</span>
        </div>
      )}

      {calibrationActive && (
        <div className="mb-4 flex items-center gap-2.5 rounded-xl border border-amber-400/40 bg-amber-500/10 px-4 py-2.5 text-xs text-amber-200">
          <Crosshair className="h-4 w-4 shrink-0 animate-pulse text-amber-300" />
          <span>
            <strong>lightIndex #{calibrationLightIndex}:</strong> {t.keyboard.calibrationHint}
          </span>
        </div>
      )}

      {/* CNC Aluminum 75% Chassis */}
      <div className="overflow-x-auto pb-2">
        <div className="mx-auto w-fit">
          <div
            style={{
              background: skinStyle.chassis,
              borderColor: skinStyle.bezelBorder,
            }}
            className="relative rounded-[22px] border p-4 shadow-[0_28px_65px_rgba(0,0,0,0.7),inset_0_1px_1px_rgba(255,255,255,0.2)]"
          >
            {/* Top CNC Chamfer Bar + Iconic Glowing Wave75 Logo Badge */}
            <div className="mb-2.5 flex items-center justify-between px-1">
              <div className="flex items-center gap-2">
                <span className="font-mono text-[10px] font-extrabold tracking-[0.25em]" style={{ color: skinStyle.brandText }}>
                  PMO • WAVE75
                </span>
                <span className="font-mono text-[9.5px] opacity-60" style={{ color: skinStyle.brandText }}>
                  GASKET CNC • SOUTH-FACING
                </span>
              </div>

              {/* Interactive Glowing Wave Logo RGB Indicator (pushes real funcInfo[11..19] to CNC Logo LED!) */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  const applyHardwareLogo = (c: RGB) => {
                    const lit = isColorLit(c);
                    if (waveHidManager.getState().connected) {
                      void waveHidManager
                        .applyLogoSettings({
                          color: c,
                          brightness: lit ? 100 : 0,
                          speed: 3,
                          saturation: 100,
                          effect: lit ? 'static' : 'off',
                        })
                        .catch(() => {});
                    }
                  };
                  if (activeTab === 'perkey' && (editorTool === 'brush' || editorTool === 'bucket')) {
                    setSlotLogoColor(brushColor);
                    applyHardwareLogo(brushColor);
                  } else if (activeTab === 'perkey' && editorTool === 'eraser') {
                    setSlotLogoColor(BLACK);
                    applyHardwareLogo(BLACK);
                  } else {
                    setLogoSelected(!logoSelected);
                  }
                }}
                title={`${t.keyboard.logoBadge} (CNC LED • funcInfo[11..19])`}
                style={{
                  boxShadow: logoLit
                    ? `0 0 18px ${rgbaToCss(logoColor, 0.85)}, inset 0 0 8px ${rgbaToCss(logoColor, 0.55)}`
                    : 'inset 0 1px 3px rgba(0,0,0,0.7)',
                  borderColor: logoSelected
                    ? '#FFFFFF'
                    : logoLit
                      ? rgbaToCss(logoColor, 0.85)
                      : 'rgba(255,255,255,0.18)',
                }}
                className="flex items-center gap-2 rounded-full border bg-[#0B0F17]/90 px-3.5 py-1 transition hover:scale-105"
              >
                <span
                  className="h-2 w-8 rounded-full"
                  style={{
                    background: logoLit
                      ? `linear-gradient(90deg, ${rgbaToCss(logoColor, 0.4)}, ${rgbToCss(logoColor)}, ${rgbaToCss(logoColor, 0.4)})`
                      : '#1E293B',
                  }}
                />
                <span
                  className="font-mono text-[9.5px] font-bold tracking-widest"
                  style={{
                    color: logoLit ? rgbToCss(logoColor) : '#64748B',
                    textShadow: logoLit ? `0 0 10px ${rgbToCss(logoColor)}` : 'none',
                  }}
                >
                  {t.keyboard.logoBadge}
                </span>
              </button>
            </div>

            {/* Inner Plate & 81 Physical Keys */}
            <div
              ref={boardRef}
              onPointerDown={handleBoardPointerDown}
              onPointerMove={handleBoardPointerMove}
              style={{
                width: BOARD_W,
                height: BOARD_H,
                backgroundColor: skinStyle.plate,
              }}
              className="relative rounded-xl border border-black/80 shadow-[inset_0_4px_14px_rgba(0,0,0,0.85)]"
            >
              {/* Interactive CNC Wave Logo Badge at Row 4 right of Up Arrow (x=15..16, row=4) */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  const applyHardwareLogo = (c: RGB) => {
                    const lit = isColorLit(c);
                    if (waveHidManager.getState().connected) {
                      void waveHidManager
                        .applyLogoSettings({
                          color: c,
                          brightness: lit ? 100 : 0,
                          speed: 3,
                          saturation: 100,
                          effect: lit ? 'static' : 'off',
                        })
                        .catch(() => {});
                    }
                  };
                  if (activeTab === 'perkey' && (editorTool === 'brush' || editorTool === 'bucket')) {
                    setSlotLogoColor(brushColor);
                    applyHardwareLogo(brushColor);
                  } else if (activeTab === 'perkey' && editorTool === 'eraser') {
                    setSlotLogoColor(BLACK);
                    applyHardwareLogo(BLACK);
                  } else {
                    setLogoSelected(!logoSelected);
                  }
                }}
                title="CNC Wave Logo LED (Nhấn để chọn / tô màu đèn Logo thật)"
                style={{
                  left: 15 * UNIT_PX + 4,
                  top: 4 * UNIT_PX + 4,
                  width: UNIT_PX - 8,
                  height: UNIT_PX - 8,
                  boxShadow: logoLit ? `inset 0 0 12px ${rgbaToCss(logoColor, 0.45)}, 0 0 10px ${rgbaToCss(logoColor, 0.4)}` : 'none',
                  borderColor: logoSelected ? '#FFFFFF' : logoLit ? rgbaToCss(logoColor, 0.65) : 'rgba(255,255,255,0.12)',
                }}
                className="absolute flex cursor-pointer items-center justify-center rounded-lg border bg-white/[0.04] transition hover:scale-105"
              >
                <span
                  className="h-1.5 w-6 rounded-full"
                  style={{
                    backgroundColor: logoLit ? rgbToCss(logoColor) : 'rgba(148,163,184,0.25)',
                    boxShadow: logoLit ? `0 0 10px ${rgbToCss(logoColor)}` : 'none',
                  }}
                />
              </button>

              {WAVE75_KEYS.map((k) => {
                const col = isNonRgb ? BLACK : (keyColors[k.index] ?? BLACK);
                const lit = isColorLit(col);
                const isSelected = selectedSet.has(k.index);
                const hwIdx = lightIndexMap[k.index] ?? k.defaultLightIndex;
                const isCalTarget = calibrationActive && hwIdx === calibrationLightIndex;
                const isMod = k.group === 'modifier' || k.group === 'nav' || k.group === 'arrow';

                const glowShadow = lit
                  ? `0 4px 13px ${rgbaToCss(col, 0.7)}, 0 2px 4px ${rgbaToCss(col, 0.85)}, inset 0 -2px 5px ${rgbaToCss(col, 0.55)}`
                  : '0 2px 5px rgba(0, 0, 0, 0.6)';

                return (
                  <div
                    key={k.id}
                    onPointerDown={(e) => handleKeyPointerDown(e, k.index)}
                    onPointerEnter={(e) => handleKeyPointerEnter(e, k.index)}
                    onContextMenu={(e) => {
                      if (activeTab === 'perkey') e.preventDefault();
                    }}
                    style={{
                      left: k.x * UNIT_PX + GAP_PX / 2,
                      top: k.y * UNIT_PX + GAP_PX / 2,
                      width: k.w * UNIT_PX - GAP_PX,
                      height: k.h * UNIT_PX - GAP_PX,
                      background: isMod ? skinStyle.modBody : skinStyle.keyBody,
                      boxShadow: isSelected
                        ? `${glowShadow}, 0 0 0 2px #FFFFFF`
                        : isCalTarget
                          ? `${glowShadow}, 0 0 0 2px #FACC15`
                          : glowShadow,
                      borderColor: isSelected
                        ? '#FFFFFF'
                        : lit
                          ? rgbaToCss(col, 0.6)
                          : 'rgba(255,255,255,0.1)',
                    }}
                    className="wave-key-glow absolute flex cursor-pointer select-none flex-col justify-between overflow-hidden rounded-[7px] border active:translate-y-[1px]"
                  >
                    {/* South-facing bottom LED bar */}
                    <div
                      className="pointer-events-none absolute inset-x-1 bottom-0.5 h-[2.5px] rounded-full blur-[0.8px]"
                      style={{
                        backgroundColor: lit ? rgbToCss(col) : 'transparent',
                        opacity: lit ? 0.95 : 0,
                      }}
                    />

                    {/* Sculpted Keycap Dish */}
                    <div
                      className="pointer-events-none mx-[3px] mt-[2.5px] mb-[5px] flex flex-1 flex-col justify-between rounded-[4px] px-1 py-0.5"
                      style={{
                        background: isMod ? skinStyle.modTop : skinStyle.keyTop,
                        boxShadow: lit
                          ? `inset 0 -3px 8px ${rgbaToCss(col, 0.28)}`
                          : 'inset 0 1px 0 rgba(255,255,255,0.06)',
                      }}
                    >
                      <div className="flex items-start justify-between leading-none">
                        <span
                          className="font-semibold tracking-tight"
                          style={{
                            fontSize: k.label.length > 3 ? '8.5px' : k.label.length > 2 ? '9.5px' : '11px',
                            color:
                              lit && caseSkin === 'anodized_black'
                                ? rgbToCss({
                                    r: Math.min(255, col.r + 75),
                                    g: Math.min(255, col.g + 75),
                                    b: Math.min(255, col.b + 75),
                                  })
                                : isMod
                                  ? skinStyle.textMod
                                  : skinStyle.textAlpha,
                            textShadow:
                              lit && caseSkin === 'anodized_black'
                                ? `0 0 7px ${rgbaToCss(col, 0.8)}`
                                : 'none',
                          }}
                        >
                          {k.label}
                        </span>
                        {k.subLabel && (
                          <span className="text-[8px] opacity-55" style={{ color: isMod ? skinStyle.textMod : skinStyle.textAlpha }}>
                            {k.subLabel}
                          </span>
                        )}
                      </div>
                      {calibrationActive && (
                        <span className="self-end rounded bg-black/65 px-1 font-mono text-[8px] text-amber-300">
                          #{hwIdx}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}

              {/* Marquee Selection Box */}
              {marquee && (
                <div
                  className="pointer-events-none absolute rounded border border-white bg-sky-400/20"
                  style={{
                    left: Math.min(marquee.sx, marquee.cx),
                    top: Math.min(marquee.sy, marquee.cy),
                    width: Math.abs(marquee.cx - marquee.sx),
                    height: Math.abs(marquee.cy - marquee.sy),
                  }}
                />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Quick Group Selectors & Keyboard Shortcut Hint */}
      {!isNonRgb && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-white/[0.06] pt-3">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="mr-1 text-[11px] font-medium text-slate-400">
              {t.keyboard.quickSelect}:
            </span>
            {QUICK_GROUPS.map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => setSelectedKeys(getWaveQuickSelection(g))}
                className="rounded-md border border-white/[0.08] bg-[#0A0D12]/80 px-2 py-1 text-[11px] font-medium text-slate-300 transition hover:border-sky-400/50 hover:bg-sky-500/10 hover:text-sky-200"
              >
                {t.keyboard.groups[g]}
              </button>
            ))}
          </div>
          <span className="text-[11px] text-slate-500">{t.keyboard.marqueeHint}</span>
        </div>
      )}
    </section>
  );
};

