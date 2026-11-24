import React, { useState } from 'react';
import { Cpu, Sparkles, Save, Info, Send, HardDriveUpload } from 'lucide-react';
import { QMK_RGB_MATRIX_EFFECTS } from '../../core/protocols/qmkViaAdapter';
import { WAVE75_NATIVE_HARDWARE_MODES } from '../../core/protocols/pmoNativeAdapter';
import type { LogoSettings } from '../../core/protocols/types';
import type { RGB } from '../../core/utils/color';
import { useWaveStore } from '../../store/useWaveStore';
import { TRANSLATIONS } from '../../i18n';
import { ColorPicker } from '../common/ColorPicker';
import { waveHidManager, type WaveHidState } from '../../core/hid/hidManager';

interface QmkPresetsPanelProps {
  hidState: WaveHidState;
}

const LOGO_EFFECTS: LogoSettings['effect'][] = [
  'static',
  'breathing',
  'rainbow',
  'neon_pulse',
  'off',
];

export const QmkPresetsPanel: React.FC<QmkPresetsPanelProps> = ({ hidState }) => {
  const language = useWaveStore((s) => s.language);
  const activeModel = useWaveStore((s) => s.activeModel);
  const qmkState = useWaveStore((s) => s.qmkState);
  const updateQmkState = useWaveStore((s) => s.updateQmkState);
  const logoSettings = useWaveStore((s) => s.logoSettings);
  const updateLogoSettings = useWaveStore((s) => s.updateLogoSettings);
  const setSlotLogoColor = useWaveStore((s) => s.setSlotLogoColor);

  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const [savingPreset, setSavingPreset] = useState(false);
  const [nativeModeId, setNativeModeId] = useState<number>(1);
  const [nativeBrightness, setNativeBrightness] = useState<number>(100);
  const [nativeSpeed, setNativeSpeed] = useState<number>(3);
  const [nativeRainbow, setNativeRainbow] = useState<boolean>(true);
  const [nativeColor, setNativeColor] = useState<RGB>({ r: 56, g: 189, b: 248 });
  const t = TRANSLATIONS[language];
  const isNonRgb = activeModel === 'wave75_non_rgb';

  const saveNativeRdrPreset = async () => {
    setSavingPreset(true);
    setNotice(null);
    try {
      const msg = await waveHidManager.applyNativePresetToFlash({
        modeId: nativeModeId,
        brightness: nativeBrightness,
        speed: nativeSpeed,
        rainbow: nativeRainbow,
        color: nativeColor,
        logo: logoSettings,
      });
      setNotice({ ok: true, text: msg });
    } catch (e) {
      setNotice({
        ok: false,
        text: e instanceof Error ? e.message : 'Lưu hiệu ứng vào Flash thất bại',
      });
    } finally {
      setSavingPreset(false);
    }
  };

  const pushQmk = async () => {
    try {
      await waveHidManager.applyQmkLighting(qmkState);
      setNotice({
        ok: true,
        text:
          language === 'vi'
            ? `Đã gửi chế độ QMK #${qmkState.effectId} qua Raw HID.`
            : `Dispatched QMK RGB Matrix mode #${qmkState.effectId}.`,
      });
    } catch (e) {
      setNotice({ ok: false, text: e instanceof Error ? e.message : 'QMK dispatch error' });
    }
  };

  const pushLogo = async () => {
    try {
      await waveHidManager.applyLogoSettings(logoSettings);
      setNotice({
        ok: true,
        text:
          language === 'vi'
            ? 'Đã gửi & lưu cấu hình Đèn Logo CNC vào Flash bàn phím WAVE75 (chạy mãi không cần mở app)!'
            : 'Saved CNC Wave Logo LED settings to WAVE75 Flash!',
      });
    } catch (e) {
      setNotice({ ok: false, text: e instanceof Error ? e.message : 'Logo dispatch error' });
    }
  };

  const saveEeprom = async () => {
    try {
      const res = await waveHidManager.saveOnboardSlotSafe(1, [], logoSettings.color);
      setNotice({ ok: true, text: res.message });
    } catch (e) {
      setNotice({ ok: false, text: e instanceof Error ? e.message : 'EEPROM save error' });
    }
  };

  return (
    <div className="space-y-4">
      {notice && (
        <div
          className={`rounded-xl border px-3.5 py-2 text-xs ${
            notice.ok
              ? 'border-emerald-400/35 bg-emerald-500/10 text-emerald-200'
              : 'border-rose-400/35 bg-rose-500/10 text-rose-200'
          }`}
        >
          {notice.text}
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-12">
        {/* Left: Native WAVE75 RDR 20-Mode Flash Save + QMK Fallback */}
        <div className="space-y-4 rounded-xl border border-white/[0.07] bg-[#0A0D12]/65 p-4 lg:col-span-7">
          {!isNonRgb && (
            <div className="space-y-3 rounded-xl border border-emerald-500/30 bg-emerald-500/[0.06] p-3.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="flex items-center gap-2 text-sm font-bold text-emerald-200">
                  <HardDriveUpload className="h-4 w-4 text-emerald-400" />
                  {language === 'vi'
                    ? 'Lưu Hiệu Ứng Vào Chip WAVE75 (Chạy hoài không cần mở app)'
                    : 'Save Hardware Preset to WAVE75 Flash (Runs Standalone)'}
                </h2>
                <span className="rounded bg-emerald-500/20 px-2 py-0.5 font-mono text-[10px] font-bold text-emerald-300">
                  RDR 0x15 + 0x11
                </span>
              </div>
              <p className="text-[11px] text-slate-300">
                {language === 'vi'
                  ? 'Ghi thẳng 1 trong 20 hiệu ứng động gốc của WAVE75 kèm Đèn Logo CNC vào bộ nhớ Flash bàn phím. Sau khi bấm lưu, bạn tắt trình duyệt hoặc rút máy cắm sang máy khác đèn vẫn tự chạy mãi mãi!'
                  : 'Writes any of the 20 stock WAVE75 MCU effects + CNC Logo LED directly to onboard Flash. Runs forever without keeping the browser open.'}
              </p>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className="mb-1 block text-xs font-medium text-slate-300">
                    {language === 'vi' ? 'Chọn hiệu ứng gốc trên chip (20 chế độ)' : 'Hardware Effect (20 modes)'}
                  </label>
                  <select
                    value={nativeModeId}
                    onChange={(e) => setNativeModeId(Number(e.target.value))}
                    className="w-full rounded-xl border border-white/10 bg-[#121721] px-3 py-2 font-mono text-xs text-slate-100 focus:border-emerald-400 focus:outline-none"
                  >
                    {WAVE75_NATIVE_HARDWARE_MODES.map((m) => (
                      <option key={m.id} value={m.id}>
                        {language === 'vi' ? m.nameVi : m.nameEn}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <div className="mb-1 flex justify-between text-xs">
                    <span className="text-slate-300">{t.effects.brightness}</span>
                    <span className="font-mono text-emerald-300">{nativeBrightness}%</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={nativeBrightness}
                    onChange={(e) => setNativeBrightness(Number(e.target.value))}
                    className="wave-slider w-full"
                  />
                </div>

                <div>
                  <div className="mb-1 flex justify-between text-xs">
                    <span className="text-slate-300">{t.effects.speed}</span>
                    <span className="font-mono text-emerald-300">{nativeSpeed} / 5</span>
                  </div>
                  <input
                    type="range"
                    min={1}
                    max={5}
                    value={nativeSpeed}
                    onChange={(e) => setNativeSpeed(Number(e.target.value))}
                    className="wave-slider w-full"
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <label className="inline-flex cursor-pointer items-center gap-2 text-xs text-slate-200">
                  <input
                    type="checkbox"
                    checked={nativeRainbow}
                    onChange={(e) => setNativeRainbow(e.target.checked)}
                    className="rounded border-white/20 bg-[#121721]"
                  />
                  {language === 'vi' ? 'Chế độ đa sắc (Rainbow)' : 'Colorful Rainbow Mix'}
                </label>
                {!nativeRainbow && (
                  <div className="min-w-[200px] flex-1">
                    <ColorPicker
                      label={language === 'vi' ? 'Màu đơn sắc' : 'Solid Color'}
                      color={nativeColor}
                      onChange={setNativeColor}
                      compact
                    />
                  </div>
                )}
              </div>

              <button
                type="button"
                disabled={savingPreset}
                onClick={() => void saveNativeRdrPreset()}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 px-4 py-2.5 text-xs font-bold text-white shadow-lg shadow-emerald-500/20 transition hover:brightness-110 disabled:opacity-50"
              >
                <Save className="h-4 w-4" />
                {savingPreset
                  ? language === 'vi'
                    ? 'Đang ghi vào Flash WAVE75...'
                    : 'Saving to WAVE75 Flash...'
                  : language === 'vi'
                    ? 'Lưu Hiệu Ứng + Logo CNC vào Flash (Chạy hoài không cần mở app)'
                    : 'Save Effect + CNC Logo to Flash (Standalone)'}
              </button>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            <h2 className="flex items-center gap-2 text-sm font-bold text-slate-100">
              <Cpu className="h-4 w-4 text-sky-400" />
              {t.qmk.title}
            </h2>
            <span className="font-mono text-[10px] text-slate-400">
              {hidState.capabilities.protocolName}
            </span>
          </div>

          {!isNonRgb && (
            <>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-300">
                  {t.qmk.effectLabel} (52 modes)
                </label>
                <select
                  value={qmkState.effectId}
                  onChange={(e) => updateQmkState({ effectId: Number(e.target.value) })}
                  className="w-full rounded-xl border border-white/10 bg-[#121721] px-3 py-2.5 font-mono text-xs text-slate-100 focus:border-sky-400 focus:outline-none"
                >
                  {QMK_RGB_MATRIX_EFFECTS.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                {(
                  [
                    ['brightness', t.qmk.brightness],
                    ['speed', t.qmk.speed],
                    ['hue', t.qmk.hue],
                    ['saturation', t.qmk.saturation],
                  ] as const
                ).map(([field, label]) => (
                  <div key={field}>
                    <div className="mb-1 flex justify-between text-xs">
                      <span className="text-slate-300">{label}</span>
                      <span className="font-mono text-sky-300">{qmkState[field]} / 255</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={255}
                      value={qmkState[field]}
                      onChange={(e) => updateQmkState({ [field]: Number(e.target.value) })}
                      className="wave-slider w-full"
                    />
                  </div>
                ))}
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void pushQmk()}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-sky-500/20 px-4 py-2 text-xs font-semibold text-sky-200 ring-1 ring-sky-400/40 hover:bg-sky-500/30"
                >
                  <Send className="h-3.5 w-3.5" />
                  {t.qmk.applyQmk}
                </button>
                <button
                  type="button"
                  onClick={() => void saveEeprom()}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-white/15 bg-[#121721] px-4 py-2 text-xs font-semibold text-slate-200 hover:border-sky-400/50"
                >
                  <Save className="h-3.5 w-3.5" />
                  {t.qmk.saveEeprom}
                </button>
              </div>
            </>
          )}

          {/* Inline Hardware Fn Shortcut Quick Reference */}
          <div className="rounded-xl border border-white/[0.06] bg-[#121721]/80 p-3.5">
            <h3 className="mb-2 text-xs font-bold text-slate-200">{t.shortcuts.title}</h3>
            <div className="grid gap-1.5 sm:grid-cols-2">
              {t.shortcuts.items.slice(0, 8).map((s) => (
                <div
                  key={s.keys}
                  className="flex items-center justify-between gap-2 rounded-lg bg-[#0A0D12] px-2.5 py-1.5 text-[11px]"
                >
                  <kbd className="font-mono font-bold text-sky-300">{s.keys}</kbd>
                  <span className="truncate text-slate-400" title={s.desc}>
                    {s.desc}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right: Dedicated CNC Wave Logo RGB Controller (Ideal for Non-RGB edition) */}
        <div className="space-y-4 rounded-xl border border-white/[0.07] bg-[#0A0D12]/65 p-4 lg:col-span-5">
          <h3 className="flex items-center gap-2 text-sm font-bold text-slate-100">
            <Sparkles className="h-4 w-4 text-indigo-400" />
            {t.qmk.logoTitle}
          </h3>

          <div className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-2.5 text-[11px] text-amber-200">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
            <span>{t.qmk.logoNote}</span>
          </div>

          <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-5">
            {LOGO_EFFECTS.map((ef) => (
              <button
                key={ef}
                type="button"
                onClick={() => updateLogoSettings({ effect: ef })}
                className={`rounded-lg border px-2 py-1.5 text-[11px] font-medium ${
                  logoSettings.effect === ef
                    ? 'border-indigo-400 bg-indigo-500/20 text-indigo-200'
                    : 'border-white/10 bg-[#121721] text-slate-400'
                }`}
              >
                {t.qmk.logoEffects[ef]}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-3 gap-2.5">
            <div>
              <div className="mb-1 flex justify-between text-[11px]">
                <span className="text-slate-400">{t.effects.brightness}</span>
                <span className="font-mono text-sky-300">{logoSettings.brightness}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                value={logoSettings.brightness}
                onChange={(e) => updateLogoSettings({ brightness: Number(e.target.value) })}
                className="wave-slider w-full"
              />
            </div>
            <div>
              <div className="mb-1 flex justify-between text-[11px]">
                <span className="text-slate-400">{t.effects.speed}</span>
                <span className="font-mono text-sky-300">{logoSettings.speed}/5</span>
              </div>
              <input
                type="range"
                min={1}
                max={5}
                value={logoSettings.speed}
                onChange={(e) => updateLogoSettings({ speed: Number(e.target.value) })}
                className="wave-slider w-full"
              />
            </div>
            <div>
              <div className="mb-1 flex justify-between text-[11px]">
                <span className="text-slate-400">Sat</span>
                <span className="font-mono text-sky-300">{logoSettings.saturation}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                value={logoSettings.saturation}
                onChange={(e) => updateLogoSettings({ saturation: Number(e.target.value) })}
                className="wave-slider w-full"
              />
            </div>
          </div>

          <ColorPicker
            label="CNC Logo Color"
            color={logoSettings.color}
            onChange={(c) => {
              updateLogoSettings({ color: c });
              setSlotLogoColor(c);
            }}
            compact
          />

          <button
            type="button"
            onClick={() => void pushLogo()}
            className="w-full rounded-xl bg-gradient-to-r from-indigo-500 to-sky-500 px-4 py-2.5 text-xs font-semibold text-white shadow-lg shadow-indigo-500/20 hover:brightness-110"
          >
            {t.qmk.applyLogo}
          </button>
        </div>
      </div>
    </div>
  );
};

