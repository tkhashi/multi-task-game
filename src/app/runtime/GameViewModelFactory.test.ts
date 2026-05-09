import { describe, expect, it } from 'vitest';

import type { CameraHint } from '../../domain/input/CameraSnapshot';
import type { CleanupTaskState, CookingTaskState } from '../../domain/tasks/TaskTypes';
import { createInitialGameState, createGameViewModel } from './GameViewModelFactory';
import { createSceneViewModel } from './GameViewModelFactory';

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

describe('createSceneViewModel cleanup mapping', () => {
  function createCleanupTask(): CleanupTaskState {
    return {
      id: 'cleanup-1',
      kind: 'cleanup',
      channel: 'hand',
      inputType: 'keyboard',
      title: 'おもちゃの片付け',
      summary: '散らかったおもちゃを収納する',
      urgency: 'urgent',
      lifecycle: 'active',
      progress: 1 / 3,
      startedAtMs: 0,
      updatedAtMs: 1_000,
      totalItems: 3,
      storedItems: 1,
      remainingItems: 2,
      playerPosition: { x: 5, y: 3 },
      carriedItemId: 'block-2',
      items: [
        {
          id: 'duck-1',
          label: 'あひる',
          targetStorage: 'basket',
          pickupReward: 1,
          storeReward: 2,
          position: { x: 2, y: 2 },
          picked: false,
          stored: false,
        },
        {
          id: 'block-2',
          label: 'つみき',
          targetStorage: 'box',
          pickupReward: 1,
          storeReward: 2,
          position: { x: 5, y: 3 },
          picked: true,
          stored: false,
        },
        {
          id: 'spoon-3',
          label: 'スプーン',
          targetStorage: 'kitchen',
          pickupReward: 1,
          storeReward: 2,
          position: { x: 8.8, y: 5.2 },
          picked: false,
          stored: true,
        },
      ],
    };
  }

  it('includes cleanup field entities for the focused cleanup task', () => {
    const state = createInitialGameState();
    const cleanupTask = createCleanupTask();

    state.phase = 'playing';
    state.focusedHandTaskId = cleanupTask.id;
    state.activeTasks[cleanupTask.id] = cleanupTask;

    const sceneViewModel = createSceneViewModel(state);

    expect(sceneViewModel.scene).toBe('cleanup');
    expect(sceneViewModel.cleanup).not.toBeNull();
    expect(sceneViewModel.cleanup?.player.carrying).toBe(true);
    expect(sceneViewModel.cleanup?.items).toHaveLength(3);
    expect(sceneViewModel.cleanup?.items.find((item) => item.id === 'block-2')).toMatchObject({
      carrying: true,
      visible: true,
    });
    expect(sceneViewModel.cleanup?.items.find((item) => item.id === 'spoon-3')).toMatchObject({
      stored: true,
      visible: false,
    });
    expect(sceneViewModel.cleanup?.storages.map((storage) => storage.kind)).toEqual([
      'basket',
      'box',
      'kitchen',
    ]);
  });
});

describe('createSceneViewModel cooking mapping', () => {
  function createCookingTask(): CookingTaskState {
    return {
      id: 'cooking-1',
      kind: 'cooking',
      channel: 'hand',
      inputType: 'mouse',
      title: 'ベビーフード作り',
      summary: '工程を進める',
      urgency: 'attention',
      lifecycle: 'active',
      progress: 0.64,
      startedAtMs: 0,
      updatedAtMs: 2_000,
      step: 'heat',
      cue: 'soon',
      stepProgress: 0.35,
      temperature: 76,
      quality: 88,
      isHeating: true,
      isReady: false,
    };
  }

  it('includes cooking scene details for the focused cooking task', () => {
    const state = createInitialGameState();
    const cookingTask = createCookingTask();

    state.phase = 'playing';
    state.focusedHandTaskId = cookingTask.id;
    state.activeTasks[cookingTask.id] = cookingTask;

    const sceneViewModel = createSceneViewModel(state);

    expect(sceneViewModel.scene).toBe('cooking');
    expect(sceneViewModel.cooking).not.toBeNull();
    expect(sceneViewModel.cooking).toMatchObject({
      step: 'heat',
      cueLabel: 'そろそろ',
      qualityLabel: 'なめらか',
      isHeating: true,
    });
    expect(sceneViewModel.cooking?.temperatureBand).toBe('hot');
  });
});
