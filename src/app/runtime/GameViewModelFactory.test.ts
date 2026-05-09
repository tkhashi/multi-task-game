import { describe, expect, it } from 'vitest';

import type { CameraHint } from '../../domain/input/CameraSnapshot';
import { createInitialGameState, createGameViewModel } from './GameViewModelFactory';

describe('GameViewModelFactory setup guidance', () => {
  it.each<
    [CameraHint, string]
  >([
    ['show-face', '顔全体をカメラの中央に映してください。'],
    ['move-left', 'もう少し左へ移動してください。'],
    ['move-right', 'もう少し右へ移動してください。'],
    ['move-up', 'もう少し上へ移動してください。'],
    ['move-down', 'もう少し下へ移動してください。'],
    ['move-forward', 'カメラに少し近づいてください。'],
    ['move-back', 'カメラから少し離れてください。'],
    ['hold', 'その位置で顔をキープしてください。'],
  ])('maps camera hint %s into setup guidance', (hint, expected) => {
    const state = createInitialGameState();
    state.phase = 'deviceCheck';
    state.session.camera.readiness = 'checking';

    const viewModel = createGameViewModel(state, {
      microphone: null,
      camera: {
        snapshot: {
          permission: 'granted',
          readiness: 'ready',
          ready: true,
          faceDetected: hint !== 'show-face',
          faceBox:
            hint === 'show-face'
              ? null
              : {
                  centerX: 0.5,
                  centerY: 0.5,
                  width: 0.22,
                  height: 0.28,
                },
          hint,
          detection: {
            lastProcessedAtMs: 1234,
            lastDetectedAtMs: hint === 'show-face' ? null : 1234,
            stale: false,
          },
        },
        calibration: {
          targetCenterX: 0.5,
          targetCenterY: 0.5,
          targetSize: 0.22,
        },
      },
    });

    expect(viewModel.hud.sensors.camera.helperText).toContain(expected);
  });

  it('surfaces environment-audio guidance from microphone calibration and snapshot', () => {
    const state = createInitialGameState();
    state.phase = 'ready';
    state.session.microphone.ready = true;

    const viewModel = createGameViewModel(state, {
      microphone: {
        snapshot: {
          permission: 'granted',
          readiness: 'ready',
          ready: true,
          rms: 0.09,
          peak: 0.14,
          stability: 0.41,
          isSpeaking: false,
          isTooLoud: false,
        },
        calibration: {
          noiseFloor: 0.03,
          speakingThreshold: 0.1,
          tooLoudThreshold: 0.35,
        },
      },
      camera: null,
    });

    expect(viewModel.hud.sensors.microphone.helperText).toContain('環境音');
    expect(viewModel.hud.sensors.microphone.helperText).toContain('静かな');
  });
});
