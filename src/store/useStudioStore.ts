import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Language } from '../i18n';
import type { RGB, ColorAdjustments } from '../core/utils/color';
import { QUICK_COLOR_PRESETS, sampleGradient, BLACK } from '../core/utils/color';
import {
  WIN60HE_KEYS,
  TOTAL_KEYS,
  createDefaultLedIndexMap,
  KEYBOARD_WIDTH_U,
  KEYBOARD_HEIGHT_U,
} from '../core/layout/win60heLayout';
import type { EffectParams } from '../core/engines/effectEngine';
import type { FitMode } from '../core/engines/gifEngine';
import type { AudioVisualizerConfig } from '../core/engines/audioEngine';
import type { ReactiveConfig } from '../core/engines/reactiveEngine';
import type {
  CustomProtocolConfig,
  KeyboardModelId,
} from '../core/protocols/types';
import { DEFAULT_CUSTOM_PROTOCOL_CONFIG } from '../core/protocols/types';

export type StudioTab =
  | 'presets'
  | 'perkey'
  | 'gif'
  | 'audio'
  | 'reactive'
  | 'profiles';

export type KeycapSkin = 'obsidian' | 'polar' | 'classic' | 'side_printed';

export type PerKeyTool = 'select' | 'brush' | 'bucket' | 'eyedropper' | 'eraser';

export interface GradientConfig {
  stops: RGB[];
  angle: number; // 0..360
  radial: boolean;
}

export interface StudioProfile {
  id: string;
  name: string;
  createdAt: string;
  activeTab: 'presets' | 'perkey';
  effectParams: EffectParams;
  perKeyColors: RGB[];
}

function buildGradientKeys(stops: RGB[], angleDeg: number, radial: boolean): RGB[] {
  const rad = (angleDeg * Math.PI) / 180;
  const dx = Math.cos(rad);
  const dy = Math.sin(rad);

  return WIN60HE_KEYS.map((k) => {
    let t: number;
    if (radial) {
      const rx = (k.cx - KEYBOARD_WIDTH_U / 2) / (KEYBOARD_WIDTH_U / 2);
      const ry = (k.cy - KEYBOARD_HEIGHT_U / 2) / (KEYBOARD_HEIGHT_U / 2);
      t = Math.min(1, Math.hypot(rx, ry) * 0.85);
    } else {
      const centeredX = k.nx - 0.5;
      const centeredY = k.ny - 0.5;
      t = centeredX * dx + centeredY * dy + 0.5;
    }
    return sampleGradient(stops, t);
  });
}

function buildFpsStarterKeys(): RGB[] {
  const fpsIds = new Set(['w', 'a', 's', 'd']);
  const skillIds = new Set(['q', 'e', 'r', 'f', '1', '2', '3', '4', '5']);
  const modIds = new Set(['esc', 'lshift', 'lctrl', 'space']);
  return WIN60HE_KEYS.map((k) => {
    if (fpsIds.has(k.id)) return { r: 255, g: 55, b: 85 };
    if (skillIds.has(k.id)) return { r: 0, g: 229, b: 255 };
    if (modIds.has(k.id)) return { r: 250, g: 204, b: 21 };
    return { r: 16, g: 28, b: 56 };
  });
}

const DEFAULT_EFFECT_PARAMS: EffectParams = {
  mode: 'rainbow_wave',
  brightness: 95,
  speed: 3,
  direction: 'left_to_right',
  colorMode: 'rainbow',
  primaryColor: { r: 6, g: 182, b: 212 },
  secondaryColor: { r: 168, g: 85, b: 247 },
  sleepTimeoutMinutes: 0,
};

const DEFAULT_PER_KEY_COLORS: RGB[] = buildGradientKeys(
  QUICK_COLOR_PRESETS[0].stops,
  QUICK_COLOR_PRESETS[0].angle,
  false
);

