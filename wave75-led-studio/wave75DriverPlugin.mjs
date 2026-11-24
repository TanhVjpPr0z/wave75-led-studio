import fs from 'node:fs';
import path from 'node:path';
import { execFileSync, spawn } from 'node:child_process';

function getDriverPaths() {
  const localAppData =
    process.env.LOCALAPPDATA || path.join(process.env.USERPROFILE || '', 'AppData', 'Local');
  const appData =
    process.env.APPDATA || path.join(process.env.USERPROFILE || '', 'AppData', 'Roaming');
  const dir = path.join(localAppData, 'Wave75LedDriver');
  const startupVbs = path.join(
    appData,
    'Microsoft',
    'Windows',
    'Start Menu',
    'Programs',
    'Startup',
    'Wave75LedDriver.vbs'
  );
  return {
    dir,
    ps1: path.join(dir, 'driver.ps1'),
    vbs: path.join(dir, 'run-hidden.vbs'),
    pidFile: path.join(dir, 'driver.pid'),
    metaFile: path.join(dir, 'meta.json'),
    uninstallBat: path.join(dir, 'uninstall.bat'),
    startupVbs,
  };
}

function isPidAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function stopRunningDriver() {
  const { pidFile } = getDriverPaths();
  if (!fs.existsSync(pidFile)) return false;
  const raw = fs.readFileSync(pidFile, 'utf8').trim();
  const pid = Number.parseInt(raw, 10);
  let stopped = false;
  if (Number.isInteger(pid) && pid > 0) {
    try {
      execFileSync('taskkill', ['/PID', String(pid), '/F'], { stdio: 'ignore' });
      stopped = true;
    } catch {
      // process may already have exited
    }
  }
  try {
    fs.unlinkSync(pidFile);
  } catch {
    // ignore
  }
  return stopped;
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      try {
        const text = Buffer.concat(chunks).toString('utf8');
        resolve(text ? JSON.parse(text) : {});
      } catch (e) {
        reject(e);
      }
    });
    req.on('error', reject);
  });
}

function sendJson(res, status, data) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(data));
}

export function wave75AutoDriverPlugin() {
  return {
    name: 'wave75-auto-driver-api',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url || '';
        if (!url.startsWith('/api/driver/')) return next();

        const paths = getDriverPaths();

        if (req.method === 'GET' && url === '/api/driver/status') {
          let running = false;
          if (fs.existsSync(paths.pidFile)) {
            const pid = Number.parseInt(fs.readFileSync(paths.pidFile, 'utf8').trim(), 10);
            running = isPidAlive(pid);
          }
          const installed = fs.existsSync(paths.startupVbs) && fs.existsSync(paths.ps1);
          let meta = {};
          if (fs.existsSync(paths.metaFile)) {
            try {
              meta = JSON.parse(fs.readFileSync(paths.metaFile, 'utf8'));
            } catch {
              // ignore
            }
          }
          return sendJson(res, 200, {
            available: process.platform === 'win32',
            installed,
            running,
            effectName: typeof meta.effectName === 'string' ? meta.effectName : null,
            frameCount: typeof meta.frameCount === 'number' ? meta.frameCount : null,
            installedAt: typeof meta.installedAt === 'string' ? meta.installedAt : null,
            installDir: paths.dir,
          });
        }

        if (req.method === 'POST' && url === '/api/driver/stop') {
          const stopped = stopRunningDriver();
          return sendJson(res, 200, { ok: true, stopped });
        }

        if (req.method === 'POST' && url === '/api/driver/uninstall') {
          stopRunningDriver();
          for (const f of [paths.startupVbs, paths.metaFile]) {
            try {
              if (fs.existsSync(f)) fs.unlinkSync(f);
            } catch {
              // ignore
            }
          }
          return sendJson(res, 200, { ok: true });
        }

        if (req.method === 'POST' && url === '/api/driver/install') {
          void readJsonBody(req)
            .then((body) => {
              const ps1Content = typeof body.ps1Content === 'string' ? body.ps1Content : '';
              const effectName =
                typeof body.effectName === 'string' ? body.effectName : 'Custom Effect';
              const frameCount = typeof body.frameCount === 'number' ? body.frameCount : 1;
              if (!ps1Content || !ps1Content.includes('Wave75PersistentDriver')) {
                return sendJson(res, 400, { ok: false, error: 'Invalid driver script payload.' });
              }

              fs.mkdirSync(paths.dir, { recursive: true });
              stopRunningDriver();

              fs.writeFileSync(paths.ps1, ps1Content, 'utf8');
              const vbsScript = `Set WshShell = CreateObject("WScript.Shell")\r\nWshShell.Run "powershell.exe -NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File ""${paths.ps1}""", 0, False\r\n`;
              fs.writeFileSync(paths.vbs, vbsScript, 'utf8');
              fs.mkdirSync(path.dirname(paths.startupVbs), { recursive: true });
              fs.writeFileSync(paths.startupVbs, vbsScript, 'utf8');

              const uninstallBat = `@echo off\r\nif exist "${paths.pidFile}" for /f "usebackq delims=" %%P in ("${paths.pidFile}") do taskkill /PID %%P /F >nul 2>&1\r\ndel /F /Q "${paths.startupVbs}" >nul 2>&1\r\necho Da go bo WAVE75 Auto-Boot Driver!\r\npause\r\n`;
              fs.writeFileSync(paths.uninstallBat, uninstallBat, 'utf8');

              const meta = {
                effectName,
                frameCount,
                installedAt: new Date().toISOString(),
              };
              fs.writeFileSync(paths.metaFile, JSON.stringify(meta, null, 2), 'utf8');

              // Launch via Windows WMI Win32_Process.Create (WmiPrvSE.exe) so the daemon runs
              // 100% OUTSIDE Node/Vite/IDE Windows Job Objects and NEVER dies when dev server or IDE tasks are killed!
              try {
                const escapedVbs = paths.vbs.replace(/'/g, "''");
                execFileSync(
                  'powershell.exe',
                  [
                    '-NoProfile',
                    '-ExecutionPolicy',
                    'Bypass',
                    '-Command',
                    `Invoke-CimMethod -ClassName Win32_Process -MethodName Create -Arguments @{ CommandLine = 'wscript.exe "${escapedVbs}"' } | Out-Null`,
                  ],
                  { stdio: 'ignore', timeout: 8000 }
                );
              } catch {
                const child = spawn('wscript.exe', [paths.vbs], {
                  detached: true,
                  stdio: 'ignore',
                });
                child.unref();
              }

              return sendJson(res, 200, {
                ok: true,
                effectName,
                frameCount,
                startupPath: paths.startupVbs,
                installDir: paths.dir,
              });
            })
            .catch((err) => {
              sendJson(res, 500, {
                ok: false,
                error: err instanceof Error ? err.message : String(err),
              });
            });
          return;
        }

        next();
      });
    },
  };
}
