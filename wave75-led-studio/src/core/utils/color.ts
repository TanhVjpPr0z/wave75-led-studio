export interface RGB {
  r: number;
  g: number;
  b: number;
}

export interface HSV {
  h: number; // 0..360
  s: number; // 0..100
  v: number; // 0..100
}

export const BLACK: RGB = { r: 0, g: 0, b: 0 };
export const WHITE: RGB = { r: 255, g: 255, b: 255 };

export function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

export function clampByte(val: number): number {
  return Math.max(0, Math.min(255, Math.round(val)));
}

/**
 * Encodes RGB888 to RGB565 (16-bit Little-Endian pair [lowByte, highByte])
 * Required by PMO WAVE75 0x2E SET_LIGHT_SYNC real-time RAM streaming.
 */
export function rgbToRgb565LE({ r, g, b }: RGB): [number, number] {
  const r5 = (clampByte(r) >> 3) & 0x1f;
  const g6 = (clampByte(g) >> 2) & 0x3f;
  const b5 = (clampByte(b) >> 3) & 0x1f;
  const value = (r5 << 11) | (g6 << 5) | b5;
  return [value & 0xff, (value >> 8) & 0xff];
}

export function rgb565LEToRgb(lo: number, hi: number): RGB {
  const value = (hi << 8) | lo;
  const r5 = (value >> 11) & 0x1f;
  const g6 = (value >> 5) & 0x3f;
  const b5 = value & 0x1f;
  return {
    r: (r5 << 3) | (r5 >> 2),
    g: (g6 << 2) | (g6 >> 4),
    b: (b5 << 3) | (b5 >> 2),
  };
}

export function rgbToHex({ r, g, b }: RGB): string {
  const h = (n: number) => clampByte(n).toString(16).padStart(2, '0');
  return `#${h(r)}${h(g)}${h(b)}`.toUpperCase();
}

export function hexToRgb(hex: string): RGB {
  const cleaned = hex.replace('#', '').trim();
  if (cleaned.length === 3) {
    const r = parseInt(cleaned[0] + cleaned[0], 16);
    const g = parseInt(cleaned[1] + cleaned[1], 16);
    const b = parseInt(cleaned[2] + cleaned[2], 16);
    if (!Number.isNaN(r) && !Number.isNaN(g) && !Number.isNaN(b)) return { r, g, b };
  }
  if (cleaned.length === 6) {
    const r = parseInt(cleaned.slice(0, 2), 16);
    const g = parseInt(cleaned.slice(2, 4), 16);
    const b = parseInt(cleaned.slice(4, 6), 16);
    if (!Number.isNaN(r) && !Number.isNaN(g) && !Number.isNaN(b)) return { r, g, b };
  }
  return { r: 56, g: 189, b: 248 };
}

export function rgbToHsv({ r, g, b }: RGB): HSV {
  const rn = clampByte(r) / 255;
  const gn = clampByte(g) / 255;
  const bn = clampByte(b) / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === rn) h = ((gn - bn) / d) % 6;
    else if (max === gn) h = (bn - rn) / d + 2;
    else h = (rn - gn) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return {
    h: Math.round(h),
    s: max === 0 ? 0 : Math.round((d / max) * 100),
    v: Math.round(max * 100),
  };
}

export function hsvToRgb({ h, s, v }: HSV): RGB {
  const hh = ((h % 360) + 360) % 360;
  const sn = clamp(s, 0, 100) / 100;
  const vn = clamp(v, 0, 100) / 100;
  const c = vn * sn;
  const x = c * (1 - Math.abs(((hh / 60) % 2) - 1));
  const m = vn - c;

  let rp = 0;
  let gp = 0;
  let bp = 0;
  if (hh < 60) [rp, gp, bp] = [c, x, 0];
  else if (hh < 120) [rp, gp, bp] = [x, c, 0];
  else if (hh < 180) [rp, gp, bp] = [0, c, x];
  else if (hh < 240) [rp, gp, bp] = [0, x, c];
  else if (hh < 300) [rp, gp, bp] = [x, 0, c];
  else [rp, gp, bp] = [c, 0, x];

  return {
    r: clampByte((rp + m) * 255),
    g: clampByte((gp + m) * 255),
    b: clampByte((bp + m) * 255),
  };
}

export function shiftHue(c: RGB, deltaDeg: number): RGB {
  const hsv = rgbToHsv(c);
  if (hsv.v <= 1) return c;
  return hsvToRgb({ h: (hsv.h + deltaDeg + 360) % 360, s: hsv.s, v: hsv.v });
}

export function adjustBrightness(c: RGB, deltaPercent: number): RGB {
  const hsv = rgbToHsv(c);
  return hsvToRgb({ h: hsv.h, s: hsv.s, v: clamp(hsv.v + deltaPercent, 0, 100) });
}

export function invertRgb(c: RGB): RGB {
  return { r: 255 - clampByte(c.r), g: 255 - clampByte(c.g), b: 255 - clampByte(c.b) };
}

