import { describe, expect, it } from 'vitest';

import { GameScheduler } from './GameScheduler';
import { createInitialGameState } from './GameState';

const createRandom = (...values: number[]) => {
  const queue = [...values];
  return {
    next: () => queue.shift() ?? 0,
  };
};

describe('GameScheduler', () => {
  it('spawns only hand tasks during the intro minute', () => {
    const scheduler = new GameScheduler();
    const state = createInitialGameState();
    state.phase = 'playing';
    state.elapsedMs = 30_000;

    const plans = scheduler.planSpawns(state, createRandom(0));

    expect(plans).toHaveLength(1);
    expect(plans[0]?.channel).toBe('hand');
  });

  it('adds sensor tasks in later phases while respecting microphone and camera caps', () => {
    const scheduler = new GameScheduler();
    const state = createInitialGameState();
    state.phase = 'playing';
    state.elapsedMs = 150_000;

    const plans = scheduler.planSpawns(state, createRandom(0.1, 0.8, 0.2));

    expect(plans).toHaveLength(3);
    expect(plans.filter((plan) => plan.channel === 'hand')).toHaveLength(1);
    expect(plans.filter((plan) => plan.channel === 'microphone')).toHaveLength(1);
    expect(plans.filter((plan) => plan.channel === 'camera')).toHaveLength(1);
  });

  it('does not respawn an already active cooking task and stays within the total cap', () => {
    const scheduler = new GameScheduler();
    const state = createInitialGameState();
    state.phase = 'playing';
    state.elapsedMs = 250_000;
    state.activeTasks['cooking-1'] = {
      id: 'cooking-1',
      kind: 'cooking',
      channel: 'hand',
      inputType: 'mouse',
      title: 'ベビーフード作り',
      summary: '継続中',
      urgency: 'urgent',
      lifecycle: 'active',
      progress: 0.4,
      startedAtMs: 100_000,
      updatedAtMs: 100_000,
      step: 'heat',
      cue: 'soon',
    };

    const plans = scheduler.planSpawns(state, createRandom(0.2, 0.4, 0.6, 0.8));

    expect(plans.some((plan) => plan.kind === 'cooking')).toBe(false);
    expect(plans.length + Object.keys(state.activeTasks).length).toBeLessThanOrEqual(
      state.taskLimits.totalActive,
    );
  });
});