const DEFAULT_PROFILES: StudioProfile[] = [
  {
    id: 'starter-cyberpunk',
    name: 'Cyberpunk Neon',
    createdAt: '2026-01-01T00:00:00.000Z',
    activeTab: 'perkey',
    effectParams: { ...DEFAULT_EFFECT_PARAMS, mode: 'neon_stream', colorMode: 'dual' },
    perKeyColors: DEFAULT_PER_KEY_COLORS,
  },
  {
    id: 'starter-fps',
    name: 'Valorant / FPS Pro',
    createdAt: '2026-01-01T00:00:00.000Z',
    activeTab: 'perkey',
    effectParams: {
      ...DEFAULT_EFFECT_PARAMS,
      mode: 'static',
      colorMode: 'solid',
      primaryColor: { r: 255, g: 70, b: 85 },
    },
    perKeyColors: buildFpsStarterKeys(),
  },
  {
    id: 'starter-aurora',
    name: 'Polar Aurora Wave',
    createdAt: '2026-01-01T00:00:00.000Z',
    activeTab: 'presets',
    effectParams: {
      ...DEFAULT_EFFECT_PARAMS,
      mode: 'aurora',
      colorMode: 'rainbow',
      speed: 2,
    },
    perKeyColors: buildGradientKeys(
      [
        { r: 16, g: 185, b: 129 },
        { r: 6, g: 182, b: 212 },
        { r: 139, g: 92, b: 246 },
      ],
      35,
      false
    ),
  },
];

const MAX_UNDO_HISTORY = 40;

interface StudioState {
  // General UI & Device settings
  language: Language;
  selectedModel: KeyboardModelId;
  activeTab: StudioTab;
  keycapSkin: KeycapSkin;
  inspectorOpen: boolean;
  safetyModalOpen: boolean;
  safetyModalDismissed: boolean;
  usbFpsLimit: number;
  liveStreamPresets: boolean;

  // Preset tab state
  effectParams: EffectParams;

  // Per-Key tab state
  perKeyColors: RGB[];
  undoStack: RGB[][];
  redoStack: RGB[][];
  selectedKeys: number[];
  perKeyTool: PerKeyTool;
  brushColor: RGB;
  gradientConfig: GradientConfig;

  // GIF tab state
  gifPresetId: string;
  gifFitMode: FitMode;
  gifSpeed: number;
  gifPlaying: boolean;
  gifLiveStream: boolean;
  gifAdjustments: ColorAdjustments;

  // Audio tab state
  audioConfig: AudioVisualizerConfig;

  // Reactive tab state
  reactiveConfig: ReactiveConfig;

  // Profiles & Custom LED Mapping
  profiles: StudioProfile[];
  activeProfileId: string;
  ledIndexMap: number[];
  calibrationActive: boolean;
  calibrationLedIndex: number;
  customProtocolConfig: CustomProtocolConfig;

  // Actions
  setLanguage: (lang: Language) => void;
  setSelectedModel: (model: KeyboardModelId) => void;
  setActiveTab: (tab: StudioTab) => void;
  setKeycapSkin: (skin: KeycapSkin) => void;
  setInspectorOpen: (open: boolean) => void;
  setSafetyModalOpen: (open: boolean) => void;
  dismissSafetyModal: (permanently: boolean) => void;
  setUsbFpsLimit: (fps: number) => void;
  setLiveStreamPresets: (enabled: boolean) => void;

  // Preset actions
  updateEffectParams: (partial: Partial<EffectParams>) => void;

  // Per-key actions
  setSelectedKeys: (indices: number[]) => void;
  toggleSelectedKey: (index: number) => void;
  setPerKeyTool: (tool: PerKeyTool) => void;
  setBrushColor: (color: RGB) => void;
  paintKeys: (indices: number[], color: RGB, pushHistory?: boolean) => void;
  commitPerKeySnapshot: () => void;
  setAllPerKeyColors: (colors: RGB[]) => void;
  clearAllPerKeyColors: () => void;
  updateGradientConfig: (partial: Partial<GradientConfig>) => void;
  applyGradientToSelection: () => void;
  applyQuickColorTheme: (themeId: string) => void;
  undoPerKey: () => void;
  redoPerKey: () => void;

