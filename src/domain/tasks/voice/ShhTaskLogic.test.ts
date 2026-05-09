import { describe, expect, it } from 'vitest';

import { createIdleInputFrame } from '../../input/InputFrame';
import { updateShhTask } from './ShhTaskLogic';
import type { ShhTaskState } from '../TaskTypes';

function createShhTask(): ShhTaskState {
  return {
    id: 'shh-1',
    kind: 'shh',
    channel: 'microphone',
    inputType: 'microphone',
    title: 'しーっ',
    summary: '小さな声を保つ',
    urgency: 'attention',
    lifecycle: 'active',
    progress: 0,
    startedAtMs: 0,
    updatedAtMs: 0,
    targetHoldMs: 3_000,
    heldMs: 0,
    silentMs: 0,
    stability: 'silent',
  };
}

describe('ShhTaskLogic', () => {
  it('adds hold time while the voice stays in the stable band', () => {
    const input = createIdleInputFrame(1_000);
    input.microphone.ready = true;
    input.microphone.isSpeaking = true;
    input.microphone.rms = 0.12;
    input.microphone.stability = 0.9;

    const result = updateShhTask(createShhTask(), input, 1_000);
    const task = result.task as ShhTaskState;

    expect(task.heldMs).toBe(1_000);
    expect(task.stability).toBe('stable');
    expect(result.gaugeDelta?.babyMood).toBeGreaterThan(0);
  });

  it('fails after silence continues for too long', () => {
    const task = createShhTask();
    task.heldMs = 800;
    task.progress = 800 / task.targetHoldMs;
    const input = createIdleInputFrame(1_500);
    input.microphone.ready = true;

    const result = updateShhTask(task, input, 1_000);
    const nextTask = result.task as ShhTaskState;

    expect(nextTask.lifecycle).toBe('failed');
    expect(result.scoreDelta?.failureCount).toBe(1);
  });

  it('penalizes too loud input', () => {
    const input = createIdleInputFrame(500);
    input.microphone.ready = true;
    input.microphone.isSpeaking = true;
    input.microphone.isTooLoud = true;
    input.microphone.rms = 0.4;

    const result = updateShhTask(createShhTask(), input, 500);
    const task = result.task as ShhTaskState;

    expect(task.stability).toBe('loud');
    expect(result.gaugeDelta).toEqual(
      expect.objectContaining({
        babyMood: -4,
        parentStress: 4,
      }),
    );
  });
});
