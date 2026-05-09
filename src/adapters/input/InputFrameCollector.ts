import type { AudioAnalyzerPort } from '../audio/AudioAnalyzerPort';
import type { FaceDetectorPort } from '../camera/FaceDetectorPort';
import { createIdleInputFrame, type InputFrame } from '../../domain/input/InputFrame';
import type { KeyboardSnapshotSource } from './KeyboardAdapter';
import { KeyboardAdapter } from './KeyboardAdapter';
import type { MouseSnapshotSource } from './MouseAdapter';
import { MouseAdapter } from './MouseAdapter';

export interface InputFrameCollectorDependencies {
  keyboard?: KeyboardSnapshotSource;
  mouse?: MouseSnapshotSource;
  microphone: AudioAnalyzerPort;
  camera: FaceDetectorPort;
}

export interface InputFrameCollectorPort {
  collect(sampledAtMs: number): InputFrame;
}

export class InputFrameCollector implements InputFrameCollectorPort {
  readonly #keyboard: KeyboardSnapshotSource;
  readonly #mouse: MouseSnapshotSource;
  readonly #microphone: AudioAnalyzerPort;
  readonly #camera: FaceDetectorPort;

  constructor({
    keyboard = new KeyboardAdapter(),
    mouse = new MouseAdapter(),
    microphone,
    camera,
  }: InputFrameCollectorDependencies) {
    this.#keyboard = keyboard;
    this.#mouse = mouse;
    this.#microphone = microphone;
    this.#camera = camera;
  }

  collect(sampledAtMs: number): InputFrame {
    const frame = createIdleInputFrame(sampledAtMs);

    return {
      ...frame,
      keyboard: this.#keyboard.sample(sampledAtMs),
      mouse: this.#mouse.sample(sampledAtMs),
      microphone: this.#microphone.sample(sampledAtMs),
      camera: this.#camera.sample(sampledAtMs),
    };
  }
}
