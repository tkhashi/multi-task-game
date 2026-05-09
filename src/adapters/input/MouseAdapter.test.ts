import { describe, expect, it } from 'vitest';

import { MouseAdapter } from './MouseAdapter';

type FakePointerEvent = {
  clientX: number;
  clientY: number;
  button?: number;
  buttons?: number;
  preventDefault(): void;
  defaultPrevented?: boolean;
};

type FakeWheelEvent = FakePointerEvent & {
  deltaY: number;
};

class FakePointerSource {
  readonly #listeners = new Map<string, Set<(event: FakePointerEvent | FakeWheelEvent) => void>>();

  addEventListener(type: string, listener: (event: FakePointerEvent | FakeWheelEvent) => void): void {
    const listeners = this.#listeners.get(type) ?? new Set<(event: FakePointerEvent | FakeWheelEvent) => void>();
    listeners.add(listener);
    this.#listeners.set(type, listeners);
  }

  removeEventListener(type: string, listener: (event: FakePointerEvent | FakeWheelEvent) => void): void {
    this.#listeners.get(type)?.delete(listener);
  }

  emit(type: string, event: Omit<FakePointerEvent, 'preventDefault'> | Omit<FakeWheelEvent, 'preventDefault'>) {
    const pointerEvent = {
      defaultPrevented: false,
      ...event,
      preventDefault() {
        pointerEvent.defaultPrevented = true;
      },
    };

    for (const listener of this.#listeners.get(type) ?? []) {
      listener(pointerEvent);
    }

    return pointerEvent;
  }
}

describe('MouseAdapter', () => {
  it('captures pointer position, drag delta, and primary release', () => {
    const eventSource = new FakePointerSource();
    const adapter = new MouseAdapter({ eventSource });

    eventSource.emit('pointermove', { clientX: 200, clientY: 140, buttons: 1 });
    eventSource.emit('pointerup', { clientX: 240, clientY: 170, button: 0, buttons: 0 });

    const firstSample = adapter.sample(1000);
    const secondSample = adapter.sample(1016);

    expect(firstSample.position).toEqual({ x: 240, y: 170 });
    expect(firstSample.delta).toEqual({ x: 240, y: 170 });
    expect(firstSample.primaryReleased).toBe(true);
    expect(secondSample.delta).toEqual({ x: 0, y: 0 });
    expect(secondSample.primaryReleased).toBe(false);
  });

  it('returns an idle snapshot while bindings are inactive', () => {
    const eventSource = new FakePointerSource();
    const adapter = new MouseAdapter({ eventSource, active: false });

    eventSource.emit('pointermove', { clientX: 120, clientY: 80, buttons: 1 });

    expect(adapter.sample(1000)).toMatchObject({
      position: { x: 0, y: 0 },
      delta: { x: 0, y: 0 },
      buttonsDown: [],
      primaryReleased: false,
    });
  });
});
