import React, { useEffect, useRef } from 'react';
import type { KeyDefinition } from '../../core/layout/win60heLayout';
import type { KeycapSkin } from '../../store/useStudioStore';
import { BLACK, RGB, isColorLit, rgbaToCss, rgbToCss } from '../../core/utils/color';
import { getCurrentFrame } from '../../core/engines/frameBus';

export interface KeycapLedHandle {
  applyColor: (color: RGB) => void;
}

interface KeycapProps {
  keyDef: KeyDefinition;
  skin: KeycapSkin;
  selected: boolean;
  isCalibrationTarget: boolean;
  mappedLedIndex?: number;
  showLedIndexBadge?: boolean;
  unitPx: number;
  gapPx: number;
  registerHandle: (keyIndex: number, handle: KeycapLedHandle | null) => void;
  onPointerDown: (e: React.PointerEvent, keyIndex: number) => void;
  onPointerEnter: (e: React.PointerEvent, keyIndex: number) => void;
}

function getKeycapPalette(skin: KeycapSkin, keyDef: KeyDefinition) {
  switch (skin) {
    case 'polar':
      return {
        bodyBg: 'linear-gradient(180deg, #F8FAFC 0%, #E2E8F0 100%)',
        topBg: 'linear-gradient(180deg, #FFFFFF 0%, #F1F5F9 100%)',
        border: 'rgba(148, 163, 184, 0.55)',
        textDefault: '#334155',
        subText: '#64748B',
      };
    case 'classic': {
      // Classic AULA WIN60HE Grey-White-Yellow colorway
      const isAccentYellow = keyDef.id === 'esc' || keyDef.id === 'enter';
      const isModGrey = keyDef.group === 'modifier' && !isAccentYellow;
      if (isAccentYellow) {
        return {
          bodyBg: 'linear-gradient(180deg, #FACC15 0%, #CA8A04 100%)',
          topBg: 'linear-gradient(180deg, #FDE047 0%, #EAB308 100%)',
          border: 'rgba(202, 138, 4, 0.7)',
          textDefault: '#1E293B',
          subText: '#475569',
        };
      }
      if (isModGrey) {
        return {
          bodyBg: 'linear-gradient(180deg, #475569 0%, #334155 100%)',
          topBg: 'linear-gradient(180deg, #64748B 0%, #475569 100%)',
          border: 'rgba(148, 163, 184, 0.35)',
          textDefault: '#F1F5F9',
          subText: '#CBD5E1',
        };
      }
      return {
        bodyBg: 'linear-gradient(180deg, #E2E8F0 0%, #CBD5E1 100%)',
        topBg: 'linear-gradient(180deg, #F8FAFC 0%, #E2E8F0 100%)',
        border: 'rgba(148, 163, 184, 0.5)',
        textDefault: '#1E293B',
        subText: '#64748B',
      };
    }
    case 'side_printed':
      return {
        bodyBg: 'linear-gradient(180deg, #1E2430 0%, #0D1117 100%)',
        topBg: 'linear-gradient(180deg, #1C212C 0%, #141821 100%)',
        border: 'rgba(255, 255, 255, 0.08)',
        textDefault: '#94A3B8',
        subText: '#64748B',
      };
    case 'obsidian':
    default:
      return {
        bodyBg: 'linear-gradient(180deg, #252C3B 0%, #131722 100%)',
        topBg: 'linear-gradient(180deg, #1E2433 0%, #171C28 100%)',
        border: 'rgba(255, 255, 255, 0.1)',
        textDefault: '#CBD5E1',
        subText: '#64748B',
      };
  }
}

