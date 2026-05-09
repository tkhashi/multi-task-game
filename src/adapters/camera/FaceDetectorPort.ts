import type { CameraSnapshot, NormalizedFaceBox } from '../../domain/input/CameraSnapshot';

export type FaceDeviceError =
  | { kind: 'permissionDenied' }
  | { kind: 'deviceUnavailable' }
  | { kind: 'deviceUnavailable'; detail: 'faceNotDetected' | 'warmupTimedOut' | 'inferenceFailed' }
  | { kind: 'modelLoadFailed' }
  | { kind: 'workerStartupFailed' };

export interface FaceCalibration {
  baselineFaceBox: NormalizedFaceBox;
}

export type Result<T, E> =
  | { ok: true; value: T }
  | { ok: false; error: E };

export interface FaceDetectorPort {
  start(): Promise<Result<FaceCalibration, FaceDeviceError>>;
  stop(): void;
  sample(sampledAtMs: number): CameraSnapshot;
}
