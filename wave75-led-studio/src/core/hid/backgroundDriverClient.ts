import type { BakedDriverPayload } from '../engines/driverExporter';

export interface BackgroundDriverStatus {
  available: boolean;
  installed: boolean;
  running: boolean;
  effectName: string | null;
  frameCount: number | null;
  installedAt: string | null;
  installDir?: string;
}

const DEFAULT_STATUS: BackgroundDriverStatus = {
  available: false,
  installed: false,
  running: false,
  effectName: null,
  frameCount: null,
  installedAt: null,
};

const statusListeners = new Set<(s: BackgroundDriverStatus) => void>();
let cachedStatus: BackgroundDriverStatus = { ...DEFAULT_STATUS };

function notify(next: BackgroundDriverStatus) {
  cachedStatus = next;
  statusListeners.forEach((fn) => fn(next));
}

export function subscribeDriverStatus(listener: (s: BackgroundDriverStatus) => void): () => void {
  statusListeners.add(listener);
  listener(cachedStatus);
  return () => statusListeners.delete(listener);
}

export async function refreshBackgroundDriverStatus(): Promise<BackgroundDriverStatus> {
  try {
    const res = await fetch('/api/driver/status', { cache: 'no-store' });
    if (!res.ok) throw new Error('status unavailable');
    const data = (await res.json()) as BackgroundDriverStatus;
    notify(data);
    return data;
  } catch {
    notify({ ...DEFAULT_STATUS });
    return cachedStatus;
  }
}

export async function stopBackgroundDriverIfRunning(): Promise<void> {
  try {
    await fetch('/api/driver/stop', { method: 'POST' });
    await refreshBackgroundDriverStatus();
  } catch {
    // static build / offline mode: ignore
  }
}

export async function installPersistentBackgroundDriver(
  payload: BakedDriverPayload
): Promise<{ ok: boolean; error?: string; startupPath?: string }> {
  try {
    const res = await fetch('/api/driver/install', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ps1Content: payload.ps1Content,
        effectName: payload.effectName,
        frameCount: payload.frameCount,
      }),
    });
    const data = (await res.json()) as { ok?: boolean; error?: string; startupPath?: string };
    await new Promise((r) => setTimeout(r, 450));
    await refreshBackgroundDriverStatus();
    if (!res.ok || !data.ok) {
      return { ok: false, error: data.error || 'Không thể cài driver tự chạy.' };
    }
    return { ok: true, startupPath: data.startupPath };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Local driver installer endpoint unavailable.',
    };
  }
}

export async function uninstallPersistentBackgroundDriver(): Promise<boolean> {
  try {
    const res = await fetch('/api/driver/uninstall', { method: 'POST' });
    await refreshBackgroundDriverStatus();
    return res.ok;
  } catch {
    return false;
  }
}
