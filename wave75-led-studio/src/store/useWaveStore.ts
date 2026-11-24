import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Language } from '../i18n';
import {
  RGB,
  BLACK,
  WAVE_COLOR_PRESETS,
  sampleGradient,
  shiftHue,
  adjustBrightness,
  invertRgb,
  hsvToRgb,
} from '../core/utils/color';
import {
  WAVE75_KEYS,
  WAVE75_KEY_COUNT,
  WAVE75_WIDTH_U,
  WAVE75_HEIGHT_U,
  WAVE75_GAP_LIGHT_INDEX,
  WAVE75_SYNC_LED_SLOTS,
  createDefaultLightIndexMap,
} from '../core/layout/wave75Layout';
import type { ProceduralEffectParams } from '../core/engines/proceduralEffects';
import type { FitMode } from '../core/engines/gifEngine';
import type { AudioConfig } from '../core/engines/audioEngine';
import {
  DEFAULT_TEXT_LED_CONFIG,
  PIXEL_GRID_COLS,
  PIXEL_GRID_ROWS,
  type TextLedConfig,
} from '../core/engines/textLedEngine';
import type {
  LogoSettings,
  QmkLightingState,
  WaveModelId,
} from '../core/protocols/types';
import type { StudioWaveProfile } from '../core/hid/rdrProfileParser';
import { parseImportedProfileJson } from '../core/hid/rdrProfileParser';
import type { ColorAdjustments } from '../core/utils/color';

export type WaveStudioTab = 'effects' | 'text' | 'gif' | 'perkey' | 'audio' | 'qmk' | 'profiles';

export type WaveCaseSkin =
  | 'anodized_black'
  | 'anodized_silver'
  | 'anodized_red'
  | 'ecoat_purple'
  | 'spray_cream';

export type EditorTool = 'select' | 'brush' | 'bucket' | 'eyedropper' | 'eraser';

export interface OnboardSlotState {
  keys: RGB[];
  logo: RGB;
  dirty: boolean;
  lastVerifiedAt: string | null;
}

export interface GradientSpec {
  stops: RGB[];
  angle: number;
  radial: boolean;
}

function buildWaveGradient(stops: RGB[], angleDeg: number, radial: boolean): RGB[] {
  const rad = (angleDeg * Math.PI) / 180;
  const dx = Math.cos(rad);
  const dy = Math.sin(rad);
  return WAVE75_KEYS.map((k) => {
    const t = radial
      ? Math.min(
          1,
          Math.hypot(
            (k.cx - WAVE75_WIDTH_U / 2) / (WAVE75_WIDTH_U / 2),
            (k.cy - WAVE75_HEIGHT_U / 2) / (WAVE75_HEIGHT_U / 2)
          ) * 0.88
        )
      : (k.nx - 0.5) * dx + (k.ny - 0.5) * dy + 0.5;
    return sampleGradient(stops, t);
  });
}

function makeSlot(presetIdx: number): OnboardSlotState {
  const p = WAVE_COLOR_PRESETS[presetIdx % WAVE_COLOR_PRESETS.length];
  return {
    keys: buildWaveGradient(p.stops, p.angle, !!p.radial),
    logo: { ...p.stops[p.stops.length - 1] },
    dirty: false,
    lastVerifiedAt: null,
  };
}

const INITIAL_SLOTS: Record<number, OnboardSlotState> = {
  1: makeSlot(0), // Cyberpunk
  2: makeSlot(2), // Ocean
  3: makeSlot(1), // Sunset
  4: makeSlot(3), // Aurora
  5: makeSlot(4), // Sakura
};

const INITIAL_PROFILES: StudioWaveProfile[] = [
  {
    id: 'wave-cyberpunk',
    name: 'WAVE75 Cyberpunk Neon',
    source: 'studio',
    createdAt: '2026-01-01T00:00:00.000Z',
    keyColors: INITIAL_SLOTS[1].keys,
    logoColor: { r: 0, g: 240, b: 255 },
  },
  {
    id: 'wave-ocean',
    name: 'Ocean Wave CNC',
    source: 'studio',
    createdAt: '2026-01-01T00:00:00.000Z',
    keyColors: INITIAL_SLOTS[2].keys,
    logoColor: { r: 103, g: 232, b: 249 },
  },
  {
    id: 'wave-warm-desk',
    name: 'Warm Studio White',
    source: 'studio',
    createdAt: '2026-01-01T00:00:00.000Z',
    keyColors: buildWaveGradient(WAVE_COLOR_PRESETS[5].stops, 90, false),
    logoColor: { r: 255, g: 224, b: 175 },
  },
];

