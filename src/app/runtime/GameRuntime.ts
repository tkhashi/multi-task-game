import type { GameCommand } from '../../domain/game/GameCommand';
import type { GameEvent } from '../../domain/game/GameEvent';
import { createInitialGameState, type DeviceChannelState, type GamePhase, type GameState } from '../../domain/game/GameState';
import {
  gameViewModelFactory,
  type GameViewModel,
  type GameViewModelFactory,
  type SceneViewModel,
} from './GameViewModelFactory';
import type { ClockPort } from './ClockPort';
import { systemClock } from './ClockPort';
import type { GameStore } from './InMemoryGameStore';
import { InMemoryGameStore } from './InMemoryGameStore';
import type { RandomPort } from './RandomPort';
import { mathRandom } from './RandomPort';

export type RuntimeListener = () => void;

export interface RuntimeSnapshot {
  state: GameState;
  viewModel: GameViewModel;
  sceneViewModel: SceneViewModel;
}

export interface GameUpdateResult extends RuntimeSnapshot {
  events: GameEvent[];
  changed: boolean;
}

export interface GameRuntimeService {
  dispatch(command: GameCommand): GameUpdateResult;
  tick(dtMs: number): GameUpdateResult;
  getState(): GameState;
  getViewModel(): GameViewModel;
  getSceneViewModel(): SceneViewModel;
  getSnapshot(): RuntimeSnapshot;
  subscribe(listener: RuntimeListener): () => void;
}

export interface RuntimeFeatureFlags {
  phaseRoutingPrototype: boolean;
}

export const runtimeFeatureFlags: RuntimeFeatureFlags = {
  phaseRoutingPrototype: true,
};

export interface GameRuntimeDependencies {
  clock?: ClockPort;
  random?: RandomPort;
  store?: GameStore;
  viewModelFactory?: GameViewModelFactory;
}

function createSnapshot(
  state: GameState,
  viewModelFactory: GameViewModelFactory,
): RuntimeSnapshot {
  return {
    state,
    viewModel: viewModelFactory.createGameViewModel(state),
    sceneViewModel: viewModelFactory.createSceneViewModel(state),
  };
}

function deviceErrorMessage(device: 'microphone' | 'camera'): string {
  return device === 'microphone'
    ? 'マイク権限を許可してから再試行してください。'
    : 'カメラ権限を許可してから再試行してください。';
}

function withPhaseEvent(events: GameEvent[], prevPhase: GamePhase, nextPhase: GamePhase): GameEvent[] {
  if (prevPhase === nextPhase) {
    return events;
  }

  return [...events, { type: 'phaseChanged', phase: nextPhase }];
}

function withSensorReadinessEvent(
  events: GameEvent[],
  device: 'microphone' | 'camera',
  previous: DeviceChannelState,
  next: DeviceChannelState,
): GameEvent[] {
  if (previous.ready === next.ready) {
    return events;
  }

  return [...events, { type: 'sensorReadinessChanged', device, ready: next.ready }];
}

function updateDevice(
  state: GameState,
  device: 'microphone' | 'camera',
  updater: (channel: DeviceChannelState) => DeviceChannelState,
): GameState {
  return {
    ...state,
    session: {
      ...state.session,
      [device]: updater(state.session[device]),
    },
  };
}

function applySetupCommand(state: GameState, command: GameCommand): [GameState, GameEvent[]] {
  switch (command.type) {
    case 'openPermissionCheck': {
      const nextState = {
        ...state,
        phase: 'permissionCheck' as const,
      };

      return [nextState, [{ type: 'phaseChanged', phase: 'permissionCheck' }]];
    }
    case 'setDevicePermission': {
      const nextState = updateDevice(state, command.device, (channel) => ({
        ...channel,
        permission: command.permission,
        readiness: command.permission === 'granted' ? 'idle' : 'error',
        ready: false,
        inUse: false,
        lastError: command.permission === 'granted' ? null : deviceErrorMessage(command.device),
      }));

      return [nextState, []];
    }
    case 'beginDeviceCheck': {
      let nextState = state;
      let events: GameEvent[] = [];

      for (const device of ['microphone', 'camera'] as const) {
        const previous = nextState.session[device];
        const nextDeviceState =
          previous.permission === 'granted'
            ? {
                ...previous,
                readiness: 'checking' as const,
                ready: false,
                inUse: false,
                lastError: null,
              }
            : {
                ...previous,
                readiness: 'error' as const,
                ready: false,
                inUse: false,
                lastError: deviceErrorMessage(device),
              };

        nextState = updateDevice(nextState, device, () => nextDeviceState);
        events = withSensorReadinessEvent(events, device, previous, nextDeviceState);
      }

      nextState = {
        ...nextState,
        phase: 'deviceCheck',
      };
      events = withPhaseEvent(events, state.phase, nextState.phase);

      return [nextState, events];
    }
    case 'completeDeviceCheck': {
      let nextState = state;
      let events: GameEvent[] = [];
      let allReady = true;

      for (const device of ['microphone', 'camera'] as const) {
        const previous = nextState.session[device];
        const nextDeviceState =
          previous.permission === 'granted'
            ? {
                ...previous,
                readiness: 'ready' as const,
                ready: true,
                inUse: false,
                lastError: null,
              }
            : {
                ...previous,
                readiness: 'error' as const,
                ready: false,
                inUse: false,
                lastError: deviceErrorMessage(device),
              };

        if (!nextDeviceState.ready) {
          allReady = false;
        }

        nextState = updateDevice(nextState, device, () => nextDeviceState);
        events = withSensorReadinessEvent(events, device, previous, nextDeviceState);
      }

      const nextPhase: GamePhase = allReady ? 'ready' : 'deviceCheck';
      nextState = {
        ...nextState,
        phase: nextPhase,
      };
      events = withPhaseEvent(events, state.phase, nextPhase);

      return [nextState, events];
    }
    default:
      return [state, []];
  }
}

