function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function normalizeByteSample(sample: number): number {
  return (sample - 128) / 128;
}

export function calculateRms(samples: ArrayLike<number>): number {
  if (samples.length === 0) {
    return 0;
  }

  let squareSum = 0;
  for (let index = 0; index < samples.length; index += 1) {
    const normalized = normalizeByteSample(samples[index] ?? 128);
    squareSum += normalized * normalized;
  }

  return Math.sqrt(squareSum / samples.length);
}

export function calculatePeak(samples: ArrayLike<number>): number {
  if (samples.length === 0) {
    return 0;
  }

  let peak = 0;
  for (let index = 0; index < samples.length; index += 1) {
    const normalized = Math.abs(normalizeByteSample(samples[index] ?? 128));
    if (normalized > peak) {
      peak = normalized;
    }
  }

  return peak;
}

export function calculateStability(history: readonly number[], referenceThreshold: number): number {
  if (history.length <= 1 || referenceThreshold <= 0) {
    return history.length === 0 ? 0 : 1;
  }

  const average = history.reduce((sum, value) => sum + value, 0) / history.length;
  const variance =
    history.reduce((sum, value) => {
      const delta = value - average;
      return sum + delta * delta;
    }, 0) / history.length;
  const deviation = Math.sqrt(variance);
  const normalizedDeviation = deviation / referenceThreshold;

  return clamp(1 - normalizedDeviation * 2.5, 0, 1);
}
