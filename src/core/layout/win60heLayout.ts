export type KeyGroup = 'alpha' | 'number' | 'modifier' | 'space';

export interface KeyDefinition {
  index: number;           // 0..60 canonical index
  id: string;              // unique short id
  label: string;           // main legend
  subLabel?: string;       // secondary legend (e.g. Shift char or Fn)
  code: string;            // DOM KeyboardEvent.code
  row: number;             // 0..4
  col: number;             // 0..13
  x: number;               // physical X in u (0..15)
  y: number;               // physical Y in u (0..5)
  w: number;               // width in u
  h: number;               // height in u (1)
  cx: number;              // center X in u
  cy: number;              // center Y in u
  nx: number;              // normalized center X (0..1)
  ny: number;              // normalized center Y (0..1)
  defaultLedIndex: number; // default hardware LED matrix index (0..60)
  group: KeyGroup;
}

export const KEYBOARD_WIDTH_U = 15;
export const KEYBOARD_HEIGHT_U = 5;
export const TOTAL_KEYS = 61;

interface RawKeySpec {
  id: string;
  label: string;
  subLabel?: string;
  code: string;
  w: number;
  group: KeyGroup;
}

const RAW_ROWS: RawKeySpec[][] = [
  // Row 0: 14 keys = 13*1 + 2 = 15u
  [
    { id: 'esc', label: 'ESC', subLabel: '~', code: 'Escape', w: 1, group: 'modifier' },
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
  ],
  // Row 1: 14 keys = 1.5 + 12*1 + 1.5 = 15u
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
  ],
  // Row 2: 13 keys = 1.75 + 11*1 + 2.25 = 15u
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
  ],
  // Row 3: 12 keys = 2.25 + 10*1 + 2.75 = 15u
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
    { id: 'rshift', label: 'SHIFT', code: 'ShiftRight', w: 2.75, group: 'modifier' },
  ],
  // Row 4: 8 keys = 7*1.25 + 6.25 = 15u
  [
    { id: 'lctrl', label: 'CTRL', code: 'ControlLeft', w: 1.25, group: 'modifier' },
    { id: 'lwin', label: 'WIN', code: 'MetaLeft', w: 1.25, group: 'modifier' },
    { id: 'lalt', label: 'ALT', code: 'AltLeft', w: 1.25, group: 'modifier' },
    { id: 'space', label: 'SPACE', code: 'Space', w: 6.25, group: 'space' },
    { id: 'ralt', label: 'ALT', code: 'AltRight', w: 1.25, group: 'modifier' },
    { id: 'fn', label: 'FN', code: 'Fn', w: 1.25, group: 'modifier' },
    { id: 'menu', label: 'MENU', code: 'ContextMenu', w: 1.25, group: 'modifier' },
    { id: 'rctrl', label: 'CTRL', code: 'ControlRight', w: 1.25, group: 'modifier' },
  ],
];

export const WIN60HE_KEYS: KeyDefinition[] = (() => {
  const keys: KeyDefinition[] = [];
  let idx = 0;
  for (let row = 0; row < RAW_ROWS.length; row++) {
    let cursorX = 0;
    for (let col = 0; col < RAW_ROWS[row].length; col++) {
      const spec = RAW_ROWS[row][col];
      const cx = cursorX + spec.w / 2;
      const cy = row + 0.5;
      keys.push({
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
        nx: cx / KEYBOARD_WIDTH_U,
        ny: cy / KEYBOARD_HEIGHT_U,
        defaultLedIndex: idx,
        group: spec.group,
      });
      cursorX += spec.w;
      idx++;
    }
  }
  return keys;
})();

export const KEY_BY_CODE: Record<string, KeyDefinition> = Object.fromEntries(
  WIN60HE_KEYS.map((k) => [k.code, k])
);

export const KEY_BY_ID: Record<string, KeyDefinition> = Object.fromEntries(
  WIN60HE_KEYS.map((k) => [k.id, k])
);

export type QuickSelectionGroup =
  | 'all'
  | 'wasd'
  | 'alphas'
  | 'numbers'
  | 'modifiers'
  | 'fps'
  | 'none';

const FPS_KEY_IDS = new Set([
  'esc', '1', '2', '3', '4', '5',
  'q', 'w', 'e', 'r', 'a', 's', 'd', 'f',
  'lshift', 'lctrl', 'space',
]);

const WASD_IDS = new Set(['w', 'a', 's', 'd']);

const NUMBER_ROW_IDS = new Set(['1', '2', '3', '4', '5', '6', '7', '8', '9', '0']);

export function getQuickSelectionIndices(group: QuickSelectionGroup): number[] {
  switch (group) {
    case 'all':
      return WIN60HE_KEYS.map((k) => k.index);
    case 'wasd':
      return WIN60HE_KEYS.filter((k) => WASD_IDS.has(k.id)).map((k) => k.index);
    case 'alphas':
      return WIN60HE_KEYS.filter((k) => k.group === 'alpha').map((k) => k.index);
    case 'numbers':
      return WIN60HE_KEYS.filter((k) => NUMBER_ROW_IDS.has(k.id)).map((k) => k.index);
    case 'modifiers':
      return WIN60HE_KEYS.filter((k) => k.group === 'modifier' || k.group === 'space').map((k) => k.index);
    case 'fps':
      return WIN60HE_KEYS.filter((k) => FPS_KEY_IDS.has(k.id)).map((k) => k.index);
    case 'none':
    default:
      return [];
  }
}

export function createDefaultLedIndexMap(): number[] {
  return WIN60HE_KEYS.map((k) => k.defaultLedIndex);
}

