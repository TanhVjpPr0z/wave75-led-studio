import React, { useState } from 'react';
import { ShieldCheck, Usb, X, AlertCircle } from 'lucide-react';
import { useStudioStore } from '../../store/useStudioStore';
import { TRANSLATIONS } from '../../i18n';

export const SafetyDisclaimerModal: React.FC = () => {
  const language = useStudioStore((s) => s.language);
  const safetyModalOpen = useStudioStore((s) => s.safetyModalOpen);
  const dismissSafetyModal = useStudioStore((s) => s.dismissSafetyModal);
  const [dontShow, setDontShow] = useState(true);

  const t = TRANSLATIONS[language];

  if (!safetyModalOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-white/10 bg-[#131822] shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/10 bg-gradient-to-r from-cyan-500/10 via-violet-500/10 to-transparent px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-500/15 text-cyan-400 ring-1 ring-cyan-400/30">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <span className="inline-block rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-300">
                {t.safetyModal.badge}
              </span>
              <h2 className="mt-0.5 text-base font-bold text-slate-100">
                {t.safetyModal.title}
              </h2>
            </div>
          </div>
          <button
            type="button"
            onClick={() => dismissSafetyModal(false)}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-white/5 hover:text-slate-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 px-6 py-5">
          <ul className="space-y-2.5 text-sm text-slate-300">
            {t.safetyModal.points.map((pt, i) => (
              <li key={i} className="flex items-start gap-2.5">
                <span className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-cyan-500/15 font-mono text-[11px] font-bold text-cyan-300">
                  {i + 1}
                </span>
                <span className="leading-relaxed">{pt}</span>
              </li>
            ))}
          </ul>

          <div className="flex items-start gap-2.5 rounded-xl border border-violet-500/25 bg-violet-500/10 p-3 text-xs text-violet-200">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-violet-300" />
            <span>{t.safetyModal.win60seNote}</span>
          </div>

          <label className="flex cursor-pointer items-center gap-2 text-xs text-slate-400">
            <input
              type="checkbox"
              checked={dontShow}
              onChange={(e) => setDontShow(e.target.checked)}
              className="h-4 w-4 rounded border-white/20 bg-[#0B0E14] accent-cyan-400"
            />
            <span>{t.safetyModal.dontShowAgain}</span>
          </label>
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-white/10 bg-[#0B0E14]/60 px-6 py-4">
          <button
            type="button"
            onClick={() => dismissSafetyModal(dontShow)}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-violet-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-cyan-500/20 transition hover:brightness-110"
          >
            <Usb className="h-4 w-4" />
            {t.safetyModal.confirmBtn}
          </button>
        </div>
      </div>
    </div>
  );
};

