import { WAVE75_KEYS, WAVE75_KEY_COUNT } from '../layout/wave75Layout';
import {
  BLACK,
  type RGB,
  blendAdditive,
  clamp,
  hsvToRgb,
  lerpRgb,
  scaleRgb,
} from '../utils/color';

export type TextLedMode = 'marquee' | 'bounce' | 'pulse' | 'clock' | 'pixel_art';
export type TextColorStyle = 'solid' | 'gradient' | 'rainbow' | 'fire';
export type TextBackgroundStyle = 'black' | 'dim_solid' | 'aurora' | 'rainbow_dim';
export type TextScrollDirection = 'rtl' | 'ltr';

export type BuiltInPixelArtId =
  | 'heart'
  | 'vietnam'
  | 'smile'
  | 'arrows'
  | 'crown'
  | 'eq'
  | 'gaming_wasd'
  | 'custom_draw';

export interface TextLedConfig {
  mode: TextLedMode;
  text: string;
  direction: TextScrollDirection;
  speed: number; // 1..10
  brightness: number; // 0..100
  colorStyle: TextColorStyle;
  primaryColor: RGB;
  secondaryColor: RGB;
  backgroundStyle: TextBackgroundStyle;
  backgroundColor: RGB;
  pixelArtId: BuiltInPixelArtId;
  /** Custom user-drawn 16×6 pixel grid (96 cells: 0 = off, 1 = primary, 2 = secondary) */
  customGrid: number[];
  drawBrushSlot: 1 | 2 | 0;
}

export const PIXEL_GRID_COLS = 16;
export const PIXEL_GRID_ROWS = 6;

export const QUICK_TEXT_PRESETS: Array<{ label: string; text: string }> = [
  { label: 'WAVE 75', text: 'WAVE 75' },
  { label: 'HELLO!', text: 'HELLO !' },
  { label: 'I ♥ U', text: 'I <3 U' },
  { label: 'GG EZ', text: 'GG EZ' },
  { label: 'PRO GAMER', text: 'PRO GAMER' },
  { label: 'VIET NAM ★', text: 'VIET NAM *' },
  { label: '2026 ★', text: '2026 *' },
];

export const PIXEL_ART_PRESETS: Array<{
  id: BuiltInPixelArtId;
  nameVi: string;
  nameEn: string;
  icon: string;
}> = [
  { id: 'heart', nameVi: 'Trái tim đập', nameEn: 'Beating Heart', icon: '♥' },
  { id: 'vietnam', nameVi: 'Sao vàng cờ đỏ', nameEn: 'Gold Star Flag', icon: '★' },
  { id: 'smile', nameVi: 'Mặt cười Cyber', nameEn: 'Cyber Smile', icon: '☺' },
  { id: 'arrows', nameVi: 'Mũi tên chạy', nameEn: 'Neon Arrows', icon: '»' },
  { id: 'crown', nameVi: 'Vương miện VIP', nameEn: 'VIP Crown', icon: '♛' },
  { id: 'eq', nameVi: 'Cột sóng nhạc', nameEn: 'Pixel EQ', icon: 'ılı' },
  { id: 'gaming_wasd', nameVi: 'Vùng Gaming FPS', nameEn: 'FPS Gaming Zone', icon: '🎮' },
  { id: 'custom_draw', nameVi: 'Tự vẽ Pixel', nameEn: 'Freehand Draw', icon: '✎' },
];

export function createDefaultCustomPixelGrid(): number[] {
  const g = new Array<number>(PIXEL_GRID_COLS * PIXEL_GRID_ROWS).fill(0);
  // Default cute heart in center of 16x6 grid
  const pts: Array<[number, number, number]> = [
    [5, 1, 1], [6, 1, 1], [9, 1, 1], [10, 1, 1],
    [4, 2, 1], [5, 2, 2], [6, 2, 2], [7, 2, 1], [8, 2, 1], [9, 2, 2], [10, 2, 2], [11, 2, 1],
    [5, 3, 1], [6, 3, 2], [7, 3, 2], [8, 3, 2], [9, 3, 2], [10, 3, 1],
    [6, 4, 1], [7, 4, 1], [8, 4, 1], [9, 4, 1],
    [7, 5, 1], [8, 5, 1],
  ];
  for (const [x, y, v] of pts) {
    g[y * PIXEL_GRID_COLS + x] = v;
  }
  return g;
}

