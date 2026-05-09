import { createIdleMouseSnapshot, type MouseSnapshot } from '../../domain/input/MouseSnapshot';

export interface MouseSnapshotSource {
  sample(sampledAtMs: number): MouseSnapshot;
}

export class MouseAdapter implements MouseSnapshotSource {
  #snapshot: MouseSnapshot = createIdleMouseSnapshot();

  sample(sampledAtMs: number): MouseSnapshot {
    void sampledAtMs;
    return this.#snapshot;
  }

  setSnapshot(snapshot: MouseSnapshot): void {
    this.#snapshot = snapshot;
  }
}
