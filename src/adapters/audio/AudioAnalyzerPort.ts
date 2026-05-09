import type { AudioCalibration } from '../../domain/game/GameState';
import type { MicrophoneSnapshot } from '../../domain/input/MicrophoneSnapshot';

export type InputDeviceError =
  | { kind: 'permissionDenied' }
  | { kind: 'deviceUnavailable' }
  | { kind: 'calibrationFailed' };

export type Result<T, E> =
  | { ok: true; value: T }
  | { ok: false; error: E };

export interface AudioAnalyzerPort {
  start(): Promise<Result<AudioCalibration, InputDeviceError>>;
  stop(): void;
  sample(sampledAtMs: number): MicrophoneSnapshot;
}
