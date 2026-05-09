import { WebAudioAnalyzer } from '../../adapters/audio/WebAudioAnalyzer';
import { MediaPipeFaceAdapter } from '../../adapters/camera/MediaPipeFaceAdapter';
import { InputFrameCollector } from '../../adapters/input/InputFrameCollector';
import type { KeyboardSnapshotSource } from '../../adapters/input/KeyboardAdapter';
import { KeyboardAdapter } from '../../adapters/input/KeyboardAdapter';
import type { MouseSnapshotSource } from '../../adapters/input/MouseAdapter';
import { MouseAdapter } from '../../adapters/input/MouseAdapter';
import { GameRuntime, type GameRuntimeDependencies, type GameRuntimeService } from '../runtime/GameRuntime';

let sharedRuntime: GameRuntimeService | null = null;

export interface CreateGameRuntimeDependencies extends GameRuntimeDependencies {
  keyboard?: KeyboardSnapshotSource;
  mouse?: MouseSnapshotSource;
}

export function createGameRuntime(dependencies: CreateGameRuntimeDependencies = {}): GameRuntimeService {
  const audioAnalyzer = dependencies.audioAnalyzer ?? new WebAudioAnalyzer();
  const faceDetector = dependencies.faceDetector ?? new MediaPipeFaceAdapter();
  const keyboard = dependencies.keyboard ?? new KeyboardAdapter();
  const mouse = dependencies.mouse ?? new MouseAdapter();
  const inputFrameCollector =
    dependencies.inputFrameCollector ??
    new InputFrameCollector({
      keyboard,
      mouse,
      microphone: audioAnalyzer,
      camera: faceDetector,
    });

  return new GameRuntime({
    ...dependencies,
    audioAnalyzer,
    faceDetector,
    inputFrameCollector,
  });
}

export function getSharedGameRuntime(): GameRuntimeService {
  if (!sharedRuntime) {
    sharedRuntime = createGameRuntime();
  }

  return sharedRuntime;
}
