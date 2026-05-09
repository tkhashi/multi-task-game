import type { GameCommand } from '../../domain/game/GameCommand';
import type { GameEvent } from '../../domain/game/GameEvent';
import { createInitialGameState, type DeviceChannelState, type GamePhase, type GameState } from '../../domain/game/GameState';
import type { AudioAnalyzerPort, InputDeviceError as AudioInputDeviceError } from '../../adapters/audio/AudioAnalyzerPort';
import type { FaceDetectorPort, FaceDeviceError } from '../../adapters/camera/FaceDetectorPort';
import type { InputFrameCollectorPort } from '../../adapters/input/InputFrameCollector';
import {
  gameViewModelFactory,
  type GameViewModel,
  type GameViewModelFactory,
  type SceneViewModel,
  type SetupGuidanceViewModelInput,
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
  audioAnalyzer?: AudioAnalyzerPort;
  faceDetector?: FaceDetectorPort;
  inputFrameCollector?: InputFrameCollectorPort;
}

function createSnapshot(
  state: GameState,
  viewModelFactory: GameViewModelFactory,
  setupGuidance: SetupGuidanceViewModelInput,
): RuntimeSnapshot {
  return {
    state,
    viewModel: viewModelFactory.createGameViewModel(state, setupGuidance),
    sceneViewModel: viewModelFactory.createSceneViewModel(state),
  };
}

function deviceErrorMessage(device: 'microphone' | 'camera'): string {
  return device === 'microphone'
    ? 'マイク権限を許可してから再試行してください。'
    : 'カメラ権限を許可してから再試行してください。';
}

function audioErrorMessage(error: AudioInputDeviceError): string {
  switch (error.kind) {
    case 'permissionDenied':
      return 'ブラウザの権限設定でマイクを許可してから再試行してください。';
    case 'deviceUnavailable':
      return 'マイク入力を確認できませんでした。環境音や接続状態を見直して再試行してください。';
    case 'calibrationFailed':
      return 'マイクの初期計測に失敗しました。静かな場所で再試行してください。';
  }
}

function cameraErrorMessage(error: FaceDeviceError): string {
  switch (error.kind) {
    case 'permissionDenied':
      return 'ブラウザの権限設定でカメラを許可してから再試行してください。';
    case 'modelLoadFailed':
      return '顔検出モデルを読み込めませんでした。ページを再読み込みして再試行してください。';
    case 'workerStartupFailed':
      return '顔検出ワーカーを起動できませんでした。別タブを閉じて再試行してください。';
    case 'deviceUnavailable':
      switch ('detail' in error ? error.detail : undefined) {
        case 'faceNotDetected':
          return '顔をカメラ中央に映してから再試行してください。';
        case 'warmupTimedOut':
          return '顔検出の準備が間に合いませんでした。照明と距離を見直して再試行してください。';
        case 'inferenceFailed':
          return '顔検出に失敗しました。カメラの向きと明るさを見直して再試行してください。';
        default:
          return 'カメラ映像を確認できませんでした。接続状態を見直して再試行してください。';
      }
  }
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

function withCollectedDeviceState(
  state: GameState,
  device: 'microphone' | 'camera',
  nextDeviceState: DeviceChannelState,
): GameState {
  return updateDevice(state, device, () => nextDeviceState);
}

function collectDeviceCheckState(
  state: GameState,
  collector: InputFrameCollectorPort,
  sampledAtMs: number,
): [GameState, GameEvent[]] {
  const frame = collector.collect(sampledAtMs);
  const microphoneState: DeviceChannelState = {
    ...state.session.microphone,
    permission: frame.microphone.permission,
    readiness: frame.microphone.ready ? 'ready' : frame.microphone.readiness,
    ready: frame.microphone.ready,
    inUse: false,
    lastError: frame.microphone.ready ? null : state.session.microphone.lastError,
  };
  const cameraState: DeviceChannelState = {
    ...state.session.camera,
    permission: frame.camera.permission,
    readiness: frame.camera.ready ? 'ready' : frame.camera.readiness,
    ready: frame.camera.ready,
    inUse: false,
    lastError: frame.camera.ready ? null : state.session.camera.lastError,
  };

  let nextState = withCollectedDeviceState(state, 'microphone', microphoneState);
  nextState = withCollectedDeviceState(nextState, 'camera', cameraState);

  let events: GameEvent[] = [];
  events = withSensorReadinessEvent(events, 'microphone', state.session.microphone, microphoneState);
  events = withSensorReadinessEvent(events, 'camera', state.session.camera, cameraState);

  const nextPhase: GamePhase =
    microphoneState.ready && cameraState.ready ? 'ready' : 'deviceCheck';
  nextState = {
    ...nextState,
    phase: nextPhase,
  };
  events = withPhaseEvent(events, state.phase, nextPhase);

  return [nextState, events];
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
        const nextPermission: DeviceChannelState['permission'] =
          previous.permission === 'unsupported' ? 'unsupported' : 'prompt';
        const nextDeviceState: DeviceChannelState = {
          ...previous,
          permission: nextPermission,
          readiness: 'checking' as const,
          ready: false,
          inUse: false,
          lastError: null,
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
      return [state, []];
    }
    default:
      return [state, []];
  }
}

