import type { InputFrame } from '../input/InputFrame';
import type { RandomPort } from '../../app/runtime/RandomPort';
import type { GameCommand } from './GameCommand';
import type { GameEvent, GameOverReason } from './GameEvent';
import { createInitialGameState, type GameOutcome, type GamePhase, type GameState } from './GameState';
import { gameScheduler, createTaskFromSpawn, type GameSchedulerService } from './GameScheduler';
import { applyGaugeTick } from './GaugeReducer';
import { applyScoreDelta, createGameResult, type ScoreDelta } from './ScoreReducer';
import { mathRandom } from '../../app/runtime/RandomPort';
import { taskRegistry, type TaskGaugeDelta, type TaskRegistryService } from '../tasks/TaskRegistry';
import type { TaskInstanceState } from '../tasks/TaskTypes';

export interface GameUpdateResult {
  state: GameState;
  events: GameEvent[];
}

export interface GameAggregatorService {
  tick(state: GameState, input: InputFrame, dtMs: number): GameUpdateResult;
  dispatch(state: GameState, command: GameCommand): GameUpdateResult;
}

export interface GameAggregatorDependencies {
  random?: RandomPort;
  scheduler?: GameSchedulerService;
  taskRegistry?: TaskRegistryService;
}

function withPhaseEvent(events: GameEvent[], previousPhase: GamePhase, nextPhase: GamePhase): GameEvent[] {
  if (previousPhase === nextPhase) {
    return events;
  }

  return [...events, { type: 'phaseChanged', phase: nextPhase }];
}

function setSensorUsage(state: GameState, inUse: boolean): GameState {
  return {
    ...state,
    session: {
      ...state.session,
      microphone: {
        ...state.session.microphone,
        inUse,
      },
      camera: {
        ...state.session.camera,
        inUse,
      },
    },
  };
}

function finishWithResult(state: GameState, outcome: GameOutcome, events: GameEvent[]): GameUpdateResult {
  const nextPhase: GamePhase = outcome === 'gameOver' ? 'gameOver' : 'result';
  const nextStateBase = setSensorUsage(state, false);
  const result = createGameResult(nextStateBase, outcome);
  const nextState: GameState = {
    ...nextStateBase,
    phase: nextPhase,
    result,
  };
  const phaseEvents = withPhaseEvent(events, state.phase, nextPhase);
  const completionEvents: GameEvent[] =
    outcome === 'gameOver'
      ? [{ type: 'sessionFinished', outcome }]
      : [
          { type: 'gameCleared', result },
          { type: 'sessionFinished', outcome },
        ];

  return {
    state: nextState,
    events: [...phaseEvents, ...completionEvents],
  };
}

function finishGameOver(
  state: GameState,
  reason: GameOverReason,
  events: GameEvent[],
): GameUpdateResult {
  const gameOverEvent: GameEvent = {
    type: 'gameOver',
    reason,
  };

  return finishWithResult(state, 'gameOver', [...events, gameOverEvent]);
}

function resolveFocusedHandTaskId(
  currentTaskId: string | null,
  activeTasks: Record<string, TaskInstanceState>,
): string | null {
  if (currentTaskId) {
    const currentTask = activeTasks[currentTaskId];
    if (currentTask && currentTask.channel === 'hand') {
      return currentTaskId;
    }
  }

  return (
    Object.values(activeTasks).find((task) => task.channel === 'hand')?.id ?? null
  );
}

function appendFocusChangeEvent(
  events: GameEvent[],
  previousTaskId: string | null,
  nextTaskId: string | null,
): GameEvent[] {
  if (previousTaskId === nextTaskId) {
    return events;
  }

  return [...events, { type: 'focusChanged', taskId: nextTaskId }];
}

function aggregateGaugeDeltas(deltas: TaskGaugeDelta[]): TaskGaugeDelta {
  return deltas.reduce<TaskGaugeDelta>(
    (accumulator, delta) => ({
      babyMood: (accumulator.babyMood ?? 0) + (delta.babyMood ?? 0),
      parentStress: (accumulator.parentStress ?? 0) + (delta.parentStress ?? 0),
      reason: delta.reason ?? accumulator.reason,
    }),
    {},
  );
}

function aggregateScoreDeltas(deltas: ScoreDelta[]): ScoreDelta {
  return deltas.reduce<ScoreDelta>(
    (accumulator, delta) => ({
      points: (accumulator.points ?? 0) + (delta.points ?? 0),
      comboIncrement: (accumulator.comboIncrement ?? 0) + (delta.comboIncrement ?? 0),
      resetCombo: accumulator.resetCombo || delta.resetCombo,
      successCount: (accumulator.successCount ?? 0) + (delta.successCount ?? 0),
      partialCount: (accumulator.partialCount ?? 0) + (delta.partialCount ?? 0),
      comboCount: (accumulator.comboCount ?? 0) + (delta.comboCount ?? 0),
      failureCount: (accumulator.failureCount ?? 0) + (delta.failureCount ?? 0),
      reason: delta.reason ?? accumulator.reason,
    }),
    {},
  );
}

class GameAggregator implements GameAggregatorService {
  readonly #random: RandomPort;
  readonly #scheduler: GameSchedulerService;
  readonly #taskRegistry: TaskRegistryService;

  constructor({
    random = mathRandom,
    scheduler = gameScheduler,
    taskRegistry: registry = taskRegistry,
  }: GameAggregatorDependencies = {}) {
    this.#random = random;
    this.#scheduler = scheduler;
    this.#taskRegistry = registry;
  }

