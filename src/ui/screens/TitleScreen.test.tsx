import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import type { GameViewModel, SceneViewModel } from '../../app/runtime/GameViewModelFactory';
import { TitleScreen } from './TitleScreen';

function createPlayingViewModel(): GameViewModel {
  return {
    phase: 'playing',
    screen: {
      title: 'プレイ中',
      subtitle: '複数タスクへ短時間ずつ介入',
      body: '残り時間、主要ゲージ、発生中タスク、センサー状態を見ながら進めます。',
      highlights: ['手元2件まで', 'センサー2件まで', '複合操作で好評価'],
    },
    hud: {
      remainingTimeLabel: '03:42',
      gauges: {
        babyMood: {
          label: '赤ちゃんの機嫌',
          current: 22,
          max: 100,
          tone: 'warning',
        },
        parentStress: {
          label: '親の心労',
          current: 79,
          max: 100,
          tone: 'warning',
        },
      },
      tasks: {
        maxConcurrent: 4,
        active: [
          {
            id: 'cleanup-1',
            label: 'おもちゃの片付け',
            inputTypeLabel: 'キーボード',
            urgency: 'urgent',
            urgencyLabel: '急ぎ',
            progressPercent: 40,
          },
          {
            id: 'voice-1',
            label: '呼びかけ連打',
            inputTypeLabel: 'マイク',
            urgency: 'critical',
            urgencyLabel: '最優先',
            progressPercent: 60,
          },
        ],
      },
      sensors: {
        microphone: {
          label: '使用中',
          active: true,
          tone: 'ready',
          helperText: '小さめの声を保つと安定します。',
        },
        camera: {
          label: '利用可能',
          active: false,
          tone: 'muted',
          helperText: '顔の向きを合わせると開始できます。',
        },
      },
      warnings: [
        {
          id: 'warn-baby',
          label: '赤ちゃんの機嫌が危険域です',
          tone: 'danger',
        },
        {
          id: 'warn-task',
          label: '呼びかけ連打を優先してください',
          tone: 'warning',
        },
      ],
    },
    result: null,
  };
}

function createSceneViewModel(): SceneViewModel {
  return {
    phase: 'playing',
    scene: 'cleanup',
    headline: 'おもちゃの片付け',
    supportingText: '矢印キーで移動し、Space と E で片付けます。',
    focusedTask: {
      id: 'cleanup-1',
      kind: 'cleanup',
      title: 'おもちゃの片付け',
      progressPercent: 40,
      detail: '2/5 個を片付け済み',
    },
    cleanup: {
      progressLabel: '2 / 5 個を収納済み',
      hintLabel: '箱へ移動して E でしまう',
      player: {
        x: 0.4,
        y: 0.6,
        carrying: true,
      },
      storages: [],
      items: [],
    },
    cooking: null,
  };
}

describe('TitleScreen gameplay HUD', () => {
  it('renders time, gauges, active tasks, sensor states, and warnings in one screen', () => {
    const markup = renderToStaticMarkup(
      <TitleScreen
        viewModel={createPlayingViewModel()}
        sceneViewModel={createSceneViewModel()}
        actions={[{ label: '一時停止', command: { type: 'pauseSession' } }]}
        onAction={() => {}}
      />,
    );

    expect(markup).toContain('残り時間');
    expect(markup).toContain('03:42');
    expect(markup).toContain('赤ちゃんの機嫌');
    expect(markup).toContain('親の心労');
    expect(markup).toContain('おもちゃの片付け');
    expect(markup).toContain('キーボード');
    expect(markup).toContain('呼びかけ連打');
    expect(markup).toContain('最優先');
    expect(markup).toContain('小さめの声を保つと安定します。');
    expect(markup).toContain('赤ちゃんの機嫌が危険域です');
    expect(markup).toContain('一時停止');
  });

  it('renders pause controls while preserving the in-play HUD context', () => {
    const viewModel = createPlayingViewModel();
    viewModel.phase = 'paused';
    viewModel.screen = {
      title: '一時停止',
      subtitle: 'プレイを中断中',
      body: '操作を再開すると同じ状態から続きます。',
      highlights: ['状態保持', '再開可能', 'センサー再利用'],
    };

    const markup = renderToStaticMarkup(
      <TitleScreen
        viewModel={viewModel}
        sceneViewModel={createSceneViewModel()}
        actions={[
          { label: '再開', command: { type: 'resumeSession' } },
          { label: 'タイトルへ戻る', command: { type: 'returnToTitle' } },
        ]}
        onAction={() => {}}
      />,
    );

    expect(markup).toContain('一時停止中');
    expect(markup).toContain('再開');
    expect(markup).toContain('タイトルへ戻る');
  });

  it('renders game-over results with rank, metrics, and retry guidance', () => {
    const viewModel = createPlayingViewModel();
    viewModel.phase = 'gameOver';
    viewModel.screen = {
      title: 'ゲームオーバー',
      subtitle: '破綻条件に到達しました',
      body: '主要ゲージと警告を見直して、次のプレイへ活かせます。',
      highlights: ['主要ゲージ確認', '警告を振り返る', 'タイトルへ戻れる'],
    };
    viewModel.result = {
      rank: 'B',
      comment: '危険域の立て直しはよかったですが、後半の複合操作が惜しいです。',
      outcomeLabel: 'ゲームオーバー',
      metrics: {
        successCount: 4,
        partialCount: 6,
        comboCount: 2,
        failureCount: 3,
      },
      finalGauges: {
        babyMood: 0,
        parentStress: 88,
      },
    };

    const markup = renderToStaticMarkup(
      <TitleScreen
        viewModel={viewModel}
        sceneViewModel={createSceneViewModel()}
        actions={[{ label: 'リトライ', command: { type: 'retrySession' } }]}
        onAction={() => {}}
      />,
    );

    expect(markup).toContain('評価ランク');
    expect(markup).toContain('B');
    expect(markup).toContain('ゲームオーバー');
    expect(markup).toContain('成功数');
    expect(markup).toContain('部分介入数');
    expect(markup).toContain('危険域の立て直しはよかったですが');
    expect(markup).toContain('リトライ');
  });
});
