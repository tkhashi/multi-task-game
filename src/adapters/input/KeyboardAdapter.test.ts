import { describe, expect, it } from 'vitest';

import { KeyboardAdapter } from './KeyboardAdapter';

type FakeKeyboardEvent = {
  code: string;
  key: string;
  shiftKey?: boolean;
  altKey?: boolean;
  ctrlKey?: boolean;
  metaKey?: boolean;
  defaultPrevented?: boolean;
  preventDefault(): void;
};

class FakeEventSource {
  readonly #listeners = new Map<string, Set<(event: FakeKeyboardEvent) => void>>();

  addEventListener(type: string, listener: (event: FakeKeyboardEvent) => void): void {
    const listeners = this.#listeners.get(type) ?? new Set<(event: FakeKeyboardEvent) => void>();
    listeners.add(listener);
    this.#listeners.set(type, listeners);
  }

  removeEventListener(type: string, listener: (event: FakeKeyboardEvent) => void): void {
    this.#listeners.get(type)?.delete(listener);
  }

  emit(type: string, event: Omit<FakeKeyboardEvent, 'preventDefault'>): FakeKeyboardEvent {
    const keyboardEvent: FakeKeyboardEvent = {
      shiftKey: false,
      altKey: false,
      ctrlKey: false,
      metaKey: false,
      defaultPrevented: false,
      ...event,
      preventDefault() {
        keyboardEvent.defaultPrevented = true;
      },
    };

    for (const listener of this.#listeners.get(type) ?? []) {
      listener(keyboardEvent);
    }

    return keyboardEvent;
  }
}

describe('KeyboardAdapter', () => {
  it('captures pressed and just-pressed keys from keyboard events', () => {
    const eventSource = new FakeEventSource();
    const adapter = new KeyboardAdapter({ eventSource });

    eventSource.emit('keydown', { code: 'ArrowLeft', key: 'ArrowLeft' });
    eventSource.emit('keydown', { code: 'Space', key: ' ' });

    const firstSample = adapter.sample(1000);
    const secondSample = adapter.sample(1016);

    expect(firstSample.pressedKeys).toEqual(['ArrowLeft', 'Space']);
    expect(firstSample.justPressedKeys).toEqual(['ArrowLeft', 'Space']);
    expect(firstSample.movement).toEqual({ horizontal: -1, vertical: 0 });
    expect(secondSample.justPressedKeys).toEqual([]);
  });

  it('returns an idle snapshot while bindings are inactive', () => {
    const eventSource = new FakeEventSource();
    const adapter = new KeyboardAdapter({ eventSource, active: false });

    eventSource.emit('keydown', { code: 'ArrowRight', key: 'ArrowRight' });

    expect(adapter.sample(1000)).toMatchObject({
      pressedKeys: [],
      justPressedKeys: [],
      movement: { horizontal: 0, vertical: 0 },
    });
  });
});
