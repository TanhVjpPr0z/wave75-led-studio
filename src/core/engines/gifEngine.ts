import { parseGIF, decompressFrames } from 'gifuct-js';
import {
  WIN60HE_KEYS,
  KEYBOARD_WIDTH_U,
  KEYBOARD_HEIGHT_U,
  TOTAL_KEYS,
} from '../layout/win60heLayout';
import {
  RGB,
  BLACK,
  ColorAdjustments,
  applyColorAdjustments,
  hsvToRgb,
  clamp,
  clampByte,
} from '../utils/color';

export type FitMode = 'cover' | 'contain' | 'stretch';

export interface DecodedAnimationFrame {
  imageData: ImageData;
  delayMs: number;
}

export interface LoadedMedia {
  id: string;
  name: string;
  width: number;
  height: number;
  frames: DecodedAnimationFrame[];
  isBuiltIn: boolean;
}

export interface BuiltInAnimationPreset {
  id: string;
  nameVi: string;
  nameEn: string;
  previewGradient: string;
}

export const BUILTIN_GIF_PRESETS: BuiltInAnimationPreset[] = [
  {
    id: 'fire',
    nameVi: 'Lửa cháy bùng',
    nameEn: 'Blazing Fire',
    previewGradient: 'linear-gradient(135deg, #450a0a, #ef4444, #f59e0b, #fef08a)',
  },
  {
    id: 'ocean',
    nameVi: 'Sóng đại dương',
    nameEn: 'Ocean Waves',
    previewGradient: 'linear-gradient(135deg, #0c4a6e, #0284c7, #22d3ee, #e0f2fe)',
  },
  {
    id: 'rainbow_bar',
    nameVi: 'Nyan Cầu Vồng',
    nameEn: 'Nyan Rainbow Bar',
    previewGradient: 'linear-gradient(90deg, #ef4444, #f59e0b, #22c55e, #06b6d4, #8b5cf6)',
  },
  {
    id: 'matrix',
    nameVi: 'Mưa Matrix',
    nameEn: 'Matrix Rain',
    previewGradient: 'linear-gradient(180deg, #022c22, #16a34a, #4ade80)',
  },
  {
    id: 'heartbeat',
    nameVi: 'Nhịp tim ECG',
    nameEn: 'Heartbeat Pulse',
    previewGradient: 'linear-gradient(135deg, #1f0a1d, #e11d48, #fb7185)',
  },
  {
    id: 'plasma',
    nameVi: 'Vòng xoáy Plasma',
    nameEn: 'Plasma Vortex',
    previewGradient: 'linear-gradient(135deg, #4c1d95, #ec4899, #06b6d4)',
  },
  {
    id: 'cyber_scan',
    nameVi: 'Quét Cyberpunk',
    nameEn: 'Cyberpunk Scan',
    previewGradient: 'linear-gradient(90deg, #090d16, #06b6d4, #d946ef)',
  },
  {
    id: 'sakura',
    nameVi: 'Hoa Anh Đào',
    nameEn: 'Sakura Drift',
    previewGradient: 'linear-gradient(135deg, #4a1530, #f472b6, #fbcfe8)',
  },
];

