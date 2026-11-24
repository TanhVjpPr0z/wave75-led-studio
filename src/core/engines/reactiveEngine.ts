import { WIN60HE_KEYS, KEY_BY_CODE, TOTAL_KEYS } from '../layout/win60heLayout';
import { RGB, blendAdditive, clamp, hsvToRgb, lerpRgb, scaleRgb } from '../utils/color';

export type ReactiveMode = 'ripple' | 'cross' | 'trail' | 'heatmap';

export interface ReactiveConfig {
  mode: ReactiveMode;
  baseColor: RGB;
  activeColor: RGB;
  rainbowHits: boolean;
  decaySpeed: number; // 1..5
  baseBrightness: number; // 0..100
}

export interface ReactivePulse {
  keyIndex: number;
  cx: number;
  cy: number;
  row: number;
  col: number;
  timestampMs: number;
  hue: number;
}

export interface ReactiveStats {
  totalPresses: number;
  activePressedCount: number;
  mostPressedKeyLabel: string;
  maxKeyCount: number;
  recentKpm: number;
}

export class ReactiveEngine {
  private pulses: ReactivePulse[] = [];
  private pressedKeys: Set<number> = new Set();
  private heatmapCounts: Uint32Array = new Uint32Array(TOTAL_KEYS);
  private recentTimestamps: number[] = [];
  private totalPresses = 0;
  private hueStep = 0;

  triggerKeyByCode(code: string, nowMs = performance.now()): number | null {
    const def = KEY_BY_CODE[code];
    if (!def) return null;
    this.triggerKeyIndex(def.index, nowMs);
    return def.index;
  }

  releaseKeyByCode(code: string): void {
    const def = KEY_BY_CODE[code];
    if (!def) return;
    this.pressedKeys.delete(def.index);
  }

  triggerKeyIndex(keyIndex: number, nowMs = performance.now()): void {
    if (keyIndex < 0 || keyIndex >= TOTAL_KEYS) return;
    const def = WIN60HE_KEYS[keyIndex];
    this.pressedKeys.add(keyIndex);
    this.heatmapCounts[keyIndex]++;
    this.totalPresses++;
    this.recentTimestamps.push(nowMs);
    this.hueStep = (this.hueStep + 37) % 360;

    this.pulses.push({
      keyIndex,
      cx: def.cx,
      cy: def.cy,
      row: def.row,
      col: def.col,
      timestampMs: nowMs,
      hue: this.hueStep,
    });

    if (this.pulses.length > 48) {
      this.pulses.splice(0, this.pulses.length - 48);
    }
  }

  releaseKeyIndex(keyIndex: number): void {
    this.pressedKeys.delete(keyIndex);
  }

  resetHeatmap(): void {
    this.heatmapCounts.fill(0);
    this.totalPresses = 0;
    this.recentTimestamps = [];
  }

  getPulses(nowMs = performance.now()): ReactivePulse[] {
    this.pulses = this.pulses.filter((p) => nowMs - p.timestampMs < 2500);
    return this.pulses;
  }

  getStats(nowMs = performance.now()): ReactiveStats {
    const cutoff = nowMs - 10_000;
    while (this.recentTimestamps.length > 0 && this.recentTimestamps[0] < cutoff) {
      this.recentTimestamps.shift();
    }
    let maxKeyCount = 0;
    let maxKeyIdx = -1;
    for (let i = 0; i < TOTAL_KEYS; i++) {
      if (this.heatmapCounts[i] > maxKeyCount) {
        maxKeyCount = this.heatmapCounts[i];
        maxKeyIdx = i;
      }
    }

    return {
      totalPresses: this.totalPresses,
      activePressedCount: this.pressedKeys.size,
      mostPressedKeyLabel: maxKeyIdx >= 0 ? WIN60HE_KEYS[maxKeyIdx].label : '—',
      maxKeyCount,
      recentKpm: this.recentTimestamps.length * 6,
    };
  }

  renderFrame(config: ReactiveConfig, nowMs: number): RGB[] {
    const activePulses = this.getPulses(nowMs);
    const frame: RGB[] = new Array<RGB>(TOTAL_KEYS);
    const base = scaleRgb(config.baseColor, clamp(config.baseBrightness, 0, 100) / 100);
    const durationSec = Math.max(0.45, 2.2 - config.decaySpeed * 0.32);

    let maxHeat = 1;
    if (config.mode === 'heatmap') {
      for (let i = 0; i < TOTAL_KEYS; i++) {
        if (this.heatmapCounts[i] > maxHeat) maxHeat = this.heatmapCounts[i];
      }
    }

    for (let i = 0; i < TOTAL_KEYS; i++) {
      const k = WIN60HE_KEYS[i];
      let col: RGB = base;

      if (config.mode === 'heatmap') {
        const count = this.heatmapCounts[i];
        if (count > 0) {
          const ratio = clamp(count / maxHeat, 0, 1);
          // Cool blue -> cyan -> yellow -> hot red
          const heatColor =
            ratio < 0.33
              ? lerpRgb({ r: 14, g: 165, b: 233 }, { r: 34, g: 211, b: 238 }, ratio / 0.33)
              : ratio < 0.66
                ? lerpRgb({ r: 34, g: 211, b: 238 }, { r: 250, g: 204, b: 21 }, (ratio - 0.33) / 0.33)
                : lerpRgb({ r: 250, g: 204, b: 21 }, { r: 239, g: 68, b: 68 }, (ratio - 0.66) / 0.34);
          col = blendAdditive(scaleRgb(base, 0.25), heatColor, 0.35 + ratio * 0.65);
        }
        if (this.pressedKeys.has(i)) {
          col = blendAdditive(col, { r: 255, g: 255, b: 255 }, 0.55);
        }
      } else {
        for (const pulse of activePulses) {
          const ageSec = (nowMs - pulse.timestampMs) / 1000;
          if (ageSec < 0 || ageSec > durationSec) continue;
          const decay = Math.pow(1 - ageSec / durationSec, 1.4);
          const accent = config.rainbowHits
            ? hsvToRgb({ h: pulse.hue, s: 100, v: 100 })
            : config.activeColor;

          if (config.mode === 'ripple') {
            const dist = Math.hypot(k.cx - pulse.cx, k.cy - pulse.cy);
            const radius = ageSec * (6.5 + config.decaySpeed * 2.2);
            const ring = Math.exp(-Math.pow((dist - radius) * 1.15, 2));
            col = blendAdditive(col, accent, ring * decay);
          } else if (config.mode === 'cross') {
            const onRow = k.row === pulse.row;
            const onCol = Math.abs(k.cx - pulse.cx) < 0.8;
            if (onRow || onCol) {
              const dist = Math.hypot(k.cx - pulse.cx, k.cy - pulse.cy);
              const reach = ageSec * (11 + config.decaySpeed * 3);
              const wave = dist <= reach ? Math.exp(-(reach - dist) * 0.35) : 0;
              col = blendAdditive(col, accent, wave * decay);
            }
          } else if (config.mode === 'trail') {
            if (pulse.keyIndex === i) {
              col = blendAdditive(col, accent, decay);
            }
          }
        }

        if (this.pressedKeys.has(i)) {
          const holdColor = config.rainbowHits
            ? hsvToRgb({ h: (i * 25 + nowMs * 0.1) % 360, s: 100, v: 100 })
            : config.activeColor;
          col = blendAdditive(col, holdColor, 0.9);
        }
      }

      frame[i] = col;
    }

    return frame;
  }
}

export const sharedReactiveEngine = new ReactiveEngine();

