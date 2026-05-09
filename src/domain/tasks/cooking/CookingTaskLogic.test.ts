import { describe, expect, it } from 'vitest';

import { createIdleInputFrame } from '../../input/InputFrame';
import { updateCookingTask } from './CookingTaskLogic';
import type { CookingTaskState } from '../TaskTypes';

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
    progress: 0,
    startedAtMs: 0,
    updatedAtMs: 0,
    step: 'select',
    cue: 'safe',
    stepProgress: 0,
    temperature: 24,
    quality: 100,
    isHeating: false,
    isReady: false,
  };
}

describe('CookingTaskLogic', () => {
  it('advances from select to mash on primary click', () => {
    const input = createIdleInputFrame(100);
    input.mouse.primaryReleased = true;

    const result = updateCookingTask(createCookingTask(), input, 100);
    const task = result.task as CookingTaskState;

    expect(task.step).toBe('mash');
    expect(result.gaugeDelta?.parentStress).toBeLessThan(0);
  });

  it('accumulates mash progress from circular-like mouse motion and advances to heat', () => {
    const task = createCookingTask();
    task.step = 'mash';
    task.stepProgress = 0.8;
    const input = createIdleInputFrame(1_000);
    input.mouse.buttonsDown = ['left'];
    input.mouse.delta = { x: 14, y: 12 };

    const result = updateCookingTask(task, input, 500);
    const nextTask = result.task as CookingTaskState;

    expect(nextTask.step).toBe('heat');
    expect(nextTask.stepProgress).toBe(0);
  });

  it('raises temperature while heating', () => {
    const task = createCookingTask();
    task.step = 'heat';
    task.temperature = 40;
    const input = createIdleInputFrame(2_000);
    input.mouse.buttonsDown = ['left'];

    const result = updateCookingTask(task, input, 1_000);
    const nextTask = result.task as CookingTaskState;

    expect(nextTask.temperature).toBeGreaterThan(40);
    expect(nextTask.isHeating).toBe(true);
  });

  it('fails with penalties when the food burns', () => {
    const task = createCookingTask();
    task.step = 'heat';
    task.temperature = 98;
    task.isHeating = true;
    const input = createIdleInputFrame(3_000);
    input.mouse.buttonsDown = ['left'];

    const result = updateCookingTask(task, input, 1_000);
    const nextTask = result.task as CookingTaskState;

    expect(nextTask.lifecycle).toBe('failed');
    expect(result.gaugeDelta).toEqual(
      expect.objectContaining({
        babyMood: -15,
        parentStress: 15,
      }),
    );
  });

  it('completes feeding and rewards both gauges', () => {
    const task = createCookingTask();
    task.step = 'feed';
    task.stepProgress = 0.75;
    task.temperature = 48;
    task.quality = 92;
    task.isReady = true;
    const input = createIdleInputFrame(4_000);
    input.mouse.buttonsDown = ['left'];
    input.mouse.delta = { x: 12, y: 10 };

    const result = updateCookingTask(task, input, 500);
    const nextTask = result.task as CookingTaskState;

    expect(nextTask.lifecycle).toBe('completed');
    expect(result.gaugeDelta?.babyMood).toBeGreaterThan(0);
    expect(result.gaugeDelta?.parentStress).toBeLessThan(0);
    expect(result.scoreDelta?.successCount).toBe(1);
  });
});
