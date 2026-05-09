import type { InputFrame } from '../../input/InputFrame';
import type { TaskUpdateResult } from '../TaskRegistry';
import type { CookingCue, CookingTaskState } from '../TaskTypes';

const MASH_PROGRESS_PER_SECOND = 0.55;
const FEED_PROGRESS_PER_SECOND = 0.7;
const HEAT_RISE_PER_SECOND = 24;
const COOL_DROP_PER_SECOND = 18;
const COOL_READY_TEMPERATURE = 52;
const COOL_TOO_COLD_TEMPERATURE = 28;
const PERFECT_HEAT_MIN = 68;
const PERFECT_HEAT_MAX = 82;
const DANGER_HEAT_MAX = 95;
const BURN_TEMPERATURE = 100;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function withCue(task: CookingTaskState): CookingTaskState {
  let cue: CookingCue = task.cue;
  switch (task.step) {
    case 'select':
      cue = task.stepProgress >= 1 ? 'now' : 'safe';
      break;
    case 'mash':
      cue = task.stepProgress >= 0.8 ? 'now' : task.stepProgress >= 0.45 ? 'soon' : 'safe';
      break;
    case 'heat':
      if (task.temperature >= BURN_TEMPERATURE) {
        cue = 'danger';
      } else if (task.temperature >= PERFECT_HEAT_MIN && task.temperature <= PERFECT_HEAT_MAX) {
        cue = 'now';
      } else if (task.temperature > PERFECT_HEAT_MAX) {
        cue = 'danger';
      } else if (task.temperature >= PERFECT_HEAT_MIN - 12) {
        cue = 'soon';
      } else {
        cue = 'safe';
      }
      break;
    case 'cool':
      if (task.temperature <= COOL_TOO_COLD_TEMPERATURE) {
        cue = 'danger';
      } else if (task.temperature <= COOL_READY_TEMPERATURE) {
        cue = 'now';
      } else if (task.temperature <= COOL_READY_TEMPERATURE + 12) {
        cue = 'soon';
      } else {
        cue = 'safe';
      }
      break;
    case 'feed':
      cue = task.stepProgress >= 0.75 ? 'now' : task.stepProgress >= 0.35 ? 'soon' : 'safe';
      break;
  }

  return {
    ...task,
    cue,
  };
}

function isPrimaryClick(input: InputFrame): boolean {
  return input.mouse.primaryReleased;
}

function movementMagnitude(input: InputFrame): number {
  return Math.hypot(input.mouse.delta.x, input.mouse.delta.y);
}

export function updateCookingTask(
  task: CookingTaskState,
  input: InputFrame,
  dtMs: number,
): TaskUpdateResult {
  if (task.lifecycle !== 'active') {
    return { task };
  }

  let nextTask: CookingTaskState = {
    ...task,
    updatedAtMs: input.sampledAtMs,
  };
  let gaugeDelta: TaskUpdateResult['gaugeDelta'];
  let scoreDelta: TaskUpdateResult['scoreDelta'];

  switch (task.step) {
    case 'select': {
      if (isPrimaryClick(input)) {
        nextTask = {
          ...nextTask,
          step: 'mash',
          stepProgress: 0,
        };
        gaugeDelta = {
          parentStress: -1,
          reason: 'cookingStepAdvance',
        };
      }
      break;
    }
    case 'mash': {
      const progressGain =
        input.mouse.buttonsDown.includes('left') && movementMagnitude(input) > 12
          ? MASH_PROGRESS_PER_SECOND * (dtMs / 1_000)
          : 0;
      const nextProgress = clamp(task.stepProgress + progressGain, 0, 1);
      nextTask = {
        ...nextTask,
        stepProgress: nextProgress,
      };
      if (nextProgress >= 1) {
        nextTask = {
          ...nextTask,
          step: 'heat',
          stepProgress: 0,
          isHeating: false,
        };
        gaugeDelta = {
          parentStress: -2,
          reason: 'cookingStepAdvance',
        };
      }
      break;
    }
    case 'heat': {
      const heating = input.mouse.buttonsDown.includes('left');
      const nextTemperature = clamp(
        task.temperature + (heating ? HEAT_RISE_PER_SECOND * (dtMs / 1_000) : 0),
        0,
        120,
      );
      nextTask = {
        ...nextTask,
        isHeating: heating,
        temperature: nextTemperature,
      };

      if (nextTemperature >= BURN_TEMPERATURE) {
        nextTask = {
          ...nextTask,
          lifecycle: 'failed',
        };
        gaugeDelta = {
          babyMood: -15,
          parentStress: 15,
          reason: 'cookingBurned',
        };
        scoreDelta = {
          points: -60,
          failureCount: 1,
          resetCombo: true,
          reason: 'cookingBurned',
        };
        break;
      }

      if (task.isHeating && input.mouse.primaryReleased) {
        const qualityPenalty =
          nextTemperature > PERFECT_HEAT_MAX ? 15 : nextTemperature < PERFECT_HEAT_MIN ? 10 : 0;
        nextTask = {
          ...nextTask,
          step: 'cool',
          stepProgress: 0,
          isHeating: false,
          quality: clamp(task.quality - qualityPenalty, 0, 100),
        };
        gaugeDelta = {
          parentStress: -2,
          reason: 'cookingStepAdvance',
        };
      }
      break;
    }
    case 'cool': {
      const nextTemperature = clamp(task.temperature - COOL_DROP_PER_SECOND * (dtMs / 1_000), 0, 120);
      const tooCold = nextTemperature < COOL_TOO_COLD_TEMPERATURE;
      nextTask = {
        ...nextTask,
        temperature: nextTemperature,
        quality: tooCold ? clamp(task.quality - 8, 0, 100) : task.quality,
      };

      if (nextTemperature <= COOL_READY_TEMPERATURE) {
        nextTask = {
          ...nextTask,
          step: 'feed',
          stepProgress: 0,
          isReady: true,
        };
        gaugeDelta = {
          parentStress: -1,
          reason: 'cookingStepAdvance',
        };
      }
      break;
    }
    case 'feed': {
      const progressGain =
        input.mouse.buttonsDown.includes('left') && movementMagnitude(input) > 10
          ? FEED_PROGRESS_PER_SECOND * (dtMs / 1_000)
          : 0;
      const nextProgress = clamp(task.stepProgress + progressGain, 0, 1);
      nextTask = {
        ...nextTask,
        stepProgress: nextProgress,
      };

      if (nextProgress >= 1) {
        nextTask = {
          ...nextTask,
          lifecycle: 'completed',
        };
        const highQuality = task.quality >= 80;
        gaugeDelta = {
          babyMood: highQuality ? 25 : 20,
          parentStress: highQuality ? -12 : -10,
          reason: 'cookingCompleted',
        };
        scoreDelta = {
          points: highQuality ? 180 : 140,
          comboIncrement: 1,
          successCount: 1,
          reason: 'cookingCompleted',
        };
      }
      break;
    }
  }

  return {
    task: withCue(nextTask),
    gaugeDelta,
    scoreDelta,
  };
}
