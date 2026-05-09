import type { NormalizedFaceBox } from '../../domain/input/CameraSnapshot';

export interface FaceWorkerInitMessage {
  type: 'init';
  requestId: number;
  modelAssetPath: string;
  wasmBasePath: string;
}

export interface FaceWorkerInferMessage {
  type: 'infer';
  requestId: number;
  timestampMs: number;
  frame: ImageBitmap;
}

export interface FaceWorkerDisposeMessage {
  type: 'dispose';
}

export type FaceWorkerRequestMessage =
  | FaceWorkerInitMessage
  | FaceWorkerInferMessage
  | FaceWorkerDisposeMessage;

export interface FaceWorkerReadyMessage {
  type: 'ready';
  requestId: number;
}

export interface FaceWorkerResultMessage {
  type: 'result';
  requestId: number;
  timestampMs: number;
  faceBox: NormalizedFaceBox | null;
}

export interface FaceWorkerErrorMessage {
  type: 'error';
  requestId: number;
  stage: 'model-init' | 'inference';
  reason: string;
}

export type FaceWorkerResponseMessage =
  | FaceWorkerReadyMessage
  | FaceWorkerResultMessage
  | FaceWorkerErrorMessage;
