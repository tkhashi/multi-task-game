import { describe, expect, it } from 'vitest';

import { createCleanupSceneLayout, createCookingSceneLayout, createScenePresentation } from './MainScene';
import type { SceneViewModel } from '../../app/runtime/GameViewModelFactory';

function createSceneViewModel(overrides: Partial<SceneViewModel>): SceneViewModel {
  return {
    phase: 'playing',
    scene: 'idle',
    headline: 'Idle View',
    supportingText: 'placeholder',
    focusedTask: null,
    cleanup: null,
    cooking: null,
    ...overrides,
  };
}

describe('createScenePresentation', () => {
  it('maps cleanup scene view models to cleanup-specific presentation values', () => {
    const presentation = createScenePresentation(
      createSceneViewModel({
        scene: 'cleanup',
        focusedTask: {
          id: 'cleanup-1',
          kind: 'cleanup',
          title: '片付け',
          progressPercent: 40,
          detail: '1/3 個を片付け済み',
        },
      }),
    );

    expect(presentation.title).toBe('片付け');
    expect(presentation.subtitle).toContain('片付け済み');
    expect(presentation.backgroundColor).toBe('#17324f');
  });

  it('maps cooking scene view models to cooking-specific presentation values', () => {
    const presentation = createScenePresentation(
      createSceneViewModel({
        scene: 'cooking',
        focusedTask: {
          id: 'cooking-1',
          kind: 'cooking',
          title: 'ベビーフード作り',
          progressPercent: 60,
          detail: '加熱 / そろそろ',
        },
      }),
    );

    expect(presentation.title).toBe('ベビーフード作り');
    expect(presentation.backgroundColor).toBe('#4f2c1d');
  });

  it('maps cleanup field entities into renderable scene coordinates', () => {
    const layout = createCleanupSceneLayout(
      createSceneViewModel({
        scene: 'cleanup',
        focusedTask: {
          id: 'cleanup-1',
          kind: 'cleanup',
          title: '片付け',
          progressPercent: 40,
          detail: '1/3 個を片付け済み',
        },
        cleanup: {
          progressLabel: '1 / 3 個を収納済み',
          hintLabel: '矢印キーで移動して Space で拾う',
          player: {
            x: 0.5,
            y: 0.5,
            carrying: true,
          },
          storages: [
            { kind: 'basket', label: 'かご', x: 0.15, y: 0.2, emphasis: 'target' },
            { kind: 'box', label: '箱', x: 0.84, y: 0.2, emphasis: 'muted' },
            { kind: 'kitchen', label: '台所', x: 0.88, y: 0.74, emphasis: 'muted' },
          ],
          items: [
            {
              id: 'duck-1',
              label: 'あひる',
              x: 0.24,
              y: 0.35,
              carrying: false,
              stored: false,
              visible: true,
            },
            {
              id: 'block-2',
              label: 'つみき',
              x: 0.5,
              y: 0.5,
              carrying: true,
              stored: false,
              visible: true,
            },
          ],
        },
      }),
      { width: 960, height: 360 },
    );

    expect(layout.field.width).toBeGreaterThan(600);
    expect(layout.player.x).toBeGreaterThan(layout.field.x);
    expect(layout.player.carrying).toBe(true);
    expect(layout.items.find((item) => item.id === 'block-2')).toMatchObject({
      carrying: true,
      visible: true,
    });
    expect(layout.storages[0]?.emphasis).toBe('target');
  });

  it('maps cooking step visuals into a renderable layout', () => {
    const layout = createCookingSceneLayout(
      createSceneViewModel({
        scene: 'cooking',
        focusedTask: {
          id: 'cooking-1',
          kind: 'cooking',
          title: 'ベビーフード作り',
          progressPercent: 60,
          detail: '加熱 / そろそろ',
        },
        cooking: {
          step: 'heat',
          stepLabel: '加熱',
          cueLabel: 'そろそろ',
          statusLabel: '火を入れて、ちょうどよいところで離す',
          qualityLabel: 'なめらか',
          progressPercent: 35,
          isHeating: true,
          isReady: false,
          temperatureBand: 'hot',
        },
      }),
      { width: 960, height: 360 },
    );

    expect(layout.station.width).toBeGreaterThan(500);
    expect(layout.bowl.radius).toBeGreaterThan(40);
    expect(layout.heatMeter.fillRatio).toBeGreaterThan(0.5);
    expect(layout.step).toBe('heat');
  });
});
