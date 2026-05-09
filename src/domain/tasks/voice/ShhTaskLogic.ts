import type { InputFrame } from '../../input/InputFrame';
import type { TaskUpdateResult } from '../TaskRegistry';
import type { ShhTaskState, ShhStability } from '../TaskTypes';

const STABLE_RMS_MAX = 0.18;
const STABLE_STABILITY_MIN = 0.7;
const SILENCE_FAILURE_MS = 1_000;

function classifyStability(task: ShhTaskState, input: InputFrame): ShhStability {
  if (input.microphone.isTooLoud) {
    return 'loud';
  }

  if (!input.microphone.isSpeaking) {
    return 'silent';
  }

  if (
    input.microphone.rms <= STABLE_RMS_MAX &&
    input.microphone.stability >= STABLE_STABILITY_MIN
  ) {
    return 'stable';
  }

  return 'shaky';
}

export function updateShhTask(task: ShhTaskState, input: InputFrame, dtMs: number): TaskUpdateResult {
  if (task.lifecycle !== 'active') {
    return { task };
  }

  const stability = classifyStability(task, input);
  const nextHeldMs = stability === 'stable' ? task.heldMs + dtMs : task.heldMs;
  const nextSilentMs = stability === 'silent' ? task.silentMs + dtMs : 0;
  const completed = nextHeldMs >= task.targetHoldMs;
  const failed = nextSilentMs >= SILENCE_FAILURE_MS;

  const nextTask: ShhTaskState = {
    ...task,
    heldMs: Math.min(nextHeldMs, task.targetHoldMs),
    silentMs: nextSilentMs,
    stability,
    progress: Math.min(1, nextHeldMs / task.targetHoldMs),
    updatedAtMs: input.sampledAtMs,
    lifecycle: completed ? 'completed' : failed ? 'failed' : 'active',
    urgency: completed ? 'stable' : failed ? 'critical' : task.urgency,
  };

  if (stability === 'loud') {
    return {
      task: nextTask,
      gaugeDelta: {
        babyMood: -4,
        parentStress: 4,
        reason: 'shhTooLoud',
      },
      scoreDelta: {
        points: -20,
        resetCombo: true,
        reason: 'shhTooLoud',
      },
    };
  }

  if (failed) {
    return {
      task: nextTask,
      scoreDelta: {
        failureCount: 1,
        resetCombo: true,
        reason: 'shhSilenceFailed',
      },
    };
  }

  if (completed) {
    return {
      task: nextTask,
      gaugeDelta: {
        babyMood: 12,
        reason: 'shhCompleted',
      },
      scoreDelta: {
        points: 100,
        comboIncrement: 1,
        successCount: 1,
        reason: 'shhCompleted',
      },
    };
  }

  if (stability === 'stable') {
    return {
      task: nextTask,
      gaugeDelta: {
        babyMood: 0.3 * (dtMs / 1_000),
        reason: 'shhHolding',
      },
    };
  }

  return {
    task: nextTask,
  };
}
