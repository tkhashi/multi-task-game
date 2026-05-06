import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { App } from './App';
import { createGameRuntime } from './bootstrap/createGameRuntime';

describe('App', () => {
  it('renders the title screen placeholder', () => {
    const markup = renderToStaticMarkup(<App />);

    expect(markup).toContain('育児マルチタスクゲーム');
    expect(markup).toContain('タイトル画面プレースホルダー');
    expect(markup).toContain('ゲームビューを準備中');
  });

  it('renders the latest runtime phase instead of a hard-coded initial state', () => {
    const runtime = createGameRuntime();

    runtime.dispatch({ type: 'openPermissionCheck' });
    const markup = renderToStaticMarkup(<App runtime={runtime} />);

    expect(markup).toContain('開始前確認');
    expect(markup).toContain('音声と映像はブラウザ内でのみ処理されます');
  });

  it('renders command-only controls for the current runtime phase', () => {
    const runtime = createGameRuntime();

    runtime.dispatch({ type: 'openPermissionCheck' });
    runtime.dispatch({ type: 'setDevicePermission', device: 'microphone', permission: 'granted' });
    runtime.dispatch({ type: 'setDevicePermission', device: 'camera', permission: 'granted' });
    runtime.dispatch({ type: 'beginDeviceCheck' });
    runtime.dispatch({ type: 'completeDeviceCheck' });
    runtime.dispatch({ type: 'startSession' });
    const markup = renderToStaticMarkup(<App runtime={runtime} />);

    expect(markup).toContain('一時停止');
    expect(markup).not.toContain('1秒進める');
    expect(markup).not.toContain('時間切れ結果へ');
  });
});
