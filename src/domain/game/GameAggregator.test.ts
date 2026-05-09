import { describe, expect, it } from 'vitest';

import { createIdleInputFrame } from '../input/InputFrame';
import { gameAggregator } from './GameAggregator';
import { createInitialGameState } from './GameState';

describe('GameAggregator', () => {
  it('advances the session timer and baseline gauges during playing ticks', () => {
    const state = createInitialGameState();
    state.phase = 'playing';
    state.session.microphone.inUse = true;
    state.session.camera.inUse = true;

    const result = gameAggregator.tick(state, createIdleInputFrame(1_000), 1_000);

    expect(result.state.elapsedMs).toBe(1_000);
    expect(result.state.remainingMs).toBe(299_000);
    expect(result.state.gauges.babyMood.current).toBeCloseTo(99.8, 5);
    expect(result.state.gauges.parentStress.current).toBeCloseTo(0.1, 5);
    expect(result.events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'gaugeChanged', target: 'babyMood' }),
        expect.objectContaining({ type: 'gaugeChanged', target: 'parentStress' }),
      ]),
    );
  });

  it('returns a timeout result when the 5 minute session reaches zero remaining time', () => {
    const state = createInitialGameState();
    state.phase = 'playing';
    state.remainingMs = 500;
    state.elapsedMs = 299_500;
    state.session.microphone.inUse = true;
    state.session.camera.inUse = true;

    const result = gameAggregator.tick(state, createIdleInputFrame(300_000), 1_000);

    expect(result.state.phase).toBe('result');
    expect(result.state.result).not.toBeNull();
    expect(result.state.result?.outcome).toBe('timeout');
    expect(result.events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'phaseChanged', phase: 'result' }),
        expect.objectContaining({ type: 'gameCleared' }),
        expect.objectContaining({ type: 'sessionFinished', outcome: 'timeout' }),
      ]),
    );
    expect(result.state.session.microphone.inUse).toBe(false);
    expect(result.state.session.camera.inUse).toBe(false);
  });

  it('returns gameOver when baby mood stays collapsed for 6 seconds', () => {
    const state = createInitialGameState();
    state.phase = 'playing';
    state.gauges.babyMood.current = 0;
    state.gauges.parentStress.current = 40;
    state.session.microphone.inUse = true;
    state.session.camera.inUse = true;

    const result = gameAggregator.tick(state, createIdleInputFrame(6_000), 6_000);

    expect(result.state.phase).toBe('gameOver');
    expect(result.state.result?.outcome).toBe('gameOver');
    expect(result.events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'gameOver',
          reason: 'babyMoodCollapsed',
        }),
        expect.objectContaining({ type: 'phaseChanged', phase: 'gameOver' }),
        expect.objectContaining({ type: 'sessionFinished', outcome: 'gameOver' }),
      ]),
    );
  });

  it('returns gameOver when both gauges stay in danger for 10 seconds', () => {
    const state = createInitialGameState();
    state.phase = 'playing';
    state.gauges.babyMood.current = 20;
    state.gauges.parentStress.current = 80;
    state.session.microphone.inUse = true;
    state.session.camera.inUse = true;

    const result = gameAggregator.tick(state, createIdleInputFrame(10_000), 10_000);

    expect(result.state.phase).toBe('gameOver');
    expect(result.events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'gameOver',
          reason: 'doubleDanger',
        }),
      ]),
    );
  });
});
