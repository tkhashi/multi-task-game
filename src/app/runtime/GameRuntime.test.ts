import { describe, expect, it } from 'vitest';

import { createGameRuntime } from '../bootstrap/createGameRuntime';

describe('GameRuntime', () => {
  it('dispatches setup commands, notifies subscribers, and exposes the latest view model', () => {
    const runtime = createGameRuntime();
    const snapshots: string[] = [];

    const unsubscribe = runtime.subscribe(() => {
      snapshots.push(runtime.getViewModel().phase);
    });

    runtime.dispatch({ type: 'openPermissionCheck' });
    runtime.dispatch({ type: 'setDevicePermission', device: 'microphone', permission: 'granted' });
    runtime.dispatch({ type: 'setDevicePermission', device: 'camera', permission: 'granted' });
    runtime.dispatch({ type: 'beginDeviceCheck' });
    const update = runtime.dispatch({ type: 'completeDeviceCheck' });

    unsubscribe();

    expect(snapshots).toEqual([
      'permissionCheck',
      'permissionCheck',
      'permissionCheck',
      'deviceCheck',
      'ready',
    ]);
    expect(update.state.phase).toBe('ready');
    expect(update.viewModel.phase).toBe('ready');
    expect(update.sceneViewModel.phase).toBe('ready');
    expect(runtime.getViewModel().screen.title).toBe('開始待機');
  });

  it('keeps tick as phase-safe no-op plumbing and supports command-driven phase changes', () => {
    const runtime = createGameRuntime();

    runtime.dispatch({ type: 'openPermissionCheck' });
    runtime.dispatch({ type: 'setDevicePermission', device: 'microphone', permission: 'granted' });
    runtime.dispatch({ type: 'setDevicePermission', device: 'camera', permission: 'granted' });
    runtime.dispatch({ type: 'beginDeviceCheck' });
    runtime.dispatch({ type: 'completeDeviceCheck' });
    runtime.dispatch({ type: 'startSession' });

    const playingTickUpdate = runtime.tick(1000);
    const pausedUpdate = runtime.dispatch({ type: 'pauseSession' });
    const pausedTickUpdate = runtime.tick(1000);
    const resumedUpdate = runtime.dispatch({ type: 'resumeSession' });
    const finishedUpdate = runtime.dispatch({ type: 'finishSession', outcome: 'timeout' });
    const retryUpdate = runtime.dispatch({ type: 'retrySession' });

    expect(playingTickUpdate.changed).toBe(false);
    expect(playingTickUpdate.events).toEqual([]);
    expect(playingTickUpdate.state.phase).toBe('playing');
    expect(playingTickUpdate.state.elapsedMs).toBe(0);
    expect(playingTickUpdate.state.remainingMs).toBe(300000);
    expect(pausedUpdate.state.phase).toBe('paused');
    expect(pausedTickUpdate.changed).toBe(false);
    expect(pausedTickUpdate.state.phase).toBe('paused');
    expect(pausedTickUpdate.state.elapsedMs).toBe(0);
    expect(pausedTickUpdate.state.remainingMs).toBe(300000);
    expect(resumedUpdate.state.phase).toBe('playing');
    expect(finishedUpdate.state.phase).toBe('result');
    expect(retryUpdate.state.phase).toBe('title');
    expect(retryUpdate.state.elapsedMs).toBe(0);
    expect(retryUpdate.viewModel.screen.title).toBe('育児マルチタスクゲーム');
  });
});
