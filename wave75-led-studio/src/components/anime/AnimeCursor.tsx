import React, { useEffect, useRef } from 'react';
import type { AnimeCharacterTheme } from './animeCharacters';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  life: number;
  maxLife: number;
  rot: number;
  vRot: number;
  kind: 'petal' | 'star' | 'ring';
  color: string;
}

interface AnimeCursorProps {
  enabled: boolean;
  theme: AnimeCharacterTheme;
}

export const AnimeCursor: React.FC<AnimeCursorProps> = ({ enabled, theme }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const ringRef = useRef<HTMLDivElement | null>(null);
  const themeRef = useRef<AnimeCharacterTheme>(theme);
  themeRef.current = theme;

  useEffect(() => {
    if (enabled) {
      document.body.classList.add('anime-cursor-on');
    } else {
      document.body.classList.remove('anime-cursor-on');
    }
    return () => {
      document.body.classList.remove('anime-cursor-on');
    };
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let dpr = Math.min(window.devicePixelRatio || 1, 2);
    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(window.innerWidth * dpr);
      canvas.height = Math.floor(window.innerHeight * dpr);
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener('resize', resize);

    const particles: Particle[] = [];
    let targetX = -100;
    let targetY = -100;
    let ringX = -100;
    let ringY = -100;
    let lastEmitX = -100;
    let lastEmitY = -100;
    let hoveringInteractive = false;
    let visible = false;

    const spawn = (x: number, y: number, burst: boolean) => {
      const palette = themeRef.current.particleColors;
      const count = burst ? 10 : 1;
      for (let i = 0; i < count; i++) {
        const ang = burst
          ? (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.4
          : Math.random() * Math.PI * 2;
        const spd = burst ? 1.4 + Math.random() * 2.6 : 0.3 + Math.random() * 0.7;
        particles.push({
          x,
          y,
          vx: Math.cos(ang) * spd,
          vy: Math.sin(ang) * spd + (burst ? -0.4 : 0.35),
          size: burst ? 4.5 + Math.random() * 3.5 : 3 + Math.random() * 3.5,
          life: 0,
          maxLife: burst ? 30 + Math.random() * 18 : 24 + Math.random() * 16,
          rot: Math.random() * Math.PI * 2,
          vRot: (Math.random() - 0.5) * 0.16,
          kind: Math.random() > 0.45 ? 'petal' : 'star',
          color: palette[Math.floor(Math.random() * palette.length)],
        });
      }
      if (burst) {
        particles.push({
          x,
          y,
          vx: 0,
          vy: 0,
          size: 8,
          life: 0,
          maxLife: 22,
          rot: 0,
          vRot: 0,
          kind: 'ring',
          color: themeRef.current.ringHex,
        });
      }
      if (particles.length > 90) {
        particles.splice(0, particles.length - 90);
      }
    };

    const onMove = (e: MouseEvent) => {
      targetX = e.clientX;
      targetY = e.clientY;
      visible = true;

      const el = e.target as HTMLElement | null;
      hoveringInteractive = Boolean(
        el?.closest('button, a, select, input[type="range"], [role="button"], label')
      );

      const dist = Math.hypot(targetX - lastEmitX, targetY - lastEmitY);
      if (dist > 18) {
        spawn(targetX, targetY, false);
        lastEmitX = targetX;
        lastEmitY = targetY;
      }
    };

    const onDown = (e: MouseEvent) => {
      spawn(e.clientX, e.clientY, true);
    };

    const onLeave = () => {
      visible = false;
    };

    window.addEventListener('mousemove', onMove, { passive: true });
    window.addEventListener('mousedown', onDown, { passive: true });
    document.addEventListener('mouseleave', onLeave);

    let raf = 0;
    const render = () => {
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

      // Spring-interpolated sakura aura ring
      ringX += (targetX - ringX) * 0.22;
      ringY += (targetY - ringY) * 0.22;
      if (ringRef.current) {
        const scale = hoveringInteractive ? 1.55 : 1;
        ringRef.current.style.opacity = visible ? '1' : '0';
        ringRef.current.style.transform = `translate3d(${ringX - 18}px, ${ringY - 18}px, 0) scale(${scale})`;
        ringRef.current.style.borderColor = hoveringInteractive
          ? themeRef.current.accent
          : themeRef.current.ringHex;
        ringRef.current.style.boxShadow = `0 0 16px rgba(${themeRef.current.primaryRgb}, 0.5)`;
      }

      // Render particles
      for (let i = particles.length - 1; i >= 0; i--) {
        const pt = particles[i];
        pt.life += 1;
        if (pt.life >= pt.maxLife) {
          particles.splice(i, 1);
          continue;
        }
        const t = pt.life / pt.maxLife;
        const alpha = 1 - t;
        pt.x += pt.vx;
        pt.y += pt.vy;
        pt.rot += pt.vRot;

        ctx.save();
        ctx.globalAlpha = alpha * 0.9;
        ctx.translate(pt.x, pt.y);
        ctx.rotate(pt.rot);

        if (pt.kind === 'ring') {
          const r = pt.size + t * 28;
          ctx.beginPath();
          ctx.arc(0, 0, r, 0, Math.PI * 2);
          ctx.strokeStyle = pt.color;
          ctx.lineWidth = 2 * (1 - t);
          ctx.stroke();
        } else if (pt.kind === 'petal') {
          ctx.fillStyle = pt.color;
          ctx.beginPath();
          ctx.ellipse(0, 0, pt.size, pt.size * 0.52, 0, 0, Math.PI * 2);
          ctx.fill();
        } else {
          // 4-point anime sparkle star
          const s = pt.size * (1 - t * 0.4);
          ctx.fillStyle = pt.color;
          ctx.beginPath();
          ctx.moveTo(0, -s);
          ctx.quadraticCurveTo(0, 0, s, 0);
          ctx.quadraticCurveTo(0, 0, 0, s);
          ctx.quadraticCurveTo(0, 0, -s, 0);
          ctx.quadraticCurveTo(0, 0, 0, -s);
          ctx.fill();
        }
        ctx.restore();
      }

      raf = window.requestAnimationFrame(render);
    };
    raf = window.requestAnimationFrame(render);

    return () => {
      window.cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mousedown', onDown);
      document.removeEventListener('mouseleave', onLeave);
    };
  }, [enabled]);

  if (!enabled) return null;

  return (
    <>
      <canvas
        ref={canvasRef}
        className="pointer-events-none fixed inset-0 z-[100]"
        aria-hidden="true"
      />
      <div
        ref={ringRef}
        aria-hidden="true"
        className="pointer-events-none fixed left-0 top-0 z-[99] h-9 w-9 rounded-full border-2 border-rose-400/60 bg-rose-500/10 shadow-[0_0_16px_rgba(244,63,94,0.45)] transition-[border-color,opacity] duration-150"
        style={{ opacity: 0, willChange: 'transform' }}
      />
    </>
  );
};
