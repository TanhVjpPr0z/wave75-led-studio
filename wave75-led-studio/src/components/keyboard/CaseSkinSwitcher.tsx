import React from 'react';
import { useWaveStore, type WaveCaseSkin } from '../../store/useWaveStore';
import { TRANSLATIONS } from '../../i18n';

const SKINS: Array<{ id: WaveCaseSkin; swatch: string }> = [
  { id: 'anodized_black', swatch: 'linear-gradient(135deg, #272D3A, #10131A)' },
  { id: 'anodized_silver', swatch: 'linear-gradient(135deg, #E2E8F0, #94A3B8)' },
  { id: 'anodized_red', swatch: 'linear-gradient(135deg, #B91C1C, #7F1D1D)' },
  { id: 'ecoat_purple', swatch: 'linear-gradient(135deg, #A78BFA, #6D28D9)' },
  { id: 'spray_cream', swatch: 'linear-gradient(135deg, #F5EFE6, #D6C7B2)' },
];

export const CaseSkinSwitcher: React.FC = () => {
  const language = useWaveStore((s) => s.language);
  const caseSkin = useWaveStore((s) => s.caseSkin);
  const setCaseSkin = useWaveStore((s) => s.setCaseSkin);
  const t = TRANSLATIONS[language];

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="mr-1 text-[11px] font-medium text-slate-400">{t.skins.label}:</span>
      {SKINS.map((s) => {
        const active = caseSkin === s.id;
        return (
          <button
            key={s.id}
            type="button"
            onClick={() => setCaseSkin(s.id)}
            className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition ${
              active
                ? 'bg-sky-500/20 text-sky-200 ring-1 ring-sky-400/60'
                : 'bg-white/[0.03] text-slate-400 hover:bg-white/[0.07] hover:text-slate-200'
            }`}
          >
            <span
              className="h-3 w-3 rounded-full border border-white/30 shadow-inner"
              style={{ background: s.swatch }}
            />
            {t.skins[s.id]}
          </button>
        );
      })}
    </div>
  );
};

