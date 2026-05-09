import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import type { AudioAnalyzerPort } from '../adapters/audio/AudioAnalyzerPort';
import type { FaceCalibration, FaceDetectorPort } from '../adapters/camera/FaceDetectorPort';
import { createIdleCameraSnapshot } from '../domain/input/CameraSnapshot';
import { createIdleMicrophoneSnapshot } from '../domain/input/MicrophoneSnapshot';
import { App } from './App';
import { createGameRuntime } from './bootstrap/createGameRuntime';

function flushMicrotasks(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

class FakeAudioAnalyzer implements AudioAnalyzerPort {
  snapshot = createIdleMicrophoneSnapshot();

  async start() {
    this.snapshot = {
      permission: 'granted',
      readiness: 'ready',
      ready: true,
      rms: 0.08,
      peak: 0.12,
      stability: 0.32,
      isSpeaking: false,
      isTooLoud: false,
    };

    return {
      ok: true as const,
      value: {
        noiseFloor: 0.03,
        speakingThreshold: 0.1,
        tooLoudThreshold: 0.35,
      },
    };
  }

  stop(): void {
    this.snapshot = createIdleMicrophoneSnapshot();
  }

  sample() {
    return this.snapshot;
  }
}

class FakeFaceDetector implements FaceDetectorPort {
  snapshot = createIdleCameraSnapshot();

  async start() {
    const baselineFaceBox = {
      centerX: 0.68,
      centerY: 0.5,
      width: 0.22,
      height: 0.28,
    };
    this.snapshot = {
      permission: 'granted',
      readiness: 'ready',
      ready: true,
      faceDetected: true,
      faceBox: baselineFaceBox,
      hint: 'move-left',
      detection: {
        lastProcessedAtMs: 1234,
        lastDetectedAtMs: 1234,
        stale: false,
      },
    };

    return {
      ok: true as const,
      value: {
        baselineFaceBox,
      } satisfies FaceCalibration,
    };
  }

  stop(): void {
    this.snapshot = createIdleCameraSnapshot();
  }

  sample() {
    return this.snapshot;
  }
}

describe('App', () => {
  it('renders the title screen placeholder', () => {
    const markup = renderToStaticMarkup(<App />);

    expect(markup).toContain('育児マルチタスクゲーム');
    expect(markup).toContain('タイトル画面プレースホルダー');
    expect(markup).toContain('ゲームビューを準備中');
  });

  it('renders the latest runtime phase instead of a hard-coded initial state', () => {
    const runtime = createGameRuntime();

    runtime.dispatch({ type: 'openPermissionCheck' });
    const markup = renderToStaticMarkup(<App runtime={runtime} />);

    expect(markup).toContain('開始前確認');
    expect(markup).toContain('音声と映像はブラウザ内でのみ処理されます');
  });

  it('renders command-only controls for the current runtime phase', () => {
    const runtime = createGameRuntime();

    runtime.dispatch({ type: 'openPermissionCheck' });
    const markup = renderToStaticMarkup(<App runtime={runtime} />);

    expect(markup).toContain('デバイス確認を始める');
    expect(markup).not.toContain('マイクを許可');
    expect(markup).not.toContain('カメラを許可');
  });

  it('renders setup guidance for environment audio and camera direction after device check', async () => {
    const runtime = createGameRuntime({
      audioAnalyzer: new FakeAudioAnalyzer(),
      faceDetector: new FakeFaceDetector(),
      clock: { nowMs: () => 1234 },
    });

    runtime.dispatch({ type: 'openPermissionCheck' });
    runtime.dispatch({ type: 'beginDeviceCheck' });
    await flushMicrotasks();

    const markup = renderToStaticMarkup(<App runtime={runtime} />);

    expect(markup).toContain('環境音');
    expect(markup).toContain('静かな場所');
    expect(markup).toContain('もう少し左へ移動してください。');
  });
});
