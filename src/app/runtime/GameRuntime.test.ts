import { describe, expect, it } from 'vitest';

import type { AudioAnalyzerPort, Result as AudioResult } from '../../adapters/audio/AudioAnalyzerPort';
import type { FaceCalibration, FaceDetectorPort, Result as FaceResult } from '../../adapters/camera/FaceDetectorPort';
import { createIdleCameraSnapshot } from '../../domain/input/CameraSnapshot';
import { createIdleMicrophoneSnapshot } from '../../domain/input/MicrophoneSnapshot';
import { createGameRuntime } from '../bootstrap/createGameRuntime';

function flushMicrotasks(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

class FakeAudioAnalyzer implements AudioAnalyzerPort {
  readonly #results: Array<AudioResult<{ noiseFloor: number; speakingThreshold: number; tooLoudThreshold: number }, { kind: 'permissionDenied' } | { kind: 'deviceUnavailable' } | { kind: 'calibrationFailed' }>>;
  snapshot = createIdleMicrophoneSnapshot();
  startCalls = 0;
  stopCalls = 0;

  constructor(
    results: Array<
      AudioResult<
        { noiseFloor: number; speakingThreshold: number; tooLoudThreshold: number },
        { kind: 'permissionDenied' } | { kind: 'deviceUnavailable' } | { kind: 'calibrationFailed' }
      >
    >,
  ) {
    this.#results = [...results];
  }

  async start() {
    this.startCalls += 1;
    const result = this.#results.shift();
    if (!result) {
      throw new Error('missing fake audio result');
    }

    if (result.ok) {
      this.snapshot = {
        permission: 'granted',
        readiness: 'ready',
        ready: true,
        rms: 0.12,
        peak: 0.24,
        stability: 0.88,
        isSpeaking: true,
        isTooLoud: false,
      };
    } else {
      this.snapshot = createIdleMicrophoneSnapshot();
    }

    return result;
  }

  stop(): void {
    this.stopCalls += 1;
    this.snapshot = createIdleMicrophoneSnapshot();
  }

  sample() {
    return this.snapshot;
  }
}

class FakeFaceDetector implements FaceDetectorPort {
  readonly #results: Array<FaceResult<FaceCalibration, { kind: 'permissionDenied' } | { kind: 'deviceUnavailable' } | { kind: 'deviceUnavailable'; detail: 'faceNotDetected' | 'warmupTimedOut' | 'inferenceFailed' } | { kind: 'modelLoadFailed' } | { kind: 'workerStartupFailed' }>>;
  snapshot = createIdleCameraSnapshot();
  startCalls = 0;
  stopCalls = 0;

  constructor(
    results: Array<
      FaceResult<
        FaceCalibration,
        | { kind: 'permissionDenied' }
        | { kind: 'deviceUnavailable' }
        | { kind: 'deviceUnavailable'; detail: 'faceNotDetected' | 'warmupTimedOut' | 'inferenceFailed' }
        | { kind: 'modelLoadFailed' }
        | { kind: 'workerStartupFailed' }
      >
    >,
  ) {
    this.#results = [...results];
  }

  async start() {
    this.startCalls += 1;
    const result = this.#results.shift();
    if (!result) {
      throw new Error('missing fake camera result');
    }

    if (result.ok) {
      this.snapshot = {
        permission: 'granted',
        readiness: 'ready',
        ready: true,
        faceDetected: true,
        faceBox: result.value.baselineFaceBox,
        hint: 'hold',
        detection: {
          lastProcessedAtMs: 2000,
          lastDetectedAtMs: 2000,
          stale: false,
        },
      };
    } else {
      this.snapshot = createIdleCameraSnapshot();
    }

    return result;
  }

  stop(): void {
    this.stopCalls += 1;
    this.snapshot = createIdleCameraSnapshot();
  }

  sample() {
    return this.snapshot;
  }
}

describe('GameRuntime', () => {
  it('dispatches setup commands, notifies subscribers, and exposes the latest view model', async () => {
    const runtime = createGameRuntime({
      clock: { nowMs: () => 1000 },
      audioAnalyzer: new FakeAudioAnalyzer([
        {
          ok: true,
          value: {
            noiseFloor: 0.02,
            speakingThreshold: 0.08,
            tooLoudThreshold: 0.35,
          },
        },
      ]),
      faceDetector: new FakeFaceDetector([
        {
          ok: true,
          value: {
            baselineFaceBox: {
              centerX: 0.5,
              centerY: 0.5,
              width: 0.24,
              height: 0.3,
            },
          },
        },
      ]),
    });
    const snapshots: string[] = [];

    const unsubscribe = runtime.subscribe(() => {
      snapshots.push(runtime.getViewModel().phase);
    });

    runtime.dispatch({ type: 'openPermissionCheck' });
    runtime.dispatch({ type: 'beginDeviceCheck' });
    await flushMicrotasks();

    unsubscribe();

    const update = runtime.getSnapshot();
    expect(snapshots).toEqual(['permissionCheck', 'deviceCheck', 'ready']);
    expect(update.state.phase).toBe('ready');
    expect(update.viewModel.phase).toBe('ready');
    expect(update.sceneViewModel.phase).toBe('ready');
    expect(update.state.session.audioCalibration).toEqual({
      noiseFloor: 0.02,
      speakingThreshold: 0.08,
      tooLoudThreshold: 0.35,
    });
    expect(update.state.session.faceCalibration).toEqual({
      targetCenterX: 0.5,
      targetCenterY: 0.5,
      targetSize: 0.24,
    });
    expect(runtime.getViewModel().screen.title).toBe('開始待機');
  });

  it('keeps deviceCheck active on failure, surfaces retryable sensor state, and reaches ready after retry succeeds', async () => {
    const runtime = createGameRuntime({
      clock: { nowMs: () => 2000 },
      audioAnalyzer: new FakeAudioAnalyzer([
        {
          ok: false,
          error: { kind: 'permissionDenied' },
        },
        {
          ok: true,
          value: {
            noiseFloor: 0.03,
            speakingThreshold: 0.09,
            tooLoudThreshold: 0.36,
          },
        },
      ]),
      faceDetector: new FakeFaceDetector([
        {
          ok: true,
          value: {
            baselineFaceBox: {
              centerX: 0.45,
              centerY: 0.52,
              width: 0.26,
              height: 0.31,
            },
          },
        },
        {
          ok: true,
          value: {
            baselineFaceBox: {
              centerX: 0.48,
              centerY: 0.5,
              width: 0.25,
              height: 0.3,
            },
          },
        },
      ]),
    });

    runtime.dispatch({ type: 'openPermissionCheck' });
    runtime.dispatch({ type: 'beginDeviceCheck' });
    await flushMicrotasks();

    expect(runtime.getState().phase).toBe('deviceCheck');
    expect(runtime.getState().session.microphone.permission).toBe('denied');
    expect(runtime.getViewModel().hud.sensors.microphone.label).toBe('拒否されています');
    expect(runtime.getViewModel().hud.sensors.camera.label).toBe('利用可能');
    expect(runtime.getState().session.audioCalibration).toBeNull();
    expect(runtime.getState().session.faceCalibration).toEqual({
      targetCenterX: 0.45,
      targetCenterY: 0.52,
      targetSize: 0.26,
    });

    runtime.dispatch({ type: 'beginDeviceCheck' });
    await flushMicrotasks();

    expect(runtime.getState().phase).toBe('ready');
    expect(runtime.getViewModel().hud.sensors.microphone.label).toBe('利用可能');
    expect(runtime.getViewModel().hud.sensors.camera.label).toBe('利用可能');
  });

  it('keeps tick as phase-safe no-op plumbing and supports command-driven phase changes', async () => {
    const runtime = createGameRuntime({
      audioAnalyzer: new FakeAudioAnalyzer([
        {
          ok: true,
          value: {
            noiseFloor: 0.02,
            speakingThreshold: 0.08,
            tooLoudThreshold: 0.35,
          },
        },
      ]),
      faceDetector: new FakeFaceDetector([
        {
          ok: true,
          value: {
            baselineFaceBox: {
              centerX: 0.5,
              centerY: 0.5,
              width: 0.24,
              height: 0.3,
            },
          },
        },
      ]),
    });

    runtime.dispatch({ type: 'openPermissionCheck' });
    runtime.dispatch({ type: 'beginDeviceCheck' });
    await flushMicrotasks();
    runtime.dispatch({ type: 'startSession' });

    const playingTickUpdate = runtime.tick(1000);
    const pausedUpdate = runtime.dispatch({ type: 'pauseSession' });
    const pausedTickUpdate = runtime.tick(1000);
    const resumedUpdate = runtime.dispatch({ type: 'resumeSession' });
    const finishedUpdate = runtime.dispatch({ type: 'finishSession', outcome: 'timeout' });
    const retryUpdate = runtime.dispatch({ type: 'retrySession' });

    expect(playingTickUpdate.changed).toBe(false);
    expect(playingTickUpdate.events).toEqual([]);
    expect(playingTickUpdate.state.phase).toBe('playing');
    expect(playingTickUpdate.state.elapsedMs).toBe(0);
    expect(playingTickUpdate.state.remainingMs).toBe(300000);
    expect(pausedUpdate.state.phase).toBe('paused');
    expect(pausedTickUpdate.changed).toBe(false);
    expect(pausedTickUpdate.state.phase).toBe('paused');
    expect(pausedTickUpdate.state.elapsedMs).toBe(0);
    expect(pausedTickUpdate.state.remainingMs).toBe(300000);
    expect(resumedUpdate.state.phase).toBe('playing');
    expect(finishedUpdate.state.phase).toBe('result');
    expect(retryUpdate.state.phase).toBe('title');
    expect(retryUpdate.state.elapsedMs).toBe(0);
    expect(retryUpdate.viewModel.screen.title).toBe('育児マルチタスクゲーム');
  });
});
