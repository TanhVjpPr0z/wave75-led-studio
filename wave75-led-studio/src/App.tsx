import React, { useEffect, useRef, useState } from 'react';
import {
  Sparkles,
  Type,
  Film,
  Palette,
  AudioLines,
  Gem,
  FolderKanban,
  Rocket,
  Sun,
  Power,
  CheckCircle2,
  Usb,
} from 'lucide-react';
import { useWaveStore, type WaveStudioTab } from './store/useWaveStore';
import { TRANSLATIONS } from './i18n';
import { WAVE75_KEYS, WAVE75_KEY_COUNT } from './core/layout/wave75Layout';
import { BLACK, type RGB, hsvToRgb, lerpRgb, rgbToHex, scaleRgb } from './core/utils/color';
import { renderProceduralFrame } from './core/engines/proceduralEffects';
import { renderTextLedFrame } from './core/engines/textLedEngine';
import {
  generateBuiltInWaveGif,
  sampleFrameTo81Keys,
  type LoadedGifMedia,
} from './core/engines/gifEngine';
import {
  buildWave75GifDriverPs1,
  buildWave75LiveEffectDriver,
  buildWave75PerKeyDriver,
  buildWave75TextLedDriver,
  triggerTextDownload,
} from './core/engines/driverExporter';
import { installPersistentBackgroundDriver } from './core/hid/backgroundDriverClient';
import { waveAudioEngine, type AudioSourceType } from './core/engines/audioEngine';
import { waveReactiveEngine } from './core/engines/reactiveEngine';
import { waveSnakeEngine } from './core/engines/snakeGameEngine';
import { waveHidManager, type WaveHidState } from './core/hid/hidManager';
import type { HidTrafficPacket, LogoSettings } from './core/protocols/types';

import { Header } from './components/layout/Header';
import { Wave75Canvas } from './components/keyboard/Wave75Canvas';
import { LiveEffectsPanel } from './components/panels/LiveEffectsPanel';
import { TextDesignerPanel } from './components/panels/TextDesignerPanel';
import { PerKeyEditorPanel } from './components/panels/PerKeyEditorPanel';
import { GifMatrixPanel } from './components/panels/GifMatrixPanel';
import { AudioVisualizerPanel } from './components/panels/AudioVisualizerPanel';
import { QmkPresetsPanel } from './components/panels/QmkPresetsPanel';
import { ProfilesPanel } from './components/panels/ProfilesPanel';
import { HidDiagnosticsDrawer } from './components/panels/HidDiagnosticsDrawer';
import { ShortcutsCheatsheetModal } from './components/common/ShortcutsCheatsheetModal';
import { AnimeCursor } from './components/anime/AnimeCursor';
import { AnimeWelcomeGate } from './components/anime/AnimeWelcomeGate';
import {
  AnimeTransitionOverlay,
  type TransitionPhase,
} from './components/anime/AnimeTransitionOverlay';
import { AnimeCompanionBar } from './components/anime/AnimeCompanionBar';
import { AnimeCharacterStage } from './components/anime/AnimeCharacterStage';
import { AnimeMotionPopover } from './components/anime/AnimeMotionPopover';
import { SakuraPetalsBackdrop } from './components/anime/SakuraPetalsBackdrop';
import {
  DEFAULT_ANIME_STAGE_SETTINGS,
  getAnimeCharacter,
  preloadAllAnimeAssets,
  type AnimeCharacterId,
  type AnimeStageSettings,
} from './components/anime/animeCharacters';

const TABS: Array<{
  id: WaveStudioTab;
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  badgeVi?: string;
  badgeEn?: string;
}> = [
  { id: 'effects', icon: Sparkles },
  { id: 'text', icon: Type, badgeVi: 'MỚI', badgeEn: 'NEW' },
  { id: 'gif', icon: Film },
  { id: 'perkey', icon: Palette },
  { id: 'audio', icon: AudioLines },
  { id: 'qmk', icon: Gem },
  { id: 'profiles', icon: FolderKanban },
];

function computeAnimatedLogo(settings: LogoSettings, nowMs: number): RGB {
  const b = settings.brightness / 100;
  const t = (nowMs / 1000) * (0.4 + settings.speed * 0.45);
  switch (settings.effect) {
    case 'off':
      return BLACK;
    case 'static':
      return scaleRgb(settings.color, b);
    case 'breathing':
      return scaleRgb(settings.color, b * (0.15 + 0.85 * (0.5 - 0.5 * Math.cos(t * 2))));
    case 'rainbow':
      return scaleRgb(
        hsvToRgb({ h: (t * 65) % 360, s: settings.saturation, v: 100 }),
        b
      );
    case 'neon_pulse': {
      const pulse = Math.pow(0.5 + 0.5 * Math.sin(t * 4), 3);
      return scaleRgb(settings.color, b * (0.25 + 0.75 * pulse));
    }
  }
}