  // GIF actions
  setGifPresetId: (id: string) => void;
  setGifFitMode: (mode: FitMode) => void;
  setGifSpeed: (speed: number) => void;
  setGifPlaying: (playing: boolean) => void;
  setGifLiveStream: (enabled: boolean) => void;
  updateGifAdjustments: (partial: Partial<ColorAdjustments>) => void;

  // Audio & Reactive actions
  updateAudioConfig: (partial: Partial<AudioVisualizerConfig>) => void;
  updateReactiveConfig: (partial: Partial<ReactiveConfig>) => void;

  // Profile actions
  createProfile: (name: string) => void;
  applyProfile: (id: string) => void;
  renameProfile: (id: string, name: string) => void;
  duplicateProfile: (id: string) => void;
  deleteProfile: (id: string) => void;
  importProfileJson: (jsonText: string) => { ok: boolean; error?: string };
  resetDefaultLighting: () => void;

  // Calibration & custom HID config
  setCalibrationActive: (active: boolean) => void;
  setCalibrationLedIndex: (idx: number) => void;
  assignCalibratedKey: (physicalKeyIndex: number) => void;
  resetLedIndexMap: () => void;
  updateCustomProtocolConfig: (partial: Partial<CustomProtocolConfig>) => void;
}

export const useStudioStore = create<StudioState>()(
  persist(
    (set, get) => ({
      language: 'vi',
      selectedModel: 'auto',
      activeTab: 'presets',
      keycapSkin: 'obsidian',
      inspectorOpen: false,
      safetyModalOpen: false,
      safetyModalDismissed: false,
      usbFpsLimit: 60,
      liveStreamPresets: false,

      effectParams: DEFAULT_EFFECT_PARAMS,

      perKeyColors: DEFAULT_PER_KEY_COLORS,
      undoStack: [],
      redoStack: [],
      selectedKeys: [],
      perKeyTool: 'brush',
      brushColor: { r: 6, g: 229, b: 255 },
      gradientConfig: {
        stops: [
          { r: 255, g: 0, b: 128 },
          { r: 124, g: 58, b: 237 },
          { r: 0, g: 240, b: 255 },
        ],
        angle: 25,
        radial: false,
      },

      gifPresetId: 'plasma',
      gifFitMode: 'cover',
      gifSpeed: 1.0,
      gifPlaying: true,
      gifLiveStream: true,
      gifAdjustments: {
        brightness: 105,
        contrast: 110,
        saturation: 120,
        gamma: 1.15,
        quantizeLevels: 0,
      },

      audioConfig: {
        mode: 'spectrum_bars',
        sensitivity: 1.3,
        smoothing: 0.65,
        palette: 'neon_cyan',
      },

      reactiveConfig: {
        mode: 'ripple',
        baseColor: { r: 14, g: 35, b: 70 },
        activeColor: { r: 0, g: 240, b: 255 },
        rainbowHits: true,
        decaySpeed: 3,
        baseBrightness: 30,
      },

      profiles: DEFAULT_PROFILES,
      activeProfileId: DEFAULT_PROFILES[0].id,
      ledIndexMap: createDefaultLedIndexMap(),
      calibrationActive: false,
      calibrationLedIndex: 0,
      customProtocolConfig: DEFAULT_CUSTOM_PROTOCOL_CONFIG,

      setLanguage: (language) => set({ language }),
      setSelectedModel: (selectedModel) => set({ selectedModel }),
      setActiveTab: (activeTab) => set({ activeTab }),
      setKeycapSkin: (keycapSkin) => set({ keycapSkin }),
      setInspectorOpen: (inspectorOpen) => set({ inspectorOpen }),
      setSafetyModalOpen: (safetyModalOpen) => set({ safetyModalOpen }),
      dismissSafetyModal: (permanently) =>
        set({
          safetyModalOpen: false,
          safetyModalDismissed: permanently ? true : get().safetyModalDismissed,
        }),
      setUsbFpsLimit: (usbFpsLimit) => set({ usbFpsLimit }),
      setLiveStreamPresets: (liveStreamPresets) => set({ liveStreamPresets }),

      updateEffectParams: (partial) =>
        set((s) => ({ effectParams: { ...s.effectParams, ...partial } })),

      setSelectedKeys: (selectedKeys) => set({ selectedKeys }),
      toggleSelectedKey: (index) =>
        set((s) => {
          const exists = s.selectedKeys.includes(index);
          return {
            selectedKeys: exists
              ? s.selectedKeys.filter((k) => k !== index)
              : [...s.selectedKeys, index],
          };
        }),
      setPerKeyTool: (perKeyTool) => set({ perKeyTool }),
      setBrushColor: (brushColor) => set({ brushColor }),

      commitPerKeySnapshot: () =>
        set((s) => {
          const snap = s.perKeyColors.map((c) => ({ ...c }));
          const nextUndo = [...s.undoStack, snap].slice(-MAX_UNDO_HISTORY);
          return { undoStack: nextUndo, redoStack: [] };
        }),

      paintKeys: (indices, color, pushHistory = true) =>
        set((s) => {
          if (indices.length === 0) return s;
          const prevSnap = pushHistory ? s.perKeyColors.map((c) => ({ ...c })) : null;
          const next = s.perKeyColors.map((c) => ({ ...c }));
          for (const idx of indices) {
            if (idx >= 0 && idx < TOTAL_KEYS) {
              next[idx] = { ...color };
            }
          }
          return {
            perKeyColors: next,
            undoStack: prevSnap
              ? [...s.undoStack, prevSnap].slice(-MAX_UNDO_HISTORY)
              : s.undoStack,
            redoStack: prevSnap ? [] : s.redoStack,
          };
        }),

      setAllPerKeyColors: (colors) =>
        set((s) => ({
          undoStack: [...s.undoStack, s.perKeyColors.map((c) => ({ ...c }))].slice(
            -MAX_UNDO_HISTORY
          ),
          redoStack: [],
          perKeyColors: colors.slice(0, TOTAL_KEYS).map((c) => ({ ...c })),
        })),

      clearAllPerKeyColors: () =>
        set((s) => ({
          undoStack: [...s.undoStack, s.perKeyColors.map((c) => ({ ...c }))].slice(
            -MAX_UNDO_HISTORY
          ),
          redoStack: [],
          perKeyColors: new Array<RGB>(TOTAL_KEYS).fill(BLACK).map((c) => ({ ...c })),
        })),

      updateGradientConfig: (partial) =>
        set((s) => ({ gradientConfig: { ...s.gradientConfig, ...partial } })),

      applyGradientToSelection: () => {
        const s = get();
        const fullGrad = buildGradientKeys(
          s.gradientConfig.stops,
          s.gradientConfig.angle,
          s.gradientConfig.radial
        );
        const target =
          s.selectedKeys.length > 0
            ? new Set(s.selectedKeys)
            : new Set(WIN60HE_KEYS.map((k) => k.index));
        const next = s.perKeyColors.map((c, idx) =>
          target.has(idx) ? fullGrad[idx] : { ...c }
        );
        s.setAllPerKeyColors(next);
      },

      applyQuickColorTheme: (themeId) => {
        const s = get();
        const theme = QUICK_COLOR_PRESETS.find((t) => t.id === themeId);
        if (!theme) return;
        const fullGrad = buildGradientKeys(theme.stops, theme.angle, !!theme.radial);
        const target =
          s.selectedKeys.length > 0
            ? new Set(s.selectedKeys)
            : new Set(WIN60HE_KEYS.map((k) => k.index));
        const next = s.perKeyColors.map((c, idx) =>
          target.has(idx) ? fullGrad[idx] : { ...c }
        );
        set({
          gradientConfig: {
            stops: theme.stops.map((c) => ({ ...c })),
            angle: theme.angle,
            radial: !!theme.radial,
          },
        });
        s.setAllPerKeyColors(next);
      },

      undoPerKey: () =>
        set((s) => {
          if (s.undoStack.length === 0) return s;
          const previous = s.undoStack[s.undoStack.length - 1];
          const nextUndo = s.undoStack.slice(0, -1);
          const nextRedo = [
            ...s.redoStack,
            s.perKeyColors.map((c) => ({ ...c })),
          ].slice(-MAX_UNDO_HISTORY);
          return {
            perKeyColors: previous,
            undoStack: nextUndo,
            redoStack: nextRedo,
          };
        }),

      redoPerKey: () =>
        set((s) => {
          if (s.redoStack.length === 0) return s;
          const restored = s.redoStack[s.redoStack.length - 1];
          const nextRedo = s.redoStack.slice(0, -1);
          const nextUndo = [
            ...s.undoStack,
            s.perKeyColors.map((c) => ({ ...c })),
          ].slice(-MAX_UNDO_HISTORY);
          return {
            perKeyColors: restored,
            undoStack: nextUndo,
            redoStack: nextRedo,
          };
        }),

      setGifPresetId: (gifPresetId) => set({ gifPresetId }),
      setGifFitMode: (gifFitMode) => set({ gifFitMode }),
      setGifSpeed: (gifSpeed) => set({ gifSpeed }),
      setGifPlaying: (gifPlaying) => set({ gifPlaying }),
      setGifLiveStream: (gifLiveStream) => set({ gifLiveStream }),
      updateGifAdjustments: (partial) =>
        set((s) => ({ gifAdjustments: { ...s.gifAdjustments, ...partial } })),

      updateAudioConfig: (partial) =>
        set((s) => ({ audioConfig: { ...s.audioConfig, ...partial } })),

      updateReactiveConfig: (partial) =>
        set((s) => ({ reactiveConfig: { ...s.reactiveConfig, ...partial } })),

      createProfile: (name) =>
        set((s) => {
          const trimmed = name.trim() || `Profile ${s.profiles.length + 1}`;
          const newProfile: StudioProfile = {
            id: `prof-${Date.now()}`,
            name: trimmed,
            createdAt: new Date().toISOString(),
            activeTab: s.activeTab === 'perkey' ? 'perkey' : 'presets',
            effectParams: { ...s.effectParams },
            perKeyColors: s.perKeyColors.map((c) => ({ ...c })),
          };
          return {
            profiles: [newProfile, ...s.profiles],
            activeProfileId: newProfile.id,
          };
        }),

      applyProfile: (id) =>
        set((s) => {
          const prof = s.profiles.find((p) => p.id === id);
          if (!prof) return s;
          return {
            activeProfileId: prof.id,
            effectParams: { ...prof.effectParams },
            perKeyColors: prof.perKeyColors.map((c) => ({ ...c })),
            activeTab: prof.activeTab,
          };
        }),

      renameProfile: (id, name) =>
        set((s) => ({
          profiles: s.profiles.map((p) =>
            p.id === id ? { ...p, name: name.trim() || p.name } : p
          ),
        })),

      duplicateProfile: (id) =>
        set((s) => {
          const orig = s.profiles.find((p) => p.id === id);
          if (!orig) return s;
          const copy: StudioProfile = {
            ...orig,
            id: `prof-${Date.now()}`,
            name: `${orig.name} (Copy)`,
            createdAt: new Date().toISOString(),
            perKeyColors: orig.perKeyColors.map((c) => ({ ...c })),
          };
          return { profiles: [copy, ...s.profiles] };
        }),

      deleteProfile: (id) =>
        set((s) => {
          if (s.profiles.length <= 1) return s;
          const remaining = s.profiles.filter((p) => p.id !== id);
          return {
            profiles: remaining,
            activeProfileId:
              s.activeProfileId === id ? remaining[0].id : s.activeProfileId,
          };
        }),

      importProfileJson: (jsonText) => {
        try {
          const parsed = JSON.parse(jsonText) as Partial<StudioProfile>;
          if (
            !parsed ||
            typeof parsed.name !== 'string' ||
            !Array.isArray(parsed.perKeyColors) ||
            parsed.perKeyColors.length !== TOTAL_KEYS
          ) {
            return {
              ok: false,
              error: 'Invalid profile JSON format (requires name and 61 perKeyColors).',
            };
          }
          const imported: StudioProfile = {
            id: `import-${Date.now()}`,
            name: parsed.name.slice(0, 48),
            createdAt: new Date().toISOString(),
            activeTab: parsed.activeTab === 'perkey' ? 'perkey' : 'presets',
            effectParams: {
              ...DEFAULT_EFFECT_PARAMS,
              ...(parsed.effectParams ?? {}),
            },
            perKeyColors: parsed.perKeyColors.map((c) => ({
              r: Number(c?.r) || 0,
              g: Number(c?.g) || 0,
              b: Number(c?.b) || 0,
            })),
          };
          set((s) => ({
            profiles: [imported, ...s.profiles],
            activeProfileId: imported.id,
            effectParams: imported.effectParams,
            perKeyColors: imported.perKeyColors,
            activeTab: imported.activeTab,
          }));
          return { ok: true };
        } catch (err) {
          return {
            ok: false,
            error: err instanceof Error ? err.message : 'Failed to parse JSON',
          };
        }
      },

      resetDefaultLighting: () =>
        set({
          effectParams: { ...DEFAULT_EFFECT_PARAMS },
          perKeyColors: DEFAULT_PER_KEY_COLORS.map((c) => ({ ...c })),
          activeTab: 'presets',
        }),

      setCalibrationActive: (calibrationActive) =>
        set({ calibrationActive, calibrationLedIndex: 0 }),
      setCalibrationLedIndex: (calibrationLedIndex) =>
        set({ calibrationLedIndex: Math.max(0, Math.min(TOTAL_KEYS - 1, calibrationLedIndex)) }),
      assignCalibratedKey: (physicalKeyIndex) =>
        set((s) => {
          const nextMap = [...s.ledIndexMap];
          nextMap[physicalKeyIndex] = s.calibrationLedIndex;
          const nextIdx = (s.calibrationLedIndex + 1) % TOTAL_KEYS;
          return {
            ledIndexMap: nextMap,
            calibrationLedIndex: nextIdx,
          };
        }),
      resetLedIndexMap: () => set({ ledIndexMap: createDefaultLedIndexMap() }),
      updateCustomProtocolConfig: (partial) =>
        set((s) => ({
          customProtocolConfig: { ...s.customProtocolConfig, ...partial },
        })),
    }),
    {
      name: 'win60he-led-studio-v1',
      partialize: (state) => ({
        language: state.language,
        selectedModel: state.selectedModel,
        keycapSkin: state.keycapSkin,
        safetyModalDismissed: state.safetyModalDismissed,
        usbFpsLimit: state.usbFpsLimit,
        effectParams: state.effectParams,
        perKeyColors: state.perKeyColors,
        gradientConfig: state.gradientConfig,
        gifPresetId: state.gifPresetId,
        gifFitMode: state.gifFitMode,
        gifAdjustments: state.gifAdjustments,
        audioConfig: state.audioConfig,
        reactiveConfig: state.reactiveConfig,
        profiles: state.profiles,
        activeProfileId: state.activeProfileId,
        ledIndexMap: state.ledIndexMap,
        customProtocolConfig: state.customProtocolConfig,
      }),
      onRehydrateStorage: () => (state) => {
        // Automatically upgrade legacy persisted <=35 FPS throttle so returning users get true 60 FPS ACK-paced streaming
        if (state && state.usbFpsLimit <= 35) {
          state.setUsbFpsLimit(60);
        }
      },
    }
  )
);

