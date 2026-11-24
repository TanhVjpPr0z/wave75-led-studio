import React, { useRef, useState, useEffect } from 'react';
import {
  RGB,
  hexToRgb,
  rgbToHex,
  rgbToHsv,
  hsvToRgb,
  rgbToHsl,
  hslToRgb,
  SWATCH_COLORS,
  clamp,
} from '../../core/utils/color';

interface ColorPickerProps {
  color: RGB;
  onChange: (color: RGB) => void;
  label?: string;
  compact?: boolean;
}

export const ColorPicker: React.FC<ColorPickerProps> = ({
  color,
  onChange,
  label,
  compact = false,
}) => {
  const hsv = rgbToHsv(color);
  const hsl = rgbToHsl(color);
  const [hue, setHue] = useState(hsv.h);
  const [hexInput, setHexInput] = useState(rgbToHex(color));
  const [inputMode, setInputMode] = useState<'hex' | 'rgb' | 'hsl'>('hex');
  const svRef = useRef<HTMLDivElement | null>(null);
  const draggingRef = useRef(false);

  useEffect(() => {
    setHexInput(rgbToHex(color));
    const nextHsv = rgbToHsv(color);
    if (nextHsv.s > 2 && nextHsv.v > 2) {
      setHue(nextHsv.h);
    }
  }, [color.r, color.g, color.b]);

  const updateFromPointer = (clientX: number, clientY: number) => {
    const el = svRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const s = clamp(((clientX - rect.left) / rect.width) * 100, 0, 100);
    const v = clamp((1 - (clientY - rect.top) / rect.height) * 100, 0, 100);
    onChange(hsvToRgb({ h: hue, s, v }));
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    draggingRef.current = true;
    updateFromPointer(e.clientX, e.clientY);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current) return;
    updateFromPointer(e.clientX, e.clientY);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (draggingRef.current) {
      draggingRef.current = false;
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  };

  const handleHueChange = (nextHue: number) => {
    setHue(nextHue);
    onChange(hsvToRgb({ h: nextHue, s: Math.max(hsv.s, 10), v: Math.max(hsv.v, 10) }));
  };

  const hueColor = `hsl(${hue}, 100%, 50%)`;

  return (
    <div className="space-y-3">
      {label && (
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium uppercase tracking-wider text-slate-400">
            {label}
          </span>
          <div className="flex items-center gap-2">
            <span
              className="h-4 w-4 rounded border border-white/20 shadow-inner"
              style={{ backgroundColor: rgbToHex(color) }}
            />
            <span className="font-mono text-xs text-cyan-300">{rgbToHex(color)}</span>
          </div>
        </div>
      )}

      {/* Saturation / Value Square */}
      <div
        ref={svRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        className={`relative w-full cursor-crosshair select-none overflow-hidden rounded-lg border border-white/10 ${
          compact ? 'h-28' : 'h-36'
        }`}
        style={{
          backgroundColor: hueColor,
          backgroundImage:
            'linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, transparent)',
        }}
      >
        <div
          className="pointer-events-none absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_8px_rgba(0,0,0,0.9)]"
          style={{
            left: `${hsv.s}%`,
            top: `${100 - hsv.v}%`,
            backgroundColor: rgbToHex(color),
          }}
        />
      </div>

      {/* Hue Slider */}
      <div className="relative flex items-center">
        <input
          type="range"
          min={0}
          max={360}
          value={hue}
          onChange={(e) => handleHueChange(Number(e.target.value))}
          aria-label="Hue"
          className="h-3 w-full cursor-pointer appearance-none rounded-full border border-white/10"
          style={{
            background:
              'linear-gradient(to right, #ff0000 0%, #ffff00 17%, #00ff00 33%, #00ffff 50%, #0000ff 67%, #ff00ff 83%, #ff0000 100%)',
          }}
        />
      </div>

      {/* Mode Switch + Direct Numeric Inputs */}
      <div className="flex items-center gap-2">
        <div className="flex rounded-md border border-white/10 bg-[#0B0E14] p-0.5 text-[11px]">
          {(['hex', 'rgb', 'hsl'] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setInputMode(m)}
              className={`rounded px-2 py-1 font-mono uppercase transition ${
                inputMode === m
                  ? 'bg-cyan-500/20 text-cyan-300'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {m}
            </button>
          ))}
        </div>

        {inputMode === 'hex' && (
          <input
            type="text"
            value={hexInput}
            onChange={(e) => {
              const v = e.target.value;
              setHexInput(v);
              if (/^#?[0-9a-fA-F]{6}$/.test(v.trim())) {
                onChange(hexToRgb(v));
              }
            }}
            className="w-full rounded-md border border-white/10 bg-[#0B0E14] px-2.5 py-1 font-mono text-xs text-slate-100 focus:border-cyan-400 focus:outline-none"
          />
        )}

        {inputMode === 'rgb' && (
          <div className="grid w-full grid-cols-3 gap-1.5">
            {(['r', 'g', 'b'] as const).map((ch) => (
              <input
                key={ch}
                type="number"
                min={0}
                max={255}
                value={color[ch]}
                onChange={(e) =>
                  onChange({
                    ...color,
                    [ch]: clamp(Number(e.target.value) || 0, 0, 255),
                  })
                }
                aria-label={ch.toUpperCase()}
                className="w-full rounded-md border border-white/10 bg-[#0B0E14] px-2 py-1 font-mono text-xs text-slate-100 focus:border-cyan-400 focus:outline-none"
              />
            ))}
          </div>
        )}

        {inputMode === 'hsl' && (
          <div className="grid w-full grid-cols-3 gap-1.5">
            <input
              type="number"
              min={0}
              max={360}
              value={hsl.h}
              onChange={(e) =>
                onChange(
                  hslToRgb({
                    ...hsl,
                    h: clamp(Number(e.target.value) || 0, 0, 360),
                  })
                )
              }
              aria-label="H"
              className="w-full rounded-md border border-white/10 bg-[#0B0E14] px-2 py-1 font-mono text-xs text-slate-100 focus:border-cyan-400 focus:outline-none"
            />
            <input
              type="number"
              min={0}
              max={100}
              value={hsl.s}
              onChange={(e) =>
                onChange(
                  hslToRgb({
                    ...hsl,
                    s: clamp(Number(e.target.value) || 0, 0, 100),
                  })
                )
              }
              aria-label="S"
              className="w-full rounded-md border border-white/10 bg-[#0B0E14] px-2 py-1 font-mono text-xs text-slate-100 focus:border-cyan-400 focus:outline-none"
            />
            <input
              type="number"
              min={0}
              max={100}
              value={hsl.l}
              onChange={(e) =>
                onChange(
                  hslToRgb({
                    ...hsl,
                    l: clamp(Number(e.target.value) || 0, 0, 100),
                  })
                )
              }
              aria-label="L"
              className="w-full rounded-md border border-white/10 bg-[#0B0E14] px-2 py-1 font-mono text-xs text-slate-100 focus:border-cyan-400 focus:outline-none"
            />
          </div>
        )}
      </div>

      {/* Swatches */}
      <div className="grid grid-cols-8 gap-1.5">
        {SWATCH_COLORS.map((hex) => (
          <button
            key={hex}
            type="button"
            title={hex}
            onClick={() => onChange(hexToRgb(hex))}
            className="h-5 w-full rounded border border-white/15 transition hover:scale-110 hover:border-white/70"
            style={{ backgroundColor: hex }}
          />
        ))}
      </div>
    </div>
  );
};