export default function App() {
  const language = useWaveStore((s) => s.language);
  const activeTab = useWaveStore((s) => s.activeTab);
  const setActiveTab = useWaveStore((s) => s.setActiveTab);
  const activeModel = useWaveStore((s) => s.activeModel);
  const usbFps = useWaveStore((s) => s.usbFps);
  const gifPresetId = useWaveStore((s) => s.gifPresetId);
  const setGifPresetId = useWaveStore((s) => s.setGifPresetId);
  const effectParams = useWaveStore((s) => s.effectParams);
  const updateEffectParams = useWaveStore((s) => s.updateEffectParams);
  const textLedConfig = useWaveStore((s) => s.textLedConfig);
  const updateTextLedConfig = useWaveStore((s) => s.updateTextLedConfig);
  const logoSettings = useWaveStore((s) => s.logoSettings);

  const [hidState, setHidState] = useState<WaveHidState>(() => waveHidManager.getState());
  const [traffic, setTraffic] = useState<HidTrafficPacket[]>(() =>
    waveHidManager.getTrafficLog()
  );
  const [frameKeys, setFrameKeys] = useState<RGB[]>(() =>
    new Array<RGB>(WAVE75_KEY_COUNT).fill(BLACK)
  );
  const [frameLogo, setFrameLogo] = useState<RGB>({ r: 56, g: 189, b: 248 });
  const [gifMedia, setGifMedia] = useState<LoadedGifMedia | null>(() =>
    generateBuiltInWaveGif(gifPresetId)
  );
  const [gifFrameIdx, setGifFrameIdx] = useState(0);
  const [audioSource, setAudioSource] = useState<AudioSourceType>('none');
  const [audioBands, setAudioBands] = useState<number[]>(() => new Array<number>(16).fill(0));
  const [quickSaveBusy, setQuickSaveBusy] = useState(false);
  const [quickSaveToast, setQuickSaveToast] = useState<string | null>(null);
  const [animeCursor, setAnimeCursor] = useState<boolean>(() => {
    try {
      const saved = window.localStorage.getItem('wave75-anime-cursor');
      return saved === null ? true : saved === '1';
    } catch {
      return true;
    }
  });
  const [studioUnlocked, setStudioUnlocked] = useState<boolean>(() => waveHidManager.getState().connected);
  const [previewMode, setPreviewMode] = useState<boolean>(false);
  const [transitionPhase, setTransitionPhase] = useState<TransitionPhase>('idle');
  const [motionEditorOpen, setMotionEditorOpen] = useState<boolean>(false);
  const transitionTimersRef = useRef<number[]>([]);

  const [characterId, setCharacterId] = useState<AnimeCharacterId>(() => {
    try {
      const saved = window.localStorage.getItem('wave75-anime-char');
      if (saved === 'elaina' || saved === 'quints' || saved === 'nino' || saved === 'miku' || saved === 'mirai') {
        return saved;
      }
    } catch {
      // ignore
    }
    return 'elaina';
  });

  const [stageSettings, setStageSettings] = useState<AnimeStageSettings>(() => {
    try {
      const raw = window.localStorage.getItem('wave75-anime-stage');
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<AnimeStageSettings>;
        return { ...DEFAULT_ANIME_STAGE_SETTINGS, ...parsed };
      }
    } catch {
      // ignore
    }
    return DEFAULT_ANIME_STAGE_SETTINGS;
  });

  const activeCharacter = getAnimeCharacter(characterId);

  // Sync active character's signature color palette into global CSS variables + cursor theme!
  useEffect(() => {
    const root = document.documentElement.style;
    const th = activeCharacter.theme;
    root.setProperty('--theme-primary', th.primary);
    root.setProperty('--theme-primary-rgb', th.primaryRgb);
    root.setProperty('--theme-secondary', th.secondary);
    root.setProperty('--theme-accent', th.accent);
    root.setProperty('--theme-accent-rgb', th.accentRgb);
    root.setProperty('--theme-bg', th.bg);
    root.setProperty('--theme-surface-from', th.surfaceFrom);
    root.setProperty('--theme-surface-to', th.surfaceTo);
    document.body.setAttribute('data-anime-theme', activeCharacter.id);
  }, [activeCharacter]);

  // Pre-decode all optimized anime wallpapers into GPU memory right on boot (0ms switch lag!)
  useEffect(() => {
    preloadAllAnimeAssets();
    return () => {
      transitionTimersRef.current.forEach((id) => window.clearTimeout(id));
    };
  }, []);

  const handleSelectCharacter = (id: AnimeCharacterId) => {
    setCharacterId(id);
    try {
      window.localStorage.setItem('wave75-anime-char', id);
    } catch {
      // ignore
    }
  };

  const handleUpdateStageSettings = (partial: Partial<AnimeStageSettings>) => {
    setStageSettings((prev) => {
      const next = { ...prev, ...partial };
      try {
        // Persist settings (omit giant data-URL custom images if > 1.5MB to keep storage safe)
        const toSave =
          next.customImageUrl && next.customImageUrl.length > 1_500_000
            ? { ...next, customImageUrl: null }
            : next;
        window.localStorage.setItem('wave75-anime-stage', JSON.stringify(toSave));
      } catch {
        // ignore storage quota
      }
      return next;
    });
  };

  const toggleAnimeCursor = () => {
    setAnimeCursor((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem('wave75-anime-cursor', next ? '1' : '0');
      } catch {
        // ignore storage errors
      }
      return next;
    });
  };

  /**
   * 2-Phase GPU-Composited Split-Gate Transition (120 FPS, zero frame-drop during Studio mount!):
   * 0ms   : Shutters glide smoothly shut on GPU compositor.
   * 340ms : Screen is 100% covered -> silently mount Studio / run midpoint callback!
   * 520ms : Shutters smoothly part apart revealing the already-rendered Studio!
   * 1000ms: Overlay unmounts cleanly.
   */
  const runSilkyTransition = (onMidpoint?: () => void) => {
    transitionTimersRef.current.forEach((id) => window.clearTimeout(id));
    transitionTimersRef.current = [];
    setTransitionPhase('closing');

    const t1 = window.setTimeout(() => {
      setTransitionPhase('hold');
      onMidpoint?.();
    }, 340);

    const t2 = window.setTimeout(() => {
      setTransitionPhase('opening');
    }, 520);

    const t3 = window.setTimeout(() => {
      setTransitionPhase('idle');
    }, 1020);

    transitionTimersRef.current = [t1, t2, t3];
  };

  const triggerUnlockTransition = (asPreview: boolean) => {
    setPreviewMode(asPreview);
    runSilkyTransition(() => {
      setStudioUnlocked(true);
    });
  };

  // Automatically unlock Studio with silky 2-phase split-gate transition when keyboard connects!
  useEffect(() => {
    if (hidState.connected && (!studioUnlocked || previewMode)) {
      triggerUnlockTransition(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hidState.connected]);

  const gifMediaRef = useRef<LoadedGifMedia | null>(gifMedia);
  const gifFrameIdxRef = useRef(0);
  const gifAccumRef = useRef(0);
  const gifSampleCacheRef = useRef<{
    cacheKey: string;
    frames: Map<number, { keys: RGB[]; logo: RGB }>;
  }>({ cacheKey: '', frames: new Map() });
  const lastAudioUiRef = useRef(0);
  const uiFramePausedRef = useRef(!studioUnlocked || transitionPhase !== 'idle');
  uiFramePausedRef.current = !studioUnlocked || transitionPhase !== 'idle';

  const t = TRANSLATIONS[language];
  const isVi = language === 'vi';

  useEffect(() => {
    waveHidManager.setMaxFps(usbFps);
    waveHidManager.switchSimulatedModel(activeModel);
    const unsubState = waveHidManager.subscribeState(setHidState);
    const unsubTraffic = waveHidManager.subscribeTraffic(setTraffic);
    return () => {
      unsubState();
      unsubTraffic();
      waveAudioEngine.stop();
    };
  }, []);

  useEffect(() => {
    gifMediaRef.current = gifMedia;
  }, [gifMedia]);

  // Global keyboard shortcuts
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT')
      ) {
        return;
      }

      if (!e.repeat) {
        waveReactiveEngine.triggerByCode(e.code, performance.now());
      }

      const store = useWaveStore.getState();

      // Playable WAVE75 LED Snake Game controls (Arrow keys, WASD, Space, R)
      if (store.activeTab === 'effects' && store.effectParams.effectId === 'snake') {
        if (e.code === 'ArrowUp' || e.code === 'KeyW') {
          e.preventDefault();
          waveSnakeEngine.steer('up');
          return;
        }
        if (e.code === 'ArrowDown' || e.code === 'KeyS') {
          e.preventDefault();
          waveSnakeEngine.steer('down');
          return;
        }
        if (e.code === 'ArrowLeft' || e.code === 'KeyA') {
          e.preventDefault();
          waveSnakeEngine.steer('left');
          return;
        }
        if (e.code === 'ArrowRight' || e.code === 'KeyD') {
          e.preventDefault();
          waveSnakeEngine.steer('right');
          return;
        }
        if (e.code === 'Space' || e.code === 'Enter') {
          e.preventDefault();
          waveSnakeEngine.togglePlayOrRestart();
          return;
        }
        if (e.code === 'KeyR') {
          e.preventDefault();
          waveSnakeEngine.reset(true);
          return;
        }
      }

      if (store.activeTab !== 'perkey') return;

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) store.redoPerKey();
        else store.undoPerKey();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        store.redoPerKey();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        store.setSelectedKeys(WAVE75_KEYS.map((k) => k.index));
      } else if (e.key === 'Escape') {
        store.setSelectedKeys([]);
        store.setLogoSelected(false);
      } else if (e.key === 'Enter' && store.selectedKeys.length > 0) {
        e.preventDefault();
        store.paintKeys(store.selectedKeys, store.brushColor, true);
      } else if ((e.key === 'Delete' || e.key === 'Backspace') && store.selectedKeys.length > 0) {
        e.preventDefault();
        store.clearSelectedOrAll(true);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  // Main 60 FPS Render & Throttled 0x2E USB Sync Loop
  useEffect(() => {
    let raf = 0;
    let prev = performance.now();

    const loop = (now: number) => {
      const dt = Math.min(100, now - prev);
      prev = now;

      const s = useWaveStore.getState();
      let keys: RGB[] = new Array<RGB>(WAVE75_KEY_COUNT).fill(BLACK);
      let logo: RGB = computeAnimatedLogo(s.logoSettings, now);
      let shouldStream = false;

      if (s.calibrationActive) {
        for (let i = 0; i < WAVE75_KEY_COUNT; i++) {
          if (s.lightIndexMap[i] === s.calibrationLightIndex) {
            keys[i] = { r: 255, g: 215, b: 40 };
          }
        }
        logo = { r: 255, g: 215, b: 40 };
        shouldStream = true;
      } else if (s.activeModel === 'wave75_non_rgb') {
        logo = computeAnimatedLogo(s.logoSettings, now);
      } else if (s.activeTab === 'effects') {
        const res = renderProceduralFrame(
          s.effectParams,
          now,
          waveReactiveEngine.getPulses(now)
        );
        keys = res.keys;
        logo = res.logo;
        shouldStream = s.liveStreamEffects;
      } else if (s.activeTab === 'text') {
        const res = renderTextLedFrame(s.textLedConfig, now);
        keys = res.keys;
        logo = res.logo;
        shouldStream = s.textLiveStream;
      } else if (s.activeTab === 'perkey' || s.activeTab === 'profiles') {
        const slot = s.slots[s.activeSlot];
        keys = slot.keys;
        logo = slot.logo;
        shouldStream = true;
      } else if (s.activeTab === 'gif') {
        const media = gifMediaRef.current;
        if (media && media.frames.length > 0) {
          const frameCount = media.frames.length;
          let delay = 55;
          if (s.gifPlaying && frameCount > 1) {
            const curF = media.frames[gifFrameIdxRef.current % frameCount];
            delay = Math.max(16, curF.delayMs / Math.max(0.25, s.gifSpeed));
            gifAccumRef.current += dt;
            if (gifAccumRef.current >= delay) {
              const steps = Math.floor(gifAccumRef.current / delay);
              gifAccumRef.current %= delay;
              gifFrameIdxRef.current = (gifFrameIdxRef.current + steps) % frameCount;
              setGifFrameIdx(gifFrameIdxRef.current);
            }
          }

          const adj = s.gifAdjustments;
          const cacheKey = `${media.id}|${s.gifFitMode}|${adj.brightness}|${adj.contrast}|${adj.saturation}|${adj.gamma}`;
          const cache = gifSampleCacheRef.current;
          if (cache.cacheKey !== cacheKey) {
            cache.cacheKey = cacheKey;
            cache.frames.clear();
          }

          const getSampled = (idx: number) => {
            const safeIdx = ((idx % frameCount) + frameCount) % frameCount;
            let cached = cache.frames.get(safeIdx);
            if (!cached) {
              cached = sampleFrameTo81Keys(media.frames[safeIdx].imageData, s.gifFitMode, adj);
              cache.frames.set(safeIdx, cached);
            }
            return cached;
          };

          const currIdx = gifFrameIdxRef.current % frameCount;
          const currRes = getSampled(currIdx);

          if (s.gifPlaying && frameCount > 1) {
            const nextRes = getSampled((currIdx + 1) % frameCount);
            const alpha = Math.min(1, Math.max(0, gifAccumRef.current / delay));
            const blendedKeys = new Array<RGB>(WAVE75_KEY_COUNT);
            for (let k = 0; k < WAVE75_KEY_COUNT; k++) {
              blendedKeys[k] = lerpRgb(currRes.keys[k], nextRes.keys[k], alpha);
            }
            keys = blendedKeys;
            logo = lerpRgb(currRes.logo, nextRes.logo, alpha);
          } else {
            keys = currRes.keys;
            logo = currRes.logo;
          }
          shouldStream = s.gifLiveStream;
        }
      } else if (s.activeTab === 'audio') {
        const res = waveAudioEngine.renderFrame(s.audioConfig, now);
        keys = res.keys;
        logo = res.logo;
        shouldStream = waveAudioEngine.getSource() !== 'none';
        if (now - lastAudioUiRef.current > 60) {
          setAudioBands(Array.from(waveAudioEngine.sample16Bands(s.audioConfig, now)));
          lastAudioUiRef.current = now;
        }
      } else if (s.activeTab === 'qmk') {
        const res = renderProceduralFrame(
          {
            effectId: s.qmkState.effectId === 0 ? 'static_solid' : 'rainbow_wave',
            brightness: s.qmkState.effectId === 0 ? 0 : Math.round((s.qmkState.brightness / 255) * 100),
            speed: Math.max(1, Math.round((s.qmkState.speed / 255) * 10)),
            direction: 'ltr',
            primaryColor: hsvToRgb({
              h: (s.qmkState.hue / 255) * 360,
              s: (s.qmkState.saturation / 255) * 100,
              v: 100,
            }),
            secondaryColor: s.logoSettings.color,
            useRainbow: s.qmkState.effectId !== 1,
          },
          now
        );
        keys = res.keys;
        logo = computeAnimatedLogo(s.logoSettings, now);
      }

      if (!uiFramePausedRef.current) {
        setFrameKeys(keys);
        setFrameLogo(logo);
      }

      if (shouldStream) {
        waveHidManager.enqueueSyncFrame(keys, logo, s.lightIndexMap);
      }

      raf = window.requestAnimationFrame(loop);
    };

    raf = window.requestAnimationFrame(loop);
    return () => window.cancelAnimationFrame(raf);
  }, []);

  const handleSelectBuiltInGif = (presetId: string) => {
    setGifPresetId(presetId);
    gifFrameIdxRef.current = 0;
    gifAccumRef.current = 0;
    setGifFrameIdx(0);
    setGifMedia(generateBuiltInWaveGif(presetId));
  };

  // Hero Quick-Bar: 1-Click Save Forever for whatever tab the user is currently viewing!
  const handleQuickSaveForever = async () => {
    const s = useWaveStore.getState();
    setQuickSaveBusy(true);
    setQuickSaveToast(null);
    try {
      let payload;
      if (s.activeTab === 'text') {
        payload = buildWave75TextLedDriver({
          textConfig: s.textLedConfig,
          logoSettings: s.logoSettings,
          lightIndexMap: s.lightIndexMap,
          fps: Math.max(20, Math.min(30, s.usbFps)),
        });
      } else if (s.activeTab === 'gif' && gifMediaRef.current) {
        payload = buildWave75GifDriverPs1({
          media: gifMediaRef.current,
          fitMode: s.gifFitMode,
          adjustments: s.gifAdjustments,
          gifSpeed: s.gifSpeed,
          logoSettings: s.logoSettings,
          lightIndexMap: s.lightIndexMap,
        });
      } else if (s.activeTab === 'perkey') {
        const slot = s.slots[s.activeSlot];
        payload = buildWave75PerKeyDriver({
          slotName: `Màu từng phím Khe ${s.activeSlot}`,
          keyColors: slot.keys,
          logoSettings: {
            ...s.logoSettings,
            color: slot.logo,
            effect: slot.logo.r + slot.logo.g + slot.logo.b > 6 ? 'static' : 'off',
            brightness: slot.logo.r + slot.logo.g + slot.logo.b > 6 ? 100 : 0,
          },
          lightIndexMap: s.lightIndexMap,
        });
      } else {
        payload = buildWave75LiveEffectDriver({
          effectName: t.effects.names[s.effectParams.effectId] || s.effectParams.effectId,
          effectParams: s.effectParams,
          logoSettings: s.logoSettings,
          lightIndexMap: s.lightIndexMap,
          fps: Math.max(20, Math.min(30, s.usbFps)),
        });
      }

      await waveHidManager.disconnectForBackgroundDriver();
      await new Promise((r) => setTimeout(r, 150));
      const res = await installPersistentBackgroundDriver(payload);
      if (res.ok) {
        setQuickSaveToast(
          isVi
            ? `Đã lưu vĩnh viễn "${payload.effectName}"! Bật phím hoặc mở máy là tự chạy ngay.`
            : `Saved "${payload.effectName}" forever! Auto-runs on keyboard power-on.`
        );
      } else {
        triggerTextDownload(payload.batFilename, payload.batContent);
        setQuickSaveToast(
          isVi
            ? `Đã tải "${payload.batFilename}" — nháy đúp 1 lần để cài tự chạy!`
            : `Downloaded "${payload.batFilename}" — double-click once to install!`
        );
      }
      window.setTimeout(() => setQuickSaveToast(null), 6500);
    } finally {
      setQuickSaveBusy(false);
    }
  };

  // Unified quick brightness control for the Hero Quick Bar
  const activeBrightness =
    activeTab === 'text' ? textLedConfig.brightness : effectParams.brightness;
  const setActiveBrightness = (val: number) => {
    if (activeTab === 'text') updateTextLedConfig({ brightness: val });
    else updateEffectParams({ brightness: val });
  };

  if (!studioUnlocked) {
    return (
      <>
        <AnimeCursor enabled={animeCursor} theme={activeCharacter.theme} />
        <AnimeWelcomeGate
          hidState={hidState}
          character={activeCharacter}
          stageSettings={stageSettings}
          onSelectCharacter={(id) => {
            handleUpdateStageSettings({ customImageUrl: null });
            handleSelectCharacter(id);
          }}
          onOpenMotionEditor={() => setMotionEditorOpen(true)}
          onEnterPreview={() => triggerUnlockTransition(true)}
          animeCursor={animeCursor}
          onToggleCursor={toggleAnimeCursor}
        />
        <AnimeMotionPopover
          open={motionEditorOpen}
          onClose={() => setMotionEditorOpen(false)}
          characterId={characterId}
          onSelectCharacter={handleSelectCharacter}
          settings={stageSettings}
          onUpdateSettings={handleUpdateStageSettings}
          onTestTransition={() => runSilkyTransition()}
          isVi={isVi}
        />
        <AnimeTransitionOverlay
          phase={transitionPhase}
          isPreviewMode={previewMode}
          isVi={isVi}
          character={activeCharacter}
          customImageUrl={stageSettings.customImageUrl}
        />
      </>
    );
  }

  return (
    <div
      className="relative min-h-screen overflow-x-hidden text-slate-50 transition-colors duration-300"
      style={{ backgroundColor: activeCharacter.theme.bg }}
    >
      <AnimeCursor enabled={animeCursor} theme={activeCharacter.theme} />
      <AnimeTransitionOverlay
        phase={transitionPhase}
        isPreviewMode={previewMode}
        isVi={isVi}
        character={activeCharacter}
        customImageUrl={stageSettings.customImageUrl}
      />
      <AnimeMotionPopover
        open={motionEditorOpen}
        onClose={() => setMotionEditorOpen(false)}
        characterId={characterId}
        onSelectCharacter={handleSelectCharacter}
        settings={stageSettings}
        onUpdateSettings={handleUpdateStageSettings}
        onTestTransition={() => runSilkyTransition()}
        isVi={isVi}
      />

      {/* 2.5D Live2D Animated Anime Character Studio Backdrop */}
      <AnimeCharacterStage
        character={activeCharacter}
        settings={stageSettings}
        variant="studio"
      />
      <div
        className="pointer-events-none fixed inset-0 z-0 transition-all duration-500"
        style={{
          background: `radial-gradient(ellipse at top, rgba(${activeCharacter.theme.primaryRgb}, 0.20), transparent 55%), radial-gradient(ellipse at bottom right, rgba(${activeCharacter.theme.accentRgb}, 0.11), transparent 50%), linear-gradient(180deg, ${activeCharacter.theme.bg}ad, ${activeCharacter.theme.bg}e6)`,
        }}
      />
      <SakuraPetalsBackdrop
        density={14}
        zIndexClass="z-0"
        colors={activeCharacter.theme.particleColors}
      />

      <div className="anime-studio-enter relative z-10">
        <Header
          hidState={hidState}
          animeCursor={animeCursor}
          onToggleCursor={toggleAnimeCursor}
          character={activeCharacter}
          onReturnToGate={() => {
            runSilkyTransition(() => {
              setStudioUnlocked(false);
              setPreviewMode(false);
            });
          }}
        />

        <main className="mx-auto max-w-7xl space-y-5 px-4 py-5 pb-14">
          {/* Anime Companion Live Dialogue Bar + In-Studio Character & Motion Controls */}
          <AnimeCompanionBar
            activeTab={activeTab}
            connected={hidState.connected}
            quickSaveToast={quickSaveToast}
            isVi={isVi}
            character={activeCharacter}
            customImageUrl={stageSettings.customImageUrl}
            onSelectCharacter={(id) => {
              handleUpdateStageSettings({ customImageUrl: null });
              handleSelectCharacter(id);
            }}
            onOpenMotionEditor={() => setMotionEditorOpen(true)}
          />

          {/* Central Interactive CNC WAVE75 Keyboard Stage */}
          <div className="anime-stage-frame rounded-3xl p-[1.5px]">
            <Wave75Canvas keyColors={frameKeys} logoColor={frameLogo} />
          </div>

          {/* Prominent Quick Action Bar — Most Important Controls Always 1 Click Away */}
          <div className="anime-glass flex flex-wrap items-center justify-between gap-3 rounded-2xl px-4 py-3">
            <div className="flex flex-wrap items-center gap-2.5">
              {/* Hero CTA #1: Save Forever */}
              <button
                type="button"
                disabled={quickSaveBusy}
                onClick={() => void handleQuickSaveForever()}
                className="anime-btn-primary anime-btn-shimmer inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-extrabold text-white transition hover:scale-[1.03] active:scale-[0.98] disabled:opacity-50"
              >
                <Rocket className="h-4 w-4" />
                {quickSaveBusy
                  ? isVi
                    ? 'Đang lưu...'
                    : 'Saving...'
                  : isVi
                    ? 'Lưu chạy vĩnh viễn'
                    : 'Save Forever'}
              </button>

              {/* Quick CTA #2: Red Case Edition GIFs */}
              <button
                type="button"
                onClick={() => setActiveTab('gif')}
                className={`inline-flex items-center gap-1.5 rounded-xl border px-3.5 py-2.5 text-xs font-bold transition ${
                  activeTab === 'gif'
                    ? 'anime-pill-active'
                    : 'anime-badge-themed hover:brightness-115'
                }`}
              >
                <Film className="h-4 w-4" />
                {isVi ? '🔴 42 GIF & Phím Đỏ' : '🔴 42 GIFs & Red Pack'}
              </button>

              {/* Quick CTA #3: Scrolling Text & Pixel Art */}
              <button
                type="button"
                onClick={() => setActiveTab('text')}
                className={`inline-flex items-center gap-1.5 rounded-xl border px-3.5 py-2.5 text-xs font-bold transition ${
                  activeTab === 'text'
                    ? 'anime-pill-active'
                    : 'border-white/15 bg-white/[0.06] text-slate-100 hover:border-white/35'
                }`}
              >
                <Type className="h-4 w-4" style={{ color: activeCharacter.theme.accent }} />
                {isVi ? 'Ghi chữ chạy lên phím' : 'Scrolling LED Text'}
              </button>

              {/* Quick CTA #4: CNC Wave Logo LED */}
              <button
                type="button"
                onClick={() => setActiveTab('qmk')}
                className={`inline-flex items-center gap-2 rounded-xl border px-3.5 py-2.5 text-xs font-bold transition ${
                  activeTab === 'qmk'
                    ? 'anime-pill-active'
                    : 'border-white/15 bg-white/[0.06] text-slate-100 hover:border-white/35'
                }`}
              >
                <span
                  className="h-3 w-3 rounded-full ring-2 ring-white/40"
                  style={{
                    backgroundColor: rgbToHex(logoSettings.color),
                    boxShadow: `0 0 8px ${rgbToHex(logoSettings.color)}`,
                  }}
                />
                {isVi ? 'Chỉnh Đèn Logo CNC' : 'CNC Logo LED'}
              </button>

              {!hidState.connected && (
                <button
                  type="button"
                  onClick={() => {
                    waveHidManager.connectDevice(activeModel).catch(() => {});
                  }}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-rose-400/40 bg-rose-500/15 px-3 py-2.5 text-xs font-semibold text-rose-100 transition hover:bg-rose-500/25 sm:hidden"
                >
                  <Usb className="h-3.5 w-3.5 text-rose-300" />
                  {t.app.connectNative}
                </button>
              )}
            </div>

            {/* Quick Master Brightness & Light On/Off Toggle */}
            <div className="flex items-center gap-2.5">
              <Sun className="h-4 w-4 text-amber-300" />
              <input
                type="range"
                min={0}
                max={100}
                value={activeBrightness}
                onChange={(e) => setActiveBrightness(Number(e.target.value))}
                aria-label="Quick Brightness"
                className="wave-slider w-24 sm:w-32"
              />
              <span className="w-9 text-right font-mono text-xs font-bold text-rose-200">
                {activeBrightness}%
              </span>
              <button
                type="button"
                onClick={() => setActiveBrightness(activeBrightness > 0 ? 0 : 95)}
                title={isVi ? 'Bật / Tắt nhanh đèn LED' : 'Toggle LEDs On/Off'}
                className={`rounded-xl border p-2 transition ${
                  activeBrightness > 0
                    ? 'border-rose-300/25 bg-rose-500/10 text-rose-100 hover:border-rose-400/60'
                    : 'border-rose-400/60 bg-rose-500/25 text-rose-200'
                }`}
              >
                <Power className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {quickSaveToast && (
            <div className="anime-panel-enter flex items-center gap-2.5 rounded-xl border border-emerald-400/45 bg-emerald-500/15 px-4 py-2.5 text-xs font-semibold text-emerald-100 shadow-lg backdrop-blur-md">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
              <span>{quickSaveToast}</span>
            </div>
          )}

          {/* 7-Tab Character-Themed Navigation + Animated Control Deck */}
          <section className="anime-glass overflow-hidden rounded-2xl">
            <div
              className="grid grid-cols-2 gap-1.5 border-b p-2 sm:grid-cols-4 lg:grid-cols-7"
              style={{
                backgroundColor: `${activeCharacter.theme.bg}cc`,
                borderColor: `rgba(${activeCharacter.theme.primaryRgb}, 0.2)`,
              }}
            >
              {TABS.map(({ id, icon: Icon, badgeVi, badgeEn }) => {
                const active = activeTab === id;
                const disabledNonRgb =
                  activeModel === 'wave75_non_rgb' &&
                  (id === 'effects' || id === 'text' || id === 'perkey' || id === 'gif' || id === 'audio');
                const badge = isVi ? badgeVi : badgeEn;
                return (
                  <button
                    key={id}
                    type="button"
                    disabled={disabledNonRgb}
                    onClick={() => setActiveTab(id)}
                    className={`relative flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-xs font-bold transition duration-200 ${
                      active
                        ? 'anime-tab-active'
                        : disabledNonRgb
                          ? 'cursor-not-allowed border-transparent text-slate-600'
                          : 'border-transparent text-slate-300/80 hover:bg-white/[0.06] hover:text-white'
                    }`}
                  >
                    <Icon
                      className="h-4 w-4 shrink-0"
                      style={active ? { color: activeCharacter.theme.accent } : undefined}
                    />
                    <span className="truncate">{t.tabs[id]}</span>
                    {badge && (
                      <span
                        className="rounded-full px-1.5 py-0.5 text-[9px] font-extrabold leading-none text-white shadow-sm"
                        style={{
                          background: `linear-gradient(90deg, ${activeCharacter.theme.primary}, ${activeCharacter.theme.accent})`,
                        }}
                      >
                        {badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            <div key={activeTab} className="anime-panel-enter p-4 sm:p-6">
              {activeTab === 'effects' && <LiveEffectsPanel />}
              {activeTab === 'text' && <TextDesignerPanel />}
              {activeTab === 'perkey' && <PerKeyEditorPanel hidState={hidState} />}
              {activeTab === 'gif' && (
                <GifMatrixPanel
                  media={gifMedia}
                  frameIdx={gifFrameIdx}
                  onSeek={(idx) => {
                    gifFrameIdxRef.current = idx;
                    gifAccumRef.current = 0;
                    setGifFrameIdx(idx);
                  }}
                  onUploaded={(m) => {
                    gifFrameIdxRef.current = 0;
                    gifAccumRef.current = 0;
                    setGifFrameIdx(0);
                    setGifMedia(m);
                  }}
                  onSelectBuiltIn={handleSelectBuiltInGif}
                />
              )}
              {activeTab === 'audio' && (
                <AudioVisualizerPanel
                  source={audioSource}
                  onSourceChange={setAudioSource}
                  bands={audioBands}
                />
              )}
              {activeTab === 'qmk' && <QmkPresetsPanel hidState={hidState} />}
              {activeTab === 'profiles' && <ProfilesPanel />}
            </div>
          </section>
        </main>
      </div>

      <HidDiagnosticsDrawer hidState={hidState} traffic={traffic} />
      <ShortcutsCheatsheetModal />
    </div>
  );
}
