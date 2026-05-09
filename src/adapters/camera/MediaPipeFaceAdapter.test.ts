import { describe, expect, it } from 'vitest';

import { createIdleCameraSnapshot } from '../../domain/input/CameraSnapshot';
import { MediaPipeFaceAdapter } from './MediaPipeFaceAdapter';

class FakeMediaStreamTrack {
  stopped = false;

  stop(): void {
    this.stopped = true;
  }
}

class FakeMediaStream {
  readonly #tracks: FakeMediaStreamTrack[];

  constructor(tracks: FakeMediaStreamTrack[]) {
    this.#tracks = tracks;
  }

  getTracks(): FakeMediaStreamTrack[] {
    return this.#tracks;
  }
}

type FakeVideoListener = () => void;

class FakeVideoElement {
  autoplay = false;
  muted = false;
  playsInline = false;
  srcObject: MediaProvider | null = null;
  videoWidth = 640;
  videoHeight = 480;
  readonly #listeners = new Map<string, Set<FakeVideoListener>>();

  addEventListener(type: string, listener: FakeVideoListener): void {
    if (!this.#listeners.has(type)) {
      this.#listeners.set(type, new Set());
    }

    this.#listeners.get(type)?.add(listener);
  }

  removeEventListener(type: string, listener: FakeVideoListener): void {
    this.#listeners.get(type)?.delete(listener);
  }

  async play(): Promise<void> {
    this.emit('loadedmetadata');
  }

  pause(): void {
    // no-op for tests
  }

  emit(type: string): void {
    for (const listener of this.#listeners.get(type) ?? []) {
      listener();
    }
  }
}

class FakeImageBitmap {
  closed = false;

  close(): void {
    this.closed = true;
  }
}

class FakeAnimationClock {
  nextFrameId = 1;
  readonly callbacks = new Map<number, FrameRequestCallback>();

  requestAnimationFrame = (callback: FrameRequestCallback): number => {
    const frameId = this.nextFrameId;
    this.nextFrameId += 1;
    this.callbacks.set(frameId, callback);
    return frameId;
  };

  cancelAnimationFrame = (frameId: number): void => {
    this.callbacks.delete(frameId);
  };

  flushNext(timestamp = 0): void {
    const [frameId, callback] = this.callbacks.entries().next().value ?? [];
    if (!frameId || !callback) {
      throw new Error('No animation frame scheduled');
    }

    this.callbacks.delete(frameId);
    callback(timestamp);
  }
}

type WorkerMessageHandler = ((event: MessageEvent) => void) | null;
type WorkerErrorHandler = ((event: ErrorEvent) => void) | null;

class FakeWorker {
  readonly postedMessages: unknown[] = [];
  onmessage: WorkerMessageHandler = null;
  onerror: WorkerErrorHandler = null;
  terminated = false;

  postMessage(message: unknown): void {
    this.postedMessages.push(message);
  }

  terminate(): void {
    this.terminated = true;
  }

  emitMessage(data: unknown): void {
    this.onmessage?.({ data } as MessageEvent);
  }

  emitError(message = 'worker failed'): void {
    this.onerror?.({ message } as ErrorEvent);
  }
}

function inferMessages(worker: FakeWorker): Array<{
  type: 'infer';
  requestId: number;
  timestampMs: number;
}> {
  return worker.postedMessages.filter(
    (message): message is { type: 'infer'; requestId: number; timestampMs: number } =>
      typeof message === 'object' &&
      message !== null &&
      'type' in message &&
      (message as { type?: string }).type === 'infer',
  );
}

function flushMicrotasks(): Promise<void> {
  return Promise.resolve();
}

async function waitFor(condition: () => boolean, timeoutMs = 250): Promise<void> {
  const deadline = Date.now() + timeoutMs;

  while (!condition()) {
    if (Date.now() > deadline) {
      throw new Error('Timed out waiting for condition');
    }

    await new Promise((resolve) => setTimeout(resolve, 0));
  }
}

