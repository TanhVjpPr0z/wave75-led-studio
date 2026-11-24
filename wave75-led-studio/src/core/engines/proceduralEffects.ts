import {
  WAVE75_KEYS,
  WAVE75_KEY_COUNT,
  WAVE75_WIDTH_U,
  WAVE75_HEIGHT_U,
} from '../layout/wave75Layout';
import {
  RGB,
  BLACK,
  hsvToRgb,
  lerpRgb,
  scaleRgb,
  blendAdditive,
  clamp,
  sampleGradient,
} from '../utils/color';
import { waveSnakeEngine } from './snakeGameEngine';

export type ProceduralEffectId =
  | 'rainbow_wave'
  | 'diagonal_rainbow'
  | 'aurora'
  | 'plasma'
  | 'ocean_ripple'
  | 'lava_lamp'
  | 'sunset_gradient'
  | 'breathing'
  | 'neon_stream'
  | 'color_radar'
  | 'spiral_vortex'
  | 'dual_sine'
  | 'fireworks'
  | 'matrix_rain'
  | 'starlight'
  | 'game_of_life'
  | 'snake'
  | 'campfire'
  | 'equalizer_demo'
  | 'meteor_shower'
  | 'heartbeat'
  | 'cyberpunk_glitch'
  | 'reactive_ripple'
  | 'static_solid';

export type EffectDirection = 'ltr' | 'rtl' | 'ttb' | 'btt' | 'outward' | 'inward';

export interface ProceduralEffectParams {
  effectId: ProceduralEffectId;
  brightness: number; // 0..100
  speed: number;      // 1..10
  direction: EffectDirection;
  primaryColor: RGB;
  secondaryColor: RGB;
  useRainbow: boolean;
}

export interface ProceduralEffectMeta {
  id: ProceduralEffectId;
  category: 'spectrum' | 'simulation';
}

export const PROCEDURAL_EFFECTS: ProceduralEffectMeta[] = [
  // Spectrum & Wave (12)
  { id: 'rainbow_wave', category: 'spectrum' },
  { id: 'diagonal_rainbow', category: 'spectrum' },
  { id: 'aurora', category: 'spectrum' },
  { id: 'plasma', category: 'spectrum' },
  { id: 'ocean_ripple', category: 'spectrum' },
  { id: 'lava_lamp', category: 'spectrum' },
  { id: 'sunset_gradient', category: 'spectrum' },
  { id: 'breathing', category: 'spectrum' },
  { id: 'neon_stream', category: 'spectrum' },
  { id: 'color_radar', category: 'spectrum' },
  { id: 'spiral_vortex', category: 'spectrum' },
  { id: 'dual_sine', category: 'spectrum' },
  // Interactive & Live Simulations (12)
  { id: 'fireworks', category: 'simulation' },
  { id: 'matrix_rain', category: 'simulation' },
  { id: 'starlight', category: 'simulation' },
  { id: 'game_of_life', category: 'simulation' },
  { id: 'snake', category: 'simulation' },
  { id: 'campfire', category: 'simulation' },
  { id: 'equalizer_demo', category: 'simulation' },
  { id: 'meteor_shower', category: 'simulation' },
  { id: 'heartbeat', category: 'simulation' },
  { id: 'cyberpunk_glitch', category: 'simulation' },
  { id: 'reactive_ripple', category: 'simulation' },
  { id: 'static_solid', category: 'simulation' },
];

export interface KeyImpulse {
  keyIndex: number;
  cx: number;
  cy: number;
  row: number;
  timestampMs: number;
  hue: number;
}

// Persistent stateful simulation grids for Conway's Game of Life & Snake (16x6 grid)
const GRID_W = 16;
const GRID_H = 6;
let golGrid = new Uint8Array(GRID_W * GRID_H);
let golLastStep = 0;

function seedGol(): void {
  for (let i = 0; i < golGrid.length; i++) {
    golGrid[i] = Math.random() > 0.62 ? 1 : 0;
  }
}
seedGol();

function stepGol(): void {
  const next = new Uint8Array(GRID_W * GRID_H);
  let alive = 0;
  for (let y = 0; y < GRID_H; y++) {
    for (let x = 0; x < GRID_W; x++) {
      let neighbors = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          const nx = (x + dx + GRID_W) % GRID_W;
          const ny = (y + dy + GRID_H) % GRID_H;
          neighbors += golGrid[ny * GRID_W + nx];
        }
      }
      const idx = y * GRID_W + x;
      const cell = golGrid[idx];
      if (cell === 1 && (neighbors === 2 || neighbors === 3)) {
        next[idx] = 1;
        alive++;
      } else if (cell === 0 && neighbors === 3) {
        next[idx] = 1;
        alive++;
      }
    }
  }
  golGrid = next;
  if (alive < 6) seedGol();
}

