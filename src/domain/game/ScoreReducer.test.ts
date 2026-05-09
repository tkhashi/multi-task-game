import { describe, expect, it } from 'vitest';

import { createInitialGameState } from './GameState';
import { applyScoreDelta, createGameResult } from './ScoreReducer';

describe('ScoreReducer', () => {
  it('updates score, combo, and metrics while emitting scoreAdded events', () => {
    const state = createInitialGameState();

    const updated = applyScoreDelta(state, {
      points: 120,
      comboIncrement: 1,
      successCount: 1,
      comboCount: 1,
      reason: 'cleanupSuccess',
    });

    expect(updated.score).toEqual({
      total: 120,
      comboStreak: 1,
      bestComboStreak: 1,
    });
    expect(updated.metrics.successCount).toBe(1);
    expect(updated.metrics.comboCount).toBe(1);
    expect(updated.events).toEqual([
      expect.objectContaining({
        type: 'scoreAdded',
        amount: 120,
        reason: 'cleanupSuccess',
      }),
    ]);
  });

  it('creates a result summary with rank, gauges, and a comment', () => {
    const state = createInitialGameState();
    state.score.total = 980;
    state.metrics.successCount = 5;
    state.metrics.comboCount = 2;
    state.gauges.babyMood.current = 82;
    state.gauges.parentStress.current = 18;

    const result = createGameResult(state, 'timeout');

    expect(result.rank).toBe('S');
    expect(result.outcome).toBe('timeout');
    expect(result.finalGauges).toEqual({
      babyMood: 82,
      parentStress: 18,
    });
    expect(result.comment.length).toBeGreaterThan(0);
  });
});
