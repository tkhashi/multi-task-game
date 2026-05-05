import { createIdleCameraSnapshot, type CameraSnapshot } from './CameraSnapshot';
import { createIdleKeyboardSnapshot, type KeyboardSnapshot } from './KeyboardSnapshot';
import { createIdleMicrophoneSnapshot, type MicrophoneSnapshot } from './MicrophoneSnapshot';
import { createIdleMouseSnapshot, type MouseSnapshot } from './MouseSnapshot';

export interface InputFrame {
  sampledAtMs: number;
  keyboard: KeyboardSnapshot;
  mouse: MouseSnapshot;
  microphone: MicrophoneSnapshot;
  camera: CameraSnapshot;
}

export function createIdleInputFrame(sampledAtMs = 0): InputFrame {
  return {
    sampledAtMs,
    keyboard: createIdleKeyboardSnapshot(),
    mouse: createIdleMouseSnapshot(),
    microphone: createIdleMicrophoneSnapshot(),
    camera: createIdleCameraSnapshot(),
  };
}
