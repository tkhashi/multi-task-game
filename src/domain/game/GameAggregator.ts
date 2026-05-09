import type { InputFrame } from '../input/InputFrame';
import type { GameCommand } from './GameCommand';
import type { GameEvent, GameOverReason } from './GameEvent';
import { createInitialGameState, type GameOutcome, type GamePhase, type GameState } from './GameState';
import { applyGaugeTick } from './GaugeReducer';
import { applyScoreDelta, createGameResult } from './ScoreReducer';

export interface GameUpdateResult {
  state: GameState;
  events: GameEvent[];
}

export interface GameAggregatorService {
  tick(state: GameState, input: InputFrame, dtMs: number): GameUpdateResult;
  dispatch(state: GameState, command: GameCommand): GameUpdateResult;
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

class GameAggregator implements GameAggregatorService {
  tick(state: GameState, input: InputFrame, dtMs: number): GameUpdateResult {
    void input;

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

    const gaugeResult = applyGaugeTick(progressState, boundedDtMs, {
      nowMs: progressState.elapsedMs,
      reason: 'timeProgress',
    });
    const scored = applyScoreDelta(
      {
        ...progressState,
        gauges: gaugeResult.gauges,
        collapseTimers: gaugeResult.collapseTimers,
        warnings: gaugeResult.warnings,
      },
      {},
    );

    const nextState: GameState = {
      ...progressState,
      gauges: gaugeResult.gauges,
      collapseTimers: gaugeResult.collapseTimers,
      warnings: gaugeResult.warnings,
      score: scored.score,
      metrics: scored.metrics,
    };
    const events = [...gaugeResult.events, ...scored.events];

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

export const gameAggregator: GameAggregatorService = new GameAggregator();