function hash(n: number, seed: number): number {
  const v = Math.sin(n * 127.1 + seed * 311.7) * 43758.5453123;
  return v - Math.floor(v);
}

function dirCoord(nx: number, ny: number, cx: number, cy: number, dir: EffectDirection): number {
  switch (dir) {
    case 'ltr':
      return nx;
    case 'rtl':
      return 1 - nx;
    case 'ttb':
      return ny;
    case 'btt':
      return 1 - ny;
    case 'outward': {
      const dx = (cx - WAVE75_WIDTH_U / 2) / (WAVE75_WIDTH_U / 2);
      const dy = (cy - WAVE75_HEIGHT_U / 2) / (WAVE75_HEIGHT_U / 2);
      return Math.hypot(dx, dy) * 0.72;
    }
    case 'inward': {
      const dx = (cx - WAVE75_WIDTH_U / 2) / (WAVE75_WIDTH_U / 2);
      const dy = (cy - WAVE75_HEIGHT_U / 2) / (WAVE75_HEIGHT_U / 2);
      return 1 - Math.hypot(dx, dy) * 0.72;
    }
  }
}

export function renderProceduralFrame(
  params: ProceduralEffectParams,
  timeMs: number,
  impulses: KeyImpulse[] = []
): { keys: RGB[]; logo: RGB } {
  // Interactive Playable WAVE75 LED Snake Game!
  if (params.effectId === 'snake') {
    return waveSnakeEngine.renderFrame(timeMs, params.speed, params.brightness);
  }

  const keys = new Array<RGB>(WAVE75_KEY_COUNT);
  const bright = clamp(params.brightness, 0, 100) / 100;
  const speedMul = 0.25 + params.speed * 0.25;
  const t = (timeMs / 1000) * speedMul;

  if (params.effectId === 'game_of_life') {
    const interval = Math.max(90, 420 - params.speed * 32);
    if (timeMs - golLastStep > interval) {
      stepGol();
      golLastStep = timeMs;
    }
  }

  // Synthesize periodic bursts for fireworks
  const fwCycle = Math.floor(t * 0.85);
  const fwAge = (t * 0.85) % 1;
  const fwX = 2 + hash(fwCycle, 1.3) * (WAVE75_WIDTH_U - 4);
  const fwY = 1 + hash(fwCycle, 4.7) * (WAVE75_HEIGHT_U - 2);
  const fwHue = (fwCycle * 87) % 360;

  const fw2Cycle = Math.floor(t * 0.85 + 0.5);
  const fw2Age = (t * 0.85 + 0.5) % 1;
  const fw2X = 2 + hash(fw2Cycle, 9.1) * (WAVE75_WIDTH_U - 4);
  const fw2Y = 1 + hash(fw2Cycle, 2.9) * (WAVE75_HEIGHT_U - 2);
  const fw2Hue = (fw2Cycle * 131 + 120) % 360;

  // Demo impulse if reactive_ripple has none
  let activeImpulses = impulses;
  if (params.effectId === 'reactive_ripple' && impulses.length === 0) {
    const cycle = Math.floor(timeMs / 2100);
    const dk = WAVE75_KEYS[Math.floor(hash(cycle, 6.2) * WAVE75_KEY_COUNT)];
    activeImpulses = [
      {
        keyIndex: dk.index,
        cx: dk.cx,
        cy: dk.cy,
        row: dk.row,
        timestampMs: cycle * 2100,
        hue: (cycle * 65) % 360,
      },
    ];
  }

  for (let i = 0; i < WAVE75_KEY_COUNT; i++) {
    const k = WAVE75_KEYS[i];
    const dc = dirCoord(k.nx, k.ny, k.cx, k.cy, params.direction);
    let col: RGB = BLACK;

    switch (params.effectId) {
      case 'rainbow_wave': {
        const hue = (((dc * 360 - t * 140) % 360) + 360) % 360;
        col = params.useRainbow
          ? hsvToRgb({ h: hue, s: 100, v: 100 })
          : lerpRgb(params.primaryColor, params.secondaryColor, 0.5 - 0.5 * Math.cos((dc - t * 0.4) * Math.PI * 2));
        break;
      }

      case 'diagonal_rainbow': {
        const diag = (k.nx * 0.7 + k.ny * 0.55) - t * 0.35;
        const hue = (((diag * 360) % 360) + 360) % 360;
        col = hsvToRgb({ h: hue, s: 100, v: 100 });
        break;
      }

      case 'aurora': {
        const w1 = Math.sin(k.nx * 4.5 - t * 1.1 + Math.sin(k.ny * 2.8 + t * 0.5));
        const w2 = Math.cos(k.nx * 2.4 + k.ny * 2.2 + t * 0.8);
        const m = clamp((w1 * 0.5 + w2 * 0.5 + 1) / 2, 0, 1);
        col = params.useRainbow
          ? scaleRgb(hsvToRgb({ h: (130 + m * 175) % 360, s: 92, v: 100 }), 0.35 + 0.65 * Math.sin(m * Math.PI))
          : lerpRgb(params.primaryColor, params.secondaryColor, m);
        break;
      }

      case 'plasma': {
        const v1 = Math.sin(k.nx * 8 + t * 1.6);
        const v2 = Math.sin((k.ny * 5 + Math.cos(t * 0.9)) * 1.3);
        const v3 = Math.sin(Math.hypot(k.nx - 0.5, k.ny - 0.5) * 14 - t * 2.1);
        const hue = ((((v1 + v2 + v3) * 65 + 210) % 360) + 360) % 360;
        col = hsvToRgb({ h: hue, s: 96, v: 100 });
        break;
      }

      case 'ocean_ripple': {
        const d1 = Math.hypot(k.cx - 4.5, k.cy - 3);
        const d2 = Math.hypot(k.cx - 11.5, k.cy - 2.5);
        const wave = 0.5 + 0.25 * Math.sin(d1 * 1.4 - t * 3.2) + 0.25 * Math.sin(d2 * 1.5 - t * 2.7);
        col = sampleGradient(
          [
            { r: 8, g: 38, b: 105 },
            { r: 14, g: 165, b: 233 },
            { r: 186, g: 245, b: 255 },
          ],
          wave
        );
        break;
      }

      case 'lava_lamp': {
        const blob1 = Math.exp(-Math.pow(Math.hypot(k.cx - (8 + Math.sin(t * 0.7) * 5.2), k.cy - (3 + Math.cos(t * 0.9) * 1.8)) / 3.2, 2));
        const blob2 = Math.exp(-Math.pow(Math.hypot(k.cx - (8 - Math.cos(t * 0.6) * 5.5), k.cy - (3 - Math.sin(t * 0.8) * 1.7)) / 2.8, 2));
        const heat = clamp(blob1 + blob2, 0, 1);
        col = sampleGradient(
          [
            { r: 42, g: 6, b: 24 },
            { r: 220, g: 38, b: 38 },
            { r: 251, g: 146, b: 60 },
            { r: 254, g: 240, b: 138 },
          ],
          heat
        );
        break;
      }

      case 'sunset_gradient': {
        const shift = 0.5 + 0.5 * Math.sin(t * 0.8 + k.nx * 1.5);
        col = sampleGradient(
          [
            { r: 126, g: 34, b: 206 },
            { r: 236, g: 72, b: 153 },
            { r: 249, g: 115, b: 22 },
            { r: 253, g: 224, b: 71 },
          ],
          clamp(k.ny * 0.7 + shift * 0.3, 0, 1)
        );
        break;
      }

      case 'breathing': {
        const b = 0.08 + 0.92 * (0.5 - 0.5 * Math.cos(t * 1.8));
        const c = params.useRainbow
          ? hsvToRgb({ h: (t * 25) % 360, s: 100, v: 100 })
          : lerpRgb(params.primaryColor, params.secondaryColor, k.nx);
        col = scaleRgb(c, b);
        break;
      }

      case 'neon_stream': {
        const phase = (((dc - t * 0.55) % 1) + 1) % 1;
        const comet = Math.pow(1 - phase, 3.2);
        const c = params.useRainbow
          ? hsvToRgb({ h: (phase * 180 + t * 55) % 360, s: 100, v: 100 })
          : lerpRgb(params.primaryColor, params.secondaryColor, phase);
        col = scaleRgb(c, 0.08 + comet * 0.92);
        break;
      }

      case 'color_radar': {
        const angle = Math.atan2(k.cy - WAVE75_HEIGHT_U / 2, k.cx - WAVE75_WIDTH_U / 2);
        const normAngle = (angle + Math.PI) / (Math.PI * 2);
        const beam = (((normAngle - t * 0.45) % 1) + 1) % 1;
        const glow = Math.pow(1 - beam, 2.8);
        const c = params.useRainbow
          ? hsvToRgb({ h: (normAngle * 360) % 360, s: 100, v: 100 })
          : params.primaryColor;
        col = scaleRgb(c, 0.08 + glow * 0.92);
        break;
      }

      case 'spiral_vortex': {
        const dx = k.cx - WAVE75_WIDTH_U / 2;
        const dy = (k.cy - WAVE75_HEIGHT_U / 2) * 1.8;
        const angle = Math.atan2(dy, dx);
        const dist = Math.hypot(dx, dy);
        const hue = ((((angle / (Math.PI * 2)) * 360 + dist * 32 - t * 180) % 360) + 360) % 360;
        col = hsvToRgb({ h: hue, s: 100, v: 100 });
        break;
      }

      case 'dual_sine': {
        const y1 = 3.0 + Math.sin(k.cx * 0.55 - t * 2.8) * 2.1;
        const y2 = 3.0 + Math.cos(k.cx * 0.48 + t * 2.3) * 2.1;
        const g1 = Math.exp(-Math.pow(k.cy - y1, 2) * 0.9);
        const g2 = Math.exp(-Math.pow(k.cy - y2, 2) * 0.9);
        col = blendAdditive(scaleRgb(params.primaryColor, g1), params.secondaryColor, g2);
        break;
      }

      case 'fireworks': {
        let acc = { r: 6, g: 8, b: 16 };
        const d1 = Math.hypot(k.cx - fwX, k.cy - fwY);
        const r1 = fwAge * 8.5;
        const ring1 = Math.exp(-Math.pow((d1 - r1) * 1.15, 2)) * (1 - fwAge);
        acc = blendAdditive(acc, hsvToRgb({ h: (fwHue + d1 * 20) % 360, s: 100, v: 100 }), ring1 * 1.4);

        const d2 = Math.hypot(k.cx - fw2X, k.cy - fw2Y);
        const r2 = fw2Age * 8.5;
        const ring2 = Math.exp(-Math.pow((d2 - r2) * 1.15, 2)) * (1 - fw2Age);
        acc = blendAdditive(acc, hsvToRgb({ h: (fw2Hue + d2 * 20) % 360, s: 100, v: 100 }), ring2 * 1.4);
        col = acc;
        break;
      }

      case 'matrix_rain': {
        const colIdx = Math.floor(k.cx);
        const colDelay = hash(colIdx, 3.7) * 1.8;
        const headY = (((t * 1.15 + colDelay) % 1.6) / 1.6) * (WAVE75_HEIGHT_U + 3) - 1;
        const dist = headY - k.cy;
        if (dist >= 0 && dist < 3.2) {
          const tail = Math.pow(1 - dist / 3.2, 1.9);
          const isHead = dist < 0.55;
          col = isHead
            ? { r: 195, g: 255, b: 205 }
            : { r: 0, g: Math.round(255 * tail), b: Math.round(75 * tail) };
        } else {
          col = { r: 0, g: 14, b: 6 };
        }
        break;
      }

      case 'starlight': {
        const rate = 0.7 + hash(i, 5.1) * 1.6;
        const phase = hash(i, 11.3) * Math.PI * 2;
        const twinkle = Math.pow(0.5 + 0.5 * Math.sin(t * rate * 2.5 + phase), 5);
        const star = params.useRainbow
          ? hsvToRgb({ h: (hash(i, 8.2) * 360 + t * 18) % 360, s: 75, v: 100 })
          : params.primaryColor;
        col = blendAdditive({ r: 8, g: 12, b: 26 }, star, twinkle);
        break;
      }

      case 'game_of_life': {
        const gx = clamp(Math.floor(k.cx), 0, GRID_W - 1);
        const gy = clamp(k.row, 0, GRID_H - 1);
        const alive = golGrid[gy * GRID_W + gx] === 1;
        col = alive
          ? (params.useRainbow ? hsvToRgb({ h: (k.nx * 240 + t * 40) % 360, s: 90, v: 100 }) : params.primaryColor)
          : scaleRgb(params.secondaryColor, 0.08);
        break;
      }

      case 'campfire': {
        const flicker =
          0.5 +
          0.25 * Math.sin(k.cx * 1.4 + t * 5.2) +
          0.25 * Math.cos(k.cx * 2.3 - k.cy * 1.9 + t * 6.8);
        const heat = clamp((k.ny * 1.15) - 0.12 + flicker * 0.42, 0, 1);
        col = sampleGradient(
          [
            { r: 24, g: 4, b: 2 },
            { r: 220, g: 38, b: 16 },
            { r: 249, g: 115, b: 22 },
            { r: 254, g: 240, b: 138 },
          ],
          heat
        );
        break;
      }

      case 'equalizer_demo': {
        const colIdx = clamp(Math.floor(k.cx), 0, 15);
        const level =
          0.25 +
          0.75 *
            Math.abs(
              Math.sin(t * 3.4 + colIdx * 0.6) *
                Math.cos(t * 1.9 - colIdx * 0.35)
            );
        const rowFromBottom = 5 - k.row;
        const barH = level * 6.2;
        const fill = clamp(barH - rowFromBottom, 0, 1);
        col =
          fill > 0.05
            ? scaleRgb(
                sampleGradient(
                  [
                    { r: 14, g: 165, b: 233 },
                    { r: 56, g: 189, b: 248 },
                    { r: 168, g: 85, b: 247 },
                    { r: 244, g: 63, b: 94 },
                  ],
                  rowFromBottom / 5
                ),
                fill
              )
            : { r: 8, g: 12, b: 22 };
        break;
      }

      case 'meteor_shower': {
        const rowSeed = hash(k.row, 2.3) * 1.5;
        const headX = (((t * 1.4 + rowSeed) % 1.4) / 1.4) * (WAVE75_WIDTH_U + 5) - 2;
        const dx = headX - k.cx;
        if (dx >= 0 && dx < 4.5) {
          const tail = Math.pow(1 - dx / 4.5, 2.2);
          col = dx < 0.7 ? { r: 230, g: 248, b: 255 } : scaleRgb(params.primaryColor, tail);
        } else {
          col = { r: 6, g: 10, b: 22 };
        }
        break;
      }

      case 'heartbeat': {
        const scan = (t * 0.65) % 1;
        const dx = (((k.nx - scan) % 1) + 1) % 1;
        const fade = Math.pow(1 - dx, 2.8);
        let ecgY = 0.58;
        const d = k.nx - 0.45;
        if (Math.abs(d) < 0.04) ecgY = 0.12;
        else if (Math.abs(d + 0.05) < 0.03) ecgY = 0.82;
        else if (Math.abs(d - 0.06) < 0.035) ecgY = 0.85;
        const glow = Math.exp(-Math.pow((k.ny - ecgY) * 6.5, 2));
        const thump = 0.18 + 0.35 * Math.pow(Math.max(0, Math.sin(t * 4)), 4);
        col = {
          r: Math.min(255, Math.round(255 * clamp(glow * fade * 1.6 + thump, 0, 1))),
          g: Math.round(45 * glow * fade),
          b: Math.round(105 * clamp(glow * fade + thump * 0.6, 0, 1)),
        };
        break;
      }

      case 'cyberpunk_glitch': {
        const tick = Math.floor(timeMs / 95);
        const glitchRoll = hash(i + tick * 7, 4.9);
        if (glitchRoll > 0.93) {
          col = { r: 255, g: 0, b: 145 };
        } else if (glitchRoll > 0.87) {
          col = { r: 0, g: 245, b: 255 };
        } else {
          const scan = 0.5 + 0.5 * Math.sin(k.ny * 10 - t * 5);
          col = lerpRgb({ r: 22, g: 10, b: 48 }, { r: 10, g: 110, b: 155 }, scan);
        }
        break;
      }

      case 'reactive_ripple': {
        let acc = scaleRgb(params.secondaryColor, 0.1);
        const waveSpd = 6 + params.speed * 1.6;
        for (const imp of activeImpulses) {
          const age = (timeMs - imp.timestampMs) / 1000;
          if (age < 0 || age > 2.2) continue;
          const dist = Math.hypot(k.cx - imp.cx, k.cy - imp.cy);
          const ring = Math.exp(-Math.pow((dist - age * waveSpd) * 1.1, 2));
          const decay = Math.max(0, 1 - age / 2.2);
          const c = params.useRainbow
            ? hsvToRgb({ h: (imp.hue + dist * 22) % 360, s: 100, v: 100 })
            : params.primaryColor;
          acc = blendAdditive(acc, c, ring * decay);
        }
        col = acc;
        break;
      }

      case 'static_solid':
      default: {
        col = params.useRainbow
          ? hsvToRgb({ h: k.nx * 360, s: 100, v: 100 })
          : params.primaryColor;
        break;
      }
    }

    keys[i] = scaleRgb(col, bright);
  }

  // Logo mirrors vibrant accent from center-right wave
  const logo = keys[13] ?? scaleRgb(params.primaryColor, bright);
  return { keys, logo };
}