  tick(state: GameState, input: InputFrame, dtMs: number): GameUpdateResult {
    if (state.phase !== 'playing' || dtMs <= 0) {
      return {
        state,
        events: [],
      };
    }

    const boundedDtMs = Math.max(0, Math.min(dtMs, state.remainingMs));
    const progressState: GameState = {
      ...state,
      elapsedMs: state.elapsedMs + boundedDtMs,
      remainingMs: Math.max(0, state.remainingMs - boundedDtMs),
    };
    const activeTasks: Record<string, TaskInstanceState> = {
      ...state.activeTasks,
    };
    let taskEvents: GameEvent[] = [];

    for (const spawn of this.#scheduler.planSpawns(progressState, this.#random)) {
      const task = createTaskFromSpawn(spawn, progressState.elapsedMs);
      activeTasks[task.id] = task;
      taskEvents.push({
        type: 'taskSpawned',
        taskId: task.id,
        taskKind: task.kind,
      });
    }

    const gaugeDeltas: TaskGaugeDelta[] = [];
    const scoreDeltas: ScoreDelta[] = [];
    for (const task of Object.values(activeTasks)) {
      const update = this.#taskRegistry.updateTask(task, input, boundedDtMs);
      if (update.task) {
        activeTasks[task.id] = update.task;
        if (update.task.lifecycle === 'completed') {
          delete activeTasks[task.id];
          taskEvents.push({
            type: 'taskCompleted',
            taskId: update.task.id,
            taskKind: update.task.kind,
          });
        } else if (update.task.lifecycle === 'failed') {
          delete activeTasks[task.id];
          taskEvents.push({
            type: 'taskFailed',
            taskId: update.task.id,
            taskKind: update.task.kind,
          });
        }
      } else {
        delete activeTasks[task.id];
      }

      if (update.gaugeDelta) {
        gaugeDeltas.push(update.gaugeDelta);
      }
      if (update.scoreDelta) {
        scoreDeltas.push(update.scoreDelta);
      }
      if (update.events) {
        taskEvents = [...taskEvents, ...update.events];
      }
    }

    const focusedHandTaskId = resolveFocusedHandTaskId(state.focusedHandTaskId, activeTasks);
    taskEvents = appendFocusChangeEvent(taskEvents, state.focusedHandTaskId, focusedHandTaskId);

    const gaugeResult = applyGaugeTick(progressState, boundedDtMs, {
      nowMs: progressState.elapsedMs,
      reason: aggregateGaugeDeltas(gaugeDeltas).reason ?? 'timeProgress',
      babyMoodDelta: aggregateGaugeDeltas(gaugeDeltas).babyMood,
      parentStressDelta: aggregateGaugeDeltas(gaugeDeltas).parentStress,
    });
    const scored = applyScoreDelta(
      {
        ...progressState,
        gauges: gaugeResult.gauges,
        collapseTimers: gaugeResult.collapseTimers,
        warnings: gaugeResult.warnings,
        activeTasks,
        focusedHandTaskId,
      },
      aggregateScoreDeltas(scoreDeltas),
    );

    const nextState: GameState = {
      ...progressState,
      gauges: gaugeResult.gauges,
      collapseTimers: gaugeResult.collapseTimers,
      warnings: gaugeResult.warnings,
      score: scored.score,
      metrics: scored.metrics,
      activeTasks,
      focusedHandTaskId,
    };
    const events = [...taskEvents, ...gaugeResult.events, ...scored.events];

    if (gaugeResult.collapseReason) {
      return finishGameOver(nextState, gaugeResult.collapseReason, events);
    }

    if (nextState.remainingMs === 0) {
      return finishWithResult(nextState, 'timeout', events);
    }

    return {
      state: nextState,
      events,
    };
  }

  dispatch(state: GameState, command: GameCommand): GameUpdateResult {
    switch (command.type) {
      case 'startSession':
        if (
          state.phase === 'ready' &&
          state.session.microphone.ready &&
          state.session.camera.ready
        ) {
          return {
            state: setSensorUsage(
              {
                ...state,
                phase: 'playing',
              },
              true,
            ),
            events: [{ type: 'phaseChanged', phase: 'playing' }],
          };
        }
        break;
      case 'pauseSession':
        if (state.phase === 'playing') {
          return {
            state: {
              ...state,
              phase: 'paused',
            },
            events: [{ type: 'phaseChanged', phase: 'paused' }],
          };
        }
        break;
      case 'resumeSession':
        if (state.phase === 'paused') {
          return {
            state: {
              ...state,
              phase: 'playing',
            },
            events: [{ type: 'phaseChanged', phase: 'playing' }],
          };
        }
        break;
      case 'focusHandTask':
        if (state.focusedHandTaskId !== command.taskId) {
          return {
            state: {
              ...state,
              focusedHandTaskId: command.taskId,
            },
            events: [{ type: 'focusChanged', taskId: command.taskId }],
          };
        }
        break;
      case 'finishSession':
        return finishWithResult(state, command.outcome, []);
      case 'returnToTitle':
      case 'retrySession':
        return {
          state: createInitialGameState(),
          events: [{ type: 'phaseChanged', phase: 'title' }],
        };
      default:
        break;
    }

    return {
      state,
      events: [],
    };
  }
}

export function createGameAggregator(
  dependencies: GameAggregatorDependencies = {},
): GameAggregatorService {
  return new GameAggregator(dependencies);
}

export const gameAggregator: GameAggregatorService = createGameAggregator();
