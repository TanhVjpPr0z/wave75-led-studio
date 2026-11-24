export type WaveKeyGroup =
  | 'fn_row'
  | 'number'
  | 'alpha'
  | 'modifier'
  | 'arrow'
  | 'nav'
  | 'space';

export interface WaveKeyDefinition {
  index: number;           // 0..80 logical key index
  id: string;
  label: string;
  subLabel?: string;
  code: string;            // DOM KeyboardEvent.code
  row: number;             // 0..5
  col: number;
  x: number;               // physical X in u (0..16)
  y: number;               // physical Y in u (0..6)
  w: number;               // width in u
  h: number;               // height in u
  cx: number;              // center X in u
  cy: number;              // center Y in u
  nx: number;              // normalized center X (0..1)
  ny: number;              // normalized center Y (0..1)
  /**
   * Hardware-verified PMO WAVE75 lightIndex (matches official rdr-profile-1.json & LED_Map.md):
   * 82 LED slots (0..81): Esc=0 .. Caps=45, [slot #46 skipped], A=47 .. RightArrow=81.
   */
  defaultLightIndex: number;
  group: WaveKeyGroup;
}

export const WAVE75_WIDTH_U = 16;
export const WAVE75_HEIGHT_U = 6;
export const WAVE75_KEY_COUNT = 81;
export const WAVE75_SYNC_LED_SLOTS = 82;   // 0..81 -> 82 * 2 = 164 bytes RGB565
export const WAVE75_GAP_LIGHT_INDEX = 46;  // Hardware empty gap #46 -> stays 0x0000
export const WAVE75_ONBOARD_SLOTS = 128;   // 128 * 3 = 384 bytes RGB888
export const WAVE75_LOGO_LIGHT_INDEX = 82; // Virtual Logo slot for preview & RDR export

interface RawKey {
  id: string;
  label: string;
  subLabel?: string;
  code: string;
  w: number;
  xOffset?: number;
  group: WaveKeyGroup;
}

/**
 * Hardware-verified PMO WAVE75 81-key ANSI layout (matches rdr-profile-1.json & LED_Map.md):
 *  Row 0 (15 keys, lightIndex 0..14): Esc, F1..F12, Del, Home
 *  Row 1 (15 keys, lightIndex 15..29): ~, 1..0, -, =, Bksp, End
 *  Row 2 (15 keys, lightIndex 30..44): Tab, Q..P, [, ], \, PgUp
 *  Row 3 (14 keys, lightIndex 45, 47..59): Caps(45), [skip 46], A(47)..L, ;, ', Enter, PgDn(59)
 *  Row 4 (13 keys, lightIndex 60..72): LShift(60), Z..M, ,, ., /, RShift(71), Up(72)
 *  Row 5 (9 keys, lightIndex 73..81): LCtrl(73), Win(74), LAlt(75), Space(76), Fn(77), RCtrl(78), Left(79), Down(80), Right(81)
 * Total = 15 + 15 + 15 + 14 + 13 + 9 = 81 keys!
 */