describe('MediaPipeFaceAdapter', () => {
  it('returns workerInitializationFailed when the worker crashes before initialization completes', async () => {
    const worker = new FakeWorker();
    const track = new FakeMediaStreamTrack();
    const adapter = new MediaPipeFaceAdapter({
      getUserMedia: async () => new FakeMediaStream([track]) as unknown as MediaStream,
      createVideoElement: () => new FakeVideoElement(),
      createImageBitmap: async () => new FakeImageBitmap() as unknown as ImageBitmap,
      createWorker: () => worker,
      requestAnimationFrame: () => 0,
      cancelAnimationFrame: () => {},
      isSecureContext: () => true,
    });

    const startPromise = adapter.start();
    await waitFor(() => worker.postedMessages.length === 1);
    worker.emitError();

    await expect(startPromise).resolves.toEqual({
      ok: false,
      error: { kind: 'workerStartupFailed' },
    });
    expect(track.stopped).toBe(true);
    expect(adapter.sample(0)).toEqual(createIdleCameraSnapshot());
  });

  it('returns modelLoadFailed when MediaPipe init fails inside the worker', async () => {
    const worker = new FakeWorker();
    const adapter = new MediaPipeFaceAdapter({
      getUserMedia: async () => new FakeMediaStream([new FakeMediaStreamTrack()]) as unknown as MediaStream,
      createVideoElement: () => new FakeVideoElement(),
      createImageBitmap: async () => new FakeImageBitmap() as unknown as ImageBitmap,
      createWorker: () => worker,
      requestAnimationFrame: () => 0,
      cancelAnimationFrame: () => {},
      isSecureContext: () => true,
    });

    const startPromise = adapter.start();
    await waitFor(() => worker.postedMessages.length === 1);
    worker.emitMessage({
      type: 'error',
      requestId: 0,
      stage: 'model-init',
      reason: 'missing asset',
    });

    await expect(startPromise).resolves.toEqual({
      ok: false,
      error: { kind: 'modelLoadFailed' },
    });
  });

  it('returns deviceUnavailable with faceNotDetected detail when warmup never produces a detected face', async () => {
    const clock = new FakeAnimationClock();
    const worker = new FakeWorker();
    const adapter = new MediaPipeFaceAdapter({
      getUserMedia: async () => new FakeMediaStream([new FakeMediaStreamTrack()]) as unknown as MediaStream,
      createVideoElement: () => new FakeVideoElement(),
      createImageBitmap: async () => new FakeImageBitmap() as unknown as ImageBitmap,
      createWorker: () => worker,
      requestAnimationFrame: clock.requestAnimationFrame,
      cancelAnimationFrame: clock.cancelAnimationFrame,
      isSecureContext: () => true,
      warmupTimeoutMs: 5,
      inferenceIntervalMs: 120,
    });

    const startPromise = adapter.start();
    await waitFor(() => worker.postedMessages.length === 1);
    worker.emitMessage({ type: 'ready', requestId: 0 });
    await waitFor(() => clock.callbacks.size === 1);
    clock.flushNext(16);
    await flushMicrotasks();
    worker.emitMessage({ type: 'result', requestId: 1, timestampMs: 16, faceBox: null });

    await expect(startPromise).resolves.toEqual({
      ok: false,
      error: {
        kind: 'deviceUnavailable',
        detail: 'faceNotDetected',
      },
    });
  });

  it('warms up successfully, returns baselineFaceBox, and expires stale detections', async () => {
    const clock = new FakeAnimationClock();
    const worker = new FakeWorker();
    const track = new FakeMediaStreamTrack();
    const adapter = new MediaPipeFaceAdapter({
      getUserMedia: async () => new FakeMediaStream([track]) as unknown as MediaStream,
      createVideoElement: () => new FakeVideoElement(),
      createImageBitmap: async () => new FakeImageBitmap() as unknown as ImageBitmap,
      createWorker: () => worker,
      requestAnimationFrame: clock.requestAnimationFrame,
      cancelAnimationFrame: clock.cancelAnimationFrame,
      isSecureContext: () => true,
      warmupTimeoutMs: 50,
      staleDetectionThresholdMs: 250,
      inferenceIntervalMs: 120,
    });

    const startPromise = adapter.start();
    await waitFor(() => worker.postedMessages.length === 1);
    worker.emitMessage({ type: 'ready', requestId: 0 });
    await waitFor(() => clock.callbacks.size === 1);
    clock.flushNext(16);
    await flushMicrotasks();
    worker.emitMessage({
      type: 'result',
      requestId: 1,
      timestampMs: 16,
      faceBox: {
        centerX: 0.5,
        centerY: 0.5,
        width: 0.24,
        height: 0.3,
      },
    });

    await expect(startPromise).resolves.toEqual({
      ok: true,
      value: {
        baselineFaceBox: {
          centerX: 0.5,
          centerY: 0.5,
          width: 0.24,
          height: 0.3,
        },
      },
    });

    expect(adapter.sample(32)).toEqual({
      permission: 'granted',
      readiness: 'ready',
      ready: true,
      faceDetected: true,
      faceBox: {
        centerX: 0.5,
        centerY: 0.5,
        width: 0.24,
        height: 0.3,
      },
      hint: 'hold',
      detection: {
        lastProcessedAtMs: 16,
        lastDetectedAtMs: 16,
        stale: false,
      },
    });

    expect(adapter.sample(320)).toEqual({
      permission: 'granted',
      readiness: 'ready',
      ready: true,
      faceDetected: false,
      faceBox: null,
      hint: 'show-face',
      detection: {
        lastProcessedAtMs: 16,
        lastDetectedAtMs: 16,
        stale: true,
      },
    });

    adapter.stop();
    expect(track.stopped).toBe(true);
    expect(worker.terminated).toBe(true);
    expect(adapter.sample(64)).toEqual(createIdleCameraSnapshot());
  });

  it('throttles inference requests to the configured 100-200ms cadence', async () => {
    const clock = new FakeAnimationClock();
    const worker = new FakeWorker();
    const adapter = new MediaPipeFaceAdapter({
      getUserMedia: async () => new FakeMediaStream([new FakeMediaStreamTrack()]) as unknown as MediaStream,
      createVideoElement: () => new FakeVideoElement(),
      createImageBitmap: async () => new FakeImageBitmap() as unknown as ImageBitmap,
      createWorker: () => worker,
      requestAnimationFrame: clock.requestAnimationFrame,
      cancelAnimationFrame: clock.cancelAnimationFrame,
      isSecureContext: () => true,
      warmupTimeoutMs: 50,
      inferenceIntervalMs: 120,
    });

    const startPromise = adapter.start();
    await waitFor(() => worker.postedMessages.length === 1);
    worker.emitMessage({ type: 'ready', requestId: 0 });
    await waitFor(() => clock.callbacks.size === 1);
    clock.flushNext(0);
    await flushMicrotasks();
    worker.emitMessage({
      type: 'result',
      requestId: 1,
      timestampMs: 0,
      faceBox: {
        centerX: 0.5,
        centerY: 0.5,
        width: 0.24,
        height: 0.3,
      },
    });
    await startPromise;

    await waitFor(() => clock.callbacks.size === 1);
    clock.flushNext(16);
    await flushMicrotasks();
    await waitFor(() => clock.callbacks.size === 1);
    clock.flushNext(80);
    await flushMicrotasks();
    await waitFor(() => clock.callbacks.size === 1);
    clock.flushNext(119);
    await flushMicrotasks();

    expect(inferMessages(worker)).toHaveLength(1);

    await waitFor(() => clock.callbacks.size === 1);
    clock.flushNext(120);
    await flushMicrotasks();

    expect(inferMessages(worker).map((message) => message.timestampMs)).toEqual([0, 120]);
  });
});
