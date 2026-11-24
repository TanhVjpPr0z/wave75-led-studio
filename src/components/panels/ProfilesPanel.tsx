import React, { useRef, useState } from 'react';
import {
  Save,
  Download,
  Upload,
  Copy,
  Trash2,
  Check,
  HardDrive,
  RotateCcw,
  Plus,
  Edit3,
} from 'lucide-react';
import { useStudioStore, type StudioProfile } from '../../store/useStudioStore';
import { TRANSLATIONS } from '../../i18n';
import { rgbToHex } from '../../core/utils/color';
import { hidManager, type HidConnectionState } from '../../core/hid/hidManager';

interface ProfilesPanelProps {
  hidState: HidConnectionState;
}

export const ProfilesPanel: React.FC<ProfilesPanelProps> = ({ hidState }) => {
  const language = useStudioStore((s) => s.language);
  const profiles = useStudioStore((s) => s.profiles);
  const activeProfileId = useStudioStore((s) => s.activeProfileId);
  const createProfile = useStudioStore((s) => s.createProfile);
  const applyProfile = useStudioStore((s) => s.applyProfile);
  const renameProfile = useStudioStore((s) => s.renameProfile);
  const duplicateProfile = useStudioStore((s) => s.duplicateProfile);
  const deleteProfile = useStudioStore((s) => s.deleteProfile);
  const importProfileJson = useStudioStore((s) => s.importProfileJson);
  const resetDefaultLighting = useStudioStore((s) => s.resetDefaultLighting);

  const [newName, setNewName] = useState('');
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameText, setRenameText] = useState('');
  const [statusMsg, setStatusMsg] = useState<{
    type: 'ok' | 'err';
    text: string;
  } | null>(null);
  const [savingHw, setSavingHw] = useState(false);

  const importInputRef = useRef<HTMLInputElement | null>(null);
  const t = TRANSLATIONS[language];

  const showNotice = (type: 'ok' | 'err', text: string) => {
    setStatusMsg({ type, text });
    window.setTimeout(() => setStatusMsg(null), 3500);
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    createProfile(newName);
    setNewName('');
  };

  const handleExportProfile = (prof: StudioProfile) => {
    const blob = new Blob([JSON.stringify(prof, null, 2)], {
      type: 'application/json;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `win60he-profile-${prof.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleImportFile = async (file: File) => {
    const text = await file.text();
    const res = importProfileJson(text);
    if (res.ok) {
      showNotice(
        'ok',
        language === 'vi'
          ? `Đã nhập thành công profile từ ${file.name}`
          : `Imported profile from ${file.name}`
      );
    } else {
      showNotice('err', res.error ?? 'Import failed');
    }
  };

  const handleSaveToKeyboard = async () => {
    if (!hidState.capabilities.supportsOnboardSave) {
      showNotice('err', t.profiles.saveUnsupported);
      return;
    }
    setSavingHw(true);
    try {
      await hidManager.saveToOnboardMemory();
      showNotice('ok', t.profiles.saveSuccess);
    } catch (err) {
      showNotice('err', err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSavingHw(false);
    }
  };

  const handleResetDefault = async () => {
    resetDefaultLighting();
    try {
      await hidManager.resetLighting();
    } catch {
      // Logged in HID Inspector
    }
    showNotice('ok', t.profiles.resetSuccess);
  };

  return (
    <div className="grid gap-5 lg:grid-cols-12">
      {/* Left: Saved Profiles List + Import/Export */}
      <div className="space-y-4 lg:col-span-7">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-bold text-slate-100">{t.profiles.title}</h2>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => importInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-[#0B0E14] px-3 py-1.5 text-xs font-medium text-slate-200 transition hover:border-cyan-400/50 hover:text-cyan-200"
            >
              <Upload className="h-3.5 w-3.5" />
              {t.profiles.importJson}
            </button>
            <input
              ref={importInputRef}
              type="file"
              accept=".json,application/json"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handleImportFile(file);
                e.target.value = '';
              }}
              className="hidden"
            />
          </div>
        </div>

        {/* Create New Profile Bar */}
        <form onSubmit={handleCreate} className="flex gap-2">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder={t.profiles.placeholderName}
            className="flex-1 rounded-xl border border-white/10 bg-[#0B0E14] px-3.5 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:border-cyan-400 focus:outline-none"
          />
          <button
            type="submit"
            className="inline-flex items-center gap-1.5 rounded-xl bg-cyan-500/20 px-4 py-2 text-xs font-semibold text-cyan-200 ring-1 ring-cyan-400/40 transition hover:bg-cyan-500/30"
          >
            <Plus className="h-3.5 w-3.5" />
            {t.profiles.createNew}
          </button>
        </form>

        {statusMsg && (
          <div
            className={`rounded-xl border px-3.5 py-2 text-xs ${
              statusMsg.type === 'ok'
                ? 'border-emerald-500/35 bg-emerald-500/10 text-emerald-200'
                : 'border-rose-500/35 bg-rose-500/10 text-rose-200'
            }`}
          >
            {statusMsg.text}
          </div>
        )}

        {/* Profiles Cards */}
        <div className="space-y-2.5">
          {profiles.map((prof) => {
            const isActive = prof.id === activeProfileId;
            const sampleSwatches = [0, 8, 16, 28, 38, 48, 56].map(
              (idx) => prof.perKeyColors[idx] ?? { r: 6, g: 182, b: 212 }
            );

            return (
              <div
                key={prof.id}
                className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3.5 transition ${
                  isActive
                    ? 'border-cyan-400/60 bg-cyan-500/10'
                    : 'border-white/[0.08] bg-[#0B0E14]/70 hover:border-white/20'
                }`}
              >
                <div className="min-w-0 flex-1">
                  {renamingId === prof.id ? (
                    <div className="flex items-center gap-1.5">
                      <input
                        type="text"
                        value={renameText}
                        onChange={(e) => setRenameText(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            renameProfile(prof.id, renameText);
                            setRenamingId(null);
                          }
                        }}
                        autoFocus
                        className="rounded border border-cyan-400 bg-[#131822] px-2 py-1 text-xs text-white focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          renameProfile(prof.id, renameText);
                          setRenamingId(null);
                        }}
                        className="rounded bg-cyan-500/20 p-1 text-cyan-300"
                      >
                        <Check className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-semibold text-slate-100">
                        {prof.name}
                      </span>
                      {isActive && (
                        <span className="rounded-full bg-cyan-500/20 px-2 py-0.5 text-[10px] font-semibold text-cyan-300">
                          {t.profiles.active}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Color Preview Strip */}
                  <div className="mt-2 flex items-center gap-1">
                    {sampleSwatches.map((c, i) => (
                      <span
                        key={i}
                        className="h-2.5 w-5 rounded-sm border border-white/10"
                        style={{ backgroundColor: rgbToHex(c) }}
                      />
                    ))}
                    <span className="ml-2 font-mono text-[10px] text-slate-500">
                      {prof.activeTab.toUpperCase()} • {prof.effectParams.mode}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => applyProfile(prof.id)}
                    className="rounded-lg border border-cyan-400/40 bg-cyan-500/15 px-2.5 py-1.5 text-xs font-semibold text-cyan-200 hover:bg-cyan-500/25"
                  >
                    {t.profiles.apply}
                  </button>
                  <button
                    type="button"
                    title="Rename"
                    onClick={() => {
                      setRenamingId(prof.id);
                      setRenameText(prof.name);
                    }}
                    className="rounded-lg border border-white/10 bg-[#131822] p-1.5 text-slate-400 hover:text-slate-100"
                  >
                    <Edit3 className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    title={t.profiles.duplicate}
                    onClick={() => duplicateProfile(prof.id)}
                    className="rounded-lg border border-white/10 bg-[#131822] p-1.5 text-slate-400 hover:text-slate-100"
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    title={t.profiles.exportJson}
                    onClick={() => handleExportProfile(prof)}
                    className="rounded-lg border border-white/10 bg-[#131822] p-1.5 text-slate-400 hover:text-cyan-200"
                  >
                    <Download className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    disabled={profiles.length <= 1}
                    title={t.profiles.delete}
                    onClick={() => deleteProfile(prof.id)}
                    className="rounded-lg border border-white/10 bg-[#131822] p-1.5 text-slate-400 hover:text-rose-300 disabled:opacity-30"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Right: Onboard Memory Save & Factory LED Reset */}
      <div className="space-y-4 lg:col-span-5">
        <div className="space-y-4 rounded-xl border border-white/[0.07] bg-[#0B0E14]/65 p-5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-500/15 text-violet-300 ring-1 ring-violet-400/30">
              <HardDrive className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-100">
                {t.profiles.hardwareMemoryTitle}
              </h3>
              <span className="font-mono text-[11px] text-slate-400">
                {hidState.capabilities.driverPlatform}
              </span>
            </div>
          </div>

          {!hidState.capabilities.supportsOnboardSave && (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200">
              {t.profiles.saveUnsupported}
            </div>
          )}

          <button
            type="button"
            disabled={!hidState.capabilities.supportsOnboardSave || savingHw}
            onClick={() => void handleSaveToKeyboard()}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-violet-500 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-cyan-500/20 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Save className="h-4 w-4" />
            {savingHw ? t.profiles.saving : t.profiles.saveToKeyboard}
          </button>

          <button
            type="button"
            onClick={() => void handleResetDefault()}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-[#131822] px-4 py-2.5 text-xs font-semibold text-slate-300 transition hover:border-rose-400/40 hover:text-rose-200"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            {t.profiles.resetDefault}
          </button>
        </div>
      </div>
    </div>
  );
};

