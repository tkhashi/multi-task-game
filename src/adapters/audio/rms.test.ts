import { describe, expect, it } from 'vitest';

import { calculatePeak, calculateRms, calculateStability, normalizeByteSample } from './rms';

function toByteSamples(values: number[]): Uint8Array {
  return Uint8Array.from(values.map((value) => Math.max(0, Math.min(255, Math.round(value * 128 + 128)))));
}

describe('rms utilities', () => {
  it('normalizes byte samples around the time-domain center', () => {
    expect(normalizeByteSample(128)).toBeCloseTo(0, 5);
    expect(normalizeByteSample(255)).toBeCloseTo(127 / 128, 5);
    expect(normalizeByteSample(0)).toBeCloseTo(-1, 5);
  });

  it('calculates rms and peak from time-domain byte samples', () => {
    const samples = toByteSamples([0, 0.5, -0.5, 0.25, -0.25]);

    expect(calculateRms(samples)).toBeCloseTo(Math.sqrt(0.125), 3);
    expect(calculatePeak(samples)).toBeCloseTo(0.5, 2);
  });

  it('reports high stability for a consistent voice band and low stability for jitter', () => {
    expect(calculateStability([0.18, 0.19, 0.18, 0.2], 0.12)).toBeGreaterThan(0.8);
    expect(calculateStability([0.04, 0.22, 0.08, 0.28], 0.12)).toBeLessThan(0.3);
  });
});
