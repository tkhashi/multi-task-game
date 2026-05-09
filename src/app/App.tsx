import { useSyncExternalStore } from 'react';

import type { GameCommand } from '../domain/game/GameCommand';
import type { GameState } from '../domain/game/GameState';
import { getSharedGameRuntime } from './bootstrap/createGameRuntime';
import {
  runtimeFeatureFlags,
  type GameRuntimeService,
  type RuntimeSnapshot,
} from './runtime/GameRuntime';
import {
  createGameViewModel,
  createInitialGameState,
  createSceneViewModel,
} from './runtime/GameViewModelFactory';
import { TitleScreen } from '../ui/screens/TitleScreen';

type ScreenAction = {
  label: string;
  command: GameCommand;
};

type AppProps = {
  runtime?: GameRuntimeService;
};

function createStaticSnapshot(): RuntimeSnapshot {
  const state = createInitialGameState();

  return {
    state,
    viewModel: createGameViewModel(state),
    sceneViewModel: createSceneViewModel(state),
  };
}

function actionsForState(state: GameState): ScreenAction[] {
  switch (state.phase) {
    case 'title':
      return [{ label: '開始前確認へ', command: { type: 'openPermissionCheck' } }];
    case 'permissionCheck':
      return [{ label: 'デバイス確認を始める', command: { type: 'beginDeviceCheck' } }];
    case 'deviceCheck':
      return [{ label: 'もう一度確認する', command: { type: 'beginDeviceCheck' } }];
    case 'ready':
      return [{ label: '本編を開始', command: { type: 'startSession' } }];
    case 'playing':
      return [{ label: '一時停止', command: { type: 'pauseSession' } }];
    case 'paused':
      return [
        { label: '再開', command: { type: 'resumeSession' } },
        { label: 'タイトルへ戻る', command: { type: 'returnToTitle' } },
      ];
    case 'gameOver':
      return [{ label: 'リトライ', command: { type: 'retrySession' } }];
    case 'result':
      return [{ label: 'リトライ', command: { type: 'retrySession' } }];
  }
}

export function App({ runtime = getSharedGameRuntime() }: AppProps) {
  const staticSnapshot = createStaticSnapshot();
  const snapshot = runtimeFeatureFlags.phaseRoutingPrototype
    ? useSyncExternalStore(
        (listener) => runtime.subscribe(listener),
        () => runtime.getSnapshot(),
        () => runtime.getSnapshot(),
      )
    : staticSnapshot;

  const actions = actionsForState(snapshot.state);

  return (
    <TitleScreen
      viewModel={snapshot.viewModel}
      sceneViewModel={snapshot.sceneViewModel}
      actions={actions}
      onAction={(action) => {
        runtime.dispatch(action.command);
      }}
    />
  );
}