export const Keycap: React.FC<KeycapProps> = React.memo(
  ({
    keyDef,
    skin,
    selected,
    isCalibrationTarget,
    mappedLedIndex,
    showLedIndexBadge,
    unitPx,
    gapPx,
    registerHandle,
    onPointerDown,
    onPointerEnter,
  }) => {
    const palette = getKeycapPalette(skin, keyDef);
    const left = keyDef.x * unitPx + gapPx / 2;
    const top = keyDef.y * unitPx + gapPx / 2;
    const width = keyDef.w * unitPx - gapPx;
    const height = keyDef.h * unitPx - gapPx;
    const isSidePrinted = skin === 'side_printed';

    const rootRef = useRef<HTMLDivElement | null>(null);
    const emitterRef = useRef<HTMLDivElement | null>(null);
    const dishRef = useRef<HTMLDivElement | null>(null);
    const legendRef = useRef<HTMLSpanElement | null>(null);
    const sideLegendRef = useRef<HTMLSpanElement | null>(null);
    const lastPaintedRef = useRef<{ r: number; g: number; b: number; stateKey: string }>({
      r: -1,
      g: -1,
      b: -1,
      stateKey: '',
    });

    const stateRef = useRef({ skin, selected, isCalibrationTarget, palette });
    stateRef.current = { skin, selected, isCalibrationTarget, palette };

    const applyColorImmediate = (color: RGB) => {
      const { skin: curSkin, selected: curSelected, isCalibrationTarget: curCal, palette: curPal } =
        stateRef.current;
      const stateKey = `${curSkin}|${curSelected ? 1 : 0}|${curCal ? 1 : 0}`;
      const lp = lastPaintedRef.current;
      if (
        lp.r === color.r &&
        lp.g === color.g &&
        lp.b === color.b &&
        lp.stateKey === stateKey
      ) {
        return;
      }
      lp.r = color.r;
      lp.g = color.g;
      lp.b = color.b;
      lp.stateKey = stateKey;

      const lit = isColorLit(color);
      const rootEl = rootRef.current;
      if (rootEl) {
        const ledFloorShadow = lit
          ? `0 5px 14px ${rgbaToCss(color, 0.72)}, 0 2px 5px ${rgbaToCss(color, 0.9)}, inset 0 -2px 6px ${rgbaToCss(color, 0.55)}`
          : '0 3px 6px rgba(0, 0, 0, 0.65)';
        rootEl.style.boxShadow = curSelected
          ? `${ledFloorShadow}, 0 0 0 2px #22D3EE`
          : curCal
            ? `${ledFloorShadow}, 0 0 0 2px #FACC15`
            : ledFloorShadow;
        rootEl.style.borderColor = curSelected
          ? '#22D3EE'
          : lit
            ? rgbaToCss(color, 0.55)
            : curPal.border;
      }

      const emitterEl = emitterRef.current;
      if (emitterEl) {
        emitterEl.style.backgroundColor = lit ? rgbToCss(color) : 'transparent';
        emitterEl.style.opacity = lit ? '0.95' : '0';
      }

      const dishEl = dishRef.current;
      if (dishEl) {
        dishEl.style.boxShadow = lit
          ? `inset 0 -4px 10px ${rgbaToCss(color, 0.25)}`
          : 'inset 0 1px 0 rgba(255,255,255,0.06)';
      }

      const legendColor =
        lit && (curSkin === 'obsidian' || curSkin === 'side_printed')
          ? rgbToCss({
              r: Math.min(255, color.r + 65),
              g: Math.min(255, color.g + 65),
              b: Math.min(255, color.b + 65),
            })
          : curPal.textDefault;

      const legendEl = legendRef.current;
      if (legendEl) {
        legendEl.style.color = legendColor;
        legendEl.style.textShadow =
          lit && curSkin === 'obsidian' ? `0 0 8px ${rgbaToCss(color, 0.85)}` : 'none';
      }

      const sideEl = sideLegendRef.current;
      if (sideEl) {
        sideEl.style.color = lit ? legendColor : '#64748B';
        sideEl.style.textShadow = lit ? `0 0 8px ${rgbToCss(color)}` : 'none';
      }
    };

    useEffect(() => {
      const handle: KeycapLedHandle = { applyColor: applyColorImmediate };
      registerHandle(keyDef.index, handle);
      applyColorImmediate(getCurrentFrame()[keyDef.index] ?? BLACK);
      return () => {
        registerHandle(keyDef.index, null);
      };
    }, [keyDef.index, registerHandle]);

    // Repaint current LED color whenever skin/selection/calibration props change
    useEffect(() => {
      applyColorImmediate(getCurrentFrame()[keyDef.index] ?? BLACK);
    }, [skin, selected, isCalibrationTarget, keyDef.index]);

    return (
      <div
        ref={rootRef}
        data-key-index={keyDef.index}
        onPointerDown={(e) => onPointerDown(e, keyDef.index)}
        onPointerEnter={(e) => onPointerEnter(e, keyDef.index)}
        style={{
          left,
          top,
          width,
          height,
          background: palette.bodyBg,
          borderColor: selected ? '#22D3EE' : palette.border,
          boxShadow: '0 3px 6px rgba(0, 0, 0, 0.65)',
        }}
        className="keycap-led-glow group absolute flex cursor-pointer select-none flex-col justify-between overflow-hidden rounded-[8px] border active:translate-y-[1px]"
      >
        {/* South-facing bottom LED emitter bar */}
        <div
          ref={emitterRef}
          className="pointer-events-none absolute inset-x-1.5 bottom-0.5 h-[3px] rounded-full blur-[1px]"
          style={{
            backgroundColor: 'transparent',
            opacity: 0,
          }}
        />

        {/* Sculpted inner top dish of the keycap */}
        <div
          ref={dishRef}
          className="pointer-events-none relative mx-[4px] mt-[3px] mb-[6px] flex flex-1 flex-col justify-between rounded-[5px] px-1.5 py-1"
          style={{
            background: palette.topBg,
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06)',
          }}
        >
          {!isSidePrinted ? (
            <>
              <div className="flex items-start justify-between leading-none">
                <span
                  ref={legendRef}
                  className="font-semibold tracking-tight"
                  style={{
                    fontSize: keyDef.label.length > 2 ? '9.5px' : '11.5px',
                    color: palette.textDefault,
                  }}
                >
                  {keyDef.label}
                </span>
                {keyDef.subLabel && (
                  <span
                    className="text-[8.5px] font-medium opacity-65"
                    style={{ color: palette.subText }}
                  >
                    {keyDef.subLabel}
                  </span>
                )}
              </div>
              {showLedIndexBadge && mappedLedIndex !== undefined && (
                <span className="self-end rounded bg-black/55 px-1 font-mono text-[8px] text-amber-300">
                  #{mappedLedIndex}
                </span>
              )}
            </>
          ) : (
            <div className="flex h-full items-center justify-end">
              {showLedIndexBadge && mappedLedIndex !== undefined && (
                <span className="rounded bg-black/60 px-1 font-mono text-[8px] text-amber-300">
                  #{mappedLedIndex}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Side-Printed South-Facing Glowing Legend on front skirt */}
        {isSidePrinted && (
          <div className="pointer-events-none absolute inset-x-0 bottom-[1px] flex items-center justify-center">
            <span
              ref={sideLegendRef}
              className="font-bold tracking-wider"
              style={{
                fontSize: keyDef.label.length > 2 ? '7.5px' : '9px',
                color: '#64748B',
              }}
            >
              {keyDef.label}
            </span>
          </div>
        )}
      </div>
    );
  }
);