export const DEFAULT_TEXT_LED_CONFIG: TextLedConfig = {
  mode: 'marquee',
  text: 'WAVE 75 <3',
  direction: 'rtl',
  speed: 5,
  brightness: 100,
  colorStyle: 'rainbow',
  primaryColor: { r: 0, g: 240, b: 255 },
  secondaryColor: { r: 255, g: 45, b: 165 },
  backgroundStyle: 'black',
  backgroundColor: { r: 12, g: 24, b: 64 },
  pixelArtId: 'heart',
  customGrid: createDefaultCustomPixelGrid(),
  drawBrushSlot: 1,
};

/**
 * Ultra-crisp 5-row bitmap pixel font designed specifically for a 6-row 75% keyboard matrix.
 * Each glyph is 5 rows of strings ('#' = lit, '.' = off). Rows map to keyboard rows 0..5.
 */
const FONT_5X5: Record<string, string[]> = {
  A: ['.###.', '#...#', '#####', '#...#', '#...#'],
  B: ['####.', '#...#', '####.', '#...#', '####.'],
  C: ['.####', '#....', '#....', '#....', '.####'],
  D: ['####.', '#...#', '#...#', '#...#', '####.'],
  E: ['#####', '#....', '####.', '#....', '#####'],
  F: ['#####', '#....', '####.', '#....', '#....'],
  G: ['.####', '#....', '#..##', '#...#', '.###.'],
  H: ['#...#', '#...#', '#####', '#...#', '#...#'],
  I: ['###', '.#.', '.#.', '.#.', '###'],
  J: ['..###', '...#.', '...#.', '#..#.', '.##..'],
  K: ['#...#', '#..#.', '###..', '#..#.', '#...#'],
  L: ['#....', '#....', '#....', '#....', '#####'],
  M: ['#...#', '##.##', '#.#.#', '#...#', '#...#'],
  N: ['#...#', '##..#', '#.#.#', '#..##', '#...#'],
  O: ['.###.', '#...#', '#...#', '#...#', '.###.'],
  P: ['####.', '#...#', '####.', '#....', '#....'],
  Q: ['.###.', '#...#', '#.#.#', '#..#.', '.##.#'],
  R: ['####.', '#...#', '####.', '#..#.', '#...#'],
  S: ['.####', '#....', '.###.', '....#', '####.'],
  T: ['#####', '..#..', '..#..', '..#..', '..#..'],
  U: ['#...#', '#...#', '#...#', '#...#', '.###.'],
  V: ['#...#', '#...#', '#...#', '.#.#.', '..#..'],
  W: ['#...#', '#...#', '#.#.#', '##.##', '#...#'],
  X: ['#...#', '.#.#.', '..#..', '.#.#.', '#...#'],
  Y: ['#...#', '.#.#.', '..#..', '..#..', '..#..'],
  Z: ['#####', '...#.', '..#..', '.#...', '#####'],
  '0': ['.###.', '#..##', '#.#.#', '##..#', '.###.'],
  '1': ['.#.', '##.', '.#.', '.#.', '###'],
  '2': ['####.', '....#', '.###.', '#....', '#####'],
  '3': ['####.', '....#', '.###.', '....#', '####.'],
  '4': ['#..#.', '#..#.', '#####', '...#.', '...#.'],
  '5': ['#####', '#....', '####.', '....#', '####.'],
  '6': ['.###.', '#....', '####.', '#...#', '.###.'],
  '7': ['#####', '...#.', '..#..', '.#...', '.#...'],
  '8': ['.###.', '#...#', '.###.', '#...#', '.###.'],
  '9': ['.###.', '#...#', '.####', '....#', '.###.'],
  ' ': ['..', '..', '..', '..', '..'],
  '!': ['#', '#', '#', '.', '#'],
  '?': ['###.', '...#', '.##.', '....', '.#..'],
  ':': ['.', '#', '.', '#', '.'],
  '.': ['.', '.', '.', '.', '#'],
  '-': ['...', '...', '###', '...', '...'],
  '+': ['...', '.#.', '###', '.#.', '...'],
  '/': ['...#', '..#.', '.#..', '#...', '....'],
  '@': ['.###.', '#.###', '#.#.#', '#....', '.###.'],
  '#': ['.#.#.', '#####', '.#.#.', '#####', '.#.#.'],
  '*': ['..#..', '#.#.#', '.###.', '#.#.#', '..#..'], // Star ★
  '♥': ['.#.#.', '#####', '#####', '.###.', '..#..'], // Heart ♥
  '☺': ['.#.#.', '.....', '#...#', '.###.', '.....'], // Smile :)
};

