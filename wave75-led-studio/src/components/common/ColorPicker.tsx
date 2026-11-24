import React, { useEffect, useRef, useState } from 'react';
import {
  RGB,
  hexToRgb,
  rgbToHex,
  rgbToHsv,
  hsvToRgb,
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
  const [hue, setHue] = useState(hsv.h);
  const [hexStr, setHexStr] = useState(rgbToHex(color));
  const [mode, setMode] = useState<'hex' | 'rgb'>('hex');
  const boxRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef(false);

  useEffect(() => {
    setHexStr(rgbToHex(color));
    const next = rgbToHsv(color);
    if (next.s > 2 && next.v > 2) setHue(next.h);
  }, [color.r, color.g, color.b]);

  const pickAt = (cx: number, cy: number) => {
    const el = boxRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const s = clamp(((cx - rect.left) / rect.width) * 100, 0, 100);
    const v = clamp((1 - (cy - rect.top) / rect.height) * 100, 0, 100);
    onChange(hsvToRgb({ h: hue, s, v }));
  };

  return (
    <div className="space-y-2.5">
      {label && (
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            {label}
          </span>
          <div className="flex items-center gap-1.5">
            <span
              className="h-3.5 w-3.5 rounded border border-white/20"
              style={{ backgroundColor: rgbToHex(color) }}
            />
            <span className="font-mono text-xs text-sky-300">{rgbToHex(color)}</span>
          </div>
        </div>
      )}

      <div
        ref={boxRef}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          dragRef.current = true;
          pickAt(e.clientX, e.clientY);
        }}
        onPointerMove={(e) => {
          if (dragRef.current) pickAt(e.clientX, e.clientY);
        }}
        onPointerUp={(e) => {
          if (dragRef.current) {
            dragRef.current = false;
            e.currentTarget.releasePointerCapture(e.pointerId);
          }
        }}
        className={`relative w-full cursor-crosshair select-none overflow-hidden rounded-lg border border-white/10 ${
          compact ? 'h-24' : 'h-32'
        }`}
        style={{
          backgroundColor: `hsl(${hue}, 100%, 50%)`,
          backgroundImage:
            'linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, transparent)',
        }}
      >
        <div
          className="pointer-events-none absolute h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_8px_rgba(0,0,0,0.9)]"
          style={{
            left: `${hsv.s}%`,
            top: `${100 - hsv.v}%`,
            backgroundColor: rgbToHex(color),
          }}
        />
      </div>

      <input
        type="range"
        min={0}
        max={360}
        value={hue}
        onChange={(e) => {
          const h = Number(e.target.value);
          setHue(h);
          onChange(hsvToRgb({ h, s: Math.max(hsv.s, 12), v: Math.max(hsv.v, 12) }));
        }}
        aria-label="Hue"
        className="h-2.5 w-full cursor-pointer appearance-none rounded-full border border-white/10"
        style={{
          background:
            'linear-gradient(to right, #ff0000 0%, #ffff00 17%, #00ff00 33%, #00ffff 50%, #0000ff 67%, #ff00ff 83%, #ff0000 100%)',
        }}
      />

      <div className="flex items-center gap-2">
        <div className="flex rounded-md border border-white/10 bg-[#0A0D12] p-0.5 text-[10px]">
          {(['hex', 'rgb'] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={`rounded px-2 py-1 font-mono uppercase ${
                mode === m ? 'bg-sky-500/20 text-sky-300' : 'text-slate-400'
              }`}
            >
              {m}
            </button>
          ))}
        </div>

        {mode === 'hex' ? (
          <input
            type="text"
            value={hexStr}
            onChange={(e) => {
              setHexStr(e.target.value);
              if (/^#?[0-9a-fA-F]{6}$/.test(e.target.value.trim())) {
                onChange(hexToRgb(e.target.value));
              }
            }}
            className="w-full rounded-md border border-white/10 bg-[#0A0D12] px-2.5 py-1 font-mono text-xs text-slate-100 focus:border-sky-400 focus:outline-none"
          />
        ) : (
          <div className="grid w-full grid-cols-3 gap-1">
            {(['r', 'g', 'b'] as const).map((ch) => (
              <input
                key={ch}
                type="number"
                min={0}
                max={255}
                value={color[ch]}
                onChange={(e) =>
                  onChange({ ...color, [ch]: clamp(Number(e.target.value) || 0, 0, 255) })
                }
                className="w-full rounded-md border border-white/10 bg-[#0A0D12] px-1.5 py-1 font-mono text-xs text-slate-100 focus:border-sky-400 focus:outline-none"
              />
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-8 gap-1">
        {SWATCH_COLORS.map((hex) => (
          <button
            key={hex}
            type="button"
            title={hex}
            onClick={() => onChange(hexToRgb(hex))}
            className="h-4.5 w-full rounded border border-white/15 transition hover:scale-110 hover:border-white"
            style={{ backgroundColor: hex }}
          />
        ))}
      </div>
    </div>
  );
};

