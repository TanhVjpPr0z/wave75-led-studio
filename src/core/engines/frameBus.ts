import { TOTAL_KEYS } from '../layout/win60heLayout';
import { BLACK, type RGB } from '../utils/color';

type FrameListener = (colors: RGB[]) => void;

let currentFrame: RGB[] = new Array<RGB>(TOTAL_KEYS).fill(BLACK);
const listeners = new Set<FrameListener>();

/**
 * Zero-React-re-render 60 FPS frame pub/sub bus.
 * Keeps the rAF animation loop & WebHID USB streaming completely off React's reconciler.
 */
export function publishFrame(colors: RGB[]): void {
  currentFrame = colors;
  listeners.forEach((fn) => fn(colors));
}

export function getCurrentFrame(): RGB[] {
  return currentFrame;
}

export function subscribeFrame(listener: FrameListener): () => void {
  listeners.add(listener);
  listener(currentFrame);
  return () => {
    listeners.delete(listener);
  };
}
