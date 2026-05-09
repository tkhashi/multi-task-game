import type { InputFrame } from '../../input/InputFrame';
import type { CameraHint, NormalizedFaceBox } from '../../input/CameraSnapshot';
import type { TaskUpdateResult } from '../TaskRegistry';
import type { FaceAlignTaskState } from '../TaskTypes';

const TARGET_FACE_BOX: NormalizedFaceBox = {
  centerX: 0.5,
  centerY: 0.5,
  width: 0.24,
  height: 0.3,
};
const CENTER_TOLERANCE = 0.08;
const SIZE_TOLERANCE = 0.05;
const MISSING_FACE_PENALTY_AFTER_MS = 1_000;

function resolveHint(faceBox: NormalizedFaceBox | null): CameraHint {
  if (!faceBox) {
    return 'show-face';
  }

  if (faceBox.centerX < TARGET_FACE_BOX.centerX - CENTER_TOLERANCE) {
    return 'move-right';
  }
  if (faceBox.centerX > TARGET_FACE_BOX.centerX + CENTER_TOLERANCE) {
    return 'move-left';
  }
  if (faceBox.centerY < TARGET_FACE_BOX.centerY - CENTER_TOLERANCE) {
    return 'move-down';
  }
  if (faceBox.centerY > TARGET_FACE_BOX.centerY + CENTER_TOLERANCE) {
    return 'move-up';
  }
  if (faceBox.width < TARGET_FACE_BOX.width - SIZE_TOLERANCE) {
    return 'move-forward';
  }
  if (faceBox.width > TARGET_FACE_BOX.width + SIZE_TOLERANCE) {
    return 'move-back';
  }

  return 'hold';
}

function requiredHoldMs(task: FaceAlignTaskState): number {
  return 1_500 * task.targetSlots;
}

export function updateFacePositionTask(
  task: FaceAlignTaskState,
  input: InputFrame,
  dtMs: number,
): TaskUpdateResult {
  if (task.lifecycle !== 'active') {
    return { task };
  }

  const snapshot = input.camera;
  const faceVisible =
    snapshot.faceDetected && !snapshot.detection.stale && snapshot.faceBox !== null;
  const hint = resolveHint(faceVisible ? snapshot.faceBox : null);
  const nextMissingMs = faceVisible ? 0 : task.missingMs + dtMs;
  const nextHeldMs = hint === 'hold' ? task.heldMs + dtMs : 0;
  const completed = nextHeldMs >= requiredHoldMs(task);

  const nextTask: FaceAlignTaskState = {
    ...task,
    heldMs: Math.min(nextHeldMs, requiredHoldMs(task)),
    missingMs: nextMissingMs,
    hint,
    progress: Math.min(1, nextHeldMs / requiredHoldMs(task)),
    updatedAtMs: input.sampledAtMs,
    lifecycle: completed ? 'completed' : 'active',
    urgency: completed ? 'stable' : hint === 'hold' ? 'attention' : 'urgent',
  };

  if (!faceVisible) {
    return {
      task: nextTask,
      gaugeDelta:
        nextMissingMs >= MISSING_FACE_PENALTY_AFTER_MS
          ? {
              parentStress: 3 * (dtMs / 1_000),
              reason: 'faceAlignMissing',
            }
          : undefined,
    };
  }

  if (completed) {
    return {
      task: nextTask,
      gaugeDelta: {
        babyMood: 10 + task.targetSlots * 4,
        reason: 'faceAlignCompleted',
      },
      scoreDelta: {
        points: 110 + task.targetSlots * 30,
        comboIncrement: 1,
        successCount: 1,
        reason: 'faceAlignCompleted',
      },
    };
  }

  return {
    task: nextTask,
  };
}
