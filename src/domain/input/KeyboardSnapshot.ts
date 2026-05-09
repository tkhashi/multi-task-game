export interface KeyboardSnapshot {
  pressedKeys: string[];
  justPressedKeys: string[];
  movement: {
    horizontal: -1 | 0 | 1;
    vertical: -1 | 0 | 1;
  };
  modifiers: {
    shift: boolean;
    alt: boolean;
    ctrl: boolean;
    meta: boolean;
  };
}

export function createIdleKeyboardSnapshot(): KeyboardSnapshot {
  return {
    pressedKeys: [],
    justPressedKeys: [],
    movement: {
      horizontal: 0,
      vertical: 0,
    },
    modifiers: {
      shift: false,
      alt: false,
      ctrl: false,
      meta: false,
    },
  };
}