const RAW_ROWS: RawKey[][] = [
  // Row 0: 15 keys (lightIndex 0..14), total width = 16u
  [
    { id: 'esc', label: 'ESC', code: 'Escape', w: 1, group: 'modifier' },
    { id: 'f1', label: 'F1', code: 'F1', w: 1, xOffset: 0.25, group: 'fn_row' },
    { id: 'f2', label: 'F2', code: 'F2', w: 1, group: 'fn_row' },
    { id: 'f3', label: 'F3', code: 'F3', w: 1, group: 'fn_row' },
    { id: 'f4', label: 'F4', code: 'F4', w: 1, group: 'fn_row' },
    { id: 'f5', label: 'F5', code: 'F5', w: 1, xOffset: 0.25, group: 'fn_row' },
    { id: 'f6', label: 'F6', code: 'F6', w: 1, group: 'fn_row' },
    { id: 'f7', label: 'F7', code: 'F7', w: 1, group: 'fn_row' },
    { id: 'f8', label: 'F8', code: 'F8', w: 1, group: 'fn_row' },
    { id: 'f9', label: 'F9', code: 'F9', w: 1, xOffset: 0.25, group: 'fn_row' },
    { id: 'f10', label: 'F10', code: 'F10', w: 1, group: 'fn_row' },
    { id: 'f11', label: 'F11', code: 'F11', w: 1, group: 'fn_row' },
    { id: 'f12', label: 'F12', code: 'F12', w: 1, group: 'fn_row' },
    { id: 'del', label: 'DEL', code: 'Delete', w: 1, xOffset: 0.25, group: 'nav' },
    { id: 'home', label: 'HOME', code: 'Home', w: 1, group: 'nav' },
  ],
  // Row 1: 15 keys (lightIndex 15..29), total width = 16u
  [
    { id: 'grave', label: '`', subLabel: '~', code: 'Backquote', w: 1, group: 'number' },
    { id: '1', label: '1', subLabel: '!', code: 'Digit1', w: 1, group: 'number' },
    { id: '2', label: '2', subLabel: '@', code: 'Digit2', w: 1, group: 'number' },
    { id: '3', label: '3', subLabel: '#', code: 'Digit3', w: 1, group: 'number' },
    { id: '4', label: '4', subLabel: '$', code: 'Digit4', w: 1, group: 'number' },
    { id: '5', label: '5', subLabel: '%', code: 'Digit5', w: 1, group: 'number' },
    { id: '6', label: '6', subLabel: '^', code: 'Digit6', w: 1, group: 'number' },
    { id: '7', label: '7', subLabel: '&', code: 'Digit7', w: 1, group: 'number' },
    { id: '8', label: '8', subLabel: '*', code: 'Digit8', w: 1, group: 'number' },
    { id: '9', label: '9', subLabel: '(', code: 'Digit9', w: 1, group: 'number' },
    { id: '0', label: '0', subLabel: ')', code: 'Digit0', w: 1, group: 'number' },
    { id: 'minus', label: '-', subLabel: '_', code: 'Minus', w: 1, group: 'number' },
    { id: 'equal', label: '=', subLabel: '+', code: 'Equal', w: 1, group: 'number' },
    { id: 'backspace', label: 'BKSP', code: 'Backspace', w: 2, group: 'modifier' },
    { id: 'end', label: 'END', code: 'End', w: 1, group: 'nav' },
  ],
  // Row 2: 15 keys (lightIndex 30..44), total width = 16u
  [
    { id: 'tab', label: 'TAB', code: 'Tab', w: 1.5, group: 'modifier' },
    { id: 'q', label: 'Q', code: 'KeyQ', w: 1, group: 'alpha' },
    { id: 'w', label: 'W', code: 'KeyW', w: 1, group: 'alpha' },
    { id: 'e', label: 'E', code: 'KeyE', w: 1, group: 'alpha' },
    { id: 'r', label: 'R', code: 'KeyR', w: 1, group: 'alpha' },
    { id: 't', label: 'T', code: 'KeyT', w: 1, group: 'alpha' },
    { id: 'y', label: 'Y', code: 'KeyY', w: 1, group: 'alpha' },
    { id: 'u', label: 'U', code: 'KeyU', w: 1, group: 'alpha' },
    { id: 'i', label: 'I', code: 'KeyI', w: 1, group: 'alpha' },
    { id: 'o', label: 'O', code: 'KeyO', w: 1, group: 'alpha' },
    { id: 'p', label: 'P', code: 'KeyP', w: 1, group: 'alpha' },
    { id: 'lbracket', label: '[', subLabel: '{', code: 'BracketLeft', w: 1, group: 'alpha' },
    { id: 'rbracket', label: ']', subLabel: '}', code: 'BracketRight', w: 1, group: 'alpha' },
    { id: 'backslash', label: '\\', subLabel: '|', code: 'Backslash', w: 1.5, group: 'modifier' },
    { id: 'pgup', label: 'PGUP', code: 'PageUp', w: 1, group: 'nav' },
  ],
  // Row 3: 14 keys (lightIndex 45, [gap 46], 47..59), total width = 16u
  [
    { id: 'caps', label: 'CAPS', code: 'CapsLock', w: 1.75, group: 'modifier' },
    { id: 'a', label: 'A', code: 'KeyA', w: 1, group: 'alpha' },
    { id: 's', label: 'S', code: 'KeyS', w: 1, group: 'alpha' },
    { id: 'd', label: 'D', code: 'KeyD', w: 1, group: 'alpha' },
    { id: 'f', label: 'F', code: 'KeyF', w: 1, group: 'alpha' },
    { id: 'g', label: 'G', code: 'KeyG', w: 1, group: 'alpha' },
    { id: 'h', label: 'H', code: 'KeyH', w: 1, group: 'alpha' },
    { id: 'j', label: 'J', code: 'KeyJ', w: 1, group: 'alpha' },
    { id: 'k', label: 'K', code: 'KeyK', w: 1, group: 'alpha' },
    { id: 'l', label: 'L', code: 'KeyL', w: 1, group: 'alpha' },
    { id: 'semicolon', label: ';', subLabel: ':', code: 'Semicolon', w: 1, group: 'alpha' },
    { id: 'quote', label: "'", subLabel: '"', code: 'Quote', w: 1, group: 'alpha' },
    { id: 'enter', label: 'ENTER', code: 'Enter', w: 2.25, group: 'modifier' },
    { id: 'pgdn', label: 'PGDN', code: 'PageDown', w: 1, group: 'nav' },
  ],
  // Row 4: 13 keys (lightIndex 60..72), Up aligned above Down (x=14..15)
  [
    { id: 'lshift', label: 'SHIFT', code: 'ShiftLeft', w: 2.25, group: 'modifier' },
    { id: 'z', label: 'Z', code: 'KeyZ', w: 1, group: 'alpha' },
    { id: 'x', label: 'X', code: 'KeyX', w: 1, group: 'alpha' },
    { id: 'c', label: 'C', code: 'KeyC', w: 1, group: 'alpha' },
    { id: 'v', label: 'V', code: 'KeyV', w: 1, group: 'alpha' },
    { id: 'b', label: 'B', code: 'KeyB', w: 1, group: 'alpha' },
    { id: 'n', label: 'N', code: 'KeyN', w: 1, group: 'alpha' },
    { id: 'm', label: 'M', code: 'KeyM', w: 1, group: 'alpha' },
    { id: 'comma', label: ',', subLabel: '<', code: 'Comma', w: 1, group: 'alpha' },
    { id: 'period', label: '.', subLabel: '>', code: 'Period', w: 1, group: 'alpha' },
    { id: 'slash', label: '/', subLabel: '?', code: 'Slash', w: 1, group: 'alpha' },
    { id: 'rshift', label: 'SHIFT', code: 'ShiftRight', w: 1.75, group: 'modifier' },
    { id: 'up', label: '↑', code: 'ArrowUp', w: 1, group: 'arrow' },
  ],
  // Row 5: 9 keys (lightIndex 73..81), total width = 16u
  [
    { id: 'lctrl', label: 'CTRL', code: 'ControlLeft', w: 1.25, group: 'modifier' },
    { id: 'lwin', label: 'WIN', code: 'MetaLeft', w: 1.25, group: 'modifier' },
    { id: 'lalt', label: 'ALT', code: 'AltLeft', w: 1.25, group: 'modifier' },
    { id: 'space', label: 'SPACE', code: 'Space', w: 6.25, group: 'space' },
    { id: 'fn', label: 'FN', code: 'Fn', w: 1.25, group: 'modifier' },
    { id: 'rctrl', label: 'CTRL', code: 'ControlRight', w: 1.25, group: 'modifier' },
    { id: 'left', label: '←', code: 'ArrowLeft', w: 1, xOffset: 0.5, group: 'arrow' },
    { id: 'down', label: '↓', code: 'ArrowDown', w: 1, group: 'arrow' },
    { id: 'right', label: '→', code: 'ArrowRight', w: 1, group: 'arrow' },
  ],
];

