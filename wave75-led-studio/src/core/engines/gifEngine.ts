import { parseGIF, decompressFrames } from 'gifuct-js';
import {
  WAVE75_KEYS,
  WAVE75_KEY_COUNT,
  WAVE75_WIDTH_U,
  WAVE75_HEIGHT_U,
} from '../layout/wave75Layout';
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

export interface DecodedGifFrame {
  imageData: ImageData;
  delayMs: number;
}

export interface LoadedGifMedia {
  id: string;
  name: string;
  width: number;
  height: number;
  frames: DecodedGifFrame[];
  isBuiltIn: boolean;
}

export type GifCategory = 'all' | 'red_edition' | 'love' | 'unique' | 'cyber' | 'nature' | 'party';

export interface BuiltInGifPreset {
  id: string;
  nameVi: string;
  nameEn: string;
  icon: string;
  category: Exclude<GifCategory, 'all'>;
  isNew?: boolean;
  previewGradient: string;
}

export const GIF_CATEGORIES: Array<{
  id: GifCategory;
  nameVi: string;
  nameEn: string;
  icon: string;
}> = [
  { id: 'all', nameVi: 'Tất cả', nameEn: 'All', icon: '✦' },
  { id: 'red_edition', nameVi: 'Hợp Phím Đỏ', nameEn: 'Red Case Edition', icon: '🔴' },
  { id: 'love', nameVi: 'Trái tim', nameEn: 'Love & Hearts', icon: '❤️' },
  { id: 'unique', nameVi: 'Độc lạ', nameEn: 'Unique Art', icon: '✨' },
  { id: 'cyber', nameVi: 'Cyber & Game', nameEn: 'Cyber & Game', icon: '🎮' },
  { id: 'nature', nameVi: 'Thiên nhiên', nameEn: 'Nature & Space', icon: '🌌' },
  { id: 'party', nameVi: 'Lễ hội', nameEn: 'Party & Fun', icon: '🎉' },
];

