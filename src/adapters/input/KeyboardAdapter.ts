import { createIdleKeyboardSnapshot, type KeyboardSnapshot } from '../../domain/input/KeyboardSnapshot';

export interface KeyboardSnapshotSource {
  sample(sampledAtMs: number): KeyboardSnapshot;
}

export class KeyboardAdapter implements KeyboardSnapshotSource {
  #snapshot: KeyboardSnapshot = createIdleKeyboardSnapshot();

  sample(sampledAtMs: number): KeyboardSnapshot {
    void sampledAtMs;
    return this.#snapshot;
  }

  setSnapshot(snapshot: KeyboardSnapshot): void {
    this.#snapshot = snapshot;
  }
}