/** Strips Vietnamese diacritics & expands friendly tokens (<3 -> ♥, :) -> ☺, ★ -> *) */
export function normalizeLedText(input: string): string {
  const expanded = input
    .replace(/<3/g, '♥')
    .replace(/:\)/g, '☺')
    .replace(/[★☆]/g, '*')
    .replace(/[đĐ]/g, 'D')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase();
  return expanded.trim().length > 0 ? expanded : 'WAVE 75';
}

interface TextBitmap {
  width: number;
  height: number;
  cols: Uint8Array[]; // cols[x][y] = 0 | 1
}

function buildTextBitmap(rawText: string): TextBitmap {
  const str = normalizeLedText(rawText);
  const cols: Uint8Array[] = [];
  for (let i = 0; i < str.length; i++) {
    const ch = str[i];
    const glyph = FONT_5X5[ch] ?? FONT_5X5[' '];
    const gw = glyph[0].length;
    for (let x = 0; x < gw; x++) {
      const col = new Uint8Array(5);
      for (let y = 0; y < 5; y++) {
        col[y] = glyph[y][x] === '#' ? 1 : 0;
      }
      cols.push(col);
    }
    // 1-column spacing between characters
    if (i < str.length - 1) {
      cols.push(new Uint8Array(5));
    }
  }
  return { width: cols.length, height: 5, cols };
}

function resolveTextColor(
  config: TextLedConfig,
  nx: number,
  ny: number,
  tSec: number,
  slot = 1
): RGB {
  if (slot === 2) {
    return config.secondaryColor;
  }
  switch (config.colorStyle) {
    case 'solid':
      return config.primaryColor;
    case 'gradient':
      return lerpRgb(config.primaryColor, config.secondaryColor, clamp(nx, 0, 1));
    case 'fire': {
      const heat = clamp(1 - ny * 0.75 + 0.15 * Math.sin(nx * 10 - tSec * 6), 0, 1);
      return {
        r: Math.round(clamp(heat * 320, 0, 255)),
        g: Math.round(clamp(Math.max(0, heat - 0.25) * 290, 0, 255)),
        b: Math.round(clamp(Math.max(0, heat - 0.7) * 260, 0, 255)),
      };
    }
    case 'rainbow':
    default:
      return hsvToRgb({ h: (((nx * 260 - tSec * 90) % 360) + 360) % 360, s: 100, v: 100 });
  }
}

function resolveBackground(
  config: TextLedConfig,
  nx: number,
  ny: number,
  tSec: number
): RGB {
  switch (config.backgroundStyle) {
    case 'black':
      return BLACK;
    case 'dim_solid':
      return scaleRgb(config.backgroundColor, 0.22);
    case 'aurora': {
      const w = 0.5 + 0.5 * Math.sin(nx * 5 - tSec * 1.1 + ny * 2);
      return scaleRgb(hsvToRgb({ h: 165 + w * 115, s: 90, v: 100 }), 0.14);
    }
    case 'rainbow_dim':
      return scaleRgb(
        hsvToRgb({ h: (((nx * 360 + tSec * 45) % 360) + 360) % 360, s: 95, v: 100 }),
        0.12
      );
  }
}

function sampleBitmapSubpixel(bmp: TextBitmap, sampleX: number, row: number): number {
  // Center 5-row bitmap vertically on 6-row keyboard (rows 0..4 or 1..5 -> row 0.5 offset looks great on 75%!)
  const y = row - 0; // map keyboard rows 0..4 to glyph rows 0..4 (row 5 spacebar stays clean accent or subtle reflection!)
  if (y < 0 || y >= bmp.height) return 0;
  const x0 = Math.floor(sampleX);
  const frac = sampleX - x0;
  const v0 = x0 >= 0 && x0 < bmp.width ? bmp.cols[x0][y] : 0;
  const v1 = x0 + 1 >= 0 && x0 + 1 < bmp.width ? bmp.cols[x0 + 1][y] : 0;
  return v0 * (1 - frac) + v1 * frac;
}

