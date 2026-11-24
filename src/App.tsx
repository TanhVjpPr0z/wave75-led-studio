import React, { useEffect, useRef, useState } from 'react';
import {
  Sparkles,
  Palette,
  Film,
  AudioLines,
  Keyboard,
  FolderKanban,
} from 'lucide-react';
import { useStudioStore, type StudioTab } from './store/useStudioStore';
import { TRANSLATIONS } from './i18n';
import { TOTAL_KEYS } from './core/layout/win60heLayout';
import { BLACK, lerpRgb, type RGB } from './core/utils/color';
import { renderEffectFrame } from './core/engines/effectEngine';
import { publishFrame } from './core/engines/frameBus';
import {
  generateBuiltInAnimation,
  sampleImageDataTo61Keys,
  type LoadedMedia,
} from './core/engines/gifEngine';
import {
  sharedAudioEngine,
  type AudioSourceType,
} from './core/engines/audioEngine';
import {
  sharedReactiveEngine,
  type ReactiveStats,
} from './core/engines/reactiveEngine';
import { hidManager, type HidConnectionState } from './core/hid/hidManager';
import type { HidTrafficEntry } from './core/protocols/types';

import { Header } from './components/layout/Header';
import { BrowserWarningBanner } from './components/common/BrowserWarningBanner';
import { SafetyDisclaimerModal } from './components/common/SafetyDisclaimerModal';
import { KeyboardCanvas } from './components/keyboard/KeyboardCanvas';
import { PresetsPanel } from './components/panels/PresetsPanel';
import { PerKeyPanel } from './components/panels/PerKeyPanel';
import { GifPlayerPanel } from './components/panels/GifPlayerPanel';
import { AudioVisualizerPanel } from './components/panels/AudioVisualizerPanel';
import { ReactivePanel } from './components/panels/ReactivePanel';
import { ProfilesPanel } from './components/panels/ProfilesPanel';
import { HidInspectorDrawer } from './components/panels/HidInspectorDrawer';

const TABS: Array<{
  id: StudioTab;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { id: 'presets', icon: Sparkles },
  { id: 'perkey', icon: Palette },
  { id: 'gif', icon: Film },
  { id: 'audio', icon: AudioLines },
  { id: 'reactive', icon: Keyboard },
  { id: 'profiles', icon: FolderKanban },
];

