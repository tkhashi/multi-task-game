import type { InputFrame } from '../input/InputFrame';
import type { GameEvent } from '../game/GameEvent';
import type { ScoreDelta } from '../game/ScoreReducer';
import type {
  CleanupTaskState,
  CookingTaskState,
  FaceAlignTaskState,
  ShhTaskState,
  TaskInstanceState,
  TaskKind,
  VoiceRhythmTaskState,
} from './TaskTypes';
import { updateShhTask } from './voice/ShhTaskLogic';
import { updateVoiceRhythmTask } from './voice/VoiceRhythmTaskLogic';
import { updateFacePositionTask } from './camera/FacePositionTaskLogic';

export interface TaskGaugeDelta {
  babyMood?: number;
  parentStress?: number;
  reason?: string;
}

export interface TaskUpdateResult {
  task: TaskInstanceState | null;
  gaugeDelta?: TaskGaugeDelta;
  scoreDelta?: ScoreDelta;
  events?: GameEvent[];
}

export interface TaskLogic<T extends TaskInstanceState> {
  updateTask(task: T, input: InputFrame, dtMs: number): TaskUpdateResult;
}

export interface TaskRegistryService {
  updateTask(task: TaskInstanceState, input: InputFrame, dtMs: number): TaskUpdateResult;
}

type TaskLogicMap = {
  cleanup: TaskLogic<CleanupTaskState>;
  cooking: TaskLogic<CookingTaskState>;
  voiceRhythm: TaskLogic<VoiceRhythmTaskState>;
  shh: TaskLogic<ShhTaskState>;
  faceAlign: TaskLogic<FaceAlignTaskState>;
};

function createNoopLogic<T extends TaskInstanceState>(): TaskLogic<T> {
  return {
    updateTask(task, input, dtMs) {
      return {
        task: {
          ...task,
          updatedAtMs: input.sampledAtMs || task.updatedAtMs + dtMs,
        },
      };
    },
  };
}

function defaultTaskLogics(): TaskLogicMap {
  return {
    cleanup: createNoopLogic<CleanupTaskState>(),
    cooking: createNoopLogic<CookingTaskState>(),
    voiceRhythm: { updateTask: updateVoiceRhythmTask },
    shh: { updateTask: updateShhTask },
    faceAlign: { updateTask: updateFacePositionTask },
  };
}

export class TaskRegistry implements TaskRegistryService {
  readonly #logics: TaskLogicMap;

  constructor(logics: Partial<TaskLogicMap> = {}) {
    this.#logics = {
      ...defaultTaskLogics(),
      ...logics,
    };
  }

  updateTask(task: TaskInstanceState, input: InputFrame, dtMs: number): TaskUpdateResult {
    const logic = this.#logics[task.kind as TaskKind] as TaskLogic<TaskInstanceState> | undefined;
    if (!logic) {
      throw new Error(`Task logic is not registered for ${task.kind}`);
    }

    return logic.updateTask(task, input, dtMs);
  }
}

export const taskRegistry: TaskRegistryService = new TaskRegistry();