export async function decodeMediaFile(file: File): Promise<LoadedMedia> {
  const isGif =
    file.type === 'image/gif' || file.name.toLowerCase().endsWith('.gif');

  if (isGif) {
    const buffer = await file.arrayBuffer();
    const gif = parseGIF(buffer);
    const rawFrames = decompressFrames(gif, true);
    const width = gif.lsd.width || (rawFrames[0]?.dims.width ?? 60);
    const height = gif.lsd.height || (rawFrames[0]?.dims.height ?? 20);

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) throw new Error('Canvas 2D context unavailable');

    const patchCanvas = document.createElement('canvas');
    const patchCtx = patchCanvas.getContext('2d');
    if (!patchCtx) throw new Error('Patch Canvas 2D context unavailable');

    const frames: DecodedAnimationFrame[] = [];
    let previousImageData: ImageData | null = null;

    for (const frame of rawFrames) {
      if (frame.disposalType === 3) {
        previousImageData = ctx.getImageData(0, 0, width, height);
      }

      patchCanvas.width = frame.dims.width;
      patchCanvas.height = frame.dims.height;
      const patchData = patchCtx.createImageData(
        frame.dims.width,
        frame.dims.height
      );
      patchData.data.set(frame.patch);
      patchCtx.putImageData(patchData, 0, 0);

      ctx.drawImage(patchCanvas, frame.dims.left, frame.dims.top);
      const snapshot = ctx.getImageData(0, 0, width, height);

      const delayMs = Math.max(20, frame.delay || 80);
      frames.push({ imageData: snapshot, delayMs });

      if (frame.disposalType === 2) {
        ctx.clearRect(
          frame.dims.left,
          frame.dims.top,
          frame.dims.width,
          frame.dims.height
        );
      } else if (frame.disposalType === 3 && previousImageData) {
        ctx.putImageData(previousImageData, 0, 0);
      }
    }

    if (frames.length === 0) {
      throw new Error('No decodable frames in GIF');
    }

    return {
      id: `upload-${Date.now()}`,
      name: file.name,
      width,
      height,
      frames,
      isBuiltIn: false,
    };
  }

  // Static image (PNG, WEBP, JPG)
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('Failed to load image file'));
      el.src = url;
    });

    const width = Math.min(320, img.naturalWidth || 150);
    const height = Math.min(240, img.naturalHeight || 50);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) throw new Error('Canvas 2D context unavailable');

    ctx.drawImage(img, 0, 0, width, height);
    const snapshot = ctx.getImageData(0, 0, width, height);

    return {
      id: `image-${Date.now()}`,
      name: file.name,
      width,
      height,
      frames: [{ imageData: snapshot, delayMs: 1000 }],
      isBuiltIn: false,
    };
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function generateBuiltInAnimation(presetId: string): LoadedMedia {
  const width = 60;
  const height = 20;
  const frameCount = 36;
  const delayMs = 55;
  const frames: DecodedAnimationFrame[] = [];

  for (let f = 0; f < frameCount; f++) {
    const data = new Uint8ClampedArray(width * height * 4);
    const p = f / frameCount; // 0..1 seamless loop phase
    const angle = p * Math.PI * 2;

    for (let y = 0; y < height; y++) {
      const ny = y / (height - 1);
      for (let x = 0; x < width; x++) {
        const nx = x / (width - 1);
        let r = 0;
        let g = 0;
        let b = 0;

        switch (presetId) {
          case 'fire': {
            const flicker =
              0.5 +
              0.25 * Math.sin(nx * 14 + angle * 2) +
              0.25 * Math.cos(nx * 23 - ny * 9 + angle * 3);
            const heat = clamp((ny * 1.15) - 0.1 + flicker * 0.35, 0, 1);
            r = clampByte(heat * 380);
            g = clampByte(Math.max(0, heat - 0.32) * 340);
            b = clampByte(Math.max(0, heat - 0.72) * 300);
            break;
          }

          case 'ocean': {
            const wave =
              0.5 +
              0.22 * Math.sin(nx * 10 - angle) +
              0.15 * Math.sin(nx * 18 + angle * 2);
            const crest = Math.exp(-Math.pow((ny - wave) * 6, 2));
            const depth = clamp(ny, 0, 1);
            r = clampByte(crest * 220 + (1 - depth) * 10);
            g = clampByte(45 + depth * 120 + crest * 160);
            b = clampByte(110 + depth * 145 + crest * 80);
            break;
          }

          case 'rainbow_bar': {
            const waveOffset = Math.sin(nx * 12 - angle * 2) * 0.12;
            const band = clamp((ny + waveOffset) * 6, 0, 5.99);
            const hue = ((nx * 180 + band * 55 - p * 360) % 360 + 360) % 360;
            const c = hsvToRgb({ h: hue, s: 100, v: 100 });
            r = c.r;
            g = c.g;
            b = c.b;
            break;
          }

          case 'matrix': {
            const colHash = Math.abs(Math.sin(x * 19.37) * 43758.5453) % 1;
            const headY = ((p * 1.5 + colHash) % 1) * 1.35;
            const dist = headY - ny;
            if (dist >= 0 && dist < 0.65) {
              const tail = Math.pow(1 - dist / 0.65, 2.2);
              const isHead = dist < 0.08;
              r = isHead ? 180 : 0;
              g = clampByte(isHead ? 255 : tail * 245);
              b = isHead ? 180 : clampByte(tail * 70);
            } else {
              r = 0;
              g = 12;
              b = 4;
            }
            break;
          }

          case 'heartbeat': {
            const scanX = p;
            const dx = ((nx - scanX) % 1 + 1) % 1;
            const fade = Math.pow(1 - dx, 3.0);
            // ECG spike profile around x=0.45
            let ecgY = 0.55;
            const d = nx - 0.45;
            if (Math.abs(d) < 0.03) ecgY = 0.12;
            else if (Math.abs(d + 0.04) < 0.02) ecgY = 0.78;
            else if (Math.abs(d - 0.05) < 0.03) ecgY = 0.82;
            else if (Math.abs(d - 0.14) < 0.05) ecgY = 0.42;

            const lineDist = Math.abs(ny - ecgY);
            const lineGlow = Math.exp(-lineDist * lineDist * 55);
            const pulse = 0.25 + 0.75 * Math.pow(Math.max(0, Math.sin(angle * 2)), 4);
            r = clampByte(255 * clamp(lineGlow * fade * 1.5 + pulse * 0.22, 0, 1));
            g = clampByte(50 * lineGlow * fade);
            b = clampByte(110 * clamp(lineGlow * fade + pulse * 0.18, 0, 1));
            break;
          }

          case 'plasma': {
            const cx = nx - 0.5;
            const cy = (ny - 0.5) * 0.4;
            const dist = Math.hypot(cx, cy);
            const v1 = Math.sin(nx * 9 + angle);
            const v2 = Math.sin((ny * 6 + Math.cos(angle)) * 1.4);
            const v3 = Math.sin(dist * 18 - angle * 2);
            const hue = (((v1 + v2 + v3) * 60 + 210) % 360 + 360) % 360;
            const c = hsvToRgb({ h: hue, s: 95, v: 98 });
            r = c.r;
            g = c.g;
            b = c.b;
            break;
          }

          case 'cyber_scan': {
            const beam1 = Math.exp(-Math.pow((nx - p) * 10, 2));
            const beam2 = Math.exp(-Math.pow((nx - (1 - p)) * 10, 2));
            const grid = (Math.sin(ny * Math.PI * 5) > 0.7 ? 0.15 : 0);
            r = clampByte(beam2 * 245 + grid * 60);
            g = clampByte(beam1 * 230 + beam2 * 60 + grid * 180);
            b = clampByte(beam1 * 255 + beam2 * 255 + 35);
            break;
          }

          case 'sakura':
          default: {
            const petal1 = Math.sin(nx * 14 + ny * 8 - angle * 2) * 0.5 + 0.5;
            const petal2 = Math.cos(nx * 9 - ny * 11 + angle) * 0.5 + 0.5;
            const sparkle = Math.pow(petal1 * petal2, 2.2);
            r = clampByte(120 + sparkle * 135);
            g = clampByte(35 + sparkle * 175);
            b = clampByte(80 + sparkle * 155);
            break;
          }
        }

        const offset = (y * width + x) * 4;
        data[offset] = r;
        data[offset + 1] = g;
        data[offset + 2] = b;
        data[offset + 3] = 255;
      }
    }

    frames.push({
      imageData: new ImageData(data, width, height),
      delayMs,
    });
  }

  const meta = BUILTIN_GIF_PRESETS.find((p) => p.id === presetId);
  return {
    id: `builtin-${presetId}`,
    name: meta ? meta.nameEn : presetId,
    width,
    height,
    frames,
    isBuiltIn: true,
  };
}