export const BUILTIN_WAVE_GIFS: BuiltInGifPreset[] = [
  // 🔴 RED CASE EDITION — TUNED FOR ANODIZED RED WAVE75 (8)
  {
    id: 'red_samurai_slash',
    nameVi: 'Kiếm Samurai Trắng-Đỏ',
    nameEn: 'Crimson Katana Slash',
    icon: '⚔️',
    category: 'red_edition',
    isNew: true,
    previewGradient: 'linear-gradient(135deg, #450a0a, #dc2626, #ffffff, #991b1b)',
  },
  {
    id: 'red_ironman_arc',
    nameVi: 'Iron Man Đỏ-Vàng-Arc',
    nameEn: 'Iron Man Gold & Arc',
    icon: '🦾',
    category: 'red_edition',
    isNew: true,
    previewGradient: 'linear-gradient(135deg, #7f1d1d, #dc2626, #facc15, #38bdf8)',
  },
  {
    id: 'red_gold_dragon',
    nameVi: 'Hoàng Kim Huyết Đỏ',
    nameEn: 'Imperial Red & Gold',
    icon: '👑',
    category: 'red_edition',
    isNew: true,
    previewGradient: 'linear-gradient(135deg, #5c0612, #b91c1c, #fbbf24, #fef08a)',
  },
  {
    id: 'red_obsidian_magma',
    nameVi: 'Dung Nham Đỏ Đen',
    nameEn: 'Obsidian Magma Veins',
    icon: '🌋',
    category: 'red_edition',
    isNew: true,
    previewGradient: 'linear-gradient(135deg, #09090b, #7f1d1d, #ef4444, #f59e0b)',
  },
  {
    id: 'red_sharingan',
    nameVi: 'Huyết Nhãn Sharingan',
    nameEn: 'Crimson Vortex Eye',
    icon: '👁️',
    category: 'red_edition',
    isNew: true,
    previewGradient: 'linear-gradient(135deg, #09090b, #dc2626, #18181b, #ef4444)',
  },
  {
    id: 'red_blood_moon',
    nameVi: 'Nhật Thực Trăng Máu',
    nameEn: 'Blood Moon Eclipse',
    icon: '🌑',
    category: 'red_edition',
    isNew: true,
    previewGradient: 'linear-gradient(135deg, #180308, #b91c1c, #f8fafc, #7f1d1d)',
  },
  {
    id: 'red_ferrari_rpm',
    nameVi: 'Vòng Tua Siêu Xe F1',
    nameEn: 'Rosso F1 Tachometer',
    icon: '🏁',
    category: 'red_edition',
    isNew: true,
    previewGradient: 'linear-gradient(90deg, #7f1d1d, #dc2626, #f59e0b, #ffffff)',
  },
  {
    id: 'red_ruby_heart',
    nameVi: 'Trái Tim Kim Cương Đỏ',
    nameEn: 'Ruby Diamond Heart',
    icon: '♦️',
    category: 'red_edition',
    isNew: true,
    previewGradient: 'linear-gradient(135deg, #4c0519, #e11d48, #ffffff, #fde047)',
  },

  // ❤️ LOVE & HEARTS (6)
  {
    id: 'heart_beat',
    nameVi: 'Trái tim Neon đập',
    nameEn: 'Neon Beating Heart',
    icon: '❤️',
    category: 'love',
    isNew: true,
    previewGradient: 'linear-gradient(135deg, #2b061e, #e11d48, #fb7185, #fbcfe8)',
  },
  {
    id: 'heart_radar',
    nameVi: 'Sóng tim lan tỏa',
    nameEn: 'Heart Shockwave',
    icon: '💓',
    category: 'love',
    isNew: true,
    previewGradient: 'linear-gradient(135deg, #3b0764, #ec4899, #f43f5e, #fde047)',
  },
  {
    id: 'heart_rain',
    nameVi: 'Mưa trái tim bay',
    nameEn: 'Floating Hearts',
    icon: '💕',
    category: 'love',
    isNew: true,
    previewGradient: 'linear-gradient(180deg, #4c0519, #be123c, #f472b6, #fce7f3)',
  },
  {
    id: 'heart_split',
    nameVi: 'Hai trái tim hội tụ',
    nameEn: 'Twin Hearts Merge',
    icon: '💞',
    category: 'love',
    isNew: true,
    previewGradient: 'linear-gradient(90deg, #06b6d4, #ec4899, #f43f5e, #a855f7)',
  },
  {
    id: 'love_gradient',
    nameVi: 'Lụa hồng Yêu thương',
    nameEn: 'Valentine Silk',
    icon: '🌸',
    category: 'love',
    isNew: true,
    previewGradient: 'linear-gradient(135deg, #831843, #f472b6, #fb923c, #fde68a)',
  },
  {
    id: 'heartbeat',
    nameVi: 'Nhịp tim ECG',
    nameEn: 'ECG Heartbeat',
    icon: '📈',
    category: 'love',
    previewGradient: 'linear-gradient(135deg, #1f0a1d, #e11d48, #fb7185)',
  },

  // ✨ UNIQUE & ART (8)
  {
    id: 'dna_helix',
    nameVi: 'Xoắn kép DNA Neon',
    nameEn: 'Neon DNA Helix',
    icon: '🧬',
    category: 'unique',
    isNew: true,
    previewGradient: 'linear-gradient(90deg, #020617, #06b6d4, #f8fafc, #ec4899)',
  },
  {
    id: 'black_hole',
    nameVi: 'Hố đen Vũ trụ',
    nameEn: 'Cosmic Black Hole',
    icon: '🕳️',
    category: 'unique',
    isNew: true,
    previewGradient: 'linear-gradient(135deg, #020617, #7c2d12, #f97316, #fde047)',
  },
  {
    id: 'dragon_breath',
    nameVi: 'Rồng Lửa & Băng',
    nameEn: 'Fire vs Ice Clash',
    icon: '🐉',
    category: 'unique',
    isNew: true,
    previewGradient: 'linear-gradient(90deg, #0284c7, #38bdf8, #ffffff, #f97316, #dc2626)',
  },
  {
    id: 'lava_lamp',
    nameVi: 'Đèn Dung Nham 3D',
    nameEn: '3D Lava Metaballs',
    icon: '🫧',
    category: 'unique',
    isNew: true,
    previewGradient: 'linear-gradient(135deg, #3b0764, #db2777, #f97316, #facc15)',
  },
  {
    id: 'portal_wormhole',
    nameVi: 'Cổng Không Gian',
    nameEn: 'Hyperspace Portal',
    icon: '🌀',
    category: 'unique',
    isNew: true,
    previewGradient: 'linear-gradient(135deg, #090d16, #06b6d4, #6366f1, #f97316)',
  },
  {
    id: 'kaleidoscope',
    nameVi: 'Kính Vạn Hoa',
    nameEn: 'Neon Kaleidoscope',
    icon: '💎',
    category: 'unique',
    isNew: true,
    previewGradient: 'linear-gradient(135deg, #4c1d95, #06b6d4, #10b981, #f43f5e)',
  },
  {
    id: 'radar_sonar',
    nameVi: 'Radar Tàu Ngầm',
    nameEn: 'Tactical Sonar',
    icon: '📡',
    category: 'unique',
    isNew: true,
    previewGradient: 'linear-gradient(135deg, #022c22, #059669, #34d399, #bbf7d0)',
  },
  {
    id: 'pac_chase',
    nameVi: 'Rượt đuổi Pac-Man',
    nameEn: 'Arcade Chaser',
    icon: '👾',
    category: 'unique',
    isNew: true,
    previewGradient: 'linear-gradient(90deg, #0f172a, #facc15, #ef4444, #22d3ee, #f472b6)',
  },

  // 🎮 CYBER & GAMING (7)
  {
    id: 'police_strobe',
    nameVi: 'Đèn Cảnh Sát / Siêu Xe',
    nameEn: 'Hypercar Strobe',
    icon: '🚨',
    category: 'cyber',
    isNew: true,
    previewGradient: 'linear-gradient(90deg, #dc2626, #ef4444, #ffffff, #2563eb, #1d4ed8)',
  },
  {
    id: 'rgb_knight',
    nameVi: 'Quét Laser Siêu Xe',
    nameEn: 'KITT Hyper Scanner',
    icon: '🏎️',
    category: 'cyber',
    isNew: true,
    previewGradient: 'linear-gradient(90deg, #18040a, #991b1b, #ef4444, #fca5a5)',
  },
  {
    id: 'tetris_blocks',
    nameVi: 'Khối Neon Rơi',
    nameEn: 'Cyber Blocks Drop',
    icon: '🧱',
    category: 'cyber',
    isNew: true,
    previewGradient: 'linear-gradient(135deg, #0f172a, #06b6d4, #a855f7, #f59e0b)',
  },
  {
    id: 'glitch_cyber',
    nameVi: 'Nhiễu Sóng Glitch',
    nameEn: 'Cyberpunk Glitch',
    icon: '⚡',
    category: 'cyber',
    isNew: true,
    previewGradient: 'linear-gradient(90deg, #090d16, #22d3ee, #f43f5e, #e879f9)',
  },
  {
    id: 'cyber',
    nameVi: 'Quét Laser Cyberpunk',
    nameEn: 'Cyberpunk Laser',
    icon: '🤖',
    category: 'cyber',
    previewGradient: 'linear-gradient(90deg, #090d16, #06b6d4, #d946ef)',
  },
  {
    id: 'matrix',
    nameVi: 'Mưa mã Matrix',
    nameEn: 'Matrix Code Rain',
    icon: '💻',
    category: 'cyber',
    previewGradient: 'linear-gradient(180deg, #022c22, #16a34a, #4ade80)',
  },
  {
    id: 'synthwave',
    nameVi: 'Hoàng hôn Synthwave',
    nameEn: 'Synthwave Sunset',
    icon: '🌆',
    category: 'cyber',
    previewGradient: 'linear-gradient(180deg, #1e1b4b, #db2777, #f97316, #facc15)',
  },

  // 🌌 NATURE & SPACE (8)
  {
    id: 'meteor_shower',
    nameVi: 'Mưa Sao Băng',
    nameEn: 'Meteor Shower',
    icon: '🌠',
    category: 'nature',
    isNew: true,
    previewGradient: 'linear-gradient(135deg, #020617, #1e3a8a, #38bdf8, #fef08a)',
  },
  {
    id: 'waterfall',
    nameVi: 'Thác Nước Phát Sáng',
    nameEn: 'Neon Waterfall',
    icon: '💧',
    category: 'nature',
    isNew: true,
    previewGradient: 'linear-gradient(180deg, #083344, #06b6d4, #67e8f9, #ecfeff)',
  },
  {
    id: 'ocean',
    nameVi: 'Sóng đại dương WAVE',
    nameEn: 'Ocean Wave',
    icon: '🌊',
    category: 'nature',
    previewGradient: 'linear-gradient(135deg, #0c4a6e, #0284c7, #22d3ee, #e0f2fe)',
  },
  {
    id: 'fire',
    nameVi: 'Lửa trại bùng cháy',
    nameEn: 'Blazing Campfire',
    icon: '🔥',
    category: 'nature',
    previewGradient: 'linear-gradient(135deg, #450a0a, #ef4444, #f59e0b, #fef08a)',
  },
  {
    id: 'sakura',
    nameVi: 'Hoa Anh Đào rơi',
    nameEn: 'Sakura Petals',
    icon: '🌺',
    category: 'nature',
    previewGradient: 'linear-gradient(135deg, #4a1530, #f472b6, #fbcfe8)',
  },
  {
    id: 'aurora',
    nameVi: 'Cực quang Bắc Cực',
    nameEn: 'Polar Aurora',
    icon: '🌌',
    category: 'nature',
    previewGradient: 'linear-gradient(135deg, #064e3b, #10b981, #06b6d4, #8b5cf6)',
  },
  {
    id: 'galaxy',
    nameVi: 'Xoáy Vũ Trụ Galaxy',
    nameEn: 'Galaxy Spiral',
    icon: '🪐',
    category: 'nature',
    previewGradient: 'linear-gradient(135deg, #0f172a, #4f46e5, #a855f7, #38bdf8)',
  },
  {
    id: 'lightning',
    nameVi: 'Sấm sét Neon',
    nameEn: 'Neon Storm',
    icon: '⛈️',
    category: 'nature',
    previewGradient: 'linear-gradient(135deg, #090d16, #2563eb, #38bdf8, #e0f2fe)',
  },

  // 🎉 PARTY & FUN (5)
  {
    id: 'fireworks',
    nameVi: 'Pháo Hoa Đêm Hội',
    nameEn: 'Festival Fireworks',
    icon: '🎆',
    category: 'party',
    isNew: true,
    previewGradient: 'linear-gradient(135deg, #090d16, #f43f5e, #facc15, #22d3ee)',
  },
  {
    id: 'disco_floor',
    nameVi: 'Sàn Nhảy Disco 80s',
    nameEn: 'Retro Disco Tiles',
    icon: '🪩',
    category: 'party',
    isNew: true,
    previewGradient: 'linear-gradient(135deg, #7e22ce, #ec4899, #eab308, #06b6d4)',
  },
  {
    id: 'vietnam_wave',
    nameVi: 'Cờ Đỏ Sao Vàng',
    nameEn: 'Vietnam Flag Wave',
    icon: '⭐',
    category: 'party',
    isNew: true,
    previewGradient: 'linear-gradient(135deg, #991b1b, #dc2626, #facc15, #dc2626)',
  },
  {
    id: 'rainbow',
    nameVi: 'Nyan Cầu Vồng',
    nameEn: 'Nyan Rainbow',
    icon: '🌈',
    category: 'party',
    previewGradient: 'linear-gradient(90deg, #ef4444, #f59e0b, #22c55e, #06b6d4, #8b5cf6)',
  },
  {
    id: 'plasma',
    nameVi: 'Vòng xoáy Plasma',
    nameEn: 'Plasma Vortex',
    icon: '🔮',
    category: 'party',
    previewGradient: 'linear-gradient(135deg, #4c1d95, #ec4899, #06b6d4)',
  },
];

export async function decodeGifOrImage(file: File): Promise<LoadedGifMedia> {
  const isGif = file.type === 'image/gif' || file.name.toLowerCase().endsWith('.gif');

  if (isGif) {
    const buffer = await file.arrayBuffer();
    const gif = parseGIF(buffer);
    const rawFrames = decompressFrames(gif, true);
    const width = gif.lsd.width || (rawFrames[0]?.dims.width ?? 64);
    const height = gif.lsd.height || (rawFrames[0]?.dims.height ?? 24);

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) throw new Error('Canvas 2D unavailable');

    const patchCanvas = document.createElement('canvas');
    const patchCtx = patchCanvas.getContext('2d');
    if (!patchCtx) throw new Error('Patch canvas unavailable');

    const frames: DecodedGifFrame[] = [];
    let prevSnapshot: ImageData | null = null;

    for (const f of rawFrames) {
      if (f.disposalType === 3) {
        prevSnapshot = ctx.getImageData(0, 0, width, height);
      }

      patchCanvas.width = f.dims.width;
      patchCanvas.height = f.dims.height;
      const patch = patchCtx.createImageData(f.dims.width, f.dims.height);
      patch.data.set(f.patch);
      patchCtx.putImageData(patch, 0, 0);

      ctx.drawImage(patchCanvas, f.dims.left, f.dims.top);
      frames.push({
        imageData: ctx.getImageData(0, 0, width, height),
        delayMs: Math.max(20, f.delay || 80),
      });

      if (f.disposalType === 2) {
        ctx.clearRect(f.dims.left, f.dims.top, f.dims.width, f.dims.height);
      } else if (f.disposalType === 3 && prevSnapshot) {
        ctx.putImageData(prevSnapshot, 0, 0);
      }
    }

    if (frames.length === 0) throw new Error('GIF contains no decodable frames');
    return {
      id: `gif-${Date.now()}`,
      name: file.name,
      width,
      height,
      frames,
      isBuiltIn: false,
    };
  }

  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('Failed to load image'));
      el.src = url;
    });
    const width = Math.min(320, img.naturalWidth || 160);
    const height = Math.min(240, img.naturalHeight || 60);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) throw new Error('Canvas 2D unavailable');
    ctx.drawImage(img, 0, 0, width, height);
    return {
      id: `img-${Date.now()}`,
      name: file.name,
      width,
      height,
      frames: [{ imageData: ctx.getImageData(0, 0, width, height), delayMs: 1000 }],
      isBuiltIn: false,
    };
  } finally {
    URL.revokeObjectURL(url);
  }
}

