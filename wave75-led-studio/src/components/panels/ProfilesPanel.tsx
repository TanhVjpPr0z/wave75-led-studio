import React, { useRef, useState } from 'react';
import { Upload, Download, Copy, Trash2, Plus, FileJson } from 'lucide-react';
import { useWaveStore } from '../../store/useWaveStore';
import { TRANSLATIONS } from '../../i18n';
import { rgbToHex } from '../../core/utils/color';
import {
  exportAsRdrProfileJson,
  type StudioWaveProfile,
} from '../../core/hid/rdrProfileParser';

export const ProfilesPanel: React.FC = () => {
  const language = useWaveStore((s) => s.language);
  const profiles = useWaveStore((s) => s.profiles);
  const activeProfileId = useWaveStore((s) => s.activeProfileId);
  const lightIndexMap = useWaveStore((s) => s.lightIndexMap);
  const createProfile = useWaveStore((s) => s.createProfile);
  const applyProfile = useWaveStore((s) => s.applyProfile);
  const duplicateProfile = useWaveStore((s) => s.duplicateProfile);
  const deleteProfile = useWaveStore((s) => s.deleteProfile);
  const importProfileText = useWaveStore((s) => s.importProfileText);

  const [newName, setNewName] = useState('');
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const importRef = useRef<HTMLInputElement | null>(null);
  const t = TRANSLATIONS[language];

  const downloadJson = (data: unknown, filename: string) => {
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: 'application/json;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleImport = async (file: File) => {
    const text = await file.text();
    const res = importProfileText(text);
    if (res.ok) {
      setNotice({
        ok: true,
        text:
          res.source === 'pmohub_rdr'
            ? language === 'vi'
              ? `Đã nhận diện & nhập thành công file chính hãng pmohub.cn (${file.name})!`
              : `Detected & imported official pmohub.cn RDR profile (${file.name})!`
            : language === 'vi'
              ? `Đã nhập thành công profile (${file.name}).`
              : `Imported WAVE75 Studio profile (${file.name}).`,
      });
    } else {
      setNotice({ ok: false, text: res.error ?? 'Import failed' });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-bold text-slate-100">{t.profiles.title}</h2>
          <p className="mt-0.5 text-xs text-slate-400">{t.profiles.rdrHint}</p>
        </div>

        <button
          type="button"
          onClick={() => importRef.current?.click()}
          className="inline-flex items-center gap-1.5 rounded-xl border border-sky-400/45 bg-sky-500/15 px-3.5 py-2 text-xs font-semibold text-sky-200 hover:bg-sky-500/25"
        >
          <Upload className="h-3.5 w-3.5" />
          {t.profiles.importBtn}
        </button>
        <input
          ref={importRef}
          type="file"
          accept=".json,application/json"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void handleImport(f);
            e.target.value = '';
          }}
          className="hidden"
        />
      </div>

      {/* Create New Profile */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          createProfile(newName);
          setNewName('');
        }}
        className="flex gap-2"
      >
        <input
          type="text"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder={t.profiles.newPlaceholder}
          className="flex-1 rounded-xl border border-white/10 bg-[#0A0D12] px-3.5 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:border-sky-400 focus:outline-none"
        />
        <button
          type="submit"
          className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-500 px-4 py-2 text-xs font-semibold text-white hover:brightness-110"
        >
          <Plus className="h-3.5 w-3.5" />
          {t.profiles.saveNew}
        </button>
      </form>

      {notice && (
        <div
          className={`rounded-xl border px-3.5 py-2 text-xs ${
            notice.ok
              ? 'border-emerald-500/35 bg-emerald-500/10 text-emerald-200'
              : 'border-rose-500/35 bg-rose-500/10 text-rose-200'
          }`}
        >
          {notice.text}
        </div>
      )}

      {/* Profile List */}
      <div className="grid gap-3 md:grid-cols-2">
        {profiles.map((prof: StudioWaveProfile) => {
          const isActive = prof.id === activeProfileId;
          const swatches = [0, 12, 24, 38, 52, 66, 79].map(
            (i) => prof.keyColors[i] ?? { r: 56, g: 189, b: 248 }
          );
          const slug = prof.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');

          return (
            <div
              key={prof.id}
              className={`flex flex-col justify-between gap-3 rounded-xl border p-4 transition ${
                isActive
                  ? 'border-sky-400/60 bg-sky-500/10'
                  : 'border-white/[0.08] bg-[#0A0D12]/70 hover:border-white/20'
              }`}
            >
              <div>
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-bold text-slate-100">
                    {prof.name}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`rounded px-1.5 py-0.5 font-mono text-[9.5px] font-bold uppercase ${
                        prof.source === 'pmohub_rdr'
                          ? 'bg-amber-500/20 text-amber-300'
                          : 'bg-white/10 text-slate-300'
                      }`}
                    >
                      {prof.source === 'pmohub_rdr' ? 'PMOHUB RDR' : 'STUDIO'}
                    </span>
                    {isActive && (
                      <span className="rounded bg-sky-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-sky-300">
                        {t.profiles.active}
                      </span>
                    )}
                  </div>
                </div>

                <div className="mt-2.5 flex items-center gap-1">
                  {swatches.map((c, idx) => (
                    <span
                      key={idx}
                      className="h-3 flex-1 rounded-sm border border-white/10"
                      style={{ backgroundColor: rgbToHex(c) }}
                    />
                  ))}
                  <span
                    title="Logo Color"
                    className="ml-1 h-3 w-3 rounded-full border border-white/30"
                    style={{ backgroundColor: rgbToHex(prof.logoColor) }}
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-1.5 border-t border-white/[0.06] pt-2.5">
                <button
                  type="button"
                  onClick={() => applyProfile(prof.id)}
                  className="rounded-lg bg-sky-500/20 px-3 py-1 text-xs font-semibold text-sky-200 ring-1 ring-sky-400/40 hover:bg-sky-500/30"
                >
                  {t.profiles.apply}
                </button>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    title={t.profiles.exportStudio}
                    onClick={() => downloadJson(prof, `wave75-studio-${slug}.json`)}
                    className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-[#121721] px-2 py-1 text-[11px] text-slate-300 hover:text-sky-200"
                  >
                    <Download className="h-3 w-3" /> JSON
                  </button>
                  <button
                    type="button"
                    title={t.profiles.exportRdr}
                    onClick={() =>
                      downloadJson(
                        exportAsRdrProfileJson(prof, lightIndexMap),
                        `rdr-profile-${slug}.json`
                      )
                    }
                    className="inline-flex items-center gap-1 rounded-lg border border-amber-400/30 bg-amber-500/10 px-2 py-1 text-[11px] text-amber-200 hover:bg-amber-500/20"
                  >
                    <FileJson className="h-3 w-3" /> RDR
                  </button>
                  <button
                    type="button"
                    title={t.profiles.duplicate}
                    onClick={() => duplicateProfile(prof.id)}
                    className="rounded-lg border border-white/10 bg-[#121721] p-1.5 text-slate-400 hover:text-white"
                  >
                    <Copy className="h-3 w-3" />
                  </button>
                  <button
                    type="button"
                    disabled={profiles.length <= 1}
                    title={t.profiles.delete}
                    onClick={() => deleteProfile(prof.id)}
                    className="rounded-lg border border-white/10 bg-[#121721] p-1.5 text-slate-400 hover:text-rose-300 disabled:opacity-30"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