export class GameRuntime implements GameRuntimeService {
  readonly #clock: ClockPort;
  readonly #random: RandomPort;
  readonly #store: GameStore;
  readonly #viewModelFactory: GameViewModelFactory;
  readonly #audioAnalyzer: AudioAnalyzerPort | null;
  readonly #faceDetector: FaceDetectorPort | null;
  readonly #inputFrameCollector: InputFrameCollectorPort | null;
  #snapshot: RuntimeSnapshot;
  #deviceCheckRunId = 0;
  #setupGuidance: SetupGuidanceViewModelInput = {
    microphone: null,
    camera: null,
  };

  constructor({
    clock = systemClock,
    random = mathRandom,
    store = new InMemoryGameStore(createInitialGameState()),
    viewModelFactory = gameViewModelFactory,
    audioAnalyzer,
    faceDetector,
    inputFrameCollector,
  }: GameRuntimeDependencies = {}) {
    this.#clock = clock;
    this.#random = random;
    this.#store = store;
    this.#viewModelFactory = viewModelFactory;
    this.#audioAnalyzer = audioAnalyzer ?? null;
    this.#faceDetector = faceDetector ?? null;
    this.#inputFrameCollector = inputFrameCollector ?? null;
    this.#snapshot = createSnapshot(this.#store.getState(), this.#viewModelFactory, this.#setupGuidance);
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
        [nextState, events] = applySetupCommand(currentState, command);
        if (command.type === 'openPermissionCheck') {
          this.#cancelDeviceCheck();
          this.#setupGuidance = {
            microphone: null,
            camera: null,
          };
        }
        break;
      case 'beginDeviceCheck':
        [nextState, events] = applySetupCommand(currentState, command);
        this.#cancelDeviceCheck();
        this.#setupGuidance = {
          microphone: null,
          camera: null,
        };
        void this.#runDeviceCheck();
        break;
      case 'completeDeviceCheck':
        if (this.#inputFrameCollector) {
          [nextState, events] = collectDeviceCheckState(
            currentState,
            this.#inputFrameCollector,
            this.#clock.nowMs(),
          );
        } else {
          [nextState, events] = applySetupCommand(currentState, command);
        }
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
        this.#cancelDeviceCheck();
        this.#setupGuidance = {
          microphone: null,
          camera: null,
        };
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

  async #runDeviceCheck(): Promise<void> {
    if (!this.#audioAnalyzer || !this.#faceDetector) {
      return;
    }

    const runId = ++this.#deviceCheckRunId;
    const [audioResult, cameraResult] = await Promise.all([
      this.#audioAnalyzer.start(),
      this.#faceDetector.start(),
    ]);

    if (runId !== this.#deviceCheckRunId) {
      return;
    }

    const currentState = this.#store.getState();
    if (currentState.phase !== 'deviceCheck') {
      return;
    }

    const sampledAtMs = this.#clock.nowMs();
    const collectedFrame = this.#inputFrameCollector?.collect(sampledAtMs);
    let nextState = currentState;
    let events: GameEvent[] = [];

    this.#setupGuidance = {
      microphone: collectedFrame
        ? {
            snapshot: collectedFrame.microphone,
            calibration: audioResult.ok ? audioResult.value : null,
          }
        : null,
      camera: collectedFrame
        ? {
            snapshot: collectedFrame.camera,
            calibration: cameraResult.ok
              ? {
                  targetCenterX: cameraResult.value.baselineFaceBox.centerX,
                  targetCenterY: cameraResult.value.baselineFaceBox.centerY,
                  targetSize: cameraResult.value.baselineFaceBox.width,
                }
              : null,
          }
        : null,
    };

    if (audioResult.ok && collectedFrame) {
      const nextDeviceState: DeviceChannelState = {
        ...currentState.session.microphone,
        permission: collectedFrame.microphone.permission,
        readiness: collectedFrame.microphone.ready ? 'ready' : collectedFrame.microphone.readiness,
        ready: collectedFrame.microphone.ready,
        inUse: false,
        lastError: collectedFrame.microphone.ready
          ? null
          : 'マイク入力を確認できませんでした。再試行してください。',
      };
      nextState = updateDevice(nextState, 'microphone', () => nextDeviceState);
      nextState = {
        ...nextState,
        session: {
          ...nextState.session,
          audioCalibration: audioResult.value,
        },
      };
      events = withSensorReadinessEvent(
        events,
        'microphone',
        currentState.session.microphone,
        nextDeviceState,
      );
    } else if (!audioResult.ok) {
      const nextDeviceState: DeviceChannelState = {
        ...currentState.session.microphone,
        permission: audioResult.error.kind === 'permissionDenied' ? 'denied' : 'prompt',
        readiness: 'error',
        ready: false,
        inUse: false,
        lastError: audioErrorMessage(audioResult.error),
      };
      nextState = updateDevice(nextState, 'microphone', () => nextDeviceState);
      nextState = {
        ...nextState,
        session: {
          ...nextState.session,
          audioCalibration: null,
        },
      };
      events = withSensorReadinessEvent(
        events,
        'microphone',
        currentState.session.microphone,
        nextDeviceState,
      );
    }

    const microphonePrevious =
      nextState === currentState ? currentState.session.microphone : nextState.session.microphone;

    if (cameraResult.ok && collectedFrame) {
      const nextDeviceState: DeviceChannelState = {
        ...nextState.session.camera,
        permission: collectedFrame.camera.permission,
        readiness: collectedFrame.camera.ready ? 'ready' : collectedFrame.camera.readiness,
        ready: collectedFrame.camera.ready,
        inUse: false,
        lastError: collectedFrame.camera.ready
          ? null
          : '顔位置を確認できませんでした。再試行してください。',
      };
      nextState = updateDevice(nextState, 'camera', () => nextDeviceState);
      nextState = {
        ...nextState,
        session: {
          ...nextState.session,
          faceCalibration: {
            targetCenterX: cameraResult.value.baselineFaceBox.centerX,
            targetCenterY: cameraResult.value.baselineFaceBox.centerY,
            targetSize: cameraResult.value.baselineFaceBox.width,
          },
        },
      };
      events = withSensorReadinessEvent(
        events,
        'camera',
        currentState.session.camera,
        nextDeviceState,
      );
    } else if (!cameraResult.ok) {
      const nextDeviceState: DeviceChannelState = {
        ...nextState.session.camera,
        permission: cameraResult.error.kind === 'permissionDenied' ? 'denied' : 'prompt',
        readiness: 'error',
        ready: false,
        inUse: false,
        lastError: cameraErrorMessage(cameraResult.error),
      };
      nextState = updateDevice(nextState, 'camera', () => nextDeviceState);
      nextState = {
        ...nextState,
        session: {
          ...nextState.session,
          faceCalibration: null,
        },
      };
      events = withSensorReadinessEvent(
        events,
        'camera',
        currentState.session.camera,
        nextDeviceState,
      );
    }

    void microphonePrevious;

    const nextPhase: GamePhase =
      nextState.session.microphone.ready && nextState.session.camera.ready ? 'ready' : 'deviceCheck';
    nextState = {
      ...nextState,
      phase: nextPhase,
    };
    events = withPhaseEvent(events, currentState.phase, nextPhase);

    this.#commit(nextState, events);
  }

  #cancelDeviceCheck(): void {
    this.#deviceCheckRunId += 1;
    this.#audioAnalyzer?.stop();
    this.#faceDetector?.stop();
  }

  #commit(nextState: GameState, events: GameEvent[]): GameUpdateResult {
    const currentState = this.#store.getState();
    const changed = !Object.is(currentState, nextState);

    if (!changed) {
      return this.#buildResult(currentState, events, false);
    }

    this.#snapshot = createSnapshot(nextState, this.#viewModelFactory, this.#setupGuidance);
    this.#store.setState(nextState);

    return {
      ...this.#snapshot,
      events,
      changed: true,
    };
  }

  #buildResult(state: GameState, events: GameEvent[], changed: boolean): GameUpdateResult {
    if (!Object.is(this.#snapshot.state, state)) {
      this.#snapshot = createSnapshot(state, this.#viewModelFactory, this.#setupGuidance);
    }

    return {
      ...this.#snapshot,
      events,
      changed,
    };
  }
}
