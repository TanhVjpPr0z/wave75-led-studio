import { WAVE75_KEYS, WAVE75_KEY_COUNT } from '../layout/wave75Layout';
import {
  type RGB,
  blendAdditive,
  clamp,
  hsvToRgb,
  lerpRgb,
  scaleRgb,
} from '../utils/color';

export type SnakeDirection = 'up' | 'down' | 'left' | 'right';
export type SnakeStatus = 'ready' | 'playing' | 'paused' | 'gameover' | 'victory';
export type SnakeSkin = 'neon_green' | 'crimson_fire' | 'rainbow_rgb' | 'ice_cyan';

export interface SnakePoint {
  x: number;
  y: number;
}

export interface SnakeHudState {
  status: SnakeStatus;
  score: number;
  highScore: number;
  length: number;
  applesEaten: number;
  direction: SnakeDirection;
  wrapWalls: boolean;
  aiMode: boolean;
  skin: SnakeSkin;
  hasBonusFruit: boolean;
}

export const SNAKE_COLS = 12;
export const SNAKE_ROWS = 5;

const HIGH_SCORE_STORAGE_KEY = 'wave75-snake-highscore';

// Build exact 1-to-1 lookup from 12x5 arena grid to real WAVE75 physical keycap indices
const ARENA_KEY_IDS: string[][] = [
  ['f1', 'f2', 'f3', 'f4', 'f5', 'f6', 'f7', 'f8', 'f9', 'f10', 'f11', 'f12'],
  ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0', 'minus', 'equal'],
  ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p', 'lbracket', 'rbracket'],
  ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l', 'semicolon', 'quote', 'enter'],
  ['lshift', 'z', 'x', 'c', 'v', 'b', 'n', 'm', 'comma', 'period', 'slash', 'rshift'],
];

const ID_TO_INDEX = new Map<string, number>();
for (const k of WAVE75_KEYS) {
  ID_TO_INDEX.set(k.id, k.index);
}

export const SNAKE_GRID_TO_KEY: number[][] = ARENA_KEY_IDS.map((row) =>
  row.map((id) => ID_TO_INDEX.get(id) ?? 0)
);

const ARROW_KEY_INDEX: Record<SnakeDirection, number> = {
  up: ID_TO_INDEX.get('up') ?? 71,
  down: ID_TO_INDEX.get('down') ?? 79,
  left: ID_TO_INDEX.get('left') ?? 78,
  right: ID_TO_INDEX.get('right') ?? 80,
};

const SPACE_KEY_INDEX = ID_TO_INDEX.get('space') ?? 75;
const ESC_KEY_INDEX = ID_TO_INDEX.get('esc') ?? 0;
const SCORE_BAR_KEYS: number[] = ['pgdn', 'pgup', 'end', 'home', 'del']
  .map((id) => ID_TO_INDEX.get(id))
  .filter((n): n is number => n !== undefined);

const OPPOSITE: Record<SnakeDirection, SnakeDirection> = {
  up: 'down',
  down: 'up',
  left: 'right',
  right: 'left',
};

const DIR_DELTA: Record<SnakeDirection, SnakePoint> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

export const SNAKE_SKINS: Array<{
  id: SnakeSkin;
  nameVi: string;
  nameEn: string;
  preview: string;
}> = [
  {
    id: 'neon_green',
    nameVi: '🟢 Xanh Neon',
    nameEn: '🟢 Neon Emerald',
    preview: 'linear-gradient(90deg, #059669, #34d399, #ecfdf5)',
  },
  {
    id: 'crimson_fire',
    nameVi: '🔥 Lửa Phím Đỏ',
    nameEn: '🔥 Crimson Flame',
    preview: 'linear-gradient(90deg, #b91c1c, #f97316, #fef08a)',
  },
  {
    id: 'rainbow_rgb',
    nameVi: '🌈 Rắn Cầu Vồng',
    nameEn: '🌈 RGB Rainbow',
    preview: 'linear-gradient(90deg, #ef4444, #facc15, #22c55e, #38bdf8, #a855f7)',
  },
  {
    id: 'ice_cyan',
    nameVi: '❄️ Băng Cyan',
    nameEn: '❄️ Ice Cyber',
    preview: 'linear-gradient(90deg, #1d4ed8, #38bdf8, #e0f2fe)',
  },
];

