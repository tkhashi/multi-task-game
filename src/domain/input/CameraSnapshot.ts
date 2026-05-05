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

export interface CameraSnapshot {
  permission: PermissionState;
  readiness: DeviceReadiness;
  ready: boolean;
  faceDetected: boolean;
  faceBox: NormalizedFaceBox | null;
  hint: CameraHint;
}

export function createIdleCameraSnapshot(): CameraSnapshot {
  return {
    permission: 'prompt',
    readiness: 'idle',
    ready: false,
    faceDetected: false,
    faceBox: null,
    hint: 'show-face',
  };
}
