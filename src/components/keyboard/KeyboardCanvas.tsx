import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Sparkles, Crosshair } from 'lucide-react';
import {
  WIN60HE_KEYS,
  TOTAL_KEYS,
  KEYBOARD_WIDTH_U,
  KEYBOARD_HEIGHT_U,
  getQuickSelectionIndices,
  type QuickSelectionGroup,
} from '../../core/layout/win60heLayout';
import { BLACK } from '../../core/utils/color';
import { useStudioStore, type KeycapSkin } from '../../store/useStudioStore';
import { TRANSLATIONS } from '../../i18n';
import { sharedReactiveEngine } from '../../core/engines/reactiveEngine';
import { getCurrentFrame, subscribeFrame } from '../../core/engines/frameBus';

import { Keycap, type KeycapLedHandle } from './Keycap';

const UNIT_PX = 58;
const GAP_PX = 5;
const BOARD_W = KEYBOARD_WIDTH_U * UNIT_PX; // 870px
const BOARD_H = KEYBOARD_HEIGHT_U * UNIT_PX; // 290px

const SKIN_OPTIONS: KeycapSkin[] = ['obsidian', 'polar', 'classic', 'side_printed'];
const QUICK_GROUPS: QuickSelectionGroup[] = [
  'all',
  'wasd',
  'alphas',
  'numbers',
  'modifiers',
  'fps',
  'none',
];