const MAX_UNDO = 35;

interface WaveStoreState {
  language: Language;
  activeModel: WaveModelId;
  activeTab: WaveStudioTab;
  caseSkin: WaveCaseSkin;
  diagnosticsOpen: boolean;
  shortcutsOpen: boolean;
  usbFps: number;
  liveStreamEffects: boolean;

  // Tab 1: 24+ 2D Procedural Effects
  effectParams: ProceduralEffectParams;

  // Tab 2: LED Text Marquee & Pixel Art Designer
  textLedConfig: TextLedConfig;
  textLiveStream: boolean;

  // Tab 2: Per-Key Editor & 5 Onboard Slots
  activeSlot: number; // 1..5
  slots: Record<number, OnboardSlotState>;
  undoStack: Array<{ keys: RGB[]; logo: RGB }>;
  redoStack: Array<{ keys: RGB[]; logo: RGB }>;
  selectedKeys: number[];
  logoSelected: boolean;
  editorTool: EditorTool;
  brushColor: RGB;
  gradientSpec: GradientSpec;

  // Tab 3: GIF Matrix
  gifPresetId: string;
  gifFitMode: FitMode;
  gifSpeed: number;
  gifPlaying: boolean;
  gifLiveStream: boolean;
  gifAdjustments: ColorAdjustments;

  // Tab 4: Audio Visualizer
  audioConfig: AudioConfig;

  // Tab 5: QMK / VIA & Logo LED
  qmkState: QmkLightingState;
  logoSettings: LogoSettings;

  // Tab 6: Profiles & Calibration
  profiles: StudioWaveProfile[];
  activeProfileId: string;
  lightIndexMap: number[];
  calibrationActive: boolean;
  calibrationLightIndex: number;

  // Actions
  setLanguage: (lang: Language) => void;
  setActiveModel: (model: WaveModelId) => void;
  setActiveTab: (tab: WaveStudioTab) => void;
  setCaseSkin: (skin: WaveCaseSkin) => void;
  setDiagnosticsOpen: (open: boolean) => void;
  setShortcutsOpen: (open: boolean) => void;
  setUsbFps: (fps: number) => void;
  setLiveStreamEffects: (enabled: boolean) => void;

  updateEffectParams: (partial: Partial<ProceduralEffectParams>) => void;
  updateTextLedConfig: (partial: Partial<TextLedConfig>) => void;
  setTextLiveStream: (enabled: boolean) => void;
  setCustomPixelCell: (col: number, row: number, value: 0 | 1 | 2) => void;
  clearCustomPixelGrid: () => void;

  setActiveSlot: (slot: number) => void;
  loadSlotDataFromHardware: (slot: number, keys: RGB[], logo: RGB) => void;
  markSlotVerified: (slot: number) => void;

  setSelectedKeys: (indices: number[]) => void;
  toggleSelectedKey: (index: number) => void;
  setLogoSelected: (sel: boolean) => void;
  setEditorTool: (tool: EditorTool) => void;
  setBrushColor: (color: RGB) => void;

  pushUndoSnapshot: () => void;
  paintKeys: (indices: number[], color: RGB, pushUndo?: boolean) => void;
  setSlotLogoColor: (color: RGB) => void;
  clearSelectedOrAll: (onlySelected: boolean) => void;
  transformSelection: (
    kind: 'hue_minus' | 'hue_plus' | 'bright_minus' | 'bright_plus' | 'invert' | 'fill_row' | 'random'
  ) => void;
  updateGradientSpec: (partial: Partial<GradientSpec>) => void;
  applyGradient: () => void;
  applyQuickPreset: (presetId: string) => void;
  undoPerKey: () => void;
  redoPerKey: () => void;

  setGifPresetId: (id: string) => void;
  setGifFitMode: (mode: FitMode) => void;
  setGifSpeed: (speed: number) => void;
  setGifPlaying: (playing: boolean) => void;
  setGifLiveStream: (enabled: boolean) => void;
  updateGifAdjustments: (partial: Partial<ColorAdjustments>) => void;

  updateAudioConfig: (partial: Partial<AudioConfig>) => void;
  updateQmkState: (partial: Partial<QmkLightingState>) => void;
  updateLogoSettings: (partial: Partial<LogoSettings>) => void;