function renderPixelArtCell(
  artId: BuiltInPixelArtId,
  col: number,
  row: number,
  tSec: number,
  config: TextLedConfig
): { lit: number; overrideColor?: RGB; slot?: 1 | 2 } {
  switch (artId) {
    case 'heart': {
      const beat = 0.65 + 0.35 * Math.pow(Math.max(0, Math.sin(tSec * 4.2)), 4);
      const cx = (col - 7.5) / (4.4 * (0.92 + 0.12 * beat));
      const cy = -(row - 2.6) / (2.5 * (0.92 + 0.12 * beat));
      // Implicit heart curve (x^2 + y^2 - 1)^3 - x^2*y^3 <= 0
      const a = cx * cx + cy * cy - 1;
      const val = a * a * a - cx * cx * cy * cy * cy;
      if (val <= 0) {
        const inner = val < -0.25;
        return {
          lit: beat,
          overrideColor: inner ? { r: 255, g: 40, b: 120 } : { r: 255, g: 12, b: 55 },
        };
      }
      return { lit: 0 };
    }

    case 'vietnam': {
      // Glowing red flag + pulsing 5-point golden star centered at (7.5, 2.5)
      const dx = col - 7.5;
      const dy = (row - 2.5) * 1.25;
      const r = Math.hypot(dx, dy);
      const ang = Math.atan2(dy, dx) + Math.PI / 2;
      const starRadius = 2.05 + 0.85 * Math.cos(ang * 5);
      const shimmer = 0.82 + 0.18 * Math.sin(tSec * 3.5 + col * 0.4);
      if (r <= starRadius) {
        return { lit: 1, overrideColor: scaleRgb({ r: 255, g: 225, b: 10 }, shimmer) };
      }
      return { lit: 0.72, overrideColor: scaleRgb({ r: 225, g: 16, b: 22 }, 0.85 + 0.15 * Math.sin(col * 0.5 - tSec * 3)) };
    }

    case 'smile': {
      const blink = Math.sin(tSec * 2.1) > 0.94;
      const isEye = !blink && row === 1 && (col === 5 || col === 10);
      const isMouth =
        (row === 3 && (col === 4 || col === 11)) ||
        (row === 4 && col >= 5 && col <= 10);
      const isCheek = row === 3 && (col === 3 || col === 12);
      if (isEye) return { lit: 1, overrideColor: { r: 0, g: 245, b: 255 } };
      if (isMouth) return { lit: 1, overrideColor: { r: 250, g: 204, b: 21 } };
      if (isCheek) return { lit: 0.75, overrideColor: { r: 255, g: 70, b: 150 } };
      return { lit: 0 };
    }

    case 'arrows': {
      const shift = (tSec * (2 + config.speed * 0.9)) % 6;
      const distFromMid = Math.abs(row - 2.5);
      const chevron = ((col - distFromMid - shift) % 6 + 6) % 6;
      const intensity = chevron < 1.6 ? Math.pow(1 - chevron / 1.6, 1.4) : 0;
      return { lit: intensity };
    }

    case 'crown': {
      const isPeak = row === 1 && (col === 4 || col === 7 || col === 8 || col === 11);
      const isMid = row === 2 && ((col >= 4 && col <= 5) || (col >= 7 && col <= 8) || (col >= 10 && col <= 11));
      const isBase = (row === 3 || row === 4) && col >= 4 && col <= 11;
      const jewel = row === 3 && (col === 5 || col === 8 || col === 10);
      const shine = 0.75 + 0.25 * Math.sin(col * 0.7 - tSec * 4);
      if (jewel) return { lit: 1, overrideColor: { r: 0, g: 240, b: 255 } };
      if (isPeak || isMid || isBase) {
        return { lit: shine, overrideColor: { r: 255, g: 195, b: 20 } };
      }
      return { lit: 0 };
    }

    case 'eq': {
      const level =
        0.5 +
        0.48 * Math.sin(tSec * (2.5 + config.speed * 0.5) + col * 0.95) * Math.cos(tSec * 1.7 - col * 0.4);
      const barTop = 5.4 - clamp(level, 0.08, 1) * 5.2;
      if (row >= barTop) {
        const hue = 135 - (5 - row) * 26; // green -> yellow -> red peak
        return { lit: 1, overrideColor: hsvToRgb({ h: (hue + 360) % 360, s: 100, v: 100 }) };
      }
      return { lit: 0 };
    }

    case 'gaming_wasd': {
      const isWasd = (row === 2 && col === 2) || (row === 3 && col >= 1 && col <= 3);
      const isArrows = (row === 4 && col === 14) || (row === 5 && col >= 13 && col <= 15);
      const isSkills = row === 1 && col >= 1 && col <= 5;
      const pulse = 0.8 + 0.2 * Math.sin(tSec * 3.5);
      if (isWasd) return { lit: pulse, overrideColor: { r: 255, g: 45, b: 85 } };
      if (isArrows) return { lit: pulse, overrideColor: { r: 250, g: 204, b: 21 } };
      if (isSkills) return { lit: 0.95, overrideColor: { r: 0, g: 235, b: 255 } };
      return { lit: 0 };
    }

    case 'custom_draw':
    default: {
      const cell = config.customGrid[row * PIXEL_GRID_COLS + col] ?? 0;
      if (cell === 1) return { lit: 1, slot: 1 };
      if (cell === 2) return { lit: 1, slot: 2 };
      return { lit: 0 };
    }
  }
}