function loadHighScore(): number {
  try {
    const raw = window.localStorage.getItem(HIGH_SCORE_STORAGE_KEY);
    const n = raw ? Number.parseInt(raw, 10) : 0;
    return Number.isFinite(n) && n > 0 ? n : 0;
  } catch {
    return 0;
  }
}

function saveHighScore(val: number): void {
  try {
    window.localStorage.setItem(HIGH_SCORE_STORAGE_KEY, String(val));
  } catch {
    // ignore
  }
}

class WaveSnakeGameEngine {
  private snake: SnakePoint[] = [];
  private direction: SnakeDirection = 'right';
  private inputQueue: SnakeDirection[] = [];
  private apple: SnakePoint = { x: 9, y: 2 };
  private bonusFruit: (SnakePoint & { expiresAt: number }) | null = null;

  private status: SnakeStatus = 'ready';
  private score = 0;
  private highScore = loadHighScore();
  private applesEaten = 0;
  private wrapWalls = true;
  private aiMode = false;
  private skin: SnakeSkin = 'neon_green';

  private lastStepMs = 0;
  private eatBurstMs = -9999;
  private eatBurstPos: SnakePoint = { x: 6, y: 2 };
  private gameOverMs = -9999;
  private lastArrowFlash: { dir: SnakeDirection; atMs: number } = { dir: 'right', atMs: -9999 };

  private listeners = new Set<(state: SnakeHudState) => void>();

  constructor() {
    this.reset(false);
  }

  public getHudState(): SnakeHudState {
    return {
      status: this.status,
      score: this.score,
      highScore: this.highScore,
      length: this.snake.length,
      applesEaten: this.applesEaten,
      direction: this.direction,
      wrapWalls: this.wrapWalls,
      aiMode: this.aiMode,
      skin: this.skin,
      hasBonusFruit: this.bonusFruit !== null,
    };
  }

  public subscribe(listener: (state: SnakeHudState) => void): () => void {
    this.listeners.add(listener);
    listener(this.getHudState());
    return () => {
      this.listeners.delete(listener);
    };
  }

  private emit(): void {
    const snap = this.getHudState();
    for (const fn of this.listeners) {
      fn(snap);
    }
  }

  public reset(startImmediately: boolean): void {
    this.snake = [
      { x: 4, y: 2 },
      { x: 3, y: 2 },
      { x: 2, y: 2 },
    ];
    this.direction = 'right';
    this.inputQueue = [];
    this.score = 0;
    this.applesEaten = 0;
    this.bonusFruit = null;
    this.status = startImmediately || this.aiMode ? 'playing' : 'ready';
    this.lastStepMs = performance.now();
    this.eatBurstMs = -9999;
    this.gameOverMs = -9999;
    this.spawnApple();
    this.emit();
  }

  public setWrapWalls(wrap: boolean): void {
    this.wrapWalls = wrap;
    this.emit();
  }

  public setAiMode(enabled: boolean): void {
    this.aiMode = enabled;
    if (enabled && (this.status === 'ready' || this.status === 'paused' || this.status === 'gameover')) {
      if (this.status === 'gameover') this.reset(true);
      else this.status = 'playing';
    }
    this.emit();
  }

  public setSkin(skin: SnakeSkin): void {
    this.skin = skin;
    this.emit();
  }

