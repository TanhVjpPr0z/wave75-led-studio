import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { useStudioStore } from '../../store/useStudioStore';
import { TRANSLATIONS } from '../../i18n';
import { hidManager } from '../../core/hid/hidManager';

export const BrowserWarningBanner: React.FC = () => {
  const language = useStudioStore((s) => s.language);
  const t = TRANSLATIONS[language];

  if (hidManager.isWebHidSupported()) {
    return null;
  }

  return (
    <div className="border-b border-amber-500/30 bg-amber-500/10 px-4 py-2.5">
      <div className="mx-auto flex max-w-7xl items-start gap-3 text-xs text-amber-200">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
        <div>
          <span className="font-semibold text-amber-100">{t.browserWarning.title}: </span>
          <span className="text-amber-200/90">{t.browserWarning.body}</span>
        </div>
      </div>
    </div>
  );
};

