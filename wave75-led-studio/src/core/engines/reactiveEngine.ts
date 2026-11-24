import { WAVE75_KEYS, WAVE_KEY_BY_CODE, WAVE75_KEY_COUNT } from '../layout/wave75Layout';
import type { KeyImpulse } from './proceduralEffects';

export class WaveReactiveEngine {
  private pulses: KeyImpulse[] = [];
  private hueStep = 0;

  triggerByCode(code: string, nowMs = performance.now()): void {
    const def = WAVE_KEY_BY_CODE[code];
    if (def) this.triggerByIndex(def.index, nowMs);
  }

  triggerByIndex(keyIndex: number, nowMs = performance.now()): void {
    if (keyIndex < 0 || keyIndex >= WAVE75_KEY_COUNT) return;
    const def = WAVE75_KEYS[keyIndex];
    this.hueStep = (this.hueStep + 41) % 360;
    this.pulses.push({
      keyIndex,
      cx: def.cx,
      cy: def.cy,
      row: def.row,
      timestampMs: nowMs,
      hue: this.hueStep,
    });
    if (this.pulses.length > 40) {
      this.pulses.splice(0, this.pulses.length - 40);
    }
  }

  getPulses(nowMs = performance.now()): KeyImpulse[] {
    this.pulses = this.pulses.filter((p) => nowMs - p.timestampMs < 2400);
    return this.pulses;
  }
}

export const waveReactiveEngine = new WaveReactiveEngine();