  public togglePlayOrRestart(): void {
    if (this.status === 'gameover' || this.status === 'victory') {
      this.reset(true);
      return;
    }
    if (this.status === 'playing') {
      this.status = 'paused';
    } else {
      this.status = 'playing';
      this.lastStepMs = performance.now();
    }
    this.emit();
  }

  public steer(dir: SnakeDirection): void {
    const now = performance.now();
    this.lastArrowFlash = { dir, atMs: now };

    // If AI was auto-driving and player presses a direction, seamlessly hand control to the player!
    if (this.aiMode) {
      this.aiMode = false;
    }

    if (this.status === 'gameover' || this.status === 'victory') {
      this.reset(true);
    } else if (this.status === 'ready' || this.status === 'paused') {
      this.status = 'playing';
      this.lastStepMs = now;
    }

    const lastPlanned =
      this.inputQueue.length > 0
        ? this.inputQueue[this.inputQueue.length - 1]
        : this.direction;

    if (dir === lastPlanned || dir === OPPOSITE[lastPlanned]) {
      this.emit();
      return;
    }

    if (this.inputQueue.length < 2) {
      this.inputQueue.push(dir);
    } else {
      this.inputQueue[1] = dir;
    }
    this.emit();
  }

  private isOccupied(x: number, y: number, ignoreTail = false): boolean {
    const limit = ignoreTail ? this.snake.length - 1 : this.snake.length;
    for (let i = 0; i < limit; i++) {
      if (this.snake[i].x === x && this.snake[i].y === y) return true;
    }
    return false;
  }

  private pickFreeCell(): SnakePoint | null {
    const free: SnakePoint[] = [];
    for (let y = 0; y < SNAKE_ROWS; y++) {
      for (let x = 0; x < SNAKE_COLS; x++) {
        const isApple = this.apple && this.apple.x === x && this.apple.y === y;
        const isBonus = this.bonusFruit && this.bonusFruit.x === x && this.bonusFruit.y === y;
        if (!this.isOccupied(x, y) && !isApple && !isBonus) {
          free.push({ x, y });
        }
      }
    }
    if (free.length === 0) return null;
    return free[Math.floor(Math.random() * free.length)];
  }

  private spawnApple(): void {
    const cell = this.pickFreeCell();
    if (!cell) {
      this.status = 'victory';
      this.emit();
      return;
    }
    this.apple = cell;
  }

  private chooseAiDirection(): SnakeDirection {
    const head = this.snake[0];
    const target = this.bonusFruit ?? this.apple;
    const dirs: SnakeDirection[] = ['up', 'down', 'left', 'right'].filter(
      (d) => d !== OPPOSITE[this.direction]
    ) as SnakeDirection[];

    let bestDir = this.direction;
    let bestScore = -Infinity;

    for (const d of dirs) {
      const delta = DIR_DELTA[d];
      let nx = head.x + delta.x;
      let ny = head.y + delta.y;

      if (this.wrapWalls) {
        nx = (nx + SNAKE_COLS) % SNAKE_COLS;
        ny = (ny + SNAKE_ROWS) % SNAKE_ROWS;
      } else if (nx < 0 || nx >= SNAKE_COLS || ny < 0 || ny >= SNAKE_ROWS) {
        continue;
      }

      if (this.isOccupied(nx, ny, true)) continue;

      // Manhattan distance (accounting for wrap if enabled)
      let dx = Math.abs(nx - target.x);
      let dy = Math.abs(ny - target.y);
      if (this.wrapWalls) {
        dx = Math.min(dx, SNAKE_COLS - dx);
        dy = Math.min(dy, SNAKE_ROWS - dy);
      }

      // Count open neighbor cells to avoid boxing itself in
      let openNeighbors = 0;
      for (const nd of ['up', 'down', 'left', 'right'] as SnakeDirection[]) {
        let ax = nx + DIR_DELTA[nd].x;
        let ay = ny + DIR_DELTA[nd].y;
        if (this.wrapWalls) {
          ax = (ax + SNAKE_COLS) % SNAKE_COLS;
          ay = (ay + SNAKE_ROWS) % SNAKE_ROWS;
        } else if (ax < 0 || ax >= SNAKE_COLS || ay < 0 || ay >= SNAKE_ROWS) {
          continue;
        }
        if (!this.isOccupied(ax, ay, true)) openNeighbors++;
      }

      const candidateScore = -(dx + dy) * 3 + openNeighbors * 1.4;
      if (candidateScore > bestScore) {
        bestScore = candidateScore;
        bestDir = d;
      }
    }
    return bestDir;
  }

