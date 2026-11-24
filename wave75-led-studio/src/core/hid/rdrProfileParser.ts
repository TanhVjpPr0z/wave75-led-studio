import {
  WAVE75_KEYS,
  WAVE75_KEY_COUNT,
  WAVE75_LOGO_LIGHT_INDEX,
  logicalKeyToDefaultLightIndex,
} from '../layout/wave75Layout';
import { BLACK, RGB, clampByte, hexToRgb, rgbToHex } from '../utils/color';

export interface RdrKeyInfo {
  lightIndex: number;
  keyItemColor: string | { r: number; g: number; b: number } | [number, number, number];
  keyName?: string;
}

export interface RdrProfileJson {
  name?: string;
  profileName?: string;
  deviceName?: string;
  keyInfos?: RdrKeyInfo[];
  logoColor?: string | RGB;
}

export interface StudioWaveProfile {
  id: string;
  name: string;
  source: 'studio' | 'pmohub_rdr';
  createdAt: string;
  keyColors: RGB[];
  logoColor: RGB;
}

function parseColorValue(
  raw: string | { r: number; g: number; b: number } | [number, number, number] | undefined
): RGB {
  if (!raw) return BLACK;
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (trimmed.startsWith('#') || /^[0-9a-fA-F]{6}$/.test(trimmed)) {
      return hexToRgb(trimmed);
    }
    const rgbMatch = trimmed.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
    if (rgbMatch) {
      return {
        r: clampByte(Number(rgbMatch[1])),
        g: clampByte(Number(rgbMatch[2])),
        b: clampByte(Number(rgbMatch[3])),
      };
    }
    return BLACK;
  }
  if (Array.isArray(raw)) {
    return {
      r: clampByte(raw[0] ?? 0),
      g: clampByte(raw[1] ?? 0),
      b: clampByte(raw[2] ?? 0),
    };
  }
  return {
    r: clampByte(raw.r ?? 0),
    g: clampByte(raw.g ?? 0),
    b: clampByte(raw.b ?? 0),
  };
}

/**
 * Automatically detects and parses BOTH:
 * 1) Official pmohub.cn `rdr-profile-*.json` (with `keyInfos[].lightIndex` + `keyItemColor`)
 * 2) Native WAVE75 LED Studio JSON profiles
 */
export function parseImportedProfileJson(
  jsonText: string,
  lightIndexMap?: number[]
): { ok: true; profile: StudioWaveProfile } | { ok: false; error: string } {
  try {
    const parsed = JSON.parse(jsonText) as Record<string, unknown>;

    // Format 1: Official pmohub.cn rdr-profile-*.json
    if (Array.isArray(parsed.keyInfos)) {
      const rdr = parsed as unknown as RdrProfileJson;
      const keys = new Array<RGB>(WAVE75_KEY_COUNT).fill(BLACK).map(() => ({ ...BLACK }));
      let logoColor: RGB = { r: 56, g: 189, b: 248 };

      // Build reverse map from hardware lightIndex -> logical key index (0..80)
      const reverseMap = new Map<number, number>();
      for (let i = 0; i < WAVE75_KEY_COUNT; i++) {
        const hwIdx = lightIndexMap ? lightIndexMap[i] : logicalKeyToDefaultLightIndex(i);
        reverseMap.set(hwIdx, i);
      }

      for (const item of rdr.keyInfos ?? []) {
        if (typeof item?.lightIndex !== 'number') continue;
        const col = parseColorValue(item.keyItemColor);
        if (item.lightIndex === WAVE75_LOGO_LIGHT_INDEX) {
          logoColor = col;
          continue;
        }
        const logicalIdx = reverseMap.get(item.lightIndex);
        if (logicalIdx !== undefined) {
          keys[logicalIdx] = col;
        }
      }

      if (rdr.logoColor) {
        logoColor = parseColorValue(rdr.logoColor);
      }

      return {
        ok: true,
        profile: {
          id: `rdr-${Date.now()}`,
          name: (rdr.profileName || rdr.name || 'Imported RDR Profile').slice(0, 48),
          source: 'pmohub_rdr',
          createdAt: new Date().toISOString(),
          keyColors: keys,
          logoColor,
        },
      };
    }

    // Format 2: Native WAVE75 Studio JSON
    if (Array.isArray(parsed.keyColors) && parsed.keyColors.length === WAVE75_KEY_COUNT) {
      const keys = (parsed.keyColors as Array<Partial<RGB>>).map((c) => ({
        r: clampByte(Number(c?.r) || 0),
        g: clampByte(Number(c?.g) || 0),
        b: clampByte(Number(c?.b) || 0),
      }));
      const logoRaw = parsed.logoColor as Partial<RGB> | undefined;
      return {
        ok: true,
        profile: {
          id: `imp-${Date.now()}`,
          name:
            typeof parsed.name === 'string' && parsed.name.trim()
              ? parsed.name.trim().slice(0, 48)
              : 'Imported WAVE75 Profile',
          source: 'studio',
          createdAt: new Date().toISOString(),
          keyColors: keys,
          logoColor: logoRaw
            ? {
                r: clampByte(Number(logoRaw.r) || 0),
                g: clampByte(Number(logoRaw.g) || 0),
                b: clampByte(Number(logoRaw.b) || 0),
              }
            : { r: 56, g: 189, b: 248 },
        },
      };
    }

    return {
      ok: false,
      error:
        'Unrecognized JSON format. Supported: WAVE75 Studio JSON (81 keyColors) or pmohub.cn rdr-profile-*.json (keyInfos[].lightIndex).',
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Invalid JSON syntax.',
    };
  }
}

/**
 * Exports a profile in official `pmohub.cn` `rdr-profile-*.json` compatible structure.
 */
export function exportAsRdrProfileJson(
  profile: StudioWaveProfile,
  lightIndexMap?: number[]
): RdrProfileJson {
  const keyInfos: RdrKeyInfo[] = WAVE75_KEYS.map((k) => {
    const hwIdx = lightIndexMap ? lightIndexMap[k.index] : k.defaultLightIndex;
    return {
      lightIndex: hwIdx,
      keyName: k.label,
      keyItemColor: rgbToHex(profile.keyColors[k.index] ?? BLACK),
    };
  });

  keyInfos.push({
    lightIndex: WAVE75_LOGO_LIGHT_INDEX,
    keyName: 'WAVE_LOGO',
    keyItemColor: rgbToHex(profile.logoColor),
  });

  return {
    profileName: profile.name,
    deviceName: 'PMO WAVE75',
    keyInfos,
    logoColor: rgbToHex(profile.logoColor),
  };
}

