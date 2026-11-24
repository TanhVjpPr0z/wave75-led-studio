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

export interface HSL {
  h: number; // 0..360
  s: number; // 0..100
  l: number; // 0..100
}

export const BLACK: RGB = { r: 0, g: 0, b: 0 };
export const WHITE: RGB = { r: 255, g: 255, b: 255 };

export function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

export function clampByte(val: number): number {
  return Math.max(0, Math.min(255, Math.round(val)));
}

export function rgbToHex({ r, g, b }: RGB): string {
  const toHex = (n: number) => clampByte(n).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
}

export function hexToRgb(hex: string): RGB {
  const cleaned = hex.replace('#', '').trim();
  if (cleaned.length === 3) {
    const r = parseInt(cleaned[0] + cleaned[0], 16);
    const g = parseInt(cleaned[1] + cleaned[1], 16);
    const b = parseInt(cleaned[2] + cleaned[2], 16);
    if (!Number.isNaN(r) && !Number.isNaN(g) && !Number.isNaN(b)) {
      return { r, g, b };
    }
  }
  if (cleaned.length === 6) {
    const r = parseInt(cleaned.slice(0, 2), 16);
    const g = parseInt(cleaned.slice(2, 4), 16);
    const b = parseInt(cleaned.slice(4, 6), 16);
    if (!Number.isNaN(r) && !Number.isNaN(g) && !Number.isNaN(b)) {
      return { r, g, b };
    }
  }
  return { r: 6, g: 182, b: 212 };
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
    if (max === rn) {
      h = ((gn - bn) / d) % 6;
    } else if (max === gn) {
      h = (bn - rn) / d + 2;
    } else {
      h = (rn - gn) / d + 4;
    }
    h *= 60;
    if (h < 0) h += 360;
  }
  const s = max === 0 ? 0 : (d / max) * 100;
  const v = max * 100;
  return { h: Math.round(h), s: Math.round(s), v: Math.round(v) };
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

export function rgbToHsl({ r, g, b }: RGB): HSL {
  const rn = clampByte(r) / 255;
  const gn = clampByte(g) / 255;
  const bn = clampByte(b) / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case rn:
        h = (gn - bn) / d + (gn < bn ? 6 : 0);
        break;
      case gn:
        h = (bn - rn) / d + 2;
        break;
      default:
        h = (rn - gn) / d + 4;
        break;
    }
    h *= 60;
  }
  return { h: Math.round(h), s: Math.round(s * 100), l: Math.round(l * 100) };
}

export function hslToRgb({ h, s, l }: HSL): RGB {
  const hh = (((h % 360) + 360) % 360) / 360;
  const sn = clamp(s, 0, 100) / 100;
  const ln = clamp(l, 0, 100) / 100;

  if (sn === 0) {
    const gray = clampByte(ln * 255);
    return { r: gray, g: gray, b: gray };
  }

  const hue2rgb = (p: number, q: number, t: number) => {
    let tt = t;
    if (tt < 0) tt += 1;
    if (tt > 1) tt -= 1;
    if (tt < 1 / 6) return p + (q - p) * 6 * tt;
    if (tt < 1 / 2) return q;
    if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
    return p;
  };

  const q = ln < 0.5 ? ln * (1 + sn) : ln + sn - ln * sn;
  const p = 2 * ln - q;
  return {
    r: clampByte(hue2rgb(p, q, hh + 1 / 3) * 255),
    g: clampByte(hue2rgb(p, q, hh) * 255),
    b: clampByte(hue2rgb(p, q, hh - 1 / 3) * 255),
  };
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
  const localT = scaled - idx;
  return lerpRgb(stops[idx], stops[idx + 1], localT);
}

export interface ColorAdjustments {
  brightness: number; // 0..200 (100 = neutral)
  contrast: number;   // 0..200 (100 = neutral)
  saturation: number; // 0..200 (100 = neutral)
  gamma: number;      // 0.4..2.6 (1.0 = neutral)
  quantizeLevels: number; // 0 = off, else e.g. 8, 16, 32
}

