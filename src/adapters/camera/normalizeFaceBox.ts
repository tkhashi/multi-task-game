import type { FaceLandmarkerResult } from '@mediapipe/tasks-vision';

import type { NormalizedFaceBox } from '../../domain/input/CameraSnapshot';

function clamp(value: number): number {
  return Math.min(1, Math.max(0, value));
}

export function normalizeFaceBox(result: FaceLandmarkerResult): NormalizedFaceBox | null {
  const landmarks = result.faceLandmarks[0];

  if (!landmarks || landmarks.length === 0) {
    return null;
  }

  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  for (const landmark of landmarks) {
    minX = Math.min(minX, landmark.x);
    minY = Math.min(minY, landmark.y);
    maxX = Math.max(maxX, landmark.x);
    maxY = Math.max(maxY, landmark.y);
  }

  if (
    !Number.isFinite(minX) ||
    !Number.isFinite(minY) ||
    !Number.isFinite(maxX) ||
    !Number.isFinite(maxY) ||
    maxX <= minX ||
    maxY <= minY
  ) {
    return null;
  }

  return {
    centerX: clamp((minX + maxX) / 2),
    centerY: clamp((minY + maxY) / 2),
    width: clamp(maxX - minX),
    height: clamp(maxY - minY),
  };
}
