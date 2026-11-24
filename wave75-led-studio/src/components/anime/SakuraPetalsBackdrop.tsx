import React, { useEffect, useRef } from 'react';

interface Petal {
  x: number;
  y: number;
  size: number;
  speedY: number;
  speedX: number;
  swayAmp: number;
  swayPhase: number;
  rot: number;
  vRot: number;
  alpha: number;
  hue: string;
}

interface SakuraPetalsBackdropProps {
  density?: number;
  zIndexClass?: string;
  colors?: string[];
}

const DEFAULT_PETAL_COLORS = [
  'rgba(253, 164, 175, 0.72)',
  'rgba(251, 113, 133, 0.65)',
  'rgba(244, 63, 94, 0.55)',
  'rgba(255, 228, 230, 0.65)',
  'rgba(253, 224, 71, 0.45)',
];

export const SakuraPetalsBackdrop: React.FC<SakuraPetalsBackdropProps> = ({
  density = 26,
  zIndexClass = 'z-0',
  colors = DEFAULT_PETAL_COLORS,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const colorsRef = useRef<string[]>(colors);
  colorsRef.current = colors;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let w = window.innerWidth;
    let h = window.innerHeight;
    const resize = () => {
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = w;
      canvas.height = h;
    };
    resize();
    window.addEventListener('resize', resize);

    const makePetal = (randomY: boolean): Petal => ({
      x: Math.random() * w,
      y: randomY ? Math.random() * h : -20 - Math.random() * 60,
      size: 4 + Math.random() * 6,
      speedY: 0.45 + Math.random() * 0.85,
      speedX: -0.35 - Math.random() * 0.45,
      swayAmp: 0.35 + Math.random() * 0.65,
      swayPhase: Math.random() * Math.PI * 2,
      rot: Math.random() * Math.PI * 2,
      vRot: (Math.random() - 0.5) * 0.025,
      alpha: 0.25 + Math.random() * 0.55,
      hue: colorsRef.current[Math.floor(Math.random() * colorsRef.current.length)],
    });

    const petals: Petal[] = Array.from({ length: density }, () => makePetal(true));
    let tick = 0;
    let raf = 0;

    const frame = () => {
      tick += 0.016;
      ctx.clearRect(0, 0, w, h);

      for (let i = 0; i < petals.length; i++) {
        const p = petals[i];
        p.y += p.speedY;
        p.x += p.speedX + Math.sin(tick * 1.4 + p.swayPhase) * p.swayAmp;
        p.rot += p.vRot;

        if (p.y > h + 24 || p.x < -30) {
          petals[i] = makePetal(false);
          petals[i].x = Math.random() * (w + 180);
          continue;
        }

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.globalAlpha = p.alpha;
        ctx.fillStyle = p.hue;

        // Soft teardrop sakura petal shape
        ctx.beginPath();
        ctx.moveTo(0, -p.size);
        ctx.bezierCurveTo(p.size * 0.85, -p.size * 0.4, p.size * 0.7, p.size * 0.8, 0, p.size);
        ctx.bezierCurveTo(-p.size * 0.7, p.size * 0.8, -p.size * 0.85, -p.size * 0.4, 0, -p.size);
        ctx.fill();
        ctx.restore();
      }

      raf = window.requestAnimationFrame(frame);
    };

    raf = window.requestAnimationFrame(frame);
    return () => {
      window.cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
    };
  }, [density]);

  return (
    <canvas
      ref={canvasRef}
      className={`pointer-events-none fixed inset-0 ${zIndexClass}`}
      aria-hidden="true"
    />
  );
};
