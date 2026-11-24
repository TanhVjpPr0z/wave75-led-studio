import React, { useEffect, useRef } from 'react';
import type { AnimeCharacterProfile, AnimeStageSettings } from './animeCharacters';

interface AnimeCharacterStageProps {
  character: AnimeCharacterProfile;
  settings: AnimeStageSettings;
  /** True for Welcome Gate (100% opacity, full interactive 3D tilt), false for subtle Studio backdrop */
  variant: 'gate' | 'studio';
}

/**
 * 2.5D Live2D-Style GPU-Composited Character Motion Stage.
 * Uses direct DOM ref + RAF spring lerp for 3D perspective mouse tracking (ZERO React re-renders!).
 */
export const AnimeCharacterStage: React.FC<AnimeCharacterStageProps> = ({
  character,
  settings,
  variant,
}) => {
  const tiltRef = useRef<HTMLDivElement | null>(null);
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  useEffect(() => {
    const el = tiltRef.current;
    if (!el) return;

    let targetX = 0;
    let targetY = 0;
    let curX = 0;
    let curY = 0;
    let raf = 0;

    const onMove = (e: MouseEvent) => {
      targetX = (e.clientX / window.innerWidth - 0.5) * 2; // -1..1
      targetY = (e.clientY / window.innerHeight - 0.5) * 2; // -1..1
    };

    window.addEventListener('mousemove', onMove, { passive: true });

    const tick = () => {
      const s = settingsRef.current;
      const amp = s.motionMode === 'still' ? 0 : s.intensity;
      const baseScale = s.zoom / 100;

      curX += (targetX - curX) * 0.085;
      curY += (targetY - curY) * 0.085;

      if (amp === 0) {
        el.style.transform = `scale3d(${baseScale}, ${baseScale}, 1)`;
      } else {
        const mult = variant === 'gate' ? 1 : 0.45;
        const tx = -curX * 14 * amp * mult;
        const ty = -curY * 10 * amp * mult;
        const rotY = curX * 3.2 * amp * mult;
        const rotX = -curY * 2.4 * amp * mult;
        el.style.transform = `perspective(1100px) translate3d(${tx.toFixed(2)}px, ${ty.toFixed(2)}px, 0) rotateX(${rotX.toFixed(2)}deg) rotateY(${rotY.toFixed(2)}deg) scale3d(${baseScale}, ${baseScale}, 1)`;
      }

      raf = window.requestAnimationFrame(tick);
    };

    raf = window.requestAnimationFrame(tick);
    return () => {
      window.cancelAnimationFrame(raf);
      window.removeEventListener('mousemove', onMove);
    };
  }, [variant]);

  const imgSrc = settings.customImageUrl || character.bgImage;
  const opacity = variant === 'gate' ? 1 : settings.studioBackdropOpacity / 100;

  return (
    <div
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
      style={{ opacity, contain: 'strict', transition: 'opacity 320ms ease' }}
      aria-hidden="true"
    >
      {/* Direct-DOM 3D Perspective Mouse-Tilt Wrapper */}
      <div
        ref={tiltRef}
        className="absolute inset-[-28px]"
        style={{ willChange: 'transform', transformOrigin: 'center center' }}
      >
        {/* Pure GPU CSS Motion Keyframe Layer */}
        <div
          key={`${character.id}-${settings.customImageUrl ? 'custom' : 'preset'}`}
          className={`anime-bg-fade relative h-full w-full char-motion-${settings.motionMode}`}
          style={
            {
              '--motion-amp': String(settings.intensity),
            } as React.CSSProperties
          }
        >
          <img
            src={imgSrc}
            alt={character.name}
            decoding="async"
            className="h-full w-full object-cover"
            style={{
              objectPosition: settings.customImageUrl ? 'center center' : character.bgPosition,
            }}
          />

          {/* Hologram Cyber Sheen Overlay (Pure GPU translate3d) */}
          {settings.motionMode === 'cyber_hologram' && (
            <div
              className="char-hologram-beam absolute inset-y-0 left-0 w-[35%]"
              style={{
                background:
                  'linear-gradient(90deg, transparent, rgba(251,113,133,0.22), rgba(254,240,138,0.28), transparent)',
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
};