const builtInGifCache = new Map<string, LoadedGifMedia>();

/** Implicit heart shape: <= 0 inside the heart (hx, hy isotropic with +hy UP). */
function heartImplicit(hx: number, hy: number): number {
  const a = hx * hx + hy * hy - 1;
  return a * a * a - hx * hx * hy * hy * hy;
}

/** Deterministic pseudo-random in [0, 1). */
function hash1(n: number): number {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453123;
  return x - Math.floor(x);
}

/** Exact 5-point star test (+hy UP, tip pointing straight up). Returns <= 0 inside star. */
function star5Dist(hx: number, hy: number, outerR: number): number {
  const r = Math.hypot(hx, hy);
  if (r < 1e-6) return -outerR;
  const theta = Math.atan2(hx, hy); // 0 = straight up
  const sector = (Math.PI * 2) / 5;
  const halfSector = Math.PI / 5;
  const local = (((theta + halfSector) % sector) + sector) % sector - halfSector;
  const a = Math.abs(local);
  const innerR = outerR * 0.381966; // sin(18deg)/sin(54deg)
  const rEdge =
    (outerR * innerR * Math.sin(halfSector)) /
    (outerR * Math.sin(a) + innerR * Math.sin(halfSector - a));
  return r - rEdge;
}

export function generateBuiltInWaveGif(presetId: string): LoadedGifMedia {
  const cached = builtInGifCache.get(presetId);
  if (cached) return cached;

  const width = 64;
  const height = 24;
  const frameCount = 36;
  const delayMs = 55;
  const frames: DecodedGifFrame[] = [];

  for (let f = 0; f < frameCount; f++) {
    const data = new Uint8ClampedArray(width * height * 4);
    const p = f / frameCount;
    const angle = p * Math.PI * 2;

    // Realistic double-thump lub-dub heartbeat curve in [0, 1]
    const lub = Math.exp(-Math.pow((p - 0.16) / 0.065, 2));
    const dub = 0.72 * Math.exp(-Math.pow((p - 0.34) / 0.075, 2));
    const heartPulse = clamp(lub + dub, 0, 1);

    for (let y = 0; y < height; y++) {
      const ny = y / (height - 1);
      // Isotropic coords: sx in [-1.333, 1.333], sy in [-1, 1] (+sy UP)
      const sy = (0.5 - ny) * 2.0;

      for (let x = 0; x < width; x++) {
        const nx = x / (width - 1);
        const sx = (nx - 0.5) * (width / height) * 2.0 * 0.5; // [-1.333, 1.333]
        let r = 0;
        let g = 0;
        let b = 0;

        switch (presetId) {
          /* ================= 🔴 RED CASE EDITION ================= */
          case 'red_samurai_slash': {
            // Deep anodized velvet crimson + blinding ice-white diagonal katana slashes + sparks
            const baseWave = 0.55 + 0.25 * Math.sin(nx * 5 - angle) + 0.15 * Math.cos(ny * 4 + angle);
            // Slash 1 (top-left -> bottom-right) at p in [0.15..0.55], Slash 2 (reverse) at p in [0.65..1.0]
            const s1Phase = clamp((p - 0.10) / 0.32, 0, 1);
            const s1Fade = p >= 0.10 && p < 0.52 ? Math.sin(clamp((p - 0.10) / 0.42, 0, 1) * Math.PI) : 0;
            const diag1 = (nx * 1.15 - ny * 0.48) - (s1Phase * 1.65 - 0.35);
            const blade1 = Math.exp(-Math.pow(diag1 * 18, 2)) * s1Fade;

            const s2Phase = clamp((p - 0.58) / 0.32, 0, 1);
            const s2Fade = p >= 0.58 && p <= 0.98 ? Math.sin(clamp((p - 0.58) / 0.40, 0, 1) * Math.PI) : 0;
            const diag2 = ((1 - nx) * 1.15 - ny * 0.48) - (s2Phase * 1.65 - 0.35);
            const blade2 = Math.exp(-Math.pow(diag2 * 18, 2)) * s2Fade;

            const blade = Math.min(1, blade1 + blade2);
            const embers =
              Math.pow(Math.max(0, Math.sin(nx * 31 + angle * 2) * Math.cos(ny * 19 + angle * 3)), 10);

            r = clampByte(115 * baseWave + 65 + blade * 255 + embers * 255);
            g = clampByte(6 + blade * 245 + embers * 120);
            b = clampByte(12 + blade * 255 + embers * 95);
            break;
          }

          case 'red_ironman_arc': {
            // Hot-Rod Red & 24K Gold metallic armor sweep + glowing Ice-Cyan Arc Reactor in center!
            const rad = Math.hypot(sx, sy);
            const arcPulse = 0.78 + 0.22 * Math.sin(angle * 2);
            const arcCore = Math.exp(-rad * rad * 18) * arcPulse;
            const arcRing = Math.exp(-Math.pow((rad - 0.42) * 16, 2)) * arcPulse;
            const arcTotal = clamp(arcCore + arcRing * 0.95, 0, 1);

            // Sweeping golden armor bands on left & right wings
            const goldBand = Math.pow(
              clamp(Math.sin(Math.abs(sx) * 4.5 - angle * 2) * 0.5 + 0.5, 0, 1),
              3.0,
            );
            const wingMask = clamp((rad - 0.48) * 2.5, 0, 1);

            const baseR = 190 + goldBand * wingMask * 65;
            const baseG = 12 + goldBand * wingMask * 178;
            const baseB = 8 + goldBand * wingMask * 20;

            r = clampByte(baseR * (1 - arcTotal * 0.65) + arcCore * 225 + arcRing * 95);
            g = clampByte(baseG * (1 - arcTotal * 0.55) + arcCore * 250 + arcRing * 235);
            b = clampByte(baseB * (1 - arcTotal * 0.55) + arcTotal * 255);
            break;
          }

          case 'red_gold_dragon': {
            // Royal Imperial Crimson silk + flowing 24K molten gold ribbon wave + warm gold dust
            const waveY = 0.5 + 0.28 * Math.sin(nx * 6.5 - angle * 2) + 0.10 * Math.cos(nx * 11 + angle);
            const ribbon = Math.exp(-Math.pow((ny - waveY) * 6.2, 2));
            const ribbonCore = Math.exp(-Math.pow((ny - waveY) * 14, 2));
            const crimsonSilk = 0.6 + 0.4 * Math.sin(nx * 4.5 + ny * 3 - angle);
            const goldDust =
              Math.pow(Math.max(0, Math.sin(nx * 36 - angle * 2) * Math.sin(ny * 22 + angle * 3)), 10);

            r = clampByte(130 + crimsonSilk * 85 + ribbon * 255 + goldDust * 255);
            g = clampByte(8 + ribbon * 190 + ribbonCore * 60 + goldDust * 215);
            b = clampByte(10 + ribbonCore * 110 + goldDust * 70);
            break;
          }

          case 'red_obsidian_magma': {
            // Stealth dark obsidian carbon surface with glowing slow-breathing molten red-gold magma veins
            const v1 = Math.sin(nx * 9.5 + Math.sin(ny * 5 + angle) * 1.4 - angle);
            const v2 = Math.cos(ny * 7.5 - Math.cos(nx * 6 - angle) * 1.2 + angle);
            const crack = Math.exp(-Math.pow((v1 + v2) * 3.8, 2));
            const breath = 0.72 + 0.28 * Math.sin(angle * 2 + nx * 3);
            const heat = clamp(crack * breath, 0, 1);

            r = clampByte(18 + heat * 255);
            g = clampByte(2 + Math.pow(heat, 1.8) * 165);
            b = clampByte(4 + Math.pow(heat, 3.2) * 55);
            break;
          }

          case 'red_sharingan': {
            // Hypnotic spinning crimson-red & pitch-black 3-tomoe chakra vortex
            const rad = Math.hypot(sx, sy);
            const theta = Math.atan2(sy, sx) - angle; // smooth clockwise rotation
            const pupil = rad < 0.20 ? 1 : 0;
            const ringBand = Math.exp(-Math.pow((rad - 0.54) * 18, 2));
            // 3 rotating dark tomoe orbs along the iris ring
            let tomoeDark = 0;
            for (let k = 0; k < 3; k++) {
              const ta = angle + (k * Math.PI * 2) / 3;
              const tx = 0.54 * Math.cos(ta);
              const ty = 0.54 * Math.sin(ta);
              const td = Math.hypot(sx - tx, sy - ty);
              if (td < 0.16) tomoeDark = Math.max(tomoeDark, 1 - td / 0.16);
            }
            const aura = 0.55 + 0.45 * Math.sin(theta * 3 - rad * 6);
            const outerFade = clamp(1.15 - rad * 0.55, 0.2, 1);
            const darkMask = clamp(pupil + tomoeDark * 1.2 + ringBand * 0.65, 0, 1);

            r = clampByte((165 + aura * 90) * outerFade * (1 - darkMask * 0.92));
            g = clampByte(8 * outerFade * (1 - darkMask) + (rad < 0.08 ? 220 : 0));
            b = clampByte(10 * outerFade * (1 - darkMask) + (rad < 0.08 ? 220 : 0));
            break;
          }

          case 'red_blood_moon': {
            // Pitch-black eclipse moon core + blazing ruby-red & pure silver-white corona + embers
            const rad = Math.hypot(sx, sy);
            const theta = Math.atan2(sy, sx);
            const moonR = 0.42;
            const flare = 0.75 + 0.25 * Math.sin(theta * 5 + angle * 2) + 0.15 * Math.cos(theta * 9 - angle * 3);

            if (rad < moonR) {
              const rim = Math.exp(-Math.pow((moonR - rad) * 24, 2));
              r = clampByte(14 + rim * 240);
              g = clampByte(2 + rim * 180);
              b = clampByte(5 + rim * 180);
            } else {
              const whiteCorona = Math.exp(-Math.pow((rad - moonR - 0.03) * 17, 2)) * flare;
              const redCorona = Math.exp(-Math.pow((rad - moonR) * 2.4, 2)) * flare;
              const driftEmber =
                Math.pow(Math.max(0, Math.sin(nx * 28 - angle * 2) * Math.cos(ny * 18 + angle * 2)), 10);
              r = clampByte(24 + redCorona * 235 + whiteCorona * 255 + driftEmber * 255);
              g = clampByte(4 + whiteCorona * 235 + driftEmber * 90);
              b = clampByte(8 + whiteCorona * 245 + driftEmber * 85);
            }
            break;
          }

          case 'red_ferrari_rpm': {
            // Rosso Corsa F1 Cockpit Tachometer: roaring left->right rev sweep + crisp white shift flash!
            const revCycle = (p * 1.15) % 1;
            const revFill = revCycle < 0.82 ? Math.pow(revCycle / 0.82, 0.75) : 1.0;
            const isShiftFlash = revCycle >= 0.82 && Math.floor(p * 24) % 2 === 0;
            const centerBand = Math.exp(-Math.pow((ny - 0.5) * 3.0, 2));

            if (isShiftFlash) {
              // Blinding crisp white + crimson F1 shift-up flash!
              r = 255;
              g = clampByte(195 + centerBand * 60);
              b = clampByte(195 + centerBand * 60);
            } else if (nx <= revFill) {
              // RPM gradient: Deep Red -> Hot Orange -> 24K Gold -> White Peak tip
              const tip = Math.exp(-Math.pow((nx - revFill) * 16, 2));
              const ratio = nx;
              r = 255;
              g = clampByte((ratio < 0.55 ? 25 + ratio * 190 : 185 - (ratio - 0.55) * 360) * (0.55 + 0.45 * centerBand) + tip * 245);
              b = clampByte(tip * 255 + (ratio > 0.8 ? (ratio - 0.8) * 180 : 0));
            } else {
              // Rich Rosso Corsa idling crimson glow
              r = clampByte(55 + centerBand * 45);
              g = 4;
              b = 6;
            }
            break;
          }

          case 'red_ruby_heart': {
            // Color-graded specifically for a RED keyboard: deep wine velvet + pure diamond-white/rose beating heart + champagne gold sparks
            const scale = 0.66 + heartPulse * 0.24;
            const hv = heartImplicit(sx / scale, (sy + 0.08) / scale);
            const goldSpark =
              Math.pow(Math.max(0, Math.sin(nx * 35 + angle * 2) * Math.cos(ny * 21 - angle * 2)), 11);

            if (hv <= 0) {
              const depth = clamp(-hv * 1.8, 0, 1);
              // Pure Diamond White heart core -> Champagne Rose rim (pops insanely on a red keyboard!)
              r = 255;
              g = clampByte(165 + depth * 90 + heartPulse * 45);
              b = clampByte(175 + depth * 80 + heartPulse * 45);
            } else {
              const halo = Math.exp(-hv * 3.6) * (0.5 + heartPulse * 0.5);
              r = clampByte(75 + halo * 180 + goldSpark * 255);
              g = clampByte(6 + halo * 55 + goldSpark * 210);
              b = clampByte(16 + halo * 75 + goldSpark * 110);
            }
            break;
          }

          /* ================= ❤️ LOVE & HEARTS ================= */
          case 'heart_beat': {
            const scale = 0.66 + heartPulse * 0.24;
            const hx = sx / scale;
            const hy = (sy + 0.08) / scale;
            const hv = heartImplicit(hx, hy);

            // Expanding heart shockwave ring
            const ringScale = 0.55 + ((p + 0.84) % 1) * 1.45;
            const ringV = heartImplicit(sx / ringScale, (sy + 0.08) / ringScale);
            const ringFade = 1 - ((p + 0.84) % 1);
            const ring = Math.exp(-Math.pow(ringV * 2.6, 2)) * ringFade * 0.85;

            if (hv <= 0) {
              const depth = clamp(-hv * 1.6, 0, 1);
              r = clampByte(215 + depth * 40 + heartPulse * 40);
              g = clampByte(15 + Math.pow(depth, 1.4) * 110 + heartPulse * 75);
              b = clampByte(75 + Math.pow(depth, 1.8) * 130 + heartPulse * 55);
            } else {
              const halo = Math.exp(-hv * 3.8) * (0.45 + heartPulse * 0.55);
              r = clampByte(18 + halo * 225 + ring * 255);
              g = clampByte(4 + halo * 25 + ring * 70);
              b = clampByte(22 + halo * 120 + ring * 175);
            }
            break;
          }

          case 'heart_radar': {
            // Concentric pulsing heart-shaped neon waves
            const hx = sx * 1.05;
            const hy = (sy + 0.06) * 1.05;
            const radApprox = Math.cbrt(Math.abs(heartImplicit(hx, hy)) + 1e-4) *
              (heartImplicit(hx, hy) < 0 ? -1 : 1);
            const distField = Math.hypot(hx, hy * 1.1) + 0.12 * radApprox;
            const wave = Math.sin(distField * 9.5 - angle * 2);
            const band = Math.pow(clamp((wave + 1) * 0.5, 0, 1), 2.4);
            const coreHeart = heartImplicit(sx / 0.45, (sy + 0.06) / 0.45) <= 0 ? 1 : 0;
            const hue = (320 + distField * 45 - p * 360 + 720) % 360;
            const c = hsvToRgb({ h: hue, s: 94, v: clamp((0.18 + band * 0.82) * 100, 0, 100) });
            r = clampByte(c.r + coreHeart * 220);
            g = clampByte(c.g + coreHeart * 130);
            b = clampByte(c.b + coreHeart * 180);
            break;
          }

          case 'heart_rain': {
            // Multiple cute hearts rising smoothly across the keyboard
            let hGlow = 0;
            let bestHue = 340;
            const count = 6;
            for (let i = 0; i < count; i++) {
              const cx = -1.15 + (i / (count - 1)) * 2.3 + Math.sin(angle + i * 1.7) * 0.16;
              const cy = -1.35 + ((p + i / count) % 1) * 2.7;
              const sc = 0.28 + (i % 3) * 0.08;
              const hv = heartImplicit((sx - cx) / sc, (sy - cy) / sc);
              if (hv <= 0) {
                hGlow = 1;
                bestHue = 330 + (i * 11) % 35;
              } else {
                const gVal = Math.exp(-hv * 6.5) * 0.65;
                if (gVal > hGlow) {
                  hGlow = gVal;
                  bestHue = 330 + (i * 11) % 35;
                }
              }
            }
            const sparkle =
              Math.pow(Math.max(0, Math.sin(nx * 37 + angle * 2) * Math.cos(ny * 23 - angle)), 10);
            const c = hsvToRgb({ h: bestHue % 360, s: 90, v: clamp(hGlow * 100, 0, 100) });
            r = clampByte(32 + (1 - ny) * 28 + c.r + sparkle * 220);
            g = clampByte(6 + c.g + sparkle * 165);
            b = clampByte(24 + ny * 32 + c.b + sparkle * 200);
            break;
          }

          case 'heart_split': {
            // Twin glowing orbs (Cyan & Pink) converge at center and bloom into a heart!
            const phase = Math.sin(angle); // -1..1
            const sep = Math.max(0, -phase) * 0.95; // separates when phase < 0
            const merged = Math.max(0, phase); // blooms into heart when phase > 0

            const dLeft = Math.hypot(sx + sep, sy);
            const dRight = Math.hypot(sx - sep, sy);
            const orbL = Math.exp(-dLeft * dLeft * 7.5) * (1 - merged * 0.6);
            const orbR = Math.exp(-dRight * dRight * 7.5) * (1 - merged * 0.6);

            let heartVal = 0;
            if (merged > 0.02) {
              const sc = 0.25 + merged * 0.65;
              const hv = heartImplicit(sx / sc, (sy + 0.06) / sc);
              heartVal = hv <= 0 ? merged : Math.exp(-hv * 4) * merged * 0.7;
            }
            r = clampByte(15 + orbL * 35 + orbR * 255 + heartVal * 255);
            g = clampByte(8 + orbL * 230 + orbR * 40 + heartVal * 85);
            b = clampByte(28 + orbL * 255 + orbR * 175 + heartVal * 155);
            break;
          }

          case 'love_gradient': {
            // Dreamy silky rose-gold / strawberry / lavender ribbons + diamond twinkle
            const w1 = Math.sin(nx * 5.5 - angle + Math.cos(ny * 4 + angle));
            const w2 = Math.cos(nx * 4.0 + ny * 5.0 + angle * 2);
            const tVal = clamp((w1 + w2 + 2) * 0.25, 0, 1);
            const hue = (315 + tVal * 62) % 360; // Magenta -> Rose -> Warm Peach Gold
            const twinkle =
              Math.pow(Math.max(0, Math.sin(nx * 41 + angle * 3) * Math.sin(ny * 29 - angle * 2)), 12);
            const c = hsvToRgb({ h: hue, s: 76, v: 78 + tVal * 22 });
            r = clampByte(c.r + twinkle * 255);
            g = clampByte(c.g + twinkle * 235);
            b = clampByte(c.b + twinkle * 245);
            break;
          }

          /* ================= ✨ UNIQUE & ART ================= */
          case 'dna_helix': {
            // Intertwined 3D Cyan & Magenta DNA double helix with glowing rungs
            const phaseX = nx * Math.PI * 3.2 - angle * 2;
            const y1 = 0.5 + 0.34 * Math.sin(phaseX);
            const y2 = 0.5 - 0.34 * Math.sin(phaseX);
            const z1 = Math.cos(phaseX); // depth [-1, 1]
            const z2 = -z1;

            const strand1 = Math.exp(-Math.pow((ny - y1) * 11, 2)) * (0.65 + 0.35 * z1);
            const strand2 = Math.exp(-Math.pow((ny - y2) * 11, 2)) * (0.65 + 0.35 * z2);

            const minY = Math.min(y1, y2);
            const maxY = Math.max(y1, y2);
            const inRungY = ny > minY && ny < maxY ? 1 : 0;
            const rungMask = Math.pow(Math.max(0, Math.cos(phaseX * 3)), 10) * inRungY;

            r = clampByte(8 + strand1 * 30 + strand2 * 255 + rungMask * 235);
            g = clampByte(14 + strand1 * 245 + strand2 * 35 + rungMask * 225);
            b = clampByte(32 + strand1 * 255 + strand2 * 195 + rungMask * 145);
            break;
          }

          case 'black_hole': {
            // Event horizon void + blazing swirling relativistic accretion disk
            const cx = sx * 0.92;
            const cy = sy * 1.15;
            const rad = Math.hypot(cx, cy);
            const theta = Math.atan2(cy, cx);
            const horizonR = 0.34;

            if (rad < horizonR) {
              // Pitch black event horizon with tiny violet inner rim
              const edge = Math.exp(-Math.pow((horizonR - rad) * 28, 2));
              r = clampByte(edge * 120);
              g = clampByte(edge * 40);
              b = clampByte(edge * 180);
            } else {
              const photonRing = Math.exp(-Math.pow((rad - horizonR - 0.04) * 18, 2));
              const swirl = Math.sin(theta * 4 - 4.2 / (rad + 0.1) + angle * 3);
              const disk =
                Math.exp(-Math.pow((rad - 0.62) * 3.0, 2)) * (0.55 + 0.45 * swirl);
              const stars =
                Math.pow(Math.max(0, Math.sin(nx * 53 + angle) * Math.cos(ny * 37 - angle)), 16);
              r = clampByte(6 + photonRing * 255 + disk * 255 + stars * 200);
              g = clampByte(4 + photonRing * 220 + disk * 115 + stars * 210);
              b = clampByte(16 + photonRing * 160 + disk * 35 + stars * 255);
            }
            break;
          }

          case 'dragon_breath': {
            // Left: Ice Frost Dragon (Cyan/Blue) vs Right: Fire Dragon (Orange/Red) clashing in the middle!
            const clashX = 0.5 + 0.08 * Math.sin(angle * 2) + 0.04 * Math.sin(ny * 14 - angle * 3);
            const turb =
              0.5 +
              0.3 * Math.sin(nx * 16 - angle * 3 + ny * 6) +
              0.2 * Math.cos(ny * 12 + angle * 2);
            const clashGlow = Math.exp(-Math.pow((nx - clashX) * 11, 2));
            const sparks =
              Math.exp(-Math.pow((nx - clashX) * 4.5, 2)) *
              Math.pow(Math.max(0, Math.sin(ny * 24 + angle * 4) * Math.cos(nx * 28)), 6);

            if (nx < clashX) {
              // Ice side
              const intensity = clamp(0.45 + turb * 0.55, 0, 1);
              r = clampByte(intensity * 40 + clashGlow * 235 + sparks * 255);
              g = clampByte(intensity * 195 + clashGlow * 245 + sparks * 255);
              b = clampByte(intensity * 255 + clashGlow * 255 + sparks * 255);
            } else {
              // Fire side
              const intensity = clamp(0.45 + turb * 0.55, 0, 1);
              r = clampByte(intensity * 255 + clashGlow * 255 + sparks * 255);
              g = clampByte(intensity * 110 + clashGlow * 215 + sparks * 235);
              b = clampByte(intensity * 15 + clashGlow * 205 + sparks * 180);
            }
            break;
          }

          case 'lava_lamp': {
            // 5 liquid glowing metaballs merging & separating in 3D lava lamp style
            const balls = [
              { x: -0.75 * Math.cos(angle), y: 0.48 * Math.sin(angle * 2), r: 0.28 },
              { x: 0.72 * Math.sin(angle), y: -0.52 * Math.cos(angle), r: 0.30 },
              { x: 0.35 * Math.cos(angle * 2 + 1.2), y: 0.35 * Math.sin(angle + 0.6), r: 0.26 },
              { x: -0.45 * Math.sin(angle + 2.1), y: -0.32 * Math.cos(angle * 2), r: 0.25 },
              { x: 0.95 * Math.sin(angle + 0.7), y: 0.25 * Math.cos(angle + 1.5), r: 0.24 },
            ];
            let field = 0;
            for (const bl of balls) {
              const d = Math.hypot(sx - bl.x, sy - bl.y) + 0.04;
              field += (bl.r * bl.r) / (d * d);
            }
            if (field > 1.0) {
              const hot = clamp((field - 1.0) * 0.7, 0, 1);
              r = clampByte(230 + hot * 25);
              g = clampByte(35 + hot * 195);
              b = clampByte(115 - hot * 70);
            } else {
              const glow = Math.pow(clamp(field, 0, 1), 2.5);
              r = clampByte(28 + glow * 160);
              g = clampByte(6 + glow * 20);
              b = clampByte(64 + glow * 110);
            }
            break;
          }

          case 'portal_wormhole': {
            // Infinite 3D hyperspace tunnel flying toward viewer
            const rad = Math.hypot(sx * 0.85, sy * 1.05) + 0.05;
            const theta = Math.atan2(sy, sx);
            const depth = 1.4 / rad - p * 4.0;
            const ring = Math.pow(Math.max(0, Math.sin(depth * Math.PI * 2)), 2.2);
            const twist = Math.sin(theta * 5 + depth * 2.5);
            const hue = (195 + (twist > 0 ? 0 : 190) + depth * 25 + 360) % 360;
            const lum = clamp(rad * 1.15, 0.1, 1) * (0.25 + 0.75 * ring);
            const c = hsvToRgb({ h: hue, s: 94, v: lum * 100 });
            r = c.r;
            g = c.g;
            b = c.b;
            break;
          }

          case 'kaleidoscope': {
            // 6-fold polar mirror mandala crystal kaleidoscope
            const rad = Math.hypot(sx, sy);
            let theta = Math.atan2(sy, sx) + angle * 0.5;
            const seg = Math.PI / 3; // 6-fold
            theta = Math.abs((((theta % seg) + seg) % seg) - seg * 0.5);
            const kx = rad * Math.cos(theta);
            const ky = rad * Math.sin(theta);
            const pat =
              Math.sin(kx * 10 - angle * 2) +
              Math.cos(ky * 12 + angle) +
              Math.sin((kx + ky) * 8 - angle * 3);
            const hue = (((pat * 58 + rad * 120 + p * 360) % 360) + 360) % 360;
            const val = clamp(55 + 45 * Math.sin(pat * 1.8), 18, 100);
            const c = hsvToRgb({ h: hue, s: 92, v: val });
            r = c.r;
            g = c.g;
            b = c.b;
            break;
          }

          case 'radar_sonar': {
            // Rotating green tactical sonar beam + glowing target blips
            const rad = Math.hypot(sx * 0.82, sy);
            const theta = Math.atan2(sy, sx);
            const sweepAngle = -angle; // clockwise
            const diff = (((sweepAngle - theta) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
            const wedge = Math.exp(-diff * 1.9);
            const gridRing =
              Math.exp(-Math.pow((rad - 0.45) * 28, 2)) +
              Math.exp(-Math.pow((rad - 0.9) * 28, 2));

            // 4 radar targets that ping brightly right after sweep passes
            const targets = [
              { x: -0.65, y: 0.35 },
              { x: 0.72, y: 0.28 },
              { x: 0.25, y: -0.55 },
              { x: -0.35, y: -0.45 },
            ];
            let blip = 0;
            for (const tg of targets) {
              const td = Math.hypot(sx - tg.x, sy - tg.y);
              const tAng = Math.atan2(tg.y, tg.x);
              const tDiff = (((sweepAngle - tAng) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
              const tGlow = Math.exp(-tDiff * 1.4);
              blip = Math.max(blip, Math.exp(-td * td * 55) * tGlow);
            }

            r = clampByte(blip * 230 + (diff < 0.08 ? 140 : 0));
            g = clampByte(12 + wedge * 215 + gridRing * 70 + blip * 255);
            b = clampByte(8 + wedge * 85 + blip * 160);
            break;
          }

          case 'pac_chase': {
            // Pac-Man chasing across the keyboard with 3 neon ghosts & pellets!
            const goingRight = p < 0.5;
            const localP = goingRight ? p * 2 : (p - 0.5) * 2;
            const pacX = goingRight ? -0.15 + localP * 1.3 : 1.15 - localP * 1.3;
            const pacY = 0.5;
            const pacDist = Math.hypot((nx - pacX) * 2.5, ny - pacY);
            const mouthOpen = 0.2 + 0.35 * Math.abs(Math.sin(angle * 8));
            const angToPac = Math.atan2(ny - pacY, (nx - pacX) * 2.5);
            const facing = goingRight ? 0 : Math.PI;
            const relAng = Math.abs(Math.atan2(Math.sin(angToPac - facing), Math.cos(angToPac - facing)));
            const isPac = pacDist < 0.28 && relAng > mouthOpen;

            // Power pellets along center line
            const pelletDot =
              Math.exp(-Math.pow((ny - 0.5) * 14, 2)) *
              Math.pow(Math.max(0, Math.cos(nx * Math.PI * 14)), 14);
            const pelletVisible = goingRight ? nx > pacX + 0.04 : nx < pacX - 0.04;

            // 3 Ghosts trailing behind (or running away in scared blue!)
            const ghosts = [
              { off: 0.20, rgb: [255, 45, 55] },
              { off: 0.34, rgb: [0, 235, 255] },
              { off: 0.48, rgb: [255, 110, 210] },
            ];
            let gr = 0;
            let gg = 0;
            let gb = 0;
            for (const gh of ghosts) {
              const gx = goingRight ? pacX - gh.off : pacX + gh.off;
              const gd = Math.hypot((nx - gx) * 2.5, ny - 0.5);
              if (gd < 0.25) {
                const intensity = 1 - gd * 1.6;
                if (goingRight) {
                  gr = Math.max(gr, gh.rgb[0] * intensity);
                  gg = Math.max(gg, gh.rgb[1] * intensity);
                  gb = Math.max(gb, gh.rgb[2] * intensity);
                } else {
                  // Scared flashing blue-white ghosts!
                  const flashW = Math.sin(angle * 10) > 0.3 ? 1 : 0;
                  gr = Math.max(gr, (flashW ? 220 : 30) * intensity);
                  gg = Math.max(gg, (flashW ? 235 : 80) * intensity);
                  gb = Math.max(gb, 255 * intensity);
                }
              }
            }

            if (isPac) {
              r = 255;
              g = 225;
              b = 15;
            } else {
              const mazeLine = (ny < 0.1 || ny > 0.9) ? 1 : 0;
              r = clampByte(gr + (pelletVisible ? pelletDot * 255 : 0) + mazeLine * 20);
              g = clampByte(gg + (pelletVisible ? pelletDot * 235 : 0) + mazeLine * 55);
              b = clampByte(18 + gb + (pelletVisible ? pelletDot * 190 : 0) + mazeLine * 195);
            }
            break;
          }

          /* ================= 🎮 CYBER & GAMING ================= */
          case 'police_strobe': {
            // Alternating Red & Blue hypercar strobe + center white burst
            const step = Math.floor(p * 12); // 12 rhythmic pulses
            const leftFlash = (step === 0 || step === 2 || step === 4) ? 1 : 0;
            const rightFlash = (step === 6 || step === 8 || step === 10) ? 1 : 0;
            const centerPop = (step === 5 || step === 11) ? 1 : 0;

            const leftMask = clamp(1.1 - nx * 2.1, 0, 1);
            const rightMask = clamp((nx - 0.48) * 2.1, 0, 1);
            const midMask = Math.exp(-Math.pow((nx - 0.5) * 8, 2));

            r = clampByte(leftMask * (25 + leftFlash * 230) + midMask * centerPop * 255);
            g = clampByte(midMask * centerPop * 255 + (leftFlash ? leftMask * 15 : 0) + (rightFlash ? rightMask * 65 : 0));
            b = clampByte(rightMask * (25 + rightFlash * 230) + midMask * centerPop * 255);
            break;
          }

          case 'rgb_knight': {
            // Iconic KITT Knight Rider sweeping red laser beam with silky comet tail
            const ping = p < 0.5 ? p * 2 : 2 - p * 2; // 0 -> 1 -> 0
            const headX = 0.08 + ping * 0.84;
            const dir = p < 0.5 ? 1 : -1;
            const d = (headX - nx) * dir; // positive behind head
            let beam = 0;
            if (d >= 0) {
              beam = Math.exp(-d * 5.2);
            } else {
              beam = Math.exp(d * 24);
            }
            const coreY = Math.exp(-Math.pow((ny - 0.5) * 2.2, 2));
            const val = beam * (0.45 + 0.55 * coreY);
            r = clampByte(14 + val * 255);
            g = clampByte(Math.pow(val, 3.2) * 180);
            b = clampByte(Math.pow(val, 4.0) * 140);
            break;
          }

          case 'tetris_blocks': {
            // Colorful falling neon pixel columns with row-clear flashes!
            const col = Math.floor(nx * 16);
            const row = Math.floor(ny * 6);
            const colSpeed = 1 + (col % 3);
            const colPhase = (p * colSpeed + hash1(col * 3.7)) % 1;
            const blockY = Math.floor(colPhase * 7);
            const isBlock = row === blockY || row === (blockY - 1 + 7) % 7;
            const hue = (col * 47 + Math.floor(p * 3) * 60) % 360;
            const clearFlash =
              row === 5 && Math.sin(angle * 4) > 0.82 ? 1 : 0;

            if (clearFlash) {
              r = 255;
              g = 255;
              b = 255;
            } else if (isBlock) {
              const c = hsvToRgb({ h: hue, s: 95, v: 98 });
              r = c.r;
              g = c.g;
              b = c.b;
            } else {
              const stackGlow = row >= 4 ? 0.25 : 0.06;
              const c = hsvToRgb({ h: (hue + 40) % 360, s: 80, v: stackGlow * 100 });
              r = c.r;
              g = c.g;
              b = c.b;
            }
            break;
          }

          case 'glitch_cyber': {
            // Cyberpunk RGB split glitch scanlines & electric interference bars
            const band = Math.floor(ny * 8);
            const slice = Math.floor(p * 18);
            const trigger = hash1(band * 13.7 + slice * 7.3);
            const shift = trigger > 0.65 ? (trigger - 0.65) * 0.6 : 0;

            const baseR = Math.sin((nx + shift) * 14 + angle * 2) * 0.5 + 0.5;
            const baseG = Math.sin(nx * 14 - angle * 3) * 0.5 + 0.5;
            const baseB = Math.sin((nx - shift) * 14 + angle * 4) * 0.5 + 0.5;
            const glitchBar = trigger > 0.84 ? 1 : 0;

            r = clampByte(baseR * 190 + glitchBar * 255);
            g = clampByte(baseG * 95 + (trigger > 0.76 ? 210 : 0));
            b = clampByte(baseB * 245 + glitchBar * 230);
            break;
          }

          /* ================= 🌌 NATURE & SPACE ================= */
          case 'meteor_shower': {
            // Midnight starry sky with diagonal blazing shooting stars
            let meteor = 0;
            let mHue = 195;
            for (let i = 0; i < 5; i++) {
              const mp = (p + i * 0.21) % 1;
              const startX = 0.18 + hash1(i * 11.3) * 0.95;
              const headX = startX - mp * 1.15;
              const headY = -0.1 + mp * 1.25;
              // Distance along diagonal velocity vector (-1, +1)
              const dx = nx - headX;
              const dy = ny - headY;
              const along = dx * 0.707 - dy * 0.707; // positive behind head
              const perp = Math.abs(dx * 0.707 + dy * 0.707);
              if (along >= -0.02 && along < 0.34) {
                const tail = Math.exp(-Math.max(0, along) * 9.5) * Math.exp(-perp * perp * 650);
                if (tail > meteor) {
                  meteor = tail;
                  mHue = i % 2 === 0 ? 198 : 42; // Cyan-white & Gold meteors
                }
              }
            }
            const star =
              Math.pow(Math.max(0, Math.sin(nx * 47 + ny * 31) * Math.cos(angle + nx * 19)), 14);
            const mc = hsvToRgb({ h: mHue, s: clamp((1 - meteor) * 95, 10, 95), v: 100 });
            r = clampByte(5 + meteor * mc.r + star * 210);
            g = clampByte(10 + (1 - ny) * 18 + meteor * mc.g + star * 225);
            b = clampByte(35 + (1 - ny) * 42 + meteor * mc.b + star * 255);
            break;
          }

          case 'waterfall': {
            // Bioluminescent turquoise waterfall cascading downward into glowing foam
            const streamX = Math.sin(nx * 24) * 0.5 + 0.5;
            const flow1 = Math.sin(ny * 14 - angle * 3 + Math.sin(nx * 9) * 1.5);
            const flow2 = Math.cos(ny * 20 - angle * 4 + nx * 12);
            const streak = clamp((flow1 * 0.55 + flow2 * 0.45 + 1) * 0.5, 0, 1);
            const mist = Math.exp(-Math.pow((1 - ny) * 4.5, 2)) * (0.65 + 0.35 * Math.sin(nx * 18 + angle * 2));
            r = clampByte(streak * streamX * 55 + mist * 225);
            g = clampByte(75 + streak * 155 + mist * 235);
            b = clampByte(130 + streak * 125 + mist * 255);
            break;
          }

          /* ================= 🎉 PARTY & FUN ================= */
          case 'fireworks': {
            // 4 dazzling multi-colored festival firework bursts expanding in sequence
            const bursts = [
              { x: -0.78, y: 0.15, offset: 0.0, hue: 350 },
              { x: 0.05, y: 0.22, offset: 0.25, hue: 46 },
              { x: 0.80, y: 0.10, offset: 0.5, hue: 185 },
              { x: -0.25, y: -0.10, offset: 0.75, hue: 285 },
            ];
            let fr = 6;
            let fg = 8;
            let fb = 22;
            for (const bu of bursts) {
              const bp = (p + 1 - bu.offset) % 1;
              const rad = Math.hypot(sx - bu.x, sy - bu.y);
              const theta = Math.atan2(sy - bu.y, sx - bu.x);
              const ringR = bp * 0.92;
              const fade = Math.pow(1 - bp, 1.4);
              const rays = Math.pow(Math.max(0, Math.cos(theta * 8 + bu.hue)), 4);
              const ring = Math.exp(-Math.pow((rad - ringR) * 13, 2)) * (0.45 + 0.55 * rays) * fade;
              const flashCore = bp < 0.12 ? Math.exp(-rad * rad * 30) * (1 - bp / 0.12) : 0;
              const c = hsvToRgb({ h: (bu.hue + bp * 45) % 360, s: 95, v: 100 });
              fr += ring * c.r + flashCore * 255;
              fg += ring * c.g + flashCore * 250;
              fb += ring * c.b + flashCore * 220;
            }
            r = clampByte(fr);
            g = clampByte(fg);
            b = clampByte(fb);
            break;
          }

          case 'disco_floor': {
            // Retro 80s pulsing neon dancefloor tiles synced to rhythmic beat
            const tx = Math.floor(nx * 8);
            const ty = Math.floor(ny * 3);
            const beatStep = Math.floor(p * 8);
            const beatPulse = Math.pow(1 - ((p * 8) % 1), 1.6);
            const tileHash = hash1(tx * 17.1 + ty * 31.7 + beatStep * 5.3);
            const hue = ((tx * 42 + ty * 95 + beatStep * 45) % 360);
            const lit = tileHash > 0.25 ? 0.35 + beatPulse * 0.65 : 0.12;
            const strobe = tileHash > 0.90 && beatPulse > 0.65 ? 1 : 0;
            const c = hsvToRgb({ h: hue, s: strobe ? 15 : 94, v: strobe ? 100 : lit * 100 });
            r = c.r;
            g = c.g;
            b = c.b;
            break;
          }

          case 'vietnam_wave': {
            // Silky waving Vietnam Red Flag with crisp Golden 5-Point Star!
            const waveOffset = Math.sin(nx * 7.5 - angle * 2) * 0.12;
            const shade = 0.82 + 0.18 * Math.cos(nx * 7.5 - angle * 2);
            const starD = star5Dist(sx, sy + waveOffset, 0.66);
            if (starD <= 0) {
              // Bright Golden Star
              r = clampByte(255 * shade);
              g = clampByte(222 * shade);
              b = clampByte(18 * shade);
            } else {
              // Crisp anti-aliased edge glow into rich Crimson Red
              const edge = Math.exp(-starD * 32);
              r = clampByte((228 + edge * 27) * shade);
              g = clampByte((14 + edge * 205) * shade);
              b = clampByte((18 + edge * 8) * shade);
            }
            break;
          }

          /* ================= ORIGINAL 12 PRESETS ================= */
          case 'fire': {
            const fl = 0.5 + 0.25 * Math.sin(nx * 14 + angle * 2) + 0.25 * Math.cos(nx * 22 - ny * 9 + angle * 3);
            const heat = clamp(ny * 1.15 - 0.1 + fl * 0.36, 0, 1);
            r = clampByte(heat * 380);
            g = clampByte(Math.max(0, heat - 0.32) * 340);
            b = clampByte(Math.max(0, heat - 0.72) * 300);
            break;
          }
          case 'ocean': {
            const wave = 0.5 + 0.22 * Math.sin(nx * 10 - angle) + 0.15 * Math.sin(nx * 18 + angle * 2);
            const crest = Math.exp(-Math.pow((ny - wave) * 6, 2));
            r = clampByte(crest * 220 + (1 - ny) * 10);
            g = clampByte(45 + ny * 120 + crest * 165);
            b = clampByte(115 + ny * 140 + crest * 80);
            break;
          }
          case 'matrix': {
            const colHash = Math.abs(Math.sin(x * 19.37) * 43758.5453) % 1;
            const headY = ((p * 1.5 + colHash) % 1) * 1.35;
            const dist = headY - ny;
            if (dist >= 0 && dist < 0.65) {
              const tail = Math.pow(1 - dist / 0.65, 2.2);
              const isHead = dist < 0.08;
              r = isHead ? 185 : 0;
              g = clampByte(isHead ? 255 : tail * 245);
              b = isHead ? 185 : clampByte(tail * 70);
            } else {
              r = 0;
              g = 12;
              b = 4;
            }
            break;
          }
          case 'rainbow': {
            const w = Math.sin(nx * 12 - angle * 2) * 0.12;
            const band = clamp((ny + w) * 6, 0, 5.99);
            const hue = (((nx * 180 + band * 55 - p * 360) % 360) + 360) % 360;
            const c = hsvToRgb({ h: hue, s: 100, v: 100 });
            r = c.r;
            g = c.g;
            b = c.b;
            break;
          }
          case 'cyber': {
            const b1 = Math.exp(-Math.pow((nx - p) * 10, 2));
            const b2 = Math.exp(-Math.pow((nx - (1 - p)) * 10, 2));
            const grid = Math.sin(ny * Math.PI * 6) > 0.7 ? 0.15 : 0;
            r = clampByte(b2 * 245 + grid * 60);
            g = clampByte(b1 * 230 + b2 * 60 + grid * 180);
            b = clampByte(b1 * 255 + b2 * 255 + 35);
            break;
          }
          case 'sakura': {
            const driftX = (nx + p * 0.8 + Math.sin(ny * 8 + angle) * 0.08) % 1;
            const driftY = (ny - p * 1.1 + 2) % 1;
            const petal =
              Math.pow(Math.max(0, Math.sin(driftX * 26) * Math.cos(driftY * 14)), 4);
            const softBg = 0.25 + 0.15 * Math.sin(nx * 5 + angle);
            r = clampByte(70 * softBg + petal * 255 + 45);
            g = clampByte(18 * softBg + petal * 165 + 15);
            b = clampByte(45 * softBg + petal * 210 + 30);
            break;
          }
          case 'aurora': {
            const w1 = Math.sin(nx * 6 - angle + Math.sin(ny * 4 + angle));
            const w2 = Math.cos(nx * 4 + ny * 3 - angle * 2);
            const band = clamp((w1 * 0.55 + w2 * 0.45 + 1) * 0.5, 0, 1);
            const hue = (135 + band * 165) % 360;
            const lum = 0.25 + 0.75 * Math.sin(band * Math.PI);
            const c = hsvToRgb({ h: hue, s: 92, v: lum * 100 });
            r = c.r;
            g = c.g;
            b = c.b;
            break;
          }
          case 'heartbeat': {
            const distFromWave = ((nx - p + 1) % 1);
            const spike =
              distFromWave < 0.08
                ? Math.sin((distFromWave / 0.08) * Math.PI) * 0.42
                : distFromWave < 0.14
                  ? -Math.sin(((distFromWave - 0.08) / 0.06) * Math.PI) * 0.28
                  : 0;
            const lineY = 0.5 - spike;
            const glow = Math.exp(-Math.pow((ny - lineY) * 9, 2));
            const trail = Math.exp(-distFromWave * 4.5);
            const pulse = glow * (0.25 + 0.75 * trail);
            r = clampByte(25 + pulse * 255);
            g = clampByte(6 + pulse * 45);
            b = clampByte(22 + pulse * 95);
            break;
          }
          case 'galaxy': {
            const cx = (nx - 0.5) * 2.2;
            const cy = ny - 0.5;
            const rad = Math.hypot(cx, cy);
            const theta = Math.atan2(cy, cx);
            const spiral = Math.sin(theta * 3 - rad * 10 + angle * 2);
            const arm = Math.pow(clamp((spiral + 1) * 0.5, 0, 1), 2.2);
            const core = Math.exp(-rad * rad * 6);
            const hue = (220 + rad * 110 + p * 360) % 360;
            const c = hsvToRgb({ h: hue, s: 85, v: clamp((arm * 0.8 + core) * 100, 10, 100) });
            r = clampByte(c.r + core * 140);
            g = clampByte(c.g + core * 130);
            b = clampByte(c.b + core * 160);
            break;
          }
          case 'synthwave': {
            const sunDist = Math.hypot((nx - 0.5) * 2.4, (ny - 0.35) * 1.4);
            const sun = sunDist < 0.55 ? 1 - sunDist / 0.55 : 0;
            const scanline = ny > 0.55 ? (Math.sin((ny * 22 - angle * 3)) > 0.35 ? 1 : 0) : 0;
            const horizon = Math.exp(-Math.pow((ny - 0.55) * 10, 2));
            r = clampByte(30 + sun * 255 + horizon * 235 + scanline * 180);
            g = clampByte(10 + sun * (185 - ny * 180) + horizon * 50 + scanline * 30);
            b = clampByte(75 + (1 - ny) * 90 + horizon * 150 + scanline * 210);
            break;
          }
          case 'lightning': {
            const flash = Math.pow(Math.max(0, Math.sin(angle * 3 + Math.sin(angle * 7))), 8);
            const boltX = 0.5 + 0.32 * Math.sin(ny * 11 + Math.floor(p * 12) * 2.1);
            const bolt = Math.exp(-Math.pow((nx - boltX) * 18, 2));
            const storm = 0.18 + 0.14 * Math.sin(nx * 7 + angle);
            r = clampByte(15 * storm + bolt * 210 + flash * 160);
            g = clampByte(40 * storm + bolt * 235 + flash * 190);
            b = clampByte(130 * storm + bolt * 255 + flash * 255);
            break;
          }
          case 'plasma':
          default: {
            const cx = nx - 0.5;
            const cy = (ny - 0.5) * 0.45;
            const dist = Math.hypot(cx, cy);
            const v1 = Math.sin(nx * 9 + angle);
            const v2 = Math.sin((ny * 6 + Math.cos(angle)) * 1.4);
            const v3 = Math.sin(dist * 18 - angle * 2);
            const hue = ((((v1 + v2 + v3) * 60 + 210) % 360) + 360) % 360;
            const c = hsvToRgb({ h: hue, s: 95, v: 98 });
            r = c.r;
            g = c.g;
            b = c.b;
            break;
          }
        }

        const off = (y * width + x) * 4;
        data[off] = r;
        data[off + 1] = g;
        data[off + 2] = b;
        data[off + 3] = 255;
      }
    }
    frames.push({ imageData: new ImageData(data, width, height), delayMs });
  }

  const meta = BUILTIN_WAVE_GIFS.find((g) => g.id === presetId);
  const media: LoadedGifMedia = {
    id: `builtin-${presetId}`,
    name: meta ? meta.nameVi : presetId,
    width,
    height,
    frames,
    isBuiltIn: true,
  };
  builtInGifCache.set(presetId, media);
  return media;
}

export function sampleFrameTo81Keys(
  imageData: ImageData,
  fitMode: FitMode,
  adjustments: ColorAdjustments
): { keys: RGB[]; logo: RGB } {
  const { width, height, data } = imageData;
  const kbAspect = WAVE75_WIDTH_U / WAVE75_HEIGHT_U;
  const imgAspect = width / height;

  let scaleX = 1;
  let scaleY = 1;
  let offsetX = 0;
  let offsetY = 0;

  if (fitMode === 'cover') {
    if (imgAspect > kbAspect) {
      scaleX = kbAspect / imgAspect;
      offsetX = (1 - scaleX) / 2;
    } else {
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

  const keys = new Array<RGB>(WAVE75_KEY_COUNT);

  for (let i = 0; i < WAVE75_KEY_COUNT; i++) {
    const k = WAVE75_KEYS[i];
    let u: number;
    let v: number;

    if (fitMode === 'contain') {
      u = (k.nx - offsetX) / scaleX;
      v = (k.ny - offsetY) / scaleY;
      if (u < 0 || u > 1 || v < 0 || v > 1) {
        keys[i] = BLACK;
        continue;
      }
    } else {
      u = offsetX + k.nx * scaleX;
      v = offsetY + k.ny * scaleY;
    }

    const halfW = (k.w / WAVE75_WIDTH_U) * 0.25 * (fitMode === 'contain' ? 1 / scaleX : scaleX);
    const halfH = (1 / WAVE75_HEIGHT_U) * 0.25 * (fitMode === 'contain' ? 1 / scaleY : scaleY);

    let rS = 0;
    let gS = 0;
    let bS = 0;
    let cnt = 0;

    for (let sy = -1; sy <= 1; sy++) {
      for (let sx = -1; sx <= 1; sx++) {
        const px = Math.floor(clamp(u + sx * halfW, 0, 0.9999) * width);
        const py = Math.floor(clamp(v + sy * halfH, 0, 0.9999) * height);
        const idx = (py * width + px) * 4;
        const a = data[idx + 3] / 255;
        rS += data[idx] * a;
        gS += data[idx + 1] * a;
        bS += data[idx + 2] * a;
        cnt++;
      }
    }

    keys[i] = applyColorAdjustments({ r: rS / cnt, g: gS / cnt, b: bS / cnt }, adjustments);
  }

  return { keys, logo: keys[13] ?? BLACK };
}