/**
 * Hardware lightIndex assignment respecting WAVE75 LED Gap #46:
 * Keys 0..45 (Esc..Caps) -> lightIndex 0..45
 * Slot 46 is skipped (empty gap -> 0x0000)
 * Keys 46..80 (A..RightArrow) -> lightIndex 47..81
 */
export function logicalKeyToDefaultLightIndex(keyIndex: number): number {
  return keyIndex < WAVE75_GAP_LIGHT_INDEX ? keyIndex : keyIndex + 1;
}

export const WAVE75_KEYS: WaveKeyDefinition[] = (() => {
  const result: WaveKeyDefinition[] = [];
  let idx = 0;
  for (let row = 0; row < RAW_ROWS.length; row++) {
    let cursorX = 0;
    for (let col = 0; col < RAW_ROWS[row].length; col++) {
      const spec = RAW_ROWS[row][col];
      if (spec.xOffset) cursorX += spec.xOffset;
      const cx = cursorX + spec.w / 2;
      const cy = row + 0.5;
      result.push({
        index: idx,
        id: spec.id,
        label: spec.label,
        subLabel: spec.subLabel,
        code: spec.code,
        row,
        col,
        x: cursorX,
        y: row,
        w: spec.w,
        h: 1,
        cx,
        cy,
        nx: cx / WAVE75_WIDTH_U,
        ny: cy / WAVE75_HEIGHT_U,
        defaultLightIndex: logicalKeyToDefaultLightIndex(idx),
        group: spec.group,
      });
      cursorX += spec.w;
      idx++;
    }
  }
  return result;
})();