export function renderTextLedFrame(
  config: TextLedConfig,
  timeMs: number
): { keys: RGB[]; logo: RGB } {
  const keys = new Array<RGB>(WAVE75_KEY_COUNT);
  const brightScale = clamp(config.brightness, 0, 100) / 100;
  if (brightScale <= 0) {
    keys.fill(BLACK);
    return { keys, logo: BLACK };
  }

  const tSec = timeMs / 1000;
  const scrollColsPerSec = 2.2 + config.speed * 1.15;

  let activeText = config.text;
  if (config.mode === 'clock') {
    const d = new Date();
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    const sep = Math.floor(tSec * 2) % 2 === 0 ? ':' : ' ';
    activeText = `${hh}${sep}${mm}`;
  }

  const bmp = config.mode !== 'pixel_art' ? buildTextBitmap(activeText) : null;

  // Precompute scroll offset for text modes
  let scrollOffset = 0;
  let pulseFade = 1;
  let activeCharBmp: TextBitmap | null = null;

  if (bmp) {
    if (config.mode === 'marquee' || config.mode === 'clock') {
      const totalSpan = bmp.width + PIXEL_GRID_COLS + 2;
      const raw = (tSec * scrollColsPerSec) % totalSpan;
      scrollOffset =
        config.direction === 'rtl'
          ? raw - PIXEL_GRID_COLS
          : bmp.width + 2 - raw;
    } else if (config.mode === 'bounce') {
      const maxTravel = Math.max(0, bmp.width - PIXEL_GRID_COLS + 2);
      if (maxTravel <= 0) {
        scrollOffset = -(PIXEL_GRID_COLS - bmp.width) / 2;
      } else {
        const wave = 0.5 - 0.5 * Math.cos(tSec * (0.45 + config.speed * 0.22));
        scrollOffset = -1 + wave * maxTravel;
      }
    } else if (config.mode === 'pulse') {
      // Split into short chunks (up to 3 chars) or single characters and pulse centered
      const clean = normalizeLedText(activeText).replace(/\s+/g, ' ').trim();
      const tokens = clean.length <= 3 ? [clean] : clean.split('').filter((c) => c !== ' ');
      const stepDur = Math.max(0.35, 1.55 - config.speed * 0.12);
      const idx = Math.floor(tSec / stepDur) % Math.max(1, tokens.length);
      const phase = (tSec % stepDur) / stepDur;
      pulseFade = Math.sin(phase * Math.PI);
      activeCharBmp = buildTextBitmap(tokens[idx] ?? 'W');
      scrollOffset = -(PIXEL_GRID_COLS - activeCharBmp.width) / 2;
    }
  }

  for (let i = 0; i < WAVE75_KEY_COUNT; i++) {
    const k = WAVE75_KEYS[i];
    const bg = resolveBackground(config, k.nx, k.ny, tSec);
    let col = bg;

    if (config.mode === 'pixel_art') {
      const gridCol = clamp(Math.floor(k.cx), 0, PIXEL_GRID_COLS - 1);
      const gridRow = clamp(k.row, 0, PIXEL_GRID_ROWS - 1);
      const res = renderPixelArtCell(config.pixelArtId, gridCol, gridRow, tSec, config);
      if (res.lit > 0.01) {
        const fg =
          res.overrideColor ??
          resolveTextColor(config, k.nx, k.ny, tSec, res.slot ?? 1);
        col = blendAdditive(bg, fg, res.lit);
      }
    } else {
      const useBmp = activeCharBmp ?? bmp!;
      const sampleX = k.cx + scrollOffset;
      const intensity = sampleBitmapSubpixel(useBmp, sampleX, k.row) * pulseFade;
      if (intensity > 0.02) {
        const fg = resolveTextColor(config, k.nx, k.ny, tSec, 1);
        col = blendAdditive(bg, fg, clamp(intensity, 0, 1));
      } else if (k.row === 5) {
        // Subtle glowing accent bar on bottom spacebar row matching text color
        const barGlow = 0.2 + 0.12 * Math.sin(k.nx * 8 - tSec * 3);
        col = blendAdditive(bg, resolveTextColor(config, k.nx, 0.5, tSec, 1), barGlow);
      }
    }

    keys[i] = scaleRgb(col, brightScale);
  }

  const logo = scaleRgb(resolveTextColor(config, 0.5, 0.2, tSec, 1), brightScale);
  return { keys, logo };
}
