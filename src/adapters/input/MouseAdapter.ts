import { createIdleMouseSnapshot, type MouseSnapshot } from '../../domain/input/MouseSnapshot';

export interface MouseSnapshotSource {
  sample(sampledAtMs: number): MouseSnapshot;
}

export interface PointerEventLike {
  clientX: number;
  clientY: number;
  button?: number;
  buttons?: number;
  deltaY?: number;
  preventDefault?(): void;
}

export interface PointerEventSource {
  addEventListener(
    type: 'pointermove' | 'pointerdown' | 'pointerup' | 'wheel',
    listener: (event: PointerEventLike) => void,
  ): void;
  removeEventListener(
    type: 'pointermove' | 'pointerdown' | 'pointerup' | 'wheel',
    listener: (event: PointerEventLike) => void,
  ): void;
}

export interface MouseAdapterOptions {
  eventSource?: PointerEventSource | null;
  active?: boolean;
}

function toButtonsDown(buttons: number): MouseSnapshot['buttonsDown'] {
  const nextButtons: MouseSnapshot['buttonsDown'] = [];
  if (buttons & 1) {
    nextButtons.push('left');
  }
  if (buttons & 4) {
    nextButtons.push('middle');
  }
  if (buttons & 2) {
    nextButtons.push('right');
  }
  return nextButtons;
}

export class MouseAdapter implements MouseSnapshotSource {
  #snapshot: MouseSnapshot = createIdleMouseSnapshot();
  readonly #eventSource: PointerEventSource | null;
  #active: boolean;
  #lastPosition = { x: 0, y: 0 };
  #delta = { x: 0, y: 0 };
  #wheelDelta = 0;
  #primaryReleased = false;
  readonly #onPointerMove = (event: PointerEventLike) => {
    if (!this.#active) {
      return;
    }

    this.#delta = {
      x: this.#delta.x + (event.clientX - this.#lastPosition.x),
      y: this.#delta.y + (event.clientY - this.#lastPosition.y),
    };
    this.#lastPosition = {
      x: event.clientX,
      y: event.clientY,
    };
    this.#snapshot = {
      ...this.#snapshot,
      position: { ...this.#lastPosition },
      buttonsDown: toButtonsDown(event.buttons ?? 0),
    };
  };
  readonly #onPointerDown = (event: PointerEventLike) => {
    if (!this.#active) {
      return;
    }

    this.#onPointerMove(event);
    event.preventDefault?.();
  };
  readonly #onPointerUp = (event: PointerEventLike) => {
    if (!this.#active) {
      return;
    }

    this.#onPointerMove(event);
    this.#snapshot = {
      ...this.#snapshot,
      buttonsDown: toButtonsDown(event.buttons ?? 0),
    };
    this.#primaryReleased = event.button === 0;
    event.preventDefault?.();
  };
  readonly #onWheel = (event: PointerEventLike) => {
    if (!this.#active) {
      return;
    }

    this.#wheelDelta += event.deltaY ?? 0;
  };

  constructor({
    eventSource = typeof window === 'undefined' ? null : window,
    active = true,
  }: MouseAdapterOptions = {}) {
    this.#eventSource = eventSource;
    this.#active = active;
    this.#eventSource?.addEventListener('pointermove', this.#onPointerMove);
    this.#eventSource?.addEventListener('pointerdown', this.#onPointerDown);
    this.#eventSource?.addEventListener('pointerup', this.#onPointerUp);
    this.#eventSource?.addEventListener('wheel', this.#onWheel);
  }

  sample(sampledAtMs: number): MouseSnapshot {
    void sampledAtMs;
    if (!this.#active) {
      return createIdleMouseSnapshot();
    }

    const snapshot: MouseSnapshot = {
      position: { ...this.#lastPosition },
      delta: { ...this.#delta },
      buttonsDown: [...this.#snapshot.buttonsDown],
      wheelDelta: this.#wheelDelta,
      primaryReleased: this.#primaryReleased,
    };
    this.#delta = { x: 0, y: 0 };
    this.#wheelDelta = 0;
    this.#primaryReleased = false;

    return snapshot;
  }

  setActive(active: boolean): void {
    this.#active = active;
    if (!active) {
      this.#snapshot = createIdleMouseSnapshot();
      this.#lastPosition = { x: 0, y: 0 };
      this.#delta = { x: 0, y: 0 };
      this.#wheelDelta = 0;
      this.#primaryReleased = false;
    }
  }

  dispose(): void {
    this.#eventSource?.removeEventListener('pointermove', this.#onPointerMove);
    this.#eventSource?.removeEventListener('pointerdown', this.#onPointerDown);
    this.#eventSource?.removeEventListener('pointerup', this.#onPointerUp);
    this.#eventSource?.removeEventListener('wheel', this.#onWheel);
  }

  setSnapshot(snapshot: MouseSnapshot): void {
    this.#snapshot = snapshot;
    this.#lastPosition = { ...snapshot.position };
    this.#delta = { ...snapshot.delta };
    this.#wheelDelta = snapshot.wheelDelta;
    this.#primaryReleased = snapshot.primaryReleased;
  }
}

let sharedMouseAdapter: MouseAdapter | null = null;

export function getSharedMouseAdapter(): MouseAdapter {
  sharedMouseAdapter ??= new MouseAdapter();
  return sharedMouseAdapter;
}
