import { describe, expect, it } from 'vitest';

import { createInitialGameState } from './GameState';
import { applyGaugeTick } from './GaugeReducer';

describe('GaugeReducer', () => {
  it('applies baseline gauge drift over time and clamps values within the allowed range', () => {
    const state = createInitialGameState();

    const result = applyGaugeTick(state, 5_000);

    expect(result.gauges.babyMood.current).toBeCloseTo(99, 5);
    expect(result.gauges.parentStress.current).toBeCloseTo(0.5, 5);
    expect(result.collapseTimers).toEqual({
      babyMoodZeroMs: 0,
      parentStressMaxMs: 0,
      bothDangerMs: 0,
    });
    expect(result.events).toEqual([
      expect.objectContaining({
        type: 'gaugeChanged',
        target: 'babyMood',
        reason: 'timeProgress',
      }),
      expect.objectContaining({
        type: 'gaugeChanged',
        target: 'parentStress',
        reason: 'timeProgress',
      }),
    ]);
  });

  it('increments collapse timers while gauges stay in collapse zones and resets them after recovery', () => {
    const state = createInitialGameState();
    state.gauges.babyMood.current = 0;
    state.gauges.parentStress.current = 100;

    const collapsed = applyGaugeTick(state, 3_000);

    expect(collapsed.collapseTimers).toEqual({
      babyMoodZeroMs: 3_000,
      parentStressMaxMs: 3_000,
      bothDangerMs: 3_000,
    });

    const recoveredState = {
      ...state,
      gauges: {
        ...state.gauges,
        babyMood: {
          ...state.gauges.babyMood,
          current: 40,
        },
        parentStress: {
          ...state.gauges.parentStress,
          current: 50,
        },
      },
      collapseTimers: collapsed.collapseTimers,
    };

    const recovered = applyGaugeTick(recoveredState, 500);

    expect(recovered.collapseTimers).toEqual({
      babyMoodZeroMs: 0,
      parentStressMaxMs: 0,
      bothDangerMs: 0,
    });
  });
});
