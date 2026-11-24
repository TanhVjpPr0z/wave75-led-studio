import { WIN60HE_KEYS, KEYBOARD_WIDTH_U, KEYBOARD_HEIGHT_U, TOTAL_KEYS } from '../layout/win60heLayout';
import {
  RGB,
  BLACK,
  hsvToRgb,
  lerpRgb,
  scaleRgb,
  blendAdditive,
  clamp,
} from '../utils/color';

export type EffectModeId =
  | 'static'
  | 'breathing'
  | 'rainbow_wave'
  | 'spectrum_cycle'
  | 'reactive_ripple'
  | 'single_key_fade'
  | 'raindrop'
  | 'aurora'
  | 'starlight'
  | 'sine_wave'
  | 'neon_stream'
  | 'dual_gradient_wave'
  | 'laser_row'
  | 'off';

export type EffectDirection =
  | 'left_to_right'
  | 'right_to_left'
  | 'top_to_bottom'
  | 'bottom_to_top'
  | 'outward'
  | 'inward';

export type EffectColorMode = 'solid' | 'dual' | 'rainbow';

export interface EffectParams {
  mode: EffectModeId;
  brightness: number;          // 0..100
  speed: number;               // 1..5
  direction: EffectDirection;
  colorMode: EffectColorMode;
  primaryColor: RGB;
  secondaryColor: RGB;
  sleepTimeoutMinutes: number; // 0 = off, 1, 3, 5, 10, 30
}

export interface EffectDefinition {
  id: EffectModeId;
  hardwareModeId: number; // canonical AULA mode byte id
  isReactive?: boolean;
}

export const PRESET_EFFECTS: EffectDefinition[] = [
  { id: 'static', hardwareModeId: 0x01 },
  { id: 'breathing', hardwareModeId: 0x02 },
  { id: 'rainbow_wave', hardwareModeId: 0x03 },
  { id: 'spectrum_cycle', hardwareModeId: 0x04 },
  { id: 'reactive_ripple', hardwareModeId: 0x05, isReactive: true },
  { id: 'single_key_fade', hardwareModeId: 0x06, isReactive: true },
  { id: 'raindrop', hardwareModeId: 0x07 },
  { id: 'aurora', hardwareModeId: 0x08 },
  { id: 'starlight', hardwareModeId: 0x09 },
  { id: 'sine_wave', hardwareModeId: 0x0a },
  { id: 'neon_stream', hardwareModeId: 0x0b },
  { id: 'dual_gradient_wave', hardwareModeId: 0x0c },
  { id: 'laser_row', hardwareModeId: 0x0d, isReactive: true },
  { id: 'off', hardwareModeId: 0x00 },
];

export interface KeyImpulse {
  keyIndex: number;
  cx: number;
  cy: number;
  row: number;
  timestampMs: number;
  hue: number;
}

// Deterministic pseudo-random helper for raindrop/starlight per key
function hashKey(index: number, seed: number): number {
  const x = Math.sin(index * 127.1 + seed * 311.7) * 43758.5453123;
  return x - Math.floor(x);
}

function getDirectionalCoord(
  nx: number,
  ny: number,
  cx: number,
  cy: number,
  direction: EffectDirection
): number {
  switch (direction) {
    case 'left_to_right':
      return nx;
    case 'right_to_left':
      return 1 - nx;
    case 'top_to_bottom':
      return ny;
    case 'bottom_to_top':
      return 1 - ny;
    case 'outward': {
      const dx = (cx - KEYBOARD_WIDTH_U / 2) / (KEYBOARD_WIDTH_U / 2);
      const dy = (cy - KEYBOARD_HEIGHT_U / 2) / (KEYBOARD_HEIGHT_U / 2);
      return Math.hypot(dx, dy) * 0.7;
    }
    case 'inward': {
      const dx = (cx - KEYBOARD_WIDTH_U / 2) / (KEYBOARD_WIDTH_U / 2);
      const dy = (cy - KEYBOARD_HEIGHT_U / 2) / (KEYBOARD_HEIGHT_U / 2);
      return 1 - Math.hypot(dx, dy) * 0.7;
    }
  }
}

function resolveColor(
  params: EffectParams,
  phase01: number,
  hueOffset = 0
): RGB {
  const p = ((phase01 % 1) + 1) % 1;
  if (params.colorMode === 'solid') {
    return params.primaryColor;
  }
  if (params.colorMode === 'dual') {
    const wave = 0.5 - 0.5 * Math.cos(p * Math.PI * 2);
    return lerpRgb(params.primaryColor, params.secondaryColor, wave);
  }
  return hsvToRgb({ h: (p * 360 + hueOffset) % 360, s: 100, v: 100 });
}

