import { createIdleKeyboardSnapshot, type KeyboardSnapshot } from '../../domain/input/KeyboardSnapshot';

export interface KeyboardSnapshotSource {
  sample(sampledAtMs: number): KeyboardSnapshot;
}

export interface KeyboardEventSource {
  addEventListener(type: 'keydown' | 'keyup', listener: (event: KeyboardEventLike) => void): void;
  removeEventListener(type: 'keydown' | 'keyup', listener: (event: KeyboardEventLike) => void): void;
}

export interface KeyboardEventLike {
  code?: string;
  key?: string;
  shiftKey?: boolean;
  altKey?: boolean;
  ctrlKey?: boolean;
  metaKey?: boolean;
  preventDefault?(): void;
}

export interface KeyboardAdapterOptions {
  eventSource?: KeyboardEventSource | null;
  active?: boolean;
}

function normalizeKey(event: KeyboardEventLike): string {
  if (event.code === 'Space' || event.key === ' ') {
    return 'Space';
  }

  if (event.key && event.key.length === 1) {
    return event.key.toLowerCase();
  }

  if (event.code?.startsWith('Key') && event.code.length === 4) {
    return event.code.slice(3).toLowerCase();
  }

  return event.key ?? event.code ?? '';
}

function movementFromPressedKeys(pressedKeys: string[]): KeyboardSnapshot['movement'] {
  const pressed = new Set(pressedKeys.map((key) => key.toLowerCase()));

  return {
    horizontal: pressed.has('arrowleft') || pressed.has('a') ? -1 : pressed.has('arrowright') || pressed.has('d') ? 1 : 0,
    vertical: pressed.has('arrowup') || pressed.has('w') ? -1 : pressed.has('arrowdown') || pressed.has('s') ? 1 : 0,
  };
}

export class KeyboardAdapter implements KeyboardSnapshotSource {
  #snapshot: KeyboardSnapshot = createIdleKeyboardSnapshot();
  readonly #eventSource: KeyboardEventSource | null;
  #active: boolean;
  readonly #pressedKeys = new Set<string>();
  readonly #justPressedKeys = new Set<string>();
  readonly #onKeyDown = (event: KeyboardEventLike) => {
    if (!this.#active) {
      return;
    }

    const key = normalizeKey(event);
    if (!key) {
      return;
    }

    if (!this.#pressedKeys.has(key)) {
      this.#justPressedKeys.add(key);
    }
    this.#pressedKeys.add(key);
    this.#snapshot = {
      ...this.#snapshot,
      modifiers: {
        shift: Boolean(event.shiftKey),
        alt: Boolean(event.altKey),
        ctrl: Boolean(event.ctrlKey),
        meta: Boolean(event.metaKey),
      },
    };

    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space'].includes(key)) {
      event.preventDefault?.();
    }
  };
  readonly #onKeyUp = (event: KeyboardEventLike) => {
    const key = normalizeKey(event);
    if (!key) {
      return;
    }

    this.#pressedKeys.delete(key);
    this.#snapshot = {
      ...this.#snapshot,
      modifiers: {
        shift: Boolean(event.shiftKey),
        alt: Boolean(event.altKey),
        ctrl: Boolean(event.ctrlKey),
        meta: Boolean(event.metaKey),
      },
    };
  };

  constructor({
    eventSource = typeof window === 'undefined' ? null : window,
    active = true,
  }: KeyboardAdapterOptions = {}) {
    this.#eventSource = eventSource;
    this.#active = active;
    this.#eventSource?.addEventListener('keydown', this.#onKeyDown);
    this.#eventSource?.addEventListener('keyup', this.#onKeyUp);
  }

  sample(sampledAtMs: number): KeyboardSnapshot {
    void sampledAtMs;
    if (!this.#active) {
      return createIdleKeyboardSnapshot();
    }

    this.#snapshot = {
      pressedKeys: [...this.#pressedKeys],
      justPressedKeys: [...this.#justPressedKeys],
      movement: movementFromPressedKeys([...this.#pressedKeys]),
      modifiers: this.#snapshot.modifiers,
    };
    const sample = this.#snapshot;
    this.#justPressedKeys.clear();

    return sample;
  }

  setActive(active: boolean): void {
    this.#active = active;
    if (!active) {
      this.#pressedKeys.clear();
      this.#justPressedKeys.clear();
      this.#snapshot = createIdleKeyboardSnapshot();
    }
  }

  dispose(): void {
    this.#eventSource?.removeEventListener('keydown', this.#onKeyDown);
    this.#eventSource?.removeEventListener('keyup', this.#onKeyUp);
  }

  setSnapshot(snapshot: KeyboardSnapshot): void {
    this.#snapshot = snapshot;
    this.#pressedKeys.clear();
    this.#justPressedKeys.clear();
    for (const key of snapshot.pressedKeys) {
      this.#pressedKeys.add(key);
    }
    for (const key of snapshot.justPressedKeys) {
      this.#justPressedKeys.add(key);
    }
  }
}

let sharedKeyboardAdapter: KeyboardAdapter | null = null;

export function getSharedKeyboardAdapter(): KeyboardAdapter {
  sharedKeyboardAdapter ??= new KeyboardAdapter();
  return sharedKeyboardAdapter;
}
