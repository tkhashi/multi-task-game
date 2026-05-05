import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { App } from './App';

describe('App', () => {
  it('renders the title screen placeholder', () => {
    const markup = renderToStaticMarkup(<App />);

    expect(markup).toContain('育児マルチタスクゲーム');
    expect(markup).toContain('タイトル画面プレースホルダー');
    expect(markup).toContain('ゲームビューを準備中');
  });
});