export function sampleImageDataTo61Keys(
  imageData: ImageData,
  fitMode: FitMode,
  adjustments: ColorAdjustments
): RGB[] {
  const { width, height, data } = imageData;
  const kbAspect = KEYBOARD_WIDTH_U / KEYBOARD_HEIGHT_U; // 3.0
  const imgAspect = width / height;

  // Compute source normalized rectangle mapping for cover/contain/stretch
  let scaleX = 1;
  let scaleY = 1;
  let offsetX = 0;
  let offsetY = 0;

  if (fitMode === 'cover') {
    if (imgAspect > kbAspect) {
      // Image wider than keyboard: crop left/right
      scaleX = kbAspect / imgAspect;
      offsetX = (1 - scaleX) / 2;
    } else {
      // Image taller than keyboard: crop top/bottom
      scaleY = imgAspect / kbAspect;
      offsetY = (1 - scaleY) / 2;
    }
  } else if (fitMode === 'contain') {
    if (imgAspect > kbAspect) {
      scaleY = kbAspect / imgAspect;
      offsetY = (1 - scaleY) / 2;
    } else {
      scaleX = imgAspect / kbAspect;
      offsetX = (1 - scaleX) / 2;
    }
  }

  const result: RGB[] = new Array<RGB>(TOTAL_KEYS);

  for (let i = 0; i < TOTAL_KEYS; i++) {
    const key = WIN60HE_KEYS[i];
    let u: number;
    let v: number;

    if (fitMode === 'contain') {
      u = (key.nx - offsetX) / scaleX;
      v = (key.ny - offsetY) / scaleY;
      if (u < 0 || u > 1 || v < 0 || v > 1) {
        result[i] = BLACK;
        continue;
      }
    } else {
      u = offsetX + key.nx * scaleX;
      v = offsetY + key.ny * scaleY;
    }

    // 3x3 area sample around the physical key center (accounting for key width)
    const sampleHalfW = (key.w / KEYBOARD_WIDTH_U) * 0.25 * (fitMode === 'contain' ? 1 / scaleX : scaleX);
    const sampleHalfH = (1 / KEYBOARD_HEIGHT_U) * 0.25 * (fitMode === 'contain' ? 1 / scaleY : scaleY);

    let rSum = 0;
    let gSum = 0;
    let bSum = 0;
    let samples = 0;

    for (let sy = -1; sy <= 1; sy++) {
      for (let sx = -1; sx <= 1; sx++) {
        const su = clamp(u + sx * sampleHalfW, 0, 0.9999);
        const sv = clamp(v + sy * sampleHalfH, 0, 0.9999);
        const px = Math.floor(su * width);
        const py = Math.floor(sv * height);
        const idx = (py * width + px) * 4;
        const alpha = data[idx + 3] / 255;
        rSum += data[idx] * alpha;
        gSum += data[idx + 1] * alpha;
        bSum += data[idx + 2] * alpha;
        samples++;
      }
    }

    const raw: RGB = {
      r: rSum / samples,
      g: gSum / samples,
      b: bSum / samples,
    };

    result[i] = applyColorAdjustments(raw, adjustments);
  }

  return result;
}