export const KeyboardCanvas: React.FC = React.memo(() => {
  const language = useStudioStore((s) => s.language);
  const activeTab = useStudioStore((s) => s.activeTab);
  const keycapSkin = useStudioStore((s) => s.keycapSkin);
  const setKeycapSkin = useStudioStore((s) => s.setKeycapSkin);
  const selectedKeys = useStudioStore((s) => s.selectedKeys);
  const setSelectedKeys = useStudioStore((s) => s.setSelectedKeys);
  const toggleSelectedKey = useStudioStore((s) => s.toggleSelectedKey);
  const perKeyTool = useStudioStore((s) => s.perKeyTool);
  const brushColor = useStudioStore((s) => s.brushColor);
  const setBrushColor = useStudioStore((s) => s.setBrushColor);
  const paintKeys = useStudioStore((s) => s.paintKeys);
  const commitPerKeySnapshot = useStudioStore((s) => s.commitPerKeySnapshot);
  const perKeyColors = useStudioStore((s) => s.perKeyColors);

  const calibrationActive = useStudioStore((s) => s.calibrationActive);
  const calibrationLedIndex = useStudioStore((s) => s.calibrationLedIndex);
  const ledIndexMap = useStudioStore((s) => s.ledIndexMap);
  const assignCalibratedKey = useStudioStore((s) => s.assignCalibratedKey);

  const t = TRANSLATIONS[language];
  const boardRef = useRef<HTMLDivElement | null>(null);
  const isBrushingRef = useRef(false);
  const ledHandlesRef = useRef<Array<KeycapLedHandle | null>>(
    new Array<KeycapLedHandle | null>(TOTAL_KEYS).fill(null)
  );

  const registerHandle = useCallback((keyIndex: number, handle: KeycapLedHandle | null) => {
    ledHandlesRef.current[keyIndex] = handle;
  }, []);

  // Zero-React-re-render LED subscription: mutates keycap DOM styles directly at 60 FPS
  useEffect(() => {
    return subscribeFrame((colors) => {
      const handles = ledHandlesRef.current;
      for (let i = 0; i < TOTAL_KEYS; i++) {
        handles[i]?.applyColor(colors[i] ?? BLACK);
      }
    });
  }, []);

  const [marquee, setMarquee] = useState<{
    startX: number;
    startY: number;
    currX: number;
    currY: number;
  } | null>(null);

  const selectedSet = useMemo(() => new Set(selectedKeys), [selectedKeys]);

  // Keep interaction handler dependencies in a ref so callbacks stay referentially stable for React.memo(Keycap)
  const interactionRef = useRef({
    calibrationActive,
    assignCalibratedKey,
    activeTab,
    perKeyTool,
    commitPerKeySnapshot,
    paintKeys,
    brushColor,
    perKeyColors,
    setBrushColor,
    selectedKeys,
    selectedSet,
    toggleSelectedKey,
    setSelectedKeys,
  });
  interactionRef.current = {
    calibrationActive,
    assignCalibratedKey,
    activeTab,
    perKeyTool,
    commitPerKeySnapshot,
    paintKeys,
    brushColor,
    perKeyColors,
    setBrushColor,
    selectedKeys,
    selectedSet,
    toggleSelectedKey,
    setSelectedKeys,
  };

  const handleKeyPointerDown = useCallback((e: React.PointerEvent, keyIndex: number) => {
    e.stopPropagation();
    const s = interactionRef.current;

    if (s.calibrationActive) {
      s.assignCalibratedKey(keyIndex);
      return;
    }

    if (s.activeTab === 'reactive' || s.activeTab === 'presets') {
      sharedReactiveEngine.triggerKeyIndex(keyIndex, performance.now());
      window.setTimeout(() => sharedReactiveEngine.releaseKeyIndex(keyIndex), 140);
    }

    if (s.activeTab === 'perkey') {
      if (s.perKeyTool === 'brush') {
        s.commitPerKeySnapshot();
        isBrushingRef.current = true;
        s.paintKeys([keyIndex], s.brushColor, false);
        return;
      }
      if (s.perKeyTool === 'eraser') {
        s.commitPerKeySnapshot();
        isBrushingRef.current = true;
        s.paintKeys([keyIndex], BLACK, false);
        return;
      }
      if (s.perKeyTool === 'eyedropper') {
        const picked = s.perKeyColors[keyIndex] ?? getCurrentFrame()[keyIndex];
        if (picked) s.setBrushColor({ ...picked });
        return;
      }
      if (s.perKeyTool === 'bucket') {
        const targets =
          s.selectedKeys.length > 0 && s.selectedSet.has(keyIndex)
            ? s.selectedKeys
            : [keyIndex];
        s.paintKeys(targets, s.brushColor, true);
        return;
      }
      if (e.ctrlKey || e.metaKey || e.shiftKey) {
        s.toggleSelectedKey(keyIndex);
      } else {
        s.setSelectedKeys([keyIndex]);
      }
      return;
    }

    if (e.ctrlKey || e.metaKey) {
      s.toggleSelectedKey(keyIndex);
    }
  }, []);

  const handleKeyPointerEnter = useCallback((e: React.PointerEvent, keyIndex: number) => {
    if (!isBrushingRef.current || e.buttons !== 1) {
      isBrushingRef.current = false;
      return;
    }
    const s = interactionRef.current;
    if (s.activeTab === 'perkey') {
      if (s.perKeyTool === 'brush') {
        s.paintKeys([keyIndex], s.brushColor, false);
      } else if (s.perKeyTool === 'eraser') {
        s.paintKeys([keyIndex], BLACK, false);
      }
    }
  }, []);

  const handleBoardPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (calibrationActive) return;
    if (activeTab === 'perkey' && (perKeyTool === 'brush' || perKeyTool === 'eraser')) {
      return;
    }
    const rect = boardRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setMarquee({ startX: x, startY: y, currX: x, currY: y });
  };

  const handleBoardPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!marquee) return;
    const rect = boardRef.current?.getBoundingClientRect();
    if (!rect) return;
    const currX = e.clientX - rect.left;
    const currY = e.clientY - rect.top;
    setMarquee({ ...marquee, currX, currY });

    // Compute marquee hit test against 61 keys
    const scaleX = BOARD_W / rect.width;
    const scaleY = BOARD_H / rect.height;
    const x1 = Math.min(marquee.startX, currX) * scaleX;
    const x2 = Math.max(marquee.startX, currX) * scaleX;
    const y1 = Math.min(marquee.startY, currY) * scaleY;
    const y2 = Math.max(marquee.startY, currY) * scaleY;

    const hits: number[] = [];
    for (const k of WIN60HE_KEYS) {
      const kx1 = k.x * UNIT_PX;
      const kx2 = (k.x + k.w) * UNIT_PX;
      const ky1 = k.y * UNIT_PX;
      const ky2 = (k.y + k.h) * UNIT_PX;
      if (kx2 >= x1 && kx1 <= x2 && ky2 >= y1 && ky1 <= y2) {
        hits.push(k.index);
      }
    }
    setSelectedKeys(hits);
  };

  const handleGlobalPointerUp = () => {
    isBrushingRef.current = false;
    if (marquee) {
      setMarquee(null);
    }
  };

  const chassisBg =
    keycapSkin === 'polar'
      ? 'linear-gradient(180deg, #E2E8F0 0%, #CBD5E1 100%)'
      : keycapSkin === 'classic'
        ? 'linear-gradient(180deg, #334155 0%, #1E293B 100%)'
        : 'linear-gradient(180deg, #1A202E 0%, #0E121B 100%)';

  const plateBg =
    keycapSkin === 'polar' ? '#94A3B8' : '#080B10';

  return (
    <section
      onPointerUp={handleGlobalPointerUp}
      onPointerLeave={handleGlobalPointerUp}
      className="rounded-2xl border border-white/[0.08] bg-[#131822]/90 p-4 shadow-2xl shadow-black/40 sm:p-5"
    >
      {/* Top Stage Header: Skin Selector & Status */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-lg bg-white/[0.04] px-2.5 py-1 font-mono text-[11px] font-semibold tracking-wider text-cyan-300 ring-1 ring-white/10">
            <Sparkles className="h-3.5 w-3.5" />
            60% ANSI • 61 KEYS • SOUTH-FACING RGB
          </span>
          {selectedKeys.length > 0 && (
            <span className="rounded-lg bg-cyan-500/15 px-2.5 py-1 text-xs font-medium text-cyan-200 ring-1 ring-cyan-400/30">
              {t.keyboard.selectedCount}: <strong>{selectedKeys.length}</strong>{' '}
              {t.keyboard.keysUnit}
            </span>
          )}
        </div>

        {/* Case & Keycap Skin Switcher */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-[11px] font-medium text-slate-400">
            {t.keyboard.skinLabel}:
          </span>
          {SKIN_OPTIONS.map((skin) => (
            <button
              key={skin}
              type="button"
              onClick={() => setKeycapSkin(skin)}
              className={`rounded-lg px-2.5 py-1 text-xs font-medium transition ${
                keycapSkin === skin
                  ? 'bg-cyan-500/20 text-cyan-200 ring-1 ring-cyan-400/50'
                  : 'bg-white/[0.03] text-slate-400 hover:bg-white/[0.07] hover:text-slate-200'
              }`}
            >
              {t.keyboard.skins[skin]}
            </button>
          ))}
        </div>
      </div>

      {/* Calibration Banner */}
      {calibrationActive && (
        <div className="mb-4 flex items-center gap-2.5 rounded-xl border border-amber-400/40 bg-amber-500/10 px-4 py-2.5 text-xs text-amber-200">
          <Crosshair className="h-4 w-4 shrink-0 animate-pulse text-amber-300" />
          <span>
            <strong>LED #{calibrationLedIndex}:</strong> {t.keyboard.calibrationBanner}
          </span>
        </div>
      )}

      {/* 2.5D Keyboard Chassis */}
      <div className="overflow-x-auto pb-2">
        <div className="mx-auto w-fit">
          <div
            style={{ background: chassisBg }}
            className="relative rounded-[20px] border border-white/15 p-3.5 shadow-[0_24px_60px_rgba(0,0,0,0.65),inset_0_1px_0_rgba(255,255,255,0.12)]"
          >
            {/* Top chassis accent ribbon & USB-C port indicator */}
            <div className="mb-2 flex items-center justify-between px-1">
              <div className="flex items-center gap-2">
                <span className="h-1.5 w-8 rounded-full bg-gradient-to-r from-cyan-400 to-violet-500 opacity-85" />
                <span className="font-mono text-[10px] font-bold tracking-[0.2em] text-slate-400">
                  AULA WIN60 HE
                </span>
              </div>
              <span className="font-mono text-[10px] tracking-wider text-slate-500">
                MAGNETIC HALL-EFFECT • 8K
              </span>
            </div>

            {/* Inner Plate + 61 Keys */}
            <div
              ref={boardRef}
              onPointerDown={handleBoardPointerDown}
              onPointerMove={handleBoardPointerMove}
              style={{
                width: BOARD_W,
                height: BOARD_H,
                backgroundColor: plateBg,
              }}
              className="relative rounded-xl border border-black/80 shadow-[inset_0_4px_14px_rgba(0,0,0,0.85)]"
            >
              {WIN60HE_KEYS.map((keyDef) => (
                <Keycap
                  key={keyDef.id}
                  keyDef={keyDef}
                  skin={keycapSkin}
                  selected={selectedSet.has(keyDef.index)}
                  isCalibrationTarget={
                    calibrationActive && ledIndexMap[keyDef.index] === calibrationLedIndex
                  }
                  mappedLedIndex={ledIndexMap[keyDef.index]}
                  showLedIndexBadge={calibrationActive}
                  unitPx={UNIT_PX}
                  gapPx={GAP_PX}
                  registerHandle={registerHandle}
                  onPointerDown={handleKeyPointerDown}
                  onPointerEnter={handleKeyPointerEnter}
                />
              ))}

              {/* Marquee Selection Overlay */}
              {marquee && (
                <div
                  className="pointer-events-none absolute rounded border border-cyan-400 bg-cyan-400/15"
                  style={{
                    left: Math.min(marquee.startX, marquee.currX),
                    top: Math.min(marquee.startY, marquee.currY),
                    width: Math.abs(marquee.currX - marquee.startX),
                    height: Math.abs(marquee.currY - marquee.startY),
                  }}
                />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Quick Selection Bar & Usage Hint */}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-white/[0.06] pt-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-[11px] font-medium text-slate-400">
            {t.keyboard.quickSelect}:
          </span>
          {QUICK_GROUPS.map((g) => (
            <button
              key={g}
              type="button"
              onClick={() => setSelectedKeys(getQuickSelectionIndices(g))}
              className="rounded-md border border-white/[0.08] bg-[#0B0E14]/80 px-2.5 py-1 text-[11px] font-medium text-slate-300 transition hover:border-cyan-400/40 hover:bg-cyan-500/10 hover:text-cyan-200"
            >
              {t.keyboard.groups[g]}
            </button>
          ))}
        </div>
        <span className="text-[11px] text-slate-500">{t.keyboard.hintDrag}</span>
      </div>
    </section>
  );
});

