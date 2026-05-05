import { describe, expect, it } from 'vitest';

import { createGameViewModel, createInitialGameState, createSceneViewModel } from '../../app/runtime/GameViewModelFactory';
import type { GameCommand } from './GameCommand';
import type { GameEvent } from './GameEvent';
import { createIdleInputFrame } from '../input/InputFrame';

describe('shared game contracts', () => {
  it('provides an initial state with shared gauges, task limits, and result counters', () => {
    const state = createInitialGameState();

    expect(state.phase).toBe('title');
    expect(state.gauges.babyMood.current).toBe(100);
    expect(state.gauges.parentStress.current).toBe(0);
    expect(state.taskLimits.totalActive).toBe(4);
    expect(state.taskLimits.handTasks).toBe(2);
    expect(state.taskLimits.sensorTasks).toBe(2);
    expect(state.taskLimits.microphoneTasks).toBe(1);
    expect(state.taskLimits.cameraTasks).toBe(1);
    expect(state.metrics.successCount).toBe(0);
    expect(state.metrics.partialCount).toBe(0);
    expect(state.metrics.comboCount).toBe(0);
    expect(state.metrics.failureCount).toBe(0);
    expect(state.result).toBeNull();
  });

  it('provides an idle input frame with all normalized input channels', () => {
    const input = createIdleInputFrame(1234);

    expect(input.sampledAtMs).toBe(1234);
    expect(input.keyboard.pressedKeys).toEqual([]);
    expect(input.mouse.buttonsDown).toEqual([]);
    expect(input.microphone.permission).toBe('prompt');
    expect(input.camera.permission).toBe('prompt');
  });

  it('builds a game view model and scene view model from the same state shape', () => {
    const state = createInitialGameState();
    const gameViewModel = createGameViewModel(state);
    const sceneViewModel = createSceneViewModel(state);

    expect(gameViewModel.phase).toBe(state.phase);
    expect(gameViewModel.hud.remainingTimeLabel).toBe('05:00');
    expect(gameViewModel.hud.tasks.maxConcurrent).toBe(4);
    expect(gameViewModel.hud.sensors.microphone.label).toBe('未確認');
    expect(gameViewModel.hud.sensors.camera.label).toBe('未確認');
    expect(gameViewModel.result).toBeNull();

    expect(sceneViewModel.phase).toBe(state.phase);
    expect(sceneViewModel.scene).toBe('title');
    expect(sceneViewModel.focusedTask).toBeNull();
  });

  it('defines compatible command and event contracts for runtime transitions', () => {
    const command: GameCommand = { type: 'focusHandTask', taskId: null };
    const event: GameEvent = { type: 'phaseChanged', phase: 'ready' };

    expect(command.type).toBe('focusHandTask');
    expect(event.type).toBe('phaseChanged');
  });
});