  public step(nowMs: number): void {
    if (this.status !== 'playing') return;

    if (this.bonusFruit && nowMs > this.bonusFruit.expiresAt) {
      this.bonusFruit = null;
      this.emit();
    }

    if (this.aiMode) {
      this.direction = this.chooseAiDirection();
    } else if (this.inputQueue.length > 0) {
      const next = this.inputQueue.shift()!;
      if (next !== OPPOSITE[this.direction]) {
        this.direction = next;
      }
    }

    const head = this.snake[0];
    const delta = DIR_DELTA[this.direction];
    let nx = head.x + delta.x;
    let ny = head.y + delta.y;

    if (this.wrapWalls) {
      nx = (nx + SNAKE_COLS) % SNAKE_COLS;
      ny = (ny + SNAKE_ROWS) % SNAKE_ROWS;
    } else if (nx < 0 || nx >= SNAKE_COLS || ny < 0 || ny >= SNAKE_ROWS) {
      this.triggerGameOver(nowMs);
      return;
    }

    const ateApple = nx === this.apple.x && ny === this.apple.y;
    const ateBonus = this.bonusFruit !== null && nx === this.bonusFruit.x && ny === this.bonusFruit.y;

    if (this.isOccupied(nx, ny, !ateApple && !ateBonus)) {
      this.triggerGameOver(nowMs);
      return;
    }

    this.snake.unshift({ x: nx, y: ny });

    if (ateApple || ateBonus) {
      this.eatBurstMs = nowMs;
      this.eatBurstPos = { x: nx, y: ny };
      if (ateBonus) {
        this.score += 3;
        this.bonusFruit = null;
      } else {
        this.score += 1;
        this.applesEaten += 1;
        this.spawnApple();
        if (this.applesEaten % 5 === 0 && !this.bonusFruit) {
          const bCell = this.pickFreeCell();
          if (bCell) {
            this.bonusFruit = { ...bCell, expiresAt: nowMs + 7500 };
          }
        }
      }
      if (this.score > this.highScore) {
        this.highScore = this.score;
        saveHighScore(this.highScore);
      }
      this.emit();
    } else {
      this.snake.pop();
    }
  }

  private triggerGameOver(nowMs: number): void {
    this.status = 'gameover';
    this.gameOverMs = nowMs;
    this.emit();
    if (this.aiMode) {
      // Auto-restart AI after brief flash
      globalThis.setTimeout(() => {
        if (this.aiMode && this.status === 'gameover') {
          this.reset(true);
        }
      }, 1200);
    }
  }

  private getSegmentColor(segIdx: number, totalLen: number, nowMs: number): RGB {
    const ratio = totalLen <= 1 ? 0 : segIdx / (totalLen - 1);
    if (segIdx === 0) {
      // Blazing high-contrast head so player always tracks snake instantly!
      switch (this.skin) {
        case 'crimson_fire':
          return { r: 255, g: 250, b: 210 };
        case 'ice_cyan':
          return { r: 230, g: 252, b: 255 };
        case 'rainbow_rgb':
          return { r: 255, g: 255, b: 255 };
        case 'neon_green':
        default:
          return { r: 225, g: 255, b: 235 };
      }
    }

    switch (this.skin) {
      case 'crimson_fire':
        return lerpRgb({ r: 255, g: 165, b: 18 }, { r: 215, g: 16, b: 28 }, ratio);
      case 'ice_cyan':
        return lerpRgb({ r: 56, g: 235, b: 255 }, { r: 37, g: 99, b: 235 }, ratio);
      case 'rainbow_rgb': {
        const hue = (((nowMs * 0.12 - segIdx * 24) % 360) + 360) % 360;
        return hsvToRgb({ h: hue, s: 96, v: clamp(100 - ratio * 24, 55, 100) });
      }
      case 'neon_green':
      default:
        return lerpRgb({ r: 34, g: 245, b: 135 }, { r: 6, g: 148, b: 162 }, ratio);
    }
  }

