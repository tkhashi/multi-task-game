import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';

import { normalizeFaceBox } from './normalizeFaceBox';
import type {
  FaceWorkerRequestMessage,
  FaceWorkerResponseMessage,
} from './workerMessages';

let faceLandmarker: FaceLandmarker | null = null;

function postMessageToMainThread(message: FaceWorkerResponseMessage): void {
  self.postMessage(message);
}

async function handleInit(message: Extract<FaceWorkerRequestMessage, { type: 'init' }>): Promise<void> {
  try {
    const vision = await FilesetResolver.forVisionTasks(message.wasmBasePath);
    faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: message.modelAssetPath,
      },
      runningMode: 'VIDEO',
      numFaces: 1,
      outputFaceBlendshapes: false,
      outputFacialTransformationMatrixes: false,
    });

    postMessageToMainThread({
      type: 'ready',
      requestId: message.requestId,
    });
  } catch (error) {
    postMessageToMainThread({
      type: 'error',
      requestId: message.requestId,
      stage: 'model-init',
      reason: error instanceof Error ? error.message : 'Failed to initialize face landmarker',
    });
  }
}

function handleInfer(message: Extract<FaceWorkerRequestMessage, { type: 'infer' }>): void {
  try {
    if (!faceLandmarker) {
      throw new Error('FaceLandmarker is not initialized');
    }

    const result = faceLandmarker.detectForVideo(message.frame, message.timestampMs);

    postMessageToMainThread({
      type: 'result',
      requestId: message.requestId,
      timestampMs: message.timestampMs,
      faceBox: normalizeFaceBox(result),
    });
  } catch (error) {
    postMessageToMainThread({
      type: 'error',
      requestId: message.requestId,
      stage: 'inference',
      reason: error instanceof Error ? error.message : 'Face detection failed',
    });
  } finally {
    message.frame.close();
  }
}

function handleDispose(): void {
  faceLandmarker?.close();
  faceLandmarker = null;
}

self.onmessage = (event: MessageEvent<FaceWorkerRequestMessage>) => {
  const message = event.data;

  switch (message.type) {
    case 'init':
      void handleInit(message);
      break;
    case 'infer':
      handleInfer(message);
      break;
    case 'dispose':
      handleDispose();
      break;
  }
};
