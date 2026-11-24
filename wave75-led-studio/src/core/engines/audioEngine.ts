import { WAVE75_KEYS, WAVE75_KEY_COUNT, WAVE75_WIDTH_U } from '../layout/wave75Layout';
import { RGB, BLACK, clamp, sampleGradient, scaleRgb, hsvToRgb } from '../utils/color';

export type AudioSourceType = 'none' | 'microphone' | 'system' | 'demo_beat';
export type AudioVisualizerMode =
  | 'spectrum_bars'
  | 'bass_pulse'
  | 'center_wave'
  | 'frequency_heatmap';
export type AudioPaletteId = 'neon_cyan' | 'fire' | 'rainbow' | 'vaporwave' | 'matrix';

export interface AudioConfig {
  mode: AudioVisualizerMode;
  sensitivity: number; // 0.3..3.0
  smoothing: number;   // 0.1..0.92
  palette: AudioPaletteId;
}

const PALETTES: Record<AudioPaletteId, RGB[]> = {
  neon_cyan: [
    { r: 14, g: 165, b: 233 },
    { r: 56, g: 240, b: 255 },
    { r: 139, g: 92, b: 246 },
    { r: 236, g: 72, b: 153 },
  ],
  fire: [
    { r: 185, g: 28, b: 28 },
    { r: 249, g: 115, b: 22 },
    { r: 250, g: 204, b: 21 },
    { r: 254, g: 249, b: 195 },
  ],
  rainbow: [
    { r: 255, g: 0, b: 85 },
    { r: 255, g: 180, b: 0 },
    { r: 0, g: 255, b: 120 },
    { r: 0, g: 210, b: 255 },
    { r: 145, g: 70, b: 255 },
  ],
  vaporwave: [
    { r: 255, g: 113, b: 206 },
    { r: 185, g: 103, b: 255 },
    { r: 1, g: 205, b: 254 },
  ],
  matrix: [
    { r: 6, g: 95, b: 70 },
    { r: 16, g: 185, b: 129 },
    { r: 110, g: 231, b: 183 },
  ],
};

export class WaveAudioEngine {
  private audioCtx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private stream: MediaStream | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private freqBins: Uint8Array<ArrayBuffer> = new Uint8Array(new ArrayBuffer(128));
  private smoothedBands = new Float32Array(16);
  private activeSource: AudioSourceType = 'none';

  getSource(): AudioSourceType {
    return this.activeSource;
  }

