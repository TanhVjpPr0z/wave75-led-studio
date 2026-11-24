import React from 'react';
import { Keyboard, X } from 'lucide-react';
import { useWaveStore } from '../../store/useWaveStore';
import { TRANSLATIONS } from '../../i18n';

export const ShortcutsCheatsheetModal: React.FC = () => {
  const language = useWaveStore((s) => s.language);
  const open = useWaveStore((s) => s.shortcutsOpen);
  const setOpen = useWaveStore((s) => s.setShortcutsOpen);
  const t = TRANSLATIONS[language];

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-white/10 bg-[#121721] shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <div className="flex items-center gap-2.5">
            <Keyboard className="h-5 w-5 text-sky-400" />
            <h2 className="text-sm font-bold text-slate-100">{t.shortcuts.title}</h2>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-white/5 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="divide-y divide-white/[0.06] px-5 py-2">
          {t.shortcuts.items.map((item) => (
            <div key={item.keys} className="flex items-center justify-between gap-4 py-2.5">
              <kbd className="shrink-0 rounded-lg border border-sky-400/35 bg-sky-500/10 px-2.5 py-1 font-mono text-xs font-bold text-sky-200">
                {item.keys}
              </kbd>
              <span className="text-right text-xs text-slate-300">{item.desc}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

