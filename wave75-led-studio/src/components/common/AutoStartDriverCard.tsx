import React, { useEffect, useState } from 'react';
import {
  Rocket,
  Download,
  Trash2,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
} from 'lucide-react';
import {
  triggerTextDownload,
  type BakedDriverPayload,
} from '../../core/engines/driverExporter';
import {
  installPersistentBackgroundDriver,
  refreshBackgroundDriverStatus,
  subscribeDriverStatus,
  uninstallPersistentBackgroundDriver,
  type BackgroundDriverStatus,
} from '../../core/hid/backgroundDriverClient';
import { waveHidManager } from '../../core/hid/hidManager';
import { useWaveStore } from '../../store/useWaveStore';

interface AutoStartDriverCardProps {
  titleVi: string;
  titleEn: string;
  descVi: string;
  descEn: string;
  buildPayload: () => BakedDriverPayload | null;
}

export const AutoStartDriverCard: React.FC<AutoStartDriverCardProps> = ({
  titleVi,
  titleEn,
  descVi,
  descEn,
  buildPayload,
}) => {
  const language = useWaveStore((s) => s.language);
  const [driverStatus, setDriverStatus] = useState<BackgroundDriverStatus>({
    available: false,
    installed: false,
    running: false,
    effectName: null,
    frameCount: null,
    installedAt: null,
  });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    const unsub = subscribeDriverStatus(setDriverStatus);
    void refreshBackgroundDriverStatus();
    return unsub;
  }, []);

  const handleInstallOneClick = async () => {
    const payload = buildPayload();
    if (!payload) return;
    setBusy(true);
    setMsg(null);
    try {
      // Hand off USB cleanly without reverting the keyboard back to factory rainbow
      await waveHidManager.disconnectForBackgroundDriver();
      await new Promise((r) => setTimeout(r, 150));

      const res = await installPersistentBackgroundDriver(payload);
      if (res.ok) {
        setMsg({
          ok: true,
          text:
            language === 'vi'
              ? `ĐÃ CÀI VĨNH VIỄN "${payload.effectName}" (${payload.frameCount} khung hình + Flash Slot 1 + Logo CNC)! Từ giờ mỗi khi bật máy hoặc bật/cắm phím WAVE75 sẽ tự chạy hiệu ứng này ngay lập tức mà không cần mở trình duyệt.`
              : `Installed "${payload.effectName}" (${payload.frameCount} frames + Flash Slot 1 + CNC Logo) to Windows Startup! It will auto-run forever whenever your WAVE75 turns on.`,
        });
      } else {
        // Fallback to downloadable .bat installer if static hosting without Vite middleware
        triggerTextDownload(payload.batFilename, payload.batContent);
        setMsg({
          ok: true,
          text:
            language === 'vi'
              ? `Đã tải bộ cài tự động "${payload.batFilename}". Nháy đúp file này 1 lần duy nhất để cài chạy ngầm vĩnh viễn khi mở máy!`
              : `Downloaded "${payload.batFilename}". Double-click it once to install persistent Windows auto-start!`,
        });
      }
    } catch (e) {
      setMsg({
        ok: false,
        text: e instanceof Error ? e.message : 'Cài đặt driver chạy ngầm thất bại',
      });
    } finally {
      setBusy(false);
    }
  };

  const handleDownloadBat = () => {
    const payload = buildPayload();
    if (!payload) return;
    triggerTextDownload(payload.batFilename, payload.batContent);
    setMsg({
      ok: true,
      text:
        language === 'vi'
          ? `Đã tải "${payload.batFilename}" (${payload.frameCount} frame). Nháy đúp file để cài lên bất kỳ máy Windows nào (tự khởi động cùng Windows, không hiện cửa sổ đen)!`
          : `Downloaded "${payload.batFilename}" (${payload.frameCount} frames). Double-click on any Windows PC to install silent auto-start!`,
    });
  };

  const handleUninstall = async () => {
    setBusy(true);
    setMsg(null);
    try {
      await uninstallPersistentBackgroundDriver();
      setMsg({
        ok: true,
        text:
          language === 'vi'
            ? 'Đã gỡ bỏ Driver chạy ngầm tự khởi động WAVE75.'
            : 'Uninstalled WAVE75 persistent auto-start driver.',
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-2.5 rounded-xl border border-emerald-500/35 bg-gradient-to-br from-emerald-500/[0.09] via-teal-500/[0.04] to-transparent p-3.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Rocket className="h-4 w-4 text-emerald-400" />
          <h3 className="text-xs font-bold text-emerald-200">
            {language === 'vi' ? titleVi : titleEn}
          </h3>
        </div>
        {driverStatus.installed && (
          <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/40 bg-emerald-500/15 px-2.5 py-0.5 font-mono text-[10px] font-semibold text-emerald-200">
            <ShieldCheck className="h-3 w-3" />
            {driverStatus.running
              ? language === 'vi'
                ? `Đang chạy ngầm: ${driverStatus.effectName ?? 'Custom'}`
                : `Running: ${driverStatus.effectName ?? 'Custom'}`
              : language === 'vi'
                ? `Đã cài Auto-Start: ${driverStatus.effectName ?? 'Custom'}`
                : `Auto-Start Ready: ${driverStatus.effectName ?? 'Custom'}`}
          </span>
        )}
      </div>

      <p className="text-[11px] leading-relaxed text-slate-300">
        {language === 'vi' ? descVi : descEn}
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => void handleInstallOneClick()}
          className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 px-3.5 py-2 text-xs font-bold text-white shadow-lg shadow-emerald-500/20 transition hover:brightness-110 disabled:opacity-50"
        >
          <Rocket className="h-3.5 w-3.5" />
          {busy
            ? language === 'vi'
              ? 'Đang cài chạy ngầm...'
              : 'Installing...'
            : language === 'vi'
              ? 'Cài chạy vĩnh viễn (Tự chạy khi bật phím / mở máy)'
              : 'Install Forever (Auto-Run on Boot / Power-On)'}
        </button>

        <button
          type="button"
          disabled={busy}
          onClick={handleDownloadBat}
          title={
            language === 'vi'
              ? 'Tải file .bat cài 1 lần dùng cho máy khác hoặc lưu dự phòng'
              : 'Download standalone 1-click .bat installer'
          }
          className="inline-flex items-center gap-1.5 rounded-xl border border-white/15 bg-[#121721] px-3 py-2 text-xs font-semibold text-slate-200 transition hover:border-emerald-400/50 hover:text-emerald-200"
        >
          <Download className="h-3.5 w-3.5" />
          .BAT
        </button>

        {driverStatus.installed && (
          <button
            type="button"
            disabled={busy}
            onClick={() => void handleUninstall()}
            title={
              language === 'vi'
                ? 'Gỡ bỏ driver tự chạy ngầm'
                : 'Uninstall persistent auto-start driver'
            }
            className="inline-flex items-center gap-1 rounded-xl border border-rose-500/35 bg-rose-500/10 px-2.5 py-2 text-xs font-semibold text-rose-200 transition hover:bg-rose-500/20"
          >
            <Trash2 className="h-3.5 w-3.5" />
            {language === 'vi' ? 'Gỡ' : 'Remove'}
          </button>
        )}
      </div>

      {msg && (
        <div
          className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-[11px] ${
            msg.ok
              ? 'border-emerald-400/35 bg-emerald-500/10 text-emerald-200'
              : 'border-rose-400/35 bg-rose-500/10 text-rose-200'
          }`}
        >
          {msg.ok ? (
            <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" />
          ) : (
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-rose-400" />
          )}
          <span>{msg.text}</span>
        </div>
      )}
    </div>
  );
};