  async startMicrophone(): Promise<void> {
    this.stop();
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error('Microphone API unavailable.');
    }
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
    });
    this.attachStream(stream, 'microphone');
  }

  async startSystemAudio(): Promise<void> {
    this.stop();
    if (!navigator.mediaDevices?.getDisplayMedia) {
      throw new Error('System / Tab audio capture unavailable.');
    }
    const stream = await navigator.mediaDevices.getDisplayMedia({ audio: true, video: true });
    const audioTracks = stream.getAudioTracks();
    if (audioTracks.length === 0) {
      stream.getTracks().forEach((t) => t.stop());
      throw new Error('No audio track shared. Enable "Share audio" in browser prompt.');
    }
    stream.getVideoTracks().forEach((t) => t.stop());
    this.attachStream(new MediaStream(audioTracks), 'system');
  }

  startDemoBeat(): void {
    this.stop();
    this.activeSource = 'demo_beat';
  }

  private attachStream(stream: MediaStream, src: AudioSourceType): void {
    const Ctx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.audioCtx = new Ctx();
    this.analyser = this.audioCtx.createAnalyser();
    this.analyser.fftSize = 256;
    this.stream = stream;
    this.sourceNode = this.audioCtx.createMediaStreamSource(stream);
    this.sourceNode.connect(this.analyser);
    this.freqBins = new Uint8Array(new ArrayBuffer(this.analyser.frequencyBinCount));
    this.activeSource = src;
    stream.getAudioTracks().forEach((track) => {
      track.addEventListener('ended', () => {
        if (this.stream === stream) this.stop();
      });
    });
  }

  stop(): void {
    this.sourceNode?.disconnect();
    this.sourceNode = null;
    this.analyser?.disconnect();
    this.analyser = null;
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    this.audioCtx?.close().catch(() => {});
    this.audioCtx = null;
    this.smoothedBands.fill(0);
    this.activeSource = 'none';
  }

  sample16Bands(config: AudioConfig, timeMs: number): Float32Array {
    const raw = new Float32Array(16);
    if (this.activeSource === 'demo_beat') {
      const t = timeMs / 1000;
      const beat = (t * (128 / 60)) % 1;
      const kick = Math.pow(Math.max(0, 1 - beat * 3.2), 2.2);
      const snare = Math.pow(Math.max(0, 1 - ((beat + 0.5) % 1) * 4.5), 2.5);
      for (let i = 0; i < 16; i++) {
        const bass = Math.exp(-i * 0.42) * kick * 0.95;
        const mid = Math.exp(-Math.pow((i - 7.5) / 3.6, 2)) * (snare * 0.72 + (0.25 + 0.25 * Math.sin(t * 4.5 + i * 0.7)) * 0.42);
        const hi = Math.exp(-Math.pow((i - 13) / 2.7, 2)) * (0.2 + 0.45 * Math.abs(Math.sin(t * 11 + i)));
        raw[i] = clamp((bass + mid + hi) * config.sensitivity, 0, 1);
      }
    } else if (this.analyser) {
      this.analyser.smoothingTimeConstant = clamp(config.smoothing, 0, 0.92);
      this.analyser.getByteFrequencyData(this.freqBins);
      const count = this.freqBins.length;
      for (let b = 0; b < 16; b++) {
        const s = Math.min(count - 1, Math.floor(Math.pow(b / 16, 1.55) * count * 0.72));
        const e = Math.max(s + 1, Math.min(count, Math.ceil(Math.pow((b + 1) / 16, 1.55) * count * 0.72)));
        let sum = 0;
        for (let j = s; j < e; j++) sum += this.freqBins[j];
        raw[b] = clamp((sum / ((e - s) * 255)) * config.sensitivity * 1.35, 0, 1);
      }
    }

    const alpha = 1 - clamp(config.smoothing, 0, 0.92);
    for (let i = 0; i < 16; i++) {
      this.smoothedBands[i] = this.smoothedBands[i] * (1 - alpha) + raw[i] * alpha;
    }
    return this.smoothedBands;
  }

  renderFrame(config: AudioConfig, timeMs: number): { keys: RGB[]; logo: RGB } {
    const bands = this.sample16Bands(config, timeMs);
    const keys = new Array<RGB>(WAVE75_KEY_COUNT);
    if (this.activeSource === 'none') {
      keys.fill(BLACK);
      return { keys, logo: BLACK };
    }

    const pal = PALETTES[config.palette] ?? PALETTES.neon_cyan;
    const bass = (bands[0] + bands[1] + bands[2]) / 3;
    let avgEnergy = 0;
    for (let i = 0; i < 16; i++) avgEnergy += bands[i];
    avgEnergy /= 16;

    for (let i = 0; i < WAVE75_KEY_COUNT; i++) {
      const k = WAVE75_KEYS[i];
      const colIdx = clamp(Math.floor(k.cx), 0, 15);
      const val = bands[colIdx];
      let col: RGB = BLACK;

      switch (config.mode) {
        case 'spectrum_bars': {
          const rowFromBottom = 5 - k.row;
          const fill = clamp(val * 6.2 - rowFromBottom, 0, 1);
          col =
            fill > 0.02
              ? scaleRgb(sampleGradient(pal, rowFromBottom / 5), fill)
              : scaleRgb(pal[0], 0.04);
          break;
        }
        case 'bass_pulse': {
          const base = sampleGradient(pal, clamp(k.nx * 0.7 + bass * 0.3, 0, 1));
          col = scaleRgb(base, 0.08 + Math.pow(bass, 1.2) * 0.92);
          break;
        }
        case 'center_wave': {
          const dist = Math.abs(k.cx - WAVE75_WIDTH_U / 2) / (WAVE75_WIDTH_U / 2);
          const reach = clamp(avgEnergy * 1.45, 0, 1);
          const intensity = clamp((reach - dist) * 2.8, 0, 1);
          col = scaleRgb(sampleGradient(pal, dist), 0.06 + intensity * 0.94);
          break;
        }
        case 'frequency_heatmap': {
          const heat = clamp(val * 0.8 + bass * 0.25, 0, 1);
          col =
            config.palette === 'rainbow'
              ? scaleRgb(hsvToRgb({ h: (240 - heat * 240 + 360) % 360, s: 100, v: 100 }), 0.12 + heat * 0.88)
              : scaleRgb(sampleGradient(pal, heat), 0.1 + heat * 0.9);
          break;
        }
      }
      keys[i] = col;
    }

    const logo = scaleRgb(sampleGradient(pal, bass), 0.25 + bass * 0.75);
    return { keys, logo };
  }
}

export const waveAudioEngine = new WaveAudioEngine();