export function applyColorAdjustments(c: RGB, adj: ColorAdjustments): RGB {
  let r = c.r / 255;
  let g = c.g / 255;
  let b = c.b / 255;

  // Brightness
  const bFactor = adj.brightness / 100;
  r *= bFactor;
  g *= bFactor;
  b *= bFactor;

  // Contrast around 0.5
  const cFactor = adj.contrast / 100;
  r = (r - 0.5) * cFactor + 0.5;
  g = (g - 0.5) * cFactor + 0.5;
  b = (b - 0.5) * cFactor + 0.5;

  // Saturation
  const sFactor = adj.saturation / 100;
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  r = lum + (r - lum) * sFactor;
  g = lum + (g - lum) * sFactor;
  b = lum + (b - lum) * sFactor;

  r = clamp(r, 0, 1);
  g = clamp(g, 0, 1);
  b = clamp(b, 0, 1);

  // Gamma
  if (adj.gamma !== 1.0 && adj.gamma > 0) {
    r = Math.pow(r, adj.gamma);
    g = Math.pow(g, adj.gamma);
    b = Math.pow(b, adj.gamma);
  }

  let outR = clampByte(r * 255);
  let outG = clampByte(g * 255);
  let outB = clampByte(b * 255);

  // Optional quantization for lower-bandwidth HID protocols
  if (adj.quantizeLevels > 1) {
    const step = 255 / (adj.quantizeLevels - 1);
    outR = clampByte(Math.round(outR / step) * step);
    outG = clampByte(Math.round(outG / step) * step);
    outB = clampByte(Math.round(outB / step) * step);
  }

  return { r: outR, g: outG, b: outB };
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

export interface QuickColorTheme {
  id: string;
  name: string;
  stops: RGB[];
  angle: number;
  radial?: boolean;
}

export const QUICK_COLOR_PRESETS: QuickColorTheme[] = [
  {
    id: 'cyberpunk',
    name: 'Cyberpunk',
    stops: [
      { r: 255, g: 0, b: 128 },
      { r: 124, g: 58, b: 237 },
      { r: 0, g: 240, b: 255 },
    ],
    angle: 25,
  },
  {
    id: 'vaporwave',
    name: 'Vaporwave',
    stops: [
      { r: 255, g: 113, b: 206 },
      { r: 185, g: 103, b: 255 },
      { r: 1, g: 205, b: 254 },
    ],
    angle: 135,
  },
  {
    id: 'sakura',
    name: 'Sakura',
    stops: [
      { r: 255, g: 183, b: 213 },
      { r: 255, g: 105, b: 165 },
      { r: 255, g: 240, b: 245 },
    ],
    angle: 45,
  },
  {
    id: 'valorant',
    name: 'Valorant Red-Cyan',
    stops: [
      { r: 255, g: 70, b: 85 },
      { r: 255, g: 40, b: 95 },
      { r: 0, g: 229, b: 255 },
    ],
    angle: 0,
  },
  {
    id: 'cs2',
    name: 'CS2 Gold-Blue',
    stops: [
      { r: 255, g: 180, b: 20 },
      { r: 255, g: 120, b: 0 },
      { r: 30, g: 120, b: 255 },
    ],
    angle: 15,
  },
  {
    id: 'matrix',
    name: 'Matrix Green',
    stops: [
      { r: 0, g: 90, b: 30 },
      { r: 0, g: 255, b: 90 },
      { r: 130, g: 255, b: 170 },
    ],
    angle: 90,
  },
  {
    id: 'ice_white',
    name: 'Ice White',
    stops: [
      { r: 185, g: 235, b: 255 },
      { r: 245, g: 252, b: 255 },
      { r: 125, g: 211, b: 252 },
    ],
    angle: 90,
  },
  {
    id: 'sunset',
    name: 'Sunset',
    stops: [
      { r: 255, g: 60, b: 40 },
      { r: 255, g: 150, b: 30 },
      { r: 155, g: 45, b: 220 },
    ],
    angle: 0,
  },
];

export const SWATCH_COLORS: string[] = [
  '#FF0040', '#FF4D00', '#FFB800', '#00FF66', '#00E5FF', '#2563EB', '#8B5CF6', '#EC4899',
  '#FFFFFF', '#CBD5E1', '#F43F5E', '#FB923C', '#FACC15', '#34D399', '#38BDF8', '#A78BFA',
];

