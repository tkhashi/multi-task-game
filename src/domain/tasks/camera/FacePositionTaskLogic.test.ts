import { describe, expect, it } from 'vitest';

import { createIdleInputFrame } from '../../input/InputFrame';
import { updateFacePositionTask } from './FacePositionTaskLogic';
import type { FaceAlignTaskState } from '../TaskTypes';

function createFaceTask(): FaceAlignTaskState {
  return {
    id: 'face-1',
    kind: 'faceAlign',
    channel: 'camera',
    inputType: 'camera',
    title: '顔ポジション',
    summary: '顔を目標位置へ合わせる',
    urgency: 'attention',
    lifecycle: 'active',
    progress: 0,
    startedAtMs: 0,
    updatedAtMs: 0,
    targetSlots: 1,
    heldMs: 0,
    missingMs: 0,
    hint: 'show-face',
  };
}

describe('FacePositionTaskLogic', () => {
  it('returns directional hints when the face is off target', () => {
    const input = createIdleInputFrame(1_000);
    input.camera.ready = true;
    input.camera.faceDetected = true;
    input.camera.faceBox = {
      centerX: 0.3,
      centerY: 0.5,
      width: 0.24,
      height: 0.3,
    };
    input.camera.detection = {
      lastProcessedAtMs: 1_000,
      lastDetectedAtMs: 1_000,
      stale: false,
    };

    const result = updateFacePositionTask(createFaceTask(), input, 500);
    const task = result.task as FaceAlignTaskState;

    expect(task.hint).toBe('move-right');
    expect(task.heldMs).toBe(0);
  });

  it('adds parent stress when the face stays missing for too long', () => {
    const task = createFaceTask();
    task.missingMs = 800;
    const input = createIdleInputFrame(1_500);
    input.camera.ready = true;
    input.camera.detection = {
      lastProcessedAtMs: 1_500,
      lastDetectedAtMs: null,
      stale: false,
    };

    const result = updateFacePositionTask(task, input, 500);
    const nextTask = result.task as FaceAlignTaskState;

    expect(nextTask.hint).toBe('show-face');
    expect(nextTask.missingMs).toBe(1_300);
    expect(result.gaugeDelta?.parentStress).toBeGreaterThan(0);
  });

  it('completes after holding the aligned face long enough', () => {
    const task = createFaceTask();
    task.heldMs = 1_200;
    task.progress = 1_200 / 1_500;
    const input = createIdleInputFrame(1_800);
    input.camera.ready = true;
    input.camera.faceDetected = true;
    input.camera.faceBox = {
      centerX: 0.5,
      centerY: 0.5,
      width: 0.24,
      height: 0.3,
    };
    input.camera.detection = {
      lastProcessedAtMs: 1_800,
      lastDetectedAtMs: 1_800,
      stale: false,
    };

    const result = updateFacePositionTask(task, input, 400);
    const nextTask = result.task as FaceAlignTaskState;

    expect(nextTask.lifecycle).toBe('completed');
    expect(nextTask.hint).toBe('hold');
    expect(result.gaugeDelta?.babyMood).toBeGreaterThan(0);
    expect(result.scoreDelta?.successCount).toBe(1);
  });
});