export function lerpRgb(a: RGB, b: RGB, t: number): RGB {
  const tt = clamp(t, 0, 1);
  return {
    r: clampByte(a.r + (b.r - a.r) * tt),
    g: clampByte(a.g + (b.g - a.g) * tt),
    b: clampByte(a.b + (b.b - a.b) * tt),
  };
}

export function scaleRgb(c: RGB, factor: number): RGB {
  const f = Math.max(0, factor);
  return {
    r: clampByte(c.r * f),
    g: clampByte(c.g * f),
    b: clampByte(c.b * f),
  };
}

export function blendAdditive(base: RGB, add: RGB, weight = 1): RGB {
  return {
    r: clampByte(base.r + add.r * weight),
    g: clampByte(base.g + add.g * weight),
    b: clampByte(base.b + add.b * weight),
  };
}

export function sampleGradient(stops: RGB[], t: number): RGB {
  if (stops.length === 0) return BLACK;
  if (stops.length === 1) return stops[0];
  const tt = clamp(t, 0, 1);
  const scaled = tt * (stops.length - 1);
  const idx = Math.min(stops.length - 2, Math.floor(scaled));
  return lerpRgb(stops[idx], stops[idx + 1], scaled - idx);
}

export interface ColorAdjustments {
  brightness: number; // 0..200
  contrast: number;   // 0..200
  saturation: number; // 0..200
  gamma: number;      // 0.4..2.6
}

export function applyColorAdjustments(c: RGB, adj: ColorAdjustments): RGB {
  let r = c.r / 255;
  let g = c.g / 255;
  let b = c.b / 255;

  const bF = adj.brightness / 100;
  r *= bF;
  g *= bF;
  b *= bF;

  const cF = adj.contrast / 100;
  r = (r - 0.5) * cF + 0.5;
  g = (g - 0.5) * cF + 0.5;
  b = (b - 0.5) * cF + 0.5;

  const sF = adj.saturation / 100;
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  r = clamp(lum + (r - lum) * sF, 0, 1);
  g = clamp(lum + (g - lum) * sF, 0, 1);
  b = clamp(lum + (b - lum) * sF, 0, 1);

  if (adj.gamma !== 1.0 && adj.gamma > 0) {
    r = Math.pow(r, adj.gamma);
    g = Math.pow(g, adj.gamma);
    b = Math.pow(b, adj.gamma);
  }

  return {
    r: clampByte(r * 255),
    g: clampByte(g * 255),
    b: clampByte(b * 255),
  };
}

export function rgbToCss(c: RGB): string {
  return `rgb(${clampByte(c.r)}, ${clampByte(c.g)}, ${clampByte(c.b)})`;
}

export function rgbaToCss(c: RGB, alpha: number): string {
  return `rgba(${clampByte(c.r)}, ${clampByte(c.g)}, ${clampByte(c.b)}, ${clamp(alpha, 0, 1)})`;
}

export function isColorLit(c: RGB): boolean {
  return c.r > 2 || c.g > 2 || c.b > 2;
}

export interface WaveColorPreset {
  id: string;
  name: string;
  stops: RGB[];
  angle: number;
  radial?: boolean;
}

export const WAVE_COLOR_PRESETS: WaveColorPreset[] = [
  {
    id: 'cyberpunk',
    name: 'Cyberpunk',
    stops: [
      { r: 255, g: 0, b: 128 },
      { r: 124, g: 58, b: 237 },
      { r: 0, g: 240, b: 255 },
    ],
    angle: 20,
  },
  {
    id: 'sunset',
    name: 'Sunset',
    stops: [
      { r: 255, g: 64, b: 48 },
      { r: 255, g: 162, b: 36 },
      { r: 168, g: 56, b: 228 },
    ],
    angle: 0,
  },
  {
    id: 'ocean',
    name: 'Ocean',
    stops: [
      { r: 12, g: 74, b: 168 },
      { r: 14, g: 165, b: 233 },
      { r: 103, g: 232, b: 249 },
    ],
    angle: 35,
  },
  {
    id: 'aurora',
    name: 'Aurora',
    stops: [
      { r: 16, g: 185, b: 129 },
      { r: 6, g: 214, b: 235 },
      { r: 139, g: 92, b: 246 },
    ],
    angle: 135,
  },
  {
    id: 'sakura',
    name: 'Sakura',
    stops: [
      { r: 255, g: 183, b: 213 },
      { r: 244, g: 114, b: 182 },
      { r: 255, g: 241, b: 247 },
    ],
    angle: 45,
  },
  {
    id: 'warm_white',
    name: 'Warm White',
    stops: [
      { r: 255, g: 214, b: 165 },
      { r: 255, g: 244, b: 224 },
      { r: 255, g: 200, b: 138 },
    ],
    angle: 90,
  },
];

export const SWATCH_COLORS: string[] = [
  '#FF0040', '#FF5500', '#FFB800', '#00FF77', '#00E5FF', '#3B82F6', '#8B5CF6', '#EC4899',
  '#FFFFFF', '#FFE4C4', '#F43F5E', '#FB923C', '#FACC15', '#34D399', '#38BDF8', '#C084FC',
];

