import { describe, expect, it } from 'vitest';

import { createIdleInputFrame } from '../../input/InputFrame';
import { updateVoiceRhythmTask } from './VoiceRhythmTaskLogic';
import type { VoiceRhythmTaskState } from '../TaskTypes';

function createVoiceTask(): VoiceRhythmTaskState {
  return {
    id: 'voice-1',
    kind: 'voiceRhythm',
    channel: 'microphone',
    inputType: 'microphone',
    title: '呼びかけ連打',
    summary: '短い声かけであやす',
    urgency: 'attention',
    lifecycle: 'active',
    progress: 0,
    startedAtMs: 0,
    updatedAtMs: 0,
    noteCount: 4,
    judgedCount: 0,
    hitCount: 0,
    missCount: 0,
    tooLoudCount: 0,
    lastJudgement: 'idle',
  };
}

describe('VoiceRhythmTaskLogic', () => {
  it('judges speaking near the note center as perfect', () => {
    const input = createIdleInputFrame(1_080);
    input.microphone.ready = true;
    input.microphone.isSpeaking = true;

    const result = updateVoiceRhythmTask(createVoiceTask(), input, 16);
    const task = result.task as VoiceRhythmTaskState;

    expect(task.lastJudgement).toBe('perfect');
    expect(task.hitCount).toBe(1);
    expect(result.gaugeDelta?.babyMood).toBeGreaterThan(0);
    expect(result.scoreDelta?.points).toBeGreaterThan(0);
  });

  it('treats too loud input as a penalty even when the timing is correct', () => {
    const input = createIdleInputFrame(1_000);
    input.microphone.ready = true;
    input.microphone.isSpeaking = true;
    input.microphone.isTooLoud = true;

    const result = updateVoiceRhythmTask(createVoiceTask(), input, 16);
    const task = result.task as VoiceRhythmTaskState;

    expect(task.lastJudgement).toBe('tooLoud');
    expect(task.tooLoudCount).toBe(1);
    expect(result.gaugeDelta).toEqual(
      expect.objectContaining({
        babyMood: -6,
        parentStress: 5,
      }),
    );
  });

  it('completes with a stronger finish bonus when the hit rate is high', () => {
    const task = createVoiceTask();
    task.judgedCount = 3;
    task.hitCount = 2;
    task.missCount = 1;
    task.progress = 0.75;
    const input = createIdleInputFrame(3_700);
    input.microphone.ready = true;
    input.microphone.isSpeaking = true;

    const result = updateVoiceRhythmTask(task, input, 16);
    const nextTask = result.task as VoiceRhythmTaskState;

    expect(nextTask.lifecycle).toBe('completed');
    expect(result.gaugeDelta?.babyMood).toBeGreaterThanOrEqual(12);
    expect(result.scoreDelta?.successCount).toBe(1);
  });
});
