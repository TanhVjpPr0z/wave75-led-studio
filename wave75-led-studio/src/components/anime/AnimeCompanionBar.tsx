import React from 'react';
import { Sparkles, Sliders } from 'lucide-react';
import type { WaveStudioTab } from '../../store/useWaveStore';
import {
  ANIME_CHARACTERS,
  type AnimeCharacterId,
  type AnimeCharacterProfile,
} from './animeCharacters';

interface AnimeCompanionBarProps {
  activeTab: WaveStudioTab;
  connected: boolean;
  quickSaveToast: string | null;
  isVi: boolean;
  character: AnimeCharacterProfile;
  customImageUrl?: string | null;
  onSelectCharacter: (id: AnimeCharacterId) => void;
  onOpenMotionEditor: () => void;
}

export const AnimeCompanionBar: React.FC<AnimeCompanionBarProps> = ({
  activeTab,
  connected,
  quickSaveToast,
  isVi,
  character,
  customImageUrl,
  onSelectCharacter,
  onOpenMotionEditor,
}) => {
  const quote = quickSaveToast
    ? `✨ ${quickSaveToast}`
    : isVi
      ? character.tabQuotesVi[activeTab]
      : character.tabQuotesEn[activeTab];

  return (
    <div className="anime-glass flex flex-wrap items-center justify-between gap-3 rounded-2xl px-4 py-2.5">
      <div className="flex min-w-0 flex-1 items-center gap-3.5">
        <div
          className="relative h-11 w-11 shrink-0 overflow-hidden rounded-xl border-2 transition-all duration-300"
          style={{
            borderColor: character.theme.primary,
            boxShadow: `0 0 16px rgba(${character.theme.primaryRgb}, 0.45)`,
          }}
        >
          <img
            src={customImageUrl || character.avatarImage}
            alt={character.name}
            className="h-full w-full object-cover object-top"
          />
          <span
            className={`absolute bottom-0.5 right-0.5 h-2.5 w-2.5 rounded-full border border-black ${
              connected ? 'bg-emerald-400 shadow-[0_0_6px_#34d399]' : 'bg-amber-400'
            }`}
          />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-extrabold tracking-wide text-white"
              style={{
                background: `linear-gradient(90deg, ${character.theme.primary}, ${character.theme.accent})`,
              }}
            >
              <Sparkles className="h-2.5 w-2.5" />
              {character.name}
            </span>
            <span
              className="text-[10px] font-semibold"
              style={{ color: character.theme.secondary }}
            >
              {isVi ? character.theme.themeNameVi : character.theme.themeNameEn}
            </span>
          </div>
          <p
            key={`${character.id}-${quote}`}
            className="anime-panel-enter mt-0.5 text-xs text-slate-100/95"
          >
            {quote}
          </p>
        </div>
      </div>

      {/* Quick In-Studio Character Switcher + Live2D Motion Editor Button */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1.5">
          {ANIME_CHARACTERS.map((ch) => {
            const active = !customImageUrl && ch.id === character.id;
            return (
              <button
                key={ch.id}
                type="button"
                onClick={() => onSelectCharacter(ch.id)}
                title={`${ch.name} — ${isVi ? ch.theme.themeNameVi : ch.theme.themeNameEn}`}
                className={`relative h-8 w-8 overflow-hidden rounded-full border-2 transition hover:scale-110 ${
                  active ? 'scale-105 opacity-100' : 'border-white/20 opacity-65 hover:opacity-100'
                }`}
                style={
                  active
                    ? {
                        borderColor: ch.theme.primary,
                        boxShadow: `0 0 14px rgba(${ch.theme.primaryRgb}, 0.75)`,
                      }
                    : undefined
                }
              >
                <img
                  src={ch.avatarImage}
                  alt={ch.shortName}
                  className="h-full w-full object-cover object-top"
                />
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={onOpenMotionEditor}
          className="anime-badge-themed inline-flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-[11px] font-bold transition hover:brightness-115"
        >
          <Sliders className="h-3.5 w-3.5" />
          <span>{isVi ? 'Chỉnh chuyển động' : 'Edit Motion'}</span>
        </button>
      </div>
    </div>
  );
};