export const WAVE_KEY_BY_CODE: Record<string, WaveKeyDefinition> = Object.fromEntries(
  WAVE75_KEYS.map((k) => [k.code, k])
);

export const WAVE_KEY_BY_ID: Record<string, WaveKeyDefinition> = Object.fromEntries(
  WAVE75_KEYS.map((k) => [k.id, k])
);

export function createDefaultLightIndexMap(): number[] {
  return WAVE75_KEYS.map((k) => k.defaultLightIndex);
}

export type WaveQuickGroup =
  | 'all'
  | 'wasd'
  | 'arrows'
  | 'fn_row'
  | 'numbers'
  | 'modifiers'
  | 'nav'
  | 'alphas'
  | 'none';

const WASD_SET = new Set(['w', 'a', 's', 'd']);

export function getWaveQuickSelection(group: WaveQuickGroup): number[] {
  switch (group) {
    case 'all':
      return WAVE75_KEYS.map((k) => k.index);
    case 'wasd':
      return WAVE75_KEYS.filter((k) => WASD_SET.has(k.id)).map((k) => k.index);
    case 'arrows':
      return WAVE75_KEYS.filter((k) => k.group === 'arrow').map((k) => k.index);
    case 'fn_row':
      return WAVE75_KEYS.filter((k) => k.group === 'fn_row').map((k) => k.index);
    case 'numbers':
      return WAVE75_KEYS.filter((k) => k.group === 'number').map((k) => k.index);
    case 'modifiers':
      return WAVE75_KEYS.filter((k) => k.group === 'modifier' || k.group === 'space').map(
        (k) => k.index
      );
    case 'nav':
      return WAVE75_KEYS.filter((k) => k.group === 'nav').map((k) => k.index);
    case 'alphas':
      return WAVE75_KEYS.filter((k) => k.group === 'alpha').map((k) => k.index);
    case 'none':
    default:
      return [];
  }
}