export class GameRuntime implements GameRuntimeService {
  readonly #random: RandomPort;
  readonly #store: GameStore;
  readonly #viewModelFactory: GameViewModelFactory;
  #snapshot: RuntimeSnapshot;

  constructor({
    clock = systemClock,
    random = mathRandom,
    store = new InMemoryGameStore(createInitialGameState()),
    viewModelFactory = gameViewModelFactory,
  }: GameRuntimeDependencies = {}) {
    void clock;
    this.#random = random;
    this.#store = store;
    this.#viewModelFactory = viewModelFactory;
    this.#snapshot = createSnapshot(this.#store.getState(), this.#viewModelFactory);
  }

  dispatch(command: GameCommand): GameUpdateResult {
    const currentState = this.#store.getState();

    if (!runtimeFeatureFlags.phaseRoutingPrototype) {
      return this.#buildResult(currentState, [], false);
    }

    const randomSample = this.#random.next();
    void randomSample;

    let nextState = currentState;
    let events: GameEvent[] = [];

    switch (command.type) {
      case 'openPermissionCheck':
      case 'setDevicePermission':
      case 'beginDeviceCheck':
      case 'completeDeviceCheck':
        [nextState, events] = applySetupCommand(currentState, command);
        break;
      case 'startSession':
        if (
          currentState.phase === 'ready' &&
          currentState.session.microphone.ready &&
          currentState.session.camera.ready
        ) {
          nextState = {
            ...currentState,
            phase: 'playing',
            session: {
              ...currentState.session,
              microphone: {
                ...currentState.session.microphone,
                inUse: true,
              },
              camera: {
                ...currentState.session.camera,
                inUse: true,
              },
            },
          };
          events = [{ type: 'phaseChanged', phase: 'playing' }];
        }
        break;
      case 'pauseSession':
        if (currentState.phase === 'playing') {
          nextState = {
            ...currentState,
            phase: 'paused',
          };
          events = [{ type: 'phaseChanged', phase: 'paused' }];
        }
        break;
      case 'resumeSession':
        if (currentState.phase === 'paused') {
          nextState = {
            ...currentState,
            phase: 'playing',
          };
          events = [{ type: 'phaseChanged', phase: 'playing' }];
        }
        break;
      case 'focusHandTask':
        if (currentState.focusedHandTaskId !== command.taskId) {
          nextState = {
            ...currentState,
            focusedHandTaskId: command.taskId,
          };
          events = [{ type: 'focusChanged', taskId: command.taskId }];
        }
        break;
      case 'finishSession':
        if (command.outcome === 'gameOver') {
          nextState = {
            ...currentState,
            phase: 'gameOver',
            result: null,
            session: {
              ...currentState.session,
              microphone: {
                ...currentState.session.microphone,
                inUse: false,
              },
              camera: {
                ...currentState.session.camera,
                inUse: false,
              },
            },
          };
          events = [
            { type: 'phaseChanged', phase: 'gameOver' },
            { type: 'sessionFinished', outcome: 'gameOver' },
          ];
        } else {
          nextState = {
            ...currentState,
            phase: 'result',
            session: {
              ...currentState.session,
              microphone: {
                ...currentState.session.microphone,
                inUse: false,
              },
              camera: {
                ...currentState.session.camera,
                inUse: false,
              },
            },
          };
          events = [
            { type: 'phaseChanged', phase: 'result' },
            { type: 'sessionFinished', outcome: command.outcome },
          ];
        }
        break;
      case 'returnToTitle':
      case 'retrySession':
        nextState = createInitialGameState();
        events = [{ type: 'phaseChanged', phase: 'title' }];
        break;
    }

    return this.#commit(nextState, events);
  }

  tick(dtMs: number): GameUpdateResult {
    void dtMs;
    const currentState = this.#store.getState();

    if (!runtimeFeatureFlags.phaseRoutingPrototype) {
      return this.#buildResult(currentState, [], false);
    }

    if (currentState.phase !== 'playing' && currentState.phase !== 'paused') {
      return this.#buildResult(currentState, [], false);
    }

    return this.#buildResult(currentState, [], false);
  }

  getState(): GameState {
    return this.#snapshot.state;
  }

  getViewModel(): GameViewModel {
    return this.#snapshot.viewModel;
  }

  getSceneViewModel(): SceneViewModel {
    return this.#snapshot.sceneViewModel;
  }

  getSnapshot(): RuntimeSnapshot {
    return this.#snapshot;
  }

  subscribe(listener: RuntimeListener): () => void {
    return this.#store.subscribe(listener);
  }

  #commit(nextState: GameState, events: GameEvent[]): GameUpdateResult {
    const currentState = this.#store.getState();
    const changed = !Object.is(currentState, nextState);

    if (!changed) {
      return this.#buildResult(currentState, events, false);
    }

    this.#snapshot = createSnapshot(nextState, this.#viewModelFactory);
    this.#store.setState(nextState);

    return {
      ...this.#snapshot,
      events,
      changed: true,
    };
  }

  #buildResult(state: GameState, events: GameEvent[], changed: boolean): GameUpdateResult {
    if (!Object.is(this.#snapshot.state, state)) {
      this.#snapshot = createSnapshot(state, this.#viewModelFactory);
    }

    return {
      ...this.#snapshot,
      events,
      changed,
    };
  }
}