export default function App() {
  const language = useStudioStore((s) => s.language);
  const activeTab = useStudioStore((s) => s.activeTab);
  const setActiveTab = useStudioStore((s) => s.setActiveTab);
  const safetyModalDismissed = useStudioStore((s) => s.safetyModalDismissed);
  const setSafetyModalOpen = useStudioStore((s) => s.setSafetyModalOpen);
  const gifPresetId = useStudioStore((s) => s.gifPresetId);
  const setGifPresetId = useStudioStore((s) => s.setGifPresetId);
  const selectedModel = useStudioStore((s) => s.selectedModel);
  const usbFpsLimit = useStudioStore((s) => s.usbFpsLimit);
  const customProtocolConfig = useStudioStore((s) => s.customProtocolConfig);

  const [hidState, setHidState] = useState<HidConnectionState>(() =>
    hidManager.getState()
  );
  const [traffic, setTraffic] = useState<HidTrafficEntry[]>(() =>
    hidManager.getTrafficLog()
  );
  const [loadedMedia, setLoadedMedia] = useState<LoadedMedia | null>(() =>
    generateBuiltInAnimation(gifPresetId)
  );
  const [gifFrameIdx, setGifFrameIdx] = useState(0);
  const [audioSource, setAudioSource] = useState<AudioSourceType>('none');
  const [audioBands, setAudioBands] = useState<number[]>(() =>
    new Array<number>(15).fill(0)
  );
  const [reactiveStats, setReactiveStats] = useState<ReactiveStats>(() =>
    sharedReactiveEngine.getStats()
  );

  const gifMediaRef = useRef<LoadedMedia | null>(loadedMedia);
  const gifFrameIdxRef = useRef(0);
  const gifAccumMsRef = useRef(0);
  const gifSampleCacheRef = useRef<{
    cacheKey: string;
    frames: Map<number, RGB[]>;
  }>({ cacheKey: '', frames: new Map() });
  const lastActivityRef = useRef<number>(performance.now());
  const lastStatsUpdateRef = useRef<number>(0);
  const lastPerKeyRef = useRef<RGB[] | null>(null);

  const t = TRANSLATIONS[language];

  // Sync hidManager subscriptions & initial settings
  useEffect(() => {
    hidManager.setMaxFps(usbFpsLimit);
    hidManager.updateCustomProtocolConfig(customProtocolConfig);
    hidManager.switchSimulatedModel(selectedModel);

    const unsubState = hidManager.subscribeState(setHidState);
    const unsubTraffic = hidManager.subscribeTraffic(setTraffic);

    if (!safetyModalDismissed) {
      setSafetyModalOpen(true);
    }

    return () => {
      unsubState();
      unsubTraffic();
      sharedAudioEngine.stop();
    };
  }, []);

  useEffect(() => {
    hidManager.setMaxFps(usbFpsLimit);
  }, [usbFpsLimit]);

  useEffect(() => {
    gifMediaRef.current = loadedMedia;
  }, [loadedMedia]);

  // Global keyboard listener for Reactive Typing & Sleep Timer activity
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
      lastActivityRef.current = performance.now();
      if (!e.repeat) {
        sharedReactiveEngine.triggerKeyByCode(e.code, performance.now());
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      sharedReactiveEngine.releaseKeyByCode(e.code);
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, []);

  // Main 60 FPS Animation & Hardware Streaming Loop
  useEffect(() => {
    let rafId = 0;
    let prevTime = performance.now();

    const tick = (now: number) => {
      const dt = Math.min(100, now - prevTime);
      prevTime = now;

      const store = useStudioStore.getState();
      let nextFrame: RGB[];
      let shouldStreamToUsb = false;

      if (store.activeTab !== 'perkey') {
        lastPerKeyRef.current = null;
      }

      if (store.calibrationActive) {
        nextFrame = new Array<RGB>(TOTAL_KEYS).fill(BLACK);
        for (let i = 0; i < TOTAL_KEYS; i++) {
          if (store.ledIndexMap[i] === store.calibrationLedIndex) {
            nextFrame[i] = { r: 255, g: 215, b: 40 };
          }
        }
        shouldStreamToUsb = true;
      } else if (store.activeTab === 'presets') {
        const impulses = sharedReactiveEngine.getPulses(now);
        nextFrame = renderEffectFrame(
          store.effectParams,
          now,
          impulses,
          lastActivityRef.current
        );
        shouldStreamToUsb = store.liveStreamPresets;
      } else if (store.activeTab === 'perkey') {
        nextFrame = store.perKeyColors;
        // Only send USB update when the per-key array reference actually changed (no idle bus spam)
        shouldStreamToUsb = lastPerKeyRef.current !== store.perKeyColors;
        if (shouldStreamToUsb) lastPerKeyRef.current = store.perKeyColors;
      } else if (store.activeTab === 'gif') {
        const media = gifMediaRef.current;
        if (media && media.frames.length > 0) {
          const frameCount = media.frames.length;
          let delay = 55;
          if (store.gifPlaying && frameCount > 1) {
            const currentF = media.frames[gifFrameIdxRef.current % frameCount];
            delay = Math.max(16, currentF.delayMs / Math.max(0.25, store.gifSpeed));
            gifAccumMsRef.current += dt;
            if (gifAccumMsRef.current >= delay) {
              const steps = Math.floor(gifAccumMsRef.current / delay);
              gifAccumMsRef.current = gifAccumMsRef.current % delay;
              gifFrameIdxRef.current = (gifFrameIdxRef.current + steps) % frameCount;
              setGifFrameIdx(gifFrameIdxRef.current);
            }
          }

          const adj = store.gifAdjustments;
          const cacheKey = `${media.id}|${store.gifFitMode}|${adj.brightness}|${adj.contrast}|${adj.saturation}|${adj.gamma}|${adj.quantizeLevels}`;
          const cache = gifSampleCacheRef.current;
          if (cache.cacheKey !== cacheKey) {
            cache.cacheKey = cacheKey;
            cache.frames.clear();
          }

          const getSampled = (idx: number): RGB[] => {
            const safeIdx = ((idx % frameCount) + frameCount) % frameCount;
            let cached = cache.frames.get(safeIdx);
            if (!cached) {
              cached = sampleImageDataTo61Keys(
                media.frames[safeIdx].imageData,
                store.gifFitMode,
                adj
              );
              cache.frames.set(safeIdx, cached);
            }
            return cached;
          };

          const currIdx = gifFrameIdxRef.current % frameCount;
          const sampledCurr = getSampled(currIdx);

          // Linearly cross-fade between consecutive GIF frames for silky-smooth 30+ FPS LED motion
          if (store.gifPlaying && frameCount > 1) {
            const sampledNext = getSampled((currIdx + 1) % frameCount);
            const alpha = Math.min(1, Math.max(0, gifAccumMsRef.current / delay));
            const blended = new Array<RGB>(TOTAL_KEYS);
            for (let k = 0; k < TOTAL_KEYS; k++) {
              blended[k] = lerpRgb(sampledCurr[k], sampledNext[k], alpha);
            }
            nextFrame = blended;
          } else {
            nextFrame = sampledCurr;
          }
          shouldStreamToUsb = store.gifLiveStream;
        } else {
          nextFrame = new Array<RGB>(TOTAL_KEYS).fill(BLACK);
        }
      } else if (store.activeTab === 'audio') {
        nextFrame = sharedAudioEngine.renderFrame(store.audioConfig, now);
        shouldStreamToUsb = sharedAudioEngine.getSource() !== 'none';
        if (now - lastStatsUpdateRef.current > 60) {
          const bands = sharedAudioEngine.sample15Bands(store.audioConfig, now);
          setAudioBands(Array.from(bands));
          lastStatsUpdateRef.current = now;
        }
      } else if (store.activeTab === 'reactive') {
        nextFrame = sharedReactiveEngine.renderFrame(store.reactiveConfig, now);
        shouldStreamToUsb = true;
        if (now - lastStatsUpdateRef.current > 150) {
          setReactiveStats(sharedReactiveEngine.getStats(now));
          lastStatsUpdateRef.current = now;
        }
      } else {
        // Profiles tab previews active effect or per-key map
        const activeProf = store.profiles.find((p) => p.id === store.activeProfileId);
        if (activeProf?.activeTab === 'perkey') {
          nextFrame = store.perKeyColors;
          shouldStreamToUsb = lastPerKeyRef.current !== store.perKeyColors;
          if (shouldStreamToUsb) lastPerKeyRef.current = store.perKeyColors;
        } else {
          nextFrame = renderEffectFrame(
            store.effectParams,
            now,
            sharedReactiveEngine.getPulses(now),
            lastActivityRef.current
          );
          shouldStreamToUsb = store.liveStreamPresets;
        }
      }

      // Publish directly to KeyboardCanvas DOM refs (ZERO React re-renders on App!)
      publishFrame(nextFrame);

      if (shouldStreamToUsb) {
        hidManager.enqueuePerKeyFrame(nextFrame, store.ledIndexMap);
      }

      rafId = window.requestAnimationFrame(tick);
    };

    rafId = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(rafId);
  }, []);

  const handleSelectBuiltInGif = (presetId: string) => {
    setGifPresetId(presetId);
    const media = generateBuiltInAnimation(presetId);
    gifFrameIdxRef.current = 0;
    gifAccumMsRef.current = 0;
    setGifFrameIdx(0);
    setLoadedMedia(media);
  };

  const handleMediaUploaded = (media: LoadedMedia) => {
    gifFrameIdxRef.current = 0;
    gifAccumMsRef.current = 0;
    setGifFrameIdx(0);
    setLoadedMedia(media);
  };

  const handleSeekGifFrame = (frameIndex: number) => {
    gifFrameIdxRef.current = frameIndex;
    gifAccumMsRef.current = 0;
    setGifFrameIdx(frameIndex);
  };

  return (
    <div className="min-h-screen bg-[#0B0E14] text-slate-100">
      <BrowserWarningBanner />
      <Header hidState={hidState} />

      <main className="mx-auto max-w-7xl space-y-5 px-4 py-5 pb-12">
        {/* Central Interactive 61-Key Keyboard Stage */}
        <KeyboardCanvas />

        {/* Control Deck: 6 Studio Tabs */}
        <section className="overflow-hidden rounded-2xl border border-white/[0.08] bg-[#131822]/95 shadow-2xl shadow-black/40">
          {/* Tab Strip */}
          <div className="flex overflow-x-auto border-b border-white/[0.08] bg-[#0E131D] px-2 pt-2">
            {TABS.map(({ id, icon: Icon }) => {
              const active = activeTab === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setActiveTab(id)}
                  className={`relative flex shrink-0 items-center gap-2 rounded-t-xl px-4 py-3 text-xs font-semibold transition ${
                    active
                      ? 'bg-[#131822] text-cyan-300'
                      : 'text-slate-400 hover:bg-white/[0.03] hover:text-slate-200'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span>{t.tabs[id]}</span>
                  {active && (
                    <span className="absolute inset-x-2 top-0 h-[2px] rounded-full bg-gradient-to-r from-cyan-400 to-violet-500" />
                  )}
                </button>
              );
            })}
          </div>

          {/* Active Tab Content */}
          <div className="p-4 sm:p-5">
            {activeTab === 'presets' && <PresetsPanel hidState={hidState} />}
            {activeTab === 'perkey' && <PerKeyPanel />}
            {activeTab === 'gif' && (
              <GifPlayerPanel
                media={loadedMedia}
                currentFrameIdx={gifFrameIdx}
                onSeekFrame={handleSeekGifFrame}
                onMediaUploaded={handleMediaUploaded}
                onSelectBuiltIn={handleSelectBuiltInGif}
              />
            )}
            {activeTab === 'audio' && (
              <AudioVisualizerPanel
                audioSource={audioSource}
                onAudioSourceChange={setAudioSource}
                bandsPreview={audioBands}
              />
            )}
            {activeTab === 'reactive' && <ReactivePanel stats={reactiveStats} />}
            {activeTab === 'profiles' && <ProfilesPanel hidState={hidState} />}
          </div>
        </section>
      </main>

      {/* Modals & Drawers */}
      <SafetyDisclaimerModal />
      <HidInspectorDrawer hidState={hidState} traffic={traffic} />
    </div>
  );
}

