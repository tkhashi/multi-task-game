import { describe, expect, it } from 'vitest';

import { createScenePresentation } from './MainScene';
import type { SceneViewModel } from '../../app/runtime/GameViewModelFactory';

function createSceneViewModel(overrides: Partial<SceneViewModel>): SceneViewModel {
  return {
    phase: 'playing',
    scene: 'idle',
    headline: 'Idle View',
    supportingText: 'placeholder',
    focusedTask: null,
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
});