export function renderEffectFrame(
  params: EffectParams,
  timeMs: number,
  impulses: KeyImpulse[] = [],
  lastActivityMs?: number
): RGB[] {
  const frame: RGB[] = new Array<RGB>(TOTAL_KEYS);

  if (params.mode === 'off' || params.brightness <= 0) {
    for (let i = 0; i < TOTAL_KEYS; i++) frame[i] = BLACK;
    return frame;
  }

  // Sleep timer fade-out check
  if (params.sleepTimeoutMinutes > 0 && lastActivityMs !== undefined) {
    const idleMs = timeMs - lastActivityMs;
    const sleepMs = params.sleepTimeoutMinutes * 60_000;
    if (idleMs > sleepMs) {
      for (let i = 0; i < TOTAL_KEYS; i++) frame[i] = BLACK;
      return frame;
    }
  }

  const speedMul = 0.35 + params.speed * 0.4; // speed 1..5 -> 0.75..2.35
  const t = (timeMs / 1000) * speedMul;
  const brightScale = clamp(params.brightness, 0, 100) / 100;

  // If reactive mode has no real impulses recently, synthesize a subtle demo impulse every 2.4s
  let activeImpulses = impulses;
  if (
    (params.mode === 'reactive_ripple' ||
      params.mode === 'single_key_fade' ||
      params.mode === 'laser_row') &&
    impulses.length === 0
  ) {
    const cycle = Math.floor(timeMs / 2200);
    const demoKeyIdx = Math.floor(hashKey(cycle, 7.3) * TOTAL_KEYS);
    const demoKey = WIN60HE_KEYS[demoKeyIdx];
    activeImpulses = [
      {
        keyIndex: demoKeyIdx,
        cx: demoKey.cx,
        cy: demoKey.cy,
        row: demoKey.row,
        timestampMs: cycle * 2200,
        hue: (cycle * 55) % 360,
      },
    ];
  }

  for (let i = 0; i < TOTAL_KEYS; i++) {
    const k = WIN60HE_KEYS[i];
    const dirPos = getDirectionalCoord(k.nx, k.ny, k.cx, k.cy, params.direction);
    let col: RGB = BLACK;

    switch (params.mode) {
      case 'static': {
        if (params.colorMode === 'solid') {
          col = params.primaryColor;
        } else if (params.colorMode === 'dual') {
          col = lerpRgb(params.primaryColor, params.secondaryColor, dirPos);
        } else {
          col = hsvToRgb({ h: dirPos * 360, s: 100, v: 100 });
        }
        break;
      }

      case 'breathing': {
        const breath = 0.1 + 0.9 * (0.5 - 0.5 * Math.cos(t * 1.8));
        const base =
          params.colorMode === 'rainbow'
            ? hsvToRgb({ h: (t * 28) % 360, s: 100, v: 100 })
            : params.colorMode === 'dual'
              ? lerpRgb(params.primaryColor, params.secondaryColor, 0.5 - 0.5 * Math.cos(t * 0.9))
              : params.primaryColor;
        col = scaleRgb(base, breath);
        break;
      }

      case 'rainbow_wave': {
        const phase = dirPos - t * 0.45;
        col =
          params.colorMode === 'dual'
            ? resolveColor(params, phase)
            : hsvToRgb({ h: (((phase * 360) % 360) + 360) % 360, s: 100, v: 100 });
        break;
      }

      case 'spectrum_cycle': {
        const hue = (t * 50) % 360;
        col =
          params.colorMode === 'dual'
            ? resolveColor(params, t * 0.2)
            : hsvToRgb({ h: hue, s: 100, v: 100 });
        break;
      }

      case 'reactive_ripple': {
        const bg = scaleRgb(params.primaryColor, 0.08);
        let acc = bg;
        const waveSpeed = 6 + params.speed * 2.5;
        for (const imp of activeImpulses) {
          const ageSec = (timeMs - imp.timestampMs) / 1000;
          if (ageSec < 0 || ageSec > 2.2) continue;
          const dist = Math.hypot(k.cx - imp.cx, k.cy - imp.cy);
          const radius = ageSec * waveSpeed;
          const ring = Math.exp(-Math.pow((dist - radius) * 1.15, 2));
          const decay = Math.max(0, 1 - ageSec / 2.2);
          const intensity = ring * decay;
          if (intensity > 0.01) {
            const waveColor =
              params.colorMode === 'rainbow'
                ? hsvToRgb({ h: (imp.hue + dist * 25) % 360, s: 100, v: 100 })
                : params.colorMode === 'dual'
                  ? lerpRgb(params.primaryColor, params.secondaryColor, clamp(dist / 10, 0, 1))
                  : params.primaryColor;
            acc = blendAdditive(acc, waveColor, intensity);
          }
        }
        col = acc;
        break;
      }

      case 'single_key_fade': {
        let acc = scaleRgb(params.secondaryColor, 0.05);
        const fadeDuration = Math.max(0.45, 2.0 - params.speed * 0.25);
        for (const imp of activeImpulses) {
          if (imp.keyIndex !== i) continue;
          const ageSec = (timeMs - imp.timestampMs) / 1000;
          if (ageSec < 0 || ageSec > fadeDuration) continue;
          const intensity = Math.pow(1 - ageSec / fadeDuration, 1.5);
          const hitColor =
            params.colorMode === 'rainbow'
              ? hsvToRgb({ h: imp.hue, s: 100, v: 100 })
              : params.primaryColor;
          acc = blendAdditive(acc, hitColor, intensity);
        }
        col = acc;
        break;
      }

      case 'raindrop': {
        // Columns carry falling luminous drops
        const dropPeriod = 1.6;
        const colOffset = hashKey(Math.floor(k.cx), 1.9) * dropPeriod;
        const dropPhase = ((t * 0.9 + colOffset) % dropPeriod) / dropPeriod;
        const dropY = dropPhase * (KEYBOARD_HEIGHT_U + 2.5) - 1.0;
        const dy = dropY - k.cy;
        let intensity = 0;
        if (dy >= 0 && dy < 2.6) {
          intensity = Math.pow(1 - dy / 2.6, 1.8);
        }
        const dropColor =
          params.colorMode === 'rainbow'
            ? hsvToRgb({ h: (k.nx * 240 + t * 30) % 360, s: 90, v: 100 })
            : params.colorMode === 'dual'
              ? lerpRgb(params.primaryColor, params.secondaryColor, k.ny)
              : params.primaryColor;
        col = scaleRgb(dropColor, 0.06 + intensity * 0.94);
        break;
      }

      case 'aurora': {
        const wave1 = Math.sin(k.nx * 4.2 - t * 1.1 + Math.sin(k.ny * 2.5 + t * 0.5));
        const wave2 = Math.cos(k.nx * 2.7 + k.ny * 2.1 + t * 0.75);
        const blend = clamp((wave1 * 0.5 + wave2 * 0.5 + 1) / 2, 0, 1);
        if (params.colorMode === 'solid') {
          col = scaleRgb(params.primaryColor, 0.2 + 0.8 * blend);
        } else if (params.colorMode === 'dual') {
          col = lerpRgb(params.primaryColor, params.secondaryColor, blend);
        } else {
          // Polar Aurora palette: emerald -> cyan -> violet -> magenta
          const hue = 135 + blend * 165;
          const lum = 0.4 + 0.6 * Math.sin(blend * Math.PI);
          col = scaleRgb(hsvToRgb({ h: hue % 360, s: 92, v: 100 }), lum);
        }
        break;
      }

      case 'starlight': {
        const speedOffset = 0.6 + hashKey(i, 3.1) * 1.4;
        const phaseOffset = hashKey(i, 9.7) * Math.PI * 2;
        const twinkle = Math.pow(0.5 + 0.5 * Math.sin(t * speedOffset * 2.4 + phaseOffset), 4);
        const starColor =
          params.colorMode === 'rainbow'
            ? hsvToRgb({ h: (hashKey(i, 5.2) * 360 + t * 20) % 360, s: 75, v: 100 })
            : params.colorMode === 'dual'
              ? lerpRgb(params.primaryColor, params.secondaryColor, hashKey(i, 2.3))
              : params.primaryColor;
        col = blendAdditive(scaleRgb(params.secondaryColor, 0.06), starColor, twinkle);
        break;
      }

      case 'sine_wave': {
        const waveY = 2.5 + Math.sin(k.cx * 0.55 - t * 2.8) * 1.9;
        const distY = Math.abs(k.cy - waveY);
        const intensity = Math.exp(-distY * distY * 0.85);
        const c = resolveColor(params, dirPos - t * 0.25);
        col = scaleRgb(c, 0.08 + intensity * 0.92);
        break;
      }

      case 'neon_stream': {
        const pos = ((dirPos - t * 0.55) % 1 + 1) % 1;
        // Sharp neon comet head + glowing tail
        const beam = Math.pow(1 - pos, 3.0);
        const c =
          params.colorMode === 'solid'
            ? params.primaryColor
            : params.colorMode === 'dual'
              ? lerpRgb(params.primaryColor, params.secondaryColor, pos)
              : hsvToRgb({ h: (pos * 180 + t * 60) % 360, s: 100, v: 100 });
        col = scaleRgb(c, 0.1 + beam * 0.9);
        break;
      }

      case 'dual_gradient_wave': {
        const wave = 0.5 - 0.5 * Math.cos((dirPos * 1.2 - t * 0.5) * Math.PI * 2);
        col = lerpRgb(params.primaryColor, params.secondaryColor, wave);
        break;
      }

      case 'laser_row': {
        let acc = scaleRgb(params.secondaryColor, 0.05);
        const beamSpeed = 14 + params.speed * 4;
        for (const imp of activeImpulses) {
          if (imp.row !== k.row) continue;
          const ageSec = (timeMs - imp.timestampMs) / 1000;
          if (ageSec < 0 || ageSec > 1.4) continue;
          const distX = Math.abs(k.cx - imp.cx);
          const headX = ageSec * beamSpeed;
          const trail = distX <= headX ? Math.exp(-(headX - distX) * 0.45) : 0;
          const decay = Math.max(0, 1 - ageSec / 1.4);
          const intensity = trail * decay;
          if (intensity > 0.01) {
            const laserColor =
              params.colorMode === 'rainbow'
                ? hsvToRgb({ h: (imp.hue + distX * 15) % 360, s: 100, v: 100 })
                : params.primaryColor;
            acc = blendAdditive(acc, laserColor, intensity);
          }
        }
        col = acc;
        break;
      }
    }

    frame[i] = scaleRgb(col, brightScale);
  }

  return frame;
}