  public renderFrame(nowMs: number, speedLevel: number, brightnessPct: number): { keys: RGB[]; logo: RGB } {
    // Tick interval: speed 1 = 320ms (chill) .. speed 5 = 175ms (sweet spot) .. speed 10 = 75ms (pro!)
    const baseInterval = clamp(345 - speedLevel * 27, 72, 330);
    // Slight smooth speed-up as you eat more apples
    const stepInterval = Math.max(65, baseInterval - Math.min(45, this.applesEaten * 2));

    if (this.status === 'playing' && nowMs - this.lastStepMs >= stepInterval) {
      this.step(nowMs);
      this.lastStepMs = nowMs;
    }

    const bright = clamp(brightnessPct, 0, 100) / 100;
    const keys = new Array<RGB>(WAVE75_KEY_COUNT);

    // Subtle dark gaming arena backdrop so snake & apple pop dramatically!
    const bgBase: RGB =
      this.skin === 'crimson_fire'
        ? { r: 16, g: 4, b: 6 }
        : this.skin === 'ice_cyan'
          ? { r: 4, g: 10, b: 22 }
          : { r: 6, g: 12, b: 18 };
    for (let i = 0; i < WAVE75_KEY_COUNT; i++) {
      keys[i] = bgBase;
    }

    // Eat-apple radial shockwave burst
    const eatAge = nowMs - this.eatBurstMs;
    if (eatAge >= 0 && eatAge < 340) {
      const p = eatAge / 340;
      const radius = p * 4.5;
      const fade = 1 - p;
      for (let y = 0; y < SNAKE_ROWS; y++) {
        for (let x = 0; x < SNAKE_COLS; x++) {
          const d = Math.hypot(x - this.eatBurstPos.x, y - this.eatBurstPos.y);
          const ring = Math.exp(-Math.pow((d - radius) * 2.2, 2)) * fade;
          if (ring > 0.05) {
            const ki = SNAKE_GRID_TO_KEY[y][x];
            keys[ki] = blendAdditive(keys[ki], scaleRgb({ r: 255, g: 220, b: 90 }, ring));
          }
        }
      }
    }

    // Draw Normal Apple (vivid pulsing crimson/coral or glowing cyan-gold for crimson skin)
    const applePulse = 0.68 + 0.32 * Math.sin(nowMs * 0.011);
    const appleColor: RGB =
      this.skin === 'crimson_fire'
        ? { r: 30, g: 250, b: 255 } // Crisp Cyan apple stands out sharply against Fire Snake!
        : { r: 255, g: 30, b: 65 };
    const appleKeyIdx = SNAKE_GRID_TO_KEY[this.apple.y]?.[this.apple.x];
    if (appleKeyIdx !== undefined) {
      keys[appleKeyIdx] = scaleRgb(appleColor, applePulse);
    }

    // Draw Bonus Golden Star Fruit (fast sparkling gold-magenta, worth +3!)
    if (this.bonusFruit) {
      const bPulse = 0.65 + 0.35 * Math.sin(nowMs * 0.025);
      const bKeyIdx = SNAKE_GRID_TO_KEY[this.bonusFruit.y]?.[this.bonusFruit.x];
      if (bKeyIdx !== undefined) {
        keys[bKeyIdx] = scaleRgb({ r: 255, g: 215, b: 20 }, bPulse);
      }
    }

    // Draw Snake Body & Head (back-to-front so head is always crisp on top)
    for (let s = this.snake.length - 1; s >= 0; s--) {
      const pt = this.snake[s];
      const ki = SNAKE_GRID_TO_KEY[pt.y]?.[pt.x];
      if (ki !== undefined) {
        keys[ki] = this.getSegmentColor(s, this.snake.length, nowMs);
      }
    }

    // Dedicated Glowing Arcade D-Pad on the 4 Physical Arrow Keys!
    for (const d of ['up', 'down', 'left', 'right'] as SnakeDirection[]) {
      const ki = ARROW_KEY_INDEX[d];
      const isActiveDir = d === this.direction;
      const flashAge = nowMs - this.lastArrowFlash.atMs;
      const isFlashing = this.lastArrowFlash.dir === d && flashAge >= 0 && flashAge < 220;
      if (isFlashing) {
        keys[ki] = { r: 255, g: 255, b: 255 };
      } else if (isActiveDir) {
        keys[ki] = { r: 255, g: 200, b: 50 };
      } else {
        keys[ki] = { r: 50, g: 70, b: 105 };
      }
    }

    // Right Column Vertical Score Progress Meter (5 LEDs bottom -> top)
    const litBars = Math.min(SCORE_BAR_KEYS.length, Math.floor(this.score / 2));
    for (let i = 0; i < SCORE_BAR_KEYS.length; i++) {
      const ki = SCORE_BAR_KEYS[i];
      if (i < litBars) {
        const hue = 120 - i * 24;
        keys[ki] = hsvToRgb({ h: Math.max(0, hue), s: 95, v: 95 });
      } else {
        keys[ki] = { r: 18, g: 22, b: 36 };
      }
    }

    // Spacebar & ESC Status Indicator
    if (this.status === 'gameover') {
      const blink = Math.sin((nowMs - this.gameOverMs) * 0.016) > 0 ? 1 : 0.2;
      for (let i = 0; i < WAVE75_KEY_COUNT; i++) {
        keys[i] = lerpRgb(keys[i], { r: 255, g: 20, b: 35 }, 0.65 * blink);
      }
      keys[SPACE_KEY_INDEX] = { r: 255, g: 255, b: 255 };
      keys[ESC_KEY_INDEX] = { r: 255, g: 40, b: 40 };
    } else if (this.status === 'ready' || this.status === 'paused') {
      const breath = 0.4 + 0.6 * (0.5 + 0.5 * Math.sin(nowMs * 0.006));
      keys[SPACE_KEY_INDEX] = scaleRgb({ r: 52, g: 211, b: 153 }, breath);
      keys[ESC_KEY_INDEX] = { r: 90, g: 60, b: 120 };
    } else {
      const eatGlow = eatAge >= 0 && eatAge < 300 ? 1 - eatAge / 300 : 0;
      keys[SPACE_KEY_INDEX] = lerpRgb({ r: 16, g: 55, b: 42 }, { r: 255, g: 225, b: 80 }, eatGlow);
      keys[ESC_KEY_INDEX] = { r: 45, g: 20, b: 35 };
    }

    // Apply master brightness
    for (let i = 0; i < WAVE75_KEY_COUNT; i++) {
      keys[i] = scaleRgb(keys[i], bright);
    }

    const logoBase =
      this.status === 'gameover'
        ? { r: 255, g: 30, b: 45 }
        : eatAge >= 0 && eatAge < 340
          ? { r: 255, g: 225, b: 80 }
          : this.getSegmentColor(1, Math.max(2, this.snake.length), nowMs);

    return {
      keys,
      logo: scaleRgb(logoBase, bright),
    };
  }
}

export const waveSnakeEngine = new WaveSnakeGameEngine();
