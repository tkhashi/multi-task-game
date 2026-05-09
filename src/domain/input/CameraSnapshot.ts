import type { DeviceReadiness, PermissionState } from '../game/GameState';

export type CameraHint =
  | 'show-face'
  | 'move-left'
  | 'move-right'
  | 'move-up'
  | 'move-down'
  | 'move-forward'
  | 'move-back'
  | 'hold';

export interface NormalizedFaceBox {
  centerX: number;
  centerY: number;
  width: number;
  height: number;
}

export interface CameraDetectionMetadata {
  lastProcessedAtMs: number | null;
  lastDetectedAtMs: number | null;
  stale: boolean;
}

export interface CameraSnapshot {
  permission: PermissionState;
  readiness: DeviceReadiness;
  ready: boolean;
  faceDetected: boolean;
  faceBox: NormalizedFaceBox | null;
  hint: CameraHint;
  detection: CameraDetectionMetadata;
}

export function createIdleCameraSnapshot(): CameraSnapshot {
  return {
    permission: 'prompt',
    readiness: 'idle',
    ready: false,
    faceDetected: false,
    faceBox: null,
    hint: 'show-face',
    detection: {
      lastProcessedAtMs: null,
      lastDetectedAtMs: null,
      stale: false,
    },
  };
}
