import { WIN60HE_KEYS, KEYBOARD_WIDTH_U, TOTAL_KEYS } from '../layout/win60heLayout';
import { RGB, BLACK, clamp, sampleGradient, scaleRgb, hsvToRgb } from '../utils/color';

export type AudioSourceType = 'none' | 'microphone' | 'system' | 'demo_beat';

export type AudioVisualizerMode =
  | 'spectrum_bars'
  | 'bass_pulse'
  | 'center_wave'
  | 'frequency_heatmap';

export type AudioPaletteId = 'neon_cyan' | 'fire' | 'rainbow' | 'vaporwave' | 'matrix';

export interface AudioVisualizerConfig {
  mode: AudioVisualizerMode;
  sensitivity: number; // 0.3..3.0
  smoothing: number;   // 0.0..0.95
  palette: AudioPaletteId;
}

const PALETTES: Record<AudioPaletteId, RGB[]> = {
  neon_cyan: [
    { r: 14, g: 165, b: 233 },
    { r: 6, g: 240, b: 255 },
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

export class AudioEngine {
  private audioCtx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private stream: MediaStream | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private freqBins: Uint8Array<ArrayBuffer> = new Uint8Array(new ArrayBuffer(128));
  private smoothedBands: Float32Array = new Float32Array(15);
  private activeSource: AudioSourceType = 'none';

  getSource(): AudioSourceType {
    return this.activeSource;
  }

  async startMicrophone(): Promise<void> {
    this.stop();
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error('Microphone API is unavailable in this browser context.');
    }
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
      },
    });
    this.attachStream(stream, 'microphone');
  }

  async startSystemAudio(): Promise<void> {
    this.stop();
    if (!navigator.mediaDevices?.getDisplayMedia) {
      throw new Error('System/Tab Audio capture is unavailable in this browser.');
    }
    const stream = await navigator.mediaDevices.getDisplayMedia({
      audio: true,
      video: true,
    });
    const audioTracks = stream.getAudioTracks();
    if (audioTracks.length === 0) {
      stream.getTracks().forEach((t) => t.stop());
      throw new Error(
        'No audio track was shared. Please enable "Share tab/system audio" in the prompt.'
      );
    }
    // Keep only audio track active to minimize overhead
    stream.getVideoTracks().forEach((t) => t.stop());
    const audioOnlyStream = new MediaStream(audioTracks);
    this.attachStream(audioOnlyStream, 'system');
  }

  startDemoBeat(): void {
    this.stop();
    this.activeSource = 'demo_beat';
  }

  private attachStream(stream: MediaStream, type: AudioSourceType): void {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.audioCtx = new AudioCtx();
    this.analyser = this.audioCtx.createAnalyser();
    this.analyser.fftSize = 256;
    this.analyser.smoothingTimeConstant = 0.72;
    this.stream = stream;
    this.sourceNode = this.audioCtx.createMediaStreamSource(stream);
    this.sourceNode.connect(this.analyser);
    this.freqBins = new Uint8Array(new ArrayBuffer(this.analyser.frequencyBinCount));
    this.activeSource = type;

    stream.getAudioTracks().forEach((track) => {
      track.addEventListener('ended', () => {
        if (this.stream === stream) {
          this.stop();
        }
      });
    });
  }

  stop(): void {
    this.sourceNode?.disconnect();
    this.sourceNode = null;
    this.analyser?.disconnect();
    this.analyser = null;
    if (this.stream) {
      this.stream.getTracks().forEach((t) => t.stop());
      this.stream = null;
    }
    if (this.audioCtx) {
      this.audioCtx.close().catch(() => {});
      this.audioCtx = null;
    }
    this.smoothedBands.fill(0);
    this.activeSource = 'none';
  }

  /**
   * Computes 15 normalized frequency bands (0..1) mapped across the 15u keyboard width.
   */
  sample15Bands(config: AudioVisualizerConfig, timeMs: number): Float32Array {
    const raw = new Float32Array(15);

    if (this.activeSource === 'demo_beat') {
      // Synthetic 128 BPM electronic beat so users can preview visualizer without mic
      const t = timeMs / 1000;
      const beatPhase = (t * (128 / 60)) % 1;
      const kick = Math.pow(Math.max(0, 1 - beatPhase * 3.2), 2.2);
      const snarePhase = ((t * (128 / 60)) + 0.5) % 1;
      const snare = Math.pow(Math.max(0, 1 - snarePhase * 4.5), 2.5);

      for (let i = 0; i < 15; i++) {
        const bassWeight = Math.exp(-i * 0.45);
        const midWeight = Math.exp(-Math.pow((i - 7) / 3.5, 2));
        const hiWeight = Math.exp(-Math.pow((i - 12.5) / 2.6, 2));
        const synth = 0.25 + 0.25 * Math.sin(t * 4.5 + i * 0.7);
        const val =
          bassWeight * kick * 0.95 +
          midWeight * (snare * 0.7 + synth * 0.45) +
          hiWeight * (0.2 + 0.45 * Math.abs(Math.sin(t * 11 + i * 1.3)));
        raw[i] = clamp(val * config.sensitivity, 0, 1);
      }
    } else if (this.analyser) {
      this.analyser.smoothingTimeConstant = clamp(config.smoothing, 0, 0.95);
      this.analyser.getByteFrequencyData(this.freqBins);
      const binCount = this.freqBins.length;
      // Logarithmic grouping from bass (low bins) to treble (higher bins)
      for (let b = 0; b < 15; b++) {
        const startRatio = Math.pow(b / 15, 1.55);
        const endRatio = Math.pow((b + 1) / 15, 1.55);
        const startBin = Math.min(binCount - 1, Math.floor(startRatio * (binCount * 0.72)));
        const endBin = Math.max(startBin + 1, Math.min(binCount, Math.ceil(endRatio * (binCount * 0.72))));
        let sum = 0;
        for (let j = startBin; j < endBin; j++) {
          sum += this.freqBins[j];
        }
        const avg = sum / ((endBin - startBin) * 255);
        raw[b] = clamp(avg * config.sensitivity * 1.35, 0, 1);
      }
    }

    const alpha = 1 - clamp(config.smoothing, 0, 0.92);
    for (let i = 0; i < 15; i++) {
      this.smoothedBands[i] =
        this.smoothedBands[i] * (1 - alpha) + raw[i] * alpha;
    }

    return this.smoothedBands;
  }

  renderFrame(config: AudioVisualizerConfig, timeMs: number): RGB[] {
    const bands = this.sample15Bands(config, timeMs);
    const frame: RGB[] = new Array<RGB>(TOTAL_KEYS);

    if (this.activeSource === 'none') {
      for (let i = 0; i < TOTAL_KEYS; i++) frame[i] = BLACK;
      return frame;
    }

    const palette = PALETTES[config.palette] ?? PALETTES.neon_cyan;
    const bassLevel = (bands[0] + bands[1] + bands[2]) / 3;
    let totalEnergy = 0;
    for (let i = 0; i < 15; i++) totalEnergy += bands[i];
    totalEnergy /= 15;

    for (let i = 0; i < TOTAL_KEYS; i++) {
      const key = WIN60HE_KEYS[i];
      const colIdx = clamp(Math.floor(key.cx), 0, 14);
      const bandVal = bands[colIdx];
      let col: RGB = BLACK;

      switch (config.mode) {
        case 'spectrum_bars': {
          // Row 4 is bottom (height 0..1), Row 0 is top (height 4..5)
          const barHeight = bandVal * 5.2;
          const rowFromBottom = 4 - key.row;
          const fill = clamp(barHeight - rowFromBottom, 0, 1);
          if (fill > 0.02) {
            const c = sampleGradient(palette, clamp(rowFromBottom / 4, 0, 1));
            col = scaleRgb(c, fill);
          } else {
            col = scaleRgb(palette[0], 0.04);
          }
          break;
        }

        case 'bass_pulse': {
          const base = sampleGradient(palette, clamp(key.nx * 0.7 + bassLevel * 0.3, 0, 1));
          col = scaleRgb(base, 0.08 + Math.pow(bassLevel, 1.2) * 0.92);
          break;
        }

        case 'center_wave': {
          const distFromCenter = Math.abs(key.cx - KEYBOARD_WIDTH_U / 2) / (KEYBOARD_WIDTH_U / 2);
          const waveReach = clamp(totalEnergy * 1.45, 0, 1);
          const intensity = clamp((waveReach - distFromCenter) * 2.8, 0, 1);
          const c = sampleGradient(palette, distFromCenter);
          col = scaleRgb(c, 0.06 + intensity * 0.94);
          break;
        }

        case 'frequency_heatmap': {
          const heat = clamp(bandVal * 0.8 + bassLevel * 0.25, 0, 1);
          const hue = (240 - heat * 240 + 360) % 360;
          col =
            config.palette === 'rainbow'
              ? scaleRgb(hsvToRgb({ h: hue, s: 100, v: 100 }), 0.12 + heat * 0.88)
              : scaleRgb(sampleGradient(palette, heat), 0.1 + heat * 0.9);
          break;
        }
      }

      frame[i] = col;
    }

    return frame;
  }
}

export const sharedAudioEngine = new AudioEngine();