  createProfile: (name: string) => void;
  applyProfile: (id: string) => void;
  duplicateProfile: (id: string) => void;
  deleteProfile: (id: string) => void;
  importProfileText: (jsonText: string) => { ok: boolean; error?: string; source?: string };

  setCalibrationActive: (active: boolean) => void;
  stepCalibrationIndex: (delta: number) => void;
  assignCalibratedKey: (keyIndex: number) => void;
  resetLightIndexMap: () => void;
}

function nextValidLightIndex(curr: number, delta: number): number {
  let next = (curr + delta + WAVE75_SYNC_LED_SLOTS) % WAVE75_SYNC_LED_SLOTS;
  if (next === WAVE75_GAP_LIGHT_INDEX) {
    next = (next + (delta >= 0 ? 1 : -1) + WAVE75_SYNC_LED_SLOTS) % WAVE75_SYNC_LED_SLOTS;
  }
  return next;
}

export const useWaveStore = create<WaveStoreState>()(
  persist(
    (set, get) => ({
      language: 'vi',
      activeModel: 'wave75_pro_rgb',
      activeTab: 'effects',
      caseSkin: 'anodized_red',
      diagnosticsOpen: false,
      shortcutsOpen: false,
      usbFps: 20,
      liveStreamEffects: true,

      effectParams: {
        effectId: 'rainbow_wave',
        brightness: 95,
        speed: 5,
        direction: 'ltr',
        primaryColor: { r: 56, g: 189, b: 248 },
        secondaryColor: { r: 168, g: 85, b: 247 },
        useRainbow: true,
      },

      textLedConfig: {
        ...DEFAULT_TEXT_LED_CONFIG,
        customGrid: [...DEFAULT_TEXT_LED_CONFIG.customGrid],
      },
      textLiveStream: true,

      activeSlot: 1,
      slots: INITIAL_SLOTS,
      undoStack: [],
      redoStack: [],
      selectedKeys: [],
      logoSelected: false,
      editorTool: 'brush',
      brushColor: { r: 244, g: 63, b: 94 },
      gradientSpec: {
        stops: [
          { r: 255, g: 0, b: 128 },
          { r: 124, g: 58, b: 237 },
          { r: 0, g: 240, b: 255 },
        ],
        angle: 20,
        radial: false,
      },

      gifPresetId: 'red_samurai_slash',
      gifFitMode: 'cover',
      gifSpeed: 1.0,
      gifPlaying: true,
      gifLiveStream: true,
      gifAdjustments: {
        brightness: 105,
        contrast: 110,
        saturation: 120,
        gamma: 1.15,
      },

      audioConfig: {
        mode: 'spectrum_bars',
        sensitivity: 1.35,
        smoothing: 0.64,
        palette: 'neon_cyan',
      },

      qmkState: {
        effectId: 13,
        brightness: 220,
        speed: 140,
        hue: 140,
        saturation: 240,
      },

      logoSettings: {
        color: { r: 56, g: 189, b: 248 },
        brightness: 90,
        speed: 3,
        saturation: 95,
        effect: 'breathing',
      },

      profiles: INITIAL_PROFILES,
      activeProfileId: INITIAL_PROFILES[0].id,
      lightIndexMap: createDefaultLightIndexMap(),
      calibrationActive: false,
      calibrationLightIndex: 0,

      setLanguage: (language) => set({ language }),
      setActiveModel: (activeModel) =>
        set((s) => ({
          activeModel,
          // Switch straight to QMK & Logo tab if Non-RGB model is chosen while on per-key/gif
          activeTab:
            activeModel === 'wave75_non_rgb' && s.activeTab !== 'profiles'
              ? 'qmk'
              : s.activeTab,
        })),
      setActiveTab: (activeTab) => set({ activeTab }),
      setCaseSkin: (caseSkin) => set({ caseSkin }),
      setDiagnosticsOpen: (diagnosticsOpen) => set({ diagnosticsOpen }),
      setShortcutsOpen: (shortcutsOpen) => set({ shortcutsOpen }),
      setUsbFps: (usbFps) => set({ usbFps }),
      setLiveStreamEffects: (liveStreamEffects) => set({ liveStreamEffects }),

      updateEffectParams: (partial) =>
        set((s) => ({ effectParams: { ...s.effectParams, ...partial } })),

      updateTextLedConfig: (partial) =>
        set((s) => ({ textLedConfig: { ...s.textLedConfig, ...partial } })),

      setTextLiveStream: (textLiveStream) => set({ textLiveStream }),

      setCustomPixelCell: (col, row, value) =>
        set((s) => {
          if (col < 0 || col >= PIXEL_GRID_COLS || row < 0 || row >= PIXEL_GRID_ROWS) return s;
          const idx = row * PIXEL_GRID_COLS + col;
          if (s.textLedConfig.customGrid[idx] === value) return s;
          const nextGrid = [...s.textLedConfig.customGrid];
          nextGrid[idx] = value;
          return {
            textLedConfig: {
              ...s.textLedConfig,
              mode: 'pixel_art',
              pixelArtId: 'custom_draw',
              customGrid: nextGrid,
            },
          };
        }),

      clearCustomPixelGrid: () =>
        set((s) => ({
          textLedConfig: {
            ...s.textLedConfig,
            customGrid: new Array<number>(PIXEL_GRID_COLS * PIXEL_GRID_ROWS).fill(0),
          },
        })),

      setActiveSlot: (slot) =>
        set({
          activeSlot: Math.max(1, Math.min(5, slot)),
          undoStack: [],
          redoStack: [],
        }),

      loadSlotDataFromHardware: (slot, keys, logo) =>
        set((s) => ({
          activeSlot: slot,
          slots: {
            ...s.slots,
            [slot]: {
              keys: keys.slice(0, WAVE75_KEY_COUNT).map((c) => ({ ...c })),
              logo: { ...logo },
              dirty: false,
              lastVerifiedAt: new Date().toISOString(),
            },
          },
        })),

      markSlotVerified: (slot) =>
        set((s) => ({
          slots: {
            ...s.slots,
            [slot]: {
              ...s.slots[slot],
              dirty: false,
              lastVerifiedAt: new Date().toISOString(),
            },
          },
        })),

      setSelectedKeys: (selectedKeys) => set({ selectedKeys }),
      toggleSelectedKey: (index) =>
        set((s) => ({
          selectedKeys: s.selectedKeys.includes(index)
            ? s.selectedKeys.filter((k) => k !== index)
            : [...s.selectedKeys, index],
        })),
      setLogoSelected: (logoSelected) => set({ logoSelected }),
      setEditorTool: (editorTool) => set({ editorTool }),
      setBrushColor: (brushColor) => set({ brushColor }),

      pushUndoSnapshot: () =>
        set((s) => {
          const cur = s.slots[s.activeSlot];
          return {
            undoStack: [
              ...s.undoStack,
              { keys: cur.keys.map((c) => ({ ...c })), logo: { ...cur.logo } },
            ].slice(-MAX_UNDO),
            redoStack: [],
          };
        }),

      paintKeys: (indices, color, pushUndo = true) =>
        set((s) => {
          if (indices.length === 0) return s;
          const cur = s.slots[s.activeSlot];
          const snap = pushUndo
            ? { keys: cur.keys.map((c) => ({ ...c })), logo: { ...cur.logo } }
            : null;
          const nextKeys = cur.keys.map((c) => ({ ...c }));
          for (const idx of indices) {
            if (idx >= 0 && idx < WAVE75_KEY_COUNT) {
              nextKeys[idx] = { ...color };
            }
          }
          return {
            slots: {
              ...s.slots,
              [s.activeSlot]: { ...cur, keys: nextKeys, dirty: true },
            },
            undoStack: snap ? [...s.undoStack, snap].slice(-MAX_UNDO) : s.undoStack,
            redoStack: snap ? [] : s.redoStack,
          };
        }),

      setSlotLogoColor: (color) =>
        set((s) => {
          const cur = s.slots[s.activeSlot];
          return {
            slots: {
              ...s.slots,
              [s.activeSlot]: { ...cur, logo: { ...color }, dirty: true },
            },
            logoSettings: { ...s.logoSettings, color: { ...color } },
          };
        }),

      clearSelectedOrAll: (onlySelected) => {
        const s = get();
        const targets =
          onlySelected && s.selectedKeys.length > 0
            ? s.selectedKeys
            : WAVE75_KEYS.map((k) => k.index);
        s.paintKeys(targets, BLACK, true);
      },

      transformSelection: (kind) =>
        set((s) => {
          const cur = s.slots[s.activeSlot];
          const targets =
            s.selectedKeys.length > 0
              ? new Set(s.selectedKeys)
              : new Set(WAVE75_KEYS.map((k) => k.index));
          const snap = { keys: cur.keys.map((c) => ({ ...c })), logo: { ...cur.logo } };
          const nextKeys = cur.keys.map((c) => ({ ...c }));

          if (kind === 'fill_row') {
            const rowsToFill = new Set<number>();
            targets.forEach((idx) => {
              const def = WAVE75_KEYS[idx];
              if (def) rowsToFill.add(def.row);
            });
            for (const k of WAVE75_KEYS) {
              if (rowsToFill.has(k.row)) {
                nextKeys[k.index] = { ...s.brushColor };
              }
            }
          } else {
            targets.forEach((idx) => {
              const c = nextKeys[idx];
              if (!c) return;
              if (kind === 'hue_minus') nextKeys[idx] = shiftHue(c, -15);
              else if (kind === 'hue_plus') nextKeys[idx] = shiftHue(c, 15);
              else if (kind === 'bright_minus') nextKeys[idx] = adjustBrightness(c, -12);
              else if (kind === 'bright_plus') nextKeys[idx] = adjustBrightness(c, 12);
              else if (kind === 'invert') nextKeys[idx] = invertRgb(c);
              else if (kind === 'random') {
                nextKeys[idx] = hsvToRgb({
                  h: Math.floor(Math.random() * 360),
                  s: 88,
                  v: 100,
                });
              }
            });
          }

          return {
            slots: {
              ...s.slots,
              [s.activeSlot]: { ...cur, keys: nextKeys, dirty: true },
            },
            undoStack: [...s.undoStack, snap].slice(-MAX_UNDO),
            redoStack: [],
          };
        }),

      updateGradientSpec: (partial) =>
        set((s) => ({ gradientSpec: { ...s.gradientSpec, ...partial } })),

      applyGradient: () =>
        set((s) => {
          const cur = s.slots[s.activeSlot];
          const snap = { keys: cur.keys.map((c) => ({ ...c })), logo: { ...cur.logo } };
          const full = buildWaveGradient(
            s.gradientSpec.stops,
            s.gradientSpec.angle,
            s.gradientSpec.radial
          );
          const targets =
            s.selectedKeys.length > 0
              ? new Set(s.selectedKeys)
              : new Set(WAVE75_KEYS.map((k) => k.index));
          const nextKeys = cur.keys.map((c, idx) => (targets.has(idx) ? full[idx] : { ...c }));
          return {
            slots: {
              ...s.slots,
              [s.activeSlot]: {
                ...cur,
                keys: nextKeys,
                logo: { ...s.gradientSpec.stops[s.gradientSpec.stops.length - 1] },
                dirty: true,
              },
            },
            undoStack: [...s.undoStack, snap].slice(-MAX_UNDO),
            redoStack: [],
          };
        }),

      applyQuickPreset: (presetId) => {
        const preset = WAVE_COLOR_PRESETS.find((p) => p.id === presetId);
        if (!preset) return;
        set({
          gradientSpec: {
            stops: preset.stops.map((c) => ({ ...c })),
            angle: preset.angle,
            radial: !!preset.radial,
          },
        });
        get().applyGradient();
      },

      undoPerKey: () =>
        set((s) => {
          if (s.undoStack.length === 0) return s;
          const prev = s.undoStack[s.undoStack.length - 1];
          const cur = s.slots[s.activeSlot];
          return {
            slots: {
              ...s.slots,
              [s.activeSlot]: {
                ...cur,
                keys: prev.keys,
                logo: prev.logo,
                dirty: true,
              },
            },
            undoStack: s.undoStack.slice(0, -1),
            redoStack: [
              ...s.redoStack,
              { keys: cur.keys.map((c) => ({ ...c })), logo: { ...cur.logo } },
            ].slice(-MAX_UNDO),
          };
        }),

      redoPerKey: () =>
        set((s) => {
          if (s.redoStack.length === 0) return s;
          const restored = s.redoStack[s.redoStack.length - 1];
          const cur = s.slots[s.activeSlot];
          return {
            slots: {
              ...s.slots,
              [s.activeSlot]: {
                ...cur,
                keys: restored.keys,
                logo: restored.logo,
                dirty: true,
              },
            },
            redoStack: s.redoStack.slice(0, -1),
            undoStack: [
              ...s.undoStack,
              { keys: cur.keys.map((c) => ({ ...c })), logo: { ...cur.logo } },
            ].slice(-MAX_UNDO),
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
      updateQmkState: (partial) =>
        set((s) => ({ qmkState: { ...s.qmkState, ...partial } })),
      updateLogoSettings: (partial) =>
        set((s) => ({ logoSettings: { ...s.logoSettings, ...partial } })),

      createProfile: (name) =>
        set((s) => {
          const cur = s.slots[s.activeSlot];
          const prof: StudioWaveProfile = {
            id: `prof-${Date.now()}`,
            name: name.trim() || `WAVE75 Profile ${s.profiles.length + 1}`,
            source: 'studio',
            createdAt: new Date().toISOString(),
            keyColors: cur.keys.map((c) => ({ ...c })),
            logoColor: { ...cur.logo },
          };
          return {
            profiles: [prof, ...s.profiles],
            activeProfileId: prof.id,
          };
        }),

      applyProfile: (id) =>
        set((s) => {
          const prof = s.profiles.find((p) => p.id === id);
          if (!prof) return s;
          const cur = s.slots[s.activeSlot];
          return {
            activeProfileId: prof.id,
            activeTab: s.activeModel === 'wave75_non_rgb' ? 'qmk' : 'perkey',
            slots: {
              ...s.slots,
              [s.activeSlot]: {
                ...cur,
                keys: prof.keyColors.map((c) => ({ ...c })),
                logo: { ...prof.logoColor },
                dirty: true,
              },
            },
            logoSettings: { ...s.logoSettings, color: { ...prof.logoColor } },
          };
        }),

      duplicateProfile: (id) =>
        set((s) => {
          const orig = s.profiles.find((p) => p.id === id);
          if (!orig) return s;
          const copy: StudioWaveProfile = {
            ...orig,
            id: `prof-${Date.now()}`,
            name: `${orig.name} (Copy)`,
            createdAt: new Date().toISOString(),
            keyColors: orig.keyColors.map((c) => ({ ...c })),
            logoColor: { ...orig.logoColor },
          };
          return { profiles: [copy, ...s.profiles] };
        }),

      deleteProfile: (id) =>
        set((s) => {
          if (s.profiles.length <= 1) return s;
          const next = s.profiles.filter((p) => p.id !== id);
          return {
            profiles: next,
            activeProfileId: s.activeProfileId === id ? next[0].id : s.activeProfileId,
          };
        }),

      importProfileText: (jsonText) => {
        const s = get();
        const res = parseImportedProfileJson(jsonText, s.lightIndexMap);
        if (!res.ok) return { ok: false, error: res.error };
        const prof = res.profile;
        const cur = s.slots[s.activeSlot];
        set({
          profiles: [prof, ...s.profiles],
          activeProfileId: prof.id,
          activeTab: 'perkey',
          slots: {
            ...s.slots,
            [s.activeSlot]: {
              ...cur,
              keys: prof.keyColors.map((c) => ({ ...c })),
              logo: { ...prof.logoColor },
              dirty: true,
            },
          },
          logoSettings: { ...s.logoSettings, color: { ...prof.logoColor } },
        });
        return { ok: true, source: prof.source };
      },

      setCalibrationActive: (calibrationActive) =>
        set({ calibrationActive, calibrationLightIndex: 0 }),

      stepCalibrationIndex: (delta) =>
        set((s) => ({
          calibrationLightIndex: nextValidLightIndex(s.calibrationLightIndex, delta),
        })),

      assignCalibratedKey: (keyIndex) =>
        set((s) => {
          const nextMap = [...s.lightIndexMap];
          nextMap[keyIndex] = s.calibrationLightIndex;
          return {
            lightIndexMap: nextMap,
            calibrationLightIndex: nextValidLightIndex(s.calibrationLightIndex, 1),
          };
        }),

      resetLightIndexMap: () => set({ lightIndexMap: createDefaultLightIndexMap() }),
    }),
    {
      name: 'wave75-led-studio-v2',
      partialize: (s) => ({
        language: s.language,
        activeModel: s.activeModel,
        caseSkin: s.caseSkin,
        usbFps: s.usbFps,
        effectParams: s.effectParams,
        textLedConfig: s.textLedConfig,
        activeSlot: s.activeSlot,
        slots: s.slots,
        gradientSpec: s.gradientSpec,
        gifPresetId: s.gifPresetId,
        gifFitMode: s.gifFitMode,
        gifAdjustments: s.gifAdjustments,
        audioConfig: s.audioConfig,
        qmkState: s.qmkState,
        logoSettings: s.logoSettings,
        profiles: s.profiles,
        activeProfileId: s.activeProfileId,
        lightIndexMap: s.lightIndexMap,
      }),
    }
  )
);

