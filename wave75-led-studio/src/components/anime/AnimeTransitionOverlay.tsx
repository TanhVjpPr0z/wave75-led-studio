import React, { useEffect, useState } from 'react';
import { Sparkles, CheckCircle2 } from 'lucide-react';
import type { AnimeCharacterProfile } from './animeCharacters';

export type TransitionPhase = 'idle' | 'closing' | 'hold' | 'opening';

interface AnimeTransitionOverlayProps {
  phase: TransitionPhase;
  isPreviewMode: boolean;
  isVi: boolean;
  character: AnimeCharacterProfile;
  customImageUrl?: string | null;
}

/**
 * 100% GPU-Composited Split-Gate + Anime Cut-In Transition (ZERO blur / ZERO backdrop-filter!)
 * - Frame 0: shutters start offscreen, then next RAF smoothly glide shut at 120 FPS.
 * - Hold: Studio mounts silently behind the solid curtain (zero visual stutter!).
 * - Opening: Shutters part smoothly revealing the already-running Studio!
 */
export const AnimeTransitionOverlay: React.FC<AnimeTransitionOverlayProps> = ({
  phase,
  isPreviewMode,
  isVi,
  character,
  customImageUrl,
}) => {
  const [entered, setEntered] = useState(false);

  useEffect(() => {
    if (phase === 'idle') {
      setEntered(false);
      return;
    }
    if (phase === 'closing') {
      setEntered(false);
      const id = window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => setEntered(true));
      });
      return () => window.cancelAnimationFrame(id);
    }
    setEntered(true);
  }, [phase]);

  if (phase === 'idle') return null;

  const isClosed = (phase === 'closing' && entered) || phase === 'hold';
  const isOpening = phase === 'opening';
  const avatarSrc = customImageUrl || character.avatarImage;

  return (
    <div
      className="pointer-events-none fixed inset-0 z-[90] overflow-hidden"
      style={{ contain: 'strict' }}
      aria-hidden="true"
    >
      {/* Left Velvet Shutter Panel (Pure GPU translate3d, Dynamic Character Theme!) */}
      <div
        className="absolute inset-y-0 left-0 w-[58vw]"
        style={{
          background: `linear-gradient(135deg, ${character.theme.bg} 0%, ${character.theme.shutterMid} 55%, ${character.theme.shutterEnd} 100%)`,
          borderRight: `2px solid ${character.theme.primary}`,
          transform: isClosed
            ? 'translate3d(-4%, 0, 0) skewX(-8deg)'
            : 'translate3d(-115%, 0, 0) skewX(-8deg)',
          transition: isOpening
            ? 'transform 460ms cubic-bezier(0.76, 0, 0.24, 1)'
            : 'transform 300ms cubic-bezier(0.22, 1, 0.36, 1)',
          willChange: 'transform',
        }}
      >
        <div
          className="absolute inset-y-0 right-0 w-1.5"
          style={{
            background: `linear-gradient(180deg, ${character.theme.secondary}, ${character.theme.primary}, ${character.theme.accent})`,
          }}
        />
      </div>

      {/* Right Velvet Shutter Panel (Pure GPU translate3d, Dynamic Character Theme!) */}
      <div
        className="absolute inset-y-0 right-0 w-[58vw]"
        style={{
          background: `linear-gradient(315deg, ${character.theme.bg} 0%, ${character.theme.shutterMid} 55%, ${character.theme.shutterEnd} 100%)`,
          borderLeft: `2px solid ${character.theme.accent}`,
          transform: isClosed
            ? 'translate3d(4%, 0, 0) skewX(-8deg)'
            : 'translate3d(115%, 0, 0) skewX(-8deg)',
          transition: isOpening
            ? 'transform 460ms cubic-bezier(0.76, 0, 0.24, 1)'
            : 'transform 300ms cubic-bezier(0.22, 1, 0.36, 1)',
          willChange: 'transform',
        }}
      >
        <div
          className="absolute inset-y-0 left-0 w-1.5"
          style={{
            background: `linear-gradient(180deg, ${character.theme.accent}, ${character.theme.primary}, ${character.theme.secondary})`,
          }}
        />
      </div>

      {/* Center Anime Character Cut-In Ribbon (Pure GPU transform3d + opacity) */}
      <div className="absolute inset-0 flex items-center justify-center px-4">
        <div
          className="relative flex items-center gap-4 rounded-3xl px-6 py-4 shadow-[0_20px_60px_rgba(0,0,0,0.75)]"
          style={{
            backgroundColor: character.theme.bg,
            border: `1.5px solid rgba(${character.theme.primaryRgb}, 0.65)`,
            transform: isClosed
              ? 'translate3d(0, 0, 0) scale3d(1, 1, 1)'
              : isOpening
                ? 'translate3d(0, -16px, 0) scale3d(0.92, 0.92, 1)'
                : 'translate3d(0, 18px, 0) scale3d(0.92, 0.92, 1)',
            opacity: isClosed ? 1 : 0,
            transition: isOpening
              ? 'transform 220ms cubic-bezier(0.4, 0, 1, 1), opacity 200ms ease-out'
              : 'transform 280ms cubic-bezier(0.16, 1, 0.3, 1), opacity 220ms ease-out',
            willChange: 'transform, opacity',
          }}
        >
          <div
            className="relative h-16 w-16 shrink-0 overflow-hidden rounded-2xl border-2"
            style={{
              borderColor: character.theme.secondary,
              boxShadow: `0 0 24px rgba(${character.theme.primaryRgb}, 0.65)`,
            }}
          >
            <img
              src={avatarSrc}
              alt={character.name}
              className="h-full w-full object-cover object-top"
            />
            <span className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full border-2 border-[#150712] bg-emerald-400 text-[#0b040a]">
              <CheckCircle2 className="h-3.5 w-3.5" />
            </span>
          </div>

          <div className="min-w-0 text-left">
            <div className="inline-flex items-center gap-1.5 rounded-full border border-amber-300/50 bg-amber-400/15 px-2.5 py-0.5 font-mono text-[10px] font-bold tracking-[0.18em] text-amber-200">
              <Sparkles className="h-3 w-3" />
              {isPreviewMode
                ? `STUDIO PREVIEW • ${character.name.toUpperCase()}`
                : `LINK ESTABLISHED • ${character.name.toUpperCase()}`}
            </div>
            <h2 className="mt-1 bg-gradient-to-r from-white via-rose-200 to-amber-200 bg-clip-text text-lg font-black tracking-tight text-transparent sm:text-xl">
              {isVi ? character.transitionQuoteVi : character.transitionQuoteEn}
            </h2>
          </div>
        </div>
      </div>
    </div>
  );
};
