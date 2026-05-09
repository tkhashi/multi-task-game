import type { DeviceReadiness, PermissionState } from '../game/GameState';

export interface MicrophoneSnapshot {
  permission: PermissionState;
  readiness: DeviceReadiness;
  ready: boolean;
  rms: number;
  peak: number;
  stability: number;
  isSpeaking: boolean;
  isTooLoud: boolean;
}

export function createIdleMicrophoneSnapshot(): MicrophoneSnapshot {
  return {
    permission: 'prompt',
    readiness: 'idle',
    ready: false,
    rms: 0,
    peak: 0,
    stability: 0,
    isSpeaking: false,
    isTooLoud: false,
  };
}
