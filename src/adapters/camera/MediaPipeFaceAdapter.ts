import {
  createIdleCameraSnapshot,
  type CameraHint,
  type CameraSnapshot,
  type NormalizedFaceBox,
} from '../../domain/input/CameraSnapshot';
import type {
  FaceCalibration,
  FaceDeviceError,
  FaceDetectorPort,
  Result,
} from './FaceDetectorPort';
import type {
  FaceWorkerRequestMessage,
  FaceWorkerResponseMessage,
} from './workerMessages';

const DEFAULT_WARMUP_TIMEOUT_MS = 5000;
const DEFAULT_INFERENCE_INTERVAL_MS = 150;
const DEFAULT_STALE_DETECTION_THRESHOLD_MS = 400;
const DEFAULT_MODEL_ASSET_PATH = '/models/face_landmarker.task';
const DEFAULT_WASM_BASE_PATH = '/vendor/mediapipe/wasm';
const INIT_REQUEST_ID = 0;

interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
}

interface VideoElementLike {
  autoplay: boolean;
  muted: boolean;
  playsInline: boolean;
  srcObject: MediaProvider | null;
  videoWidth: number;
  videoHeight: number;
  addEventListener(type: 'loadedmetadata', listener: () => void): void;
  removeEventListener(type: 'loadedmetadata', listener: () => void): void;
  play(): Promise<void>;
  pause(): void;
}

interface WorkerLike {
  onmessage: ((event: MessageEvent<FaceWorkerResponseMessage>) => void) | null;
  onerror: ((event: ErrorEvent) => void) | null;
  postMessage(message: FaceWorkerRequestMessage, transfer?: Transferable[]): void;
  terminate(): void;
}

export interface MediaPipeFaceAdapterDependencies {
  getUserMedia?: (constraints: MediaStreamConstraints) => Promise<MediaStream>;
  createVideoElement?: () => VideoElementLike;
  createImageBitmap?: (image: CanvasImageSource) => Promise<ImageBitmap>;
  createWorker?: () => WorkerLike;
  requestAnimationFrame?: (callback: FrameRequestCallback) => number;
  cancelAnimationFrame?: (handle: number) => void;
  isSecureContext?: () => boolean;
  warmupTimeoutMs?: number;
  inferenceIntervalMs?: number;
  staleDetectionThresholdMs?: number;
  modelAssetPath?: string;
  wasmBasePath?: string;
}

function createDeferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;

  const promise = new Promise<T>((nextResolve) => {
    resolve = nextResolve;
  });

  return { promise, resolve };
}

function getDefaultUserMedia(constraints: MediaStreamConstraints): Promise<MediaStream> {
  const mediaDevices = globalThis.navigator?.mediaDevices;
  if (!mediaDevices?.getUserMedia) {
    throw new Error('getUserMedia is not available');
  }

  return mediaDevices.getUserMedia(constraints);
}

function getDefaultVideoElement(): HTMLVideoElement {
  if (!globalThis.document?.createElement) {
    throw new Error('document is not available');
  }

  return globalThis.document.createElement('video');
}

function getDefaultCreateImageBitmap(image: CanvasImageSource): Promise<ImageBitmap> {
  if (!globalThis.createImageBitmap) {
    throw new Error('createImageBitmap is not available');
  }

  return globalThis.createImageBitmap(image);
}

function getDefaultWorker(): WorkerLike {
  return new Worker(new URL('./faceWorker.ts', import.meta.url), { type: 'module' });
}

function mapInputDeviceError(error: unknown): FaceDeviceError {
  if (error instanceof DOMException) {
    if (error.name === 'NotAllowedError' || error.name === 'SecurityError') {
      return { kind: 'permissionDenied' };
    }

    if (
      error.name === 'NotFoundError' ||
      error.name === 'NotReadableError' ||
      error.name === 'AbortError' ||
      error.name === 'OverconstrainedError'
    ) {
      return { kind: 'deviceUnavailable' };
    }
  }

  if (
    error instanceof Error &&
    (error.message.includes('getUserMedia is not available') ||
      error.message.includes('document is not available') ||
      error.message.includes('createImageBitmap is not available'))
  ) {
    return { kind: 'deviceUnavailable' };
  }

  return { kind: 'deviceUnavailable' };
}

function createCheckingSnapshot(permission: CameraSnapshot['permission']): CameraSnapshot {
  return {
    permission,
    readiness: 'checking',
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

function createReadySnapshot(
  faceBox: NormalizedFaceBox | null,
  processedAtMs: number,
  lastDetectedAtMs: number | null,
): CameraSnapshot {
  return {
    permission: 'granted',
    readiness: 'ready',
    ready: true,
    faceDetected: faceBox !== null,
    faceBox,
    hint: determineHint(faceBox),
    detection: {
      lastProcessedAtMs: processedAtMs,
      lastDetectedAtMs,
      stale: false,
    },
  };
}

function createErrorSnapshot(permission: CameraSnapshot['permission']): CameraSnapshot {
  return {
    permission,
    readiness: 'error',
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

function withStaleDetection(snapshot: CameraSnapshot): CameraSnapshot {
  return {
    ...snapshot,
    faceDetected: false,
    faceBox: null,
    hint: 'show-face',
    detection: {
      ...snapshot.detection,
      stale: true,
    },
  };
}

function determineHint(faceBox: NormalizedFaceBox | null): CameraHint {
  if (!faceBox) {
    return 'show-face';
  }

  if (faceBox.centerX < 0.4) {
    return 'move-right';
  }

  if (faceBox.centerX > 0.6) {
    return 'move-left';
  }

  if (faceBox.centerY < 0.35) {
    return 'move-down';
  }

  if (faceBox.centerY > 0.65) {
    return 'move-up';
  }

  if (faceBox.width < 0.18) {
    return 'move-forward';
  }

  if (faceBox.width > 0.45) {
    return 'move-back';
  }

  return 'hold';
}

async function waitForVideoToBeReady(video: VideoElementLike): Promise<void> {
  const ready = createDeferred<void>();
  const handleLoadedMetadata = (): void => {
    video.removeEventListener('loadedmetadata', handleLoadedMetadata);
    ready.resolve();
  };

  video.addEventListener('loadedmetadata', handleLoadedMetadata);
  await video.play();

  if (video.videoWidth > 0 && video.videoHeight > 0) {
    handleLoadedMetadata();
  }

  await ready.promise;
}

export class MediaPipeFaceAdapter implements FaceDetectorPort {
  readonly #getUserMedia: (constraints: MediaStreamConstraints) => Promise<MediaStream>;
  readonly #createVideoElement: () => VideoElementLike;
  readonly #createImageBitmap: (image: CanvasImageSource) => Promise<ImageBitmap>;
  readonly #createWorker: () => WorkerLike;
  readonly #requestAnimationFrame: (callback: FrameRequestCallback) => number;
  readonly #cancelAnimationFrame: (handle: number) => void;
  readonly #isSecureContext: () => boolean;
  readonly #warmupTimeoutMs: number;
  readonly #inferenceIntervalMs: number;
  readonly #staleDetectionThresholdMs: number;
  readonly #modelAssetPath: string;
  readonly #wasmBasePath: string;

  #stream: MediaStream | null = null;
  #video: VideoElementLike | null = null;
  #worker: WorkerLike | null = null;
  #snapshot: CameraSnapshot = createIdleCameraSnapshot();
  #warmupTimer: ReturnType<typeof setTimeout> | null = null;
  #warmupDeferred: Deferred<Result<FaceCalibration, FaceDeviceError>> | null = null;
  #initDeferred: Deferred<Result<void, FaceDeviceError>> | null = null;
  #animationFrameId: number | null = null;
  #running = false;
  #inferenceInFlight = false;
  #nextRequestId = 1;
  #lastInferenceRequestedAtMs: number | null = null;

  constructor({
    getUserMedia = getDefaultUserMedia,
    createVideoElement = getDefaultVideoElement,
    createImageBitmap = getDefaultCreateImageBitmap,
    createWorker = getDefaultWorker,
    requestAnimationFrame = (callback) => globalThis.requestAnimationFrame(callback),
    cancelAnimationFrame = (handle) => globalThis.cancelAnimationFrame(handle),
    isSecureContext = () => globalThis.isSecureContext ?? false,
    warmupTimeoutMs = DEFAULT_WARMUP_TIMEOUT_MS,
    inferenceIntervalMs = DEFAULT_INFERENCE_INTERVAL_MS,
    staleDetectionThresholdMs = DEFAULT_STALE_DETECTION_THRESHOLD_MS,
    modelAssetPath = DEFAULT_MODEL_ASSET_PATH,
    wasmBasePath = DEFAULT_WASM_BASE_PATH,
  }: MediaPipeFaceAdapterDependencies = {}) {
    this.#getUserMedia = getUserMedia;
    this.#createVideoElement = createVideoElement;
    this.#createImageBitmap = createImageBitmap;
    this.#createWorker = createWorker;
    this.#requestAnimationFrame = requestAnimationFrame;
    this.#cancelAnimationFrame = cancelAnimationFrame;
    this.#isSecureContext = isSecureContext;
    this.#warmupTimeoutMs = warmupTimeoutMs;
    this.#inferenceIntervalMs = inferenceIntervalMs;
    this.#staleDetectionThresholdMs = staleDetectionThresholdMs;
    this.#modelAssetPath = modelAssetPath;
    this.#wasmBasePath = wasmBasePath;
  }

  async start(): Promise<Result<FaceCalibration, FaceDeviceError>> {
    this.stop();

    if (!this.#isSecureContext()) {
      return { ok: false, error: { kind: 'deviceUnavailable' } };
    }

    try {
      const stream = await this.#getUserMedia({
        audio: false,
        video: {
          facingMode: 'user',
        },
      });
      const video = this.#createVideoElement();

      video.autoplay = true;
      video.muted = true;
      video.playsInline = true;
      video.srcObject = stream;

      this.#stream = stream;
      this.#video = video;
      this.#snapshot = createCheckingSnapshot('granted');

      await waitForVideoToBeReady(video);

      const worker = this.#createWorker();
      worker.onmessage = this.#handleWorkerMessage;
      worker.onerror = this.#handleWorkerError;
      this.#worker = worker;

      this.#initDeferred = createDeferred<Result<void, FaceDeviceError>>();
      worker.postMessage({
        type: 'init',
        requestId: INIT_REQUEST_ID,
        modelAssetPath: this.#modelAssetPath,
        wasmBasePath: this.#wasmBasePath,
      });

      const initResult = await this.#initDeferred.promise;
      this.#initDeferred = null;

      if (!initResult.ok) {
        this.stop();
        return initResult;
      }

      this.#running = true;
      this.#scheduleNextFrame();

      this.#warmupDeferred = createDeferred<Result<FaceCalibration, FaceDeviceError>>();
      this.#warmupTimer = setTimeout(() => {
        this.#warmupDeferred?.resolve({
          ok: false,
          error: {
            kind: 'deviceUnavailable',
            detail: 'faceNotDetected',
          },
        });
      }, this.#warmupTimeoutMs);

      const warmupResult = await this.#warmupDeferred.promise;
      this.#warmupDeferred = null;

      if (!warmupResult.ok) {
        this.stop();
        return warmupResult;
      }

      return warmupResult;
    } catch (error) {
      this.stop();
      return { ok: false, error: mapInputDeviceError(error) };
    }
  }

  stop(): void {
    this.#clearWarmupTimer();
    this.#running = false;
    this.#inferenceInFlight = false;
    this.#nextRequestId = 1;
    this.#lastInferenceRequestedAtMs = null;

    if (this.#animationFrameId !== null) {
      this.#cancelAnimationFrame(this.#animationFrameId);
      this.#animationFrameId = null;
    }

    this.#worker?.postMessage({ type: 'dispose' });
    this.#worker?.terminate();
    this.#worker = null;

    for (const track of this.#stream?.getTracks() ?? []) {
      track.stop();
    }

    this.#video?.pause();
    if (this.#video) {
      this.#video.srcObject = null;
    }

    this.#stream = null;
    this.#video = null;
    this.#warmupDeferred = null;
    this.#initDeferred = null;
    this.#snapshot = createIdleCameraSnapshot();
  }

  sample(sampledAtMs: number): CameraSnapshot {
    const lastProcessedAtMs = this.#snapshot.detection.lastProcessedAtMs;

    if (
      lastProcessedAtMs !== null &&
      sampledAtMs >= lastProcessedAtMs &&
      sampledAtMs - lastProcessedAtMs > this.#staleDetectionThresholdMs
    ) {
      return withStaleDetection(this.#snapshot);
    }

    return this.#snapshot;
  }

  readonly #handleWorkerMessage = (event: MessageEvent<FaceWorkerResponseMessage>): void => {
    const message = event.data;

    switch (message.type) {
      case 'ready':
        if (message.requestId === INIT_REQUEST_ID) {
          this.#initDeferred?.resolve({ ok: true, value: undefined });
        }
        break;
      case 'result':
        this.#inferenceInFlight = false;
        this.#snapshot = createReadySnapshot(
          message.faceBox,
          message.timestampMs,
          message.faceBox ? message.timestampMs : this.#snapshot.detection.lastDetectedAtMs,
        );
        if (message.faceBox) {
          this.#clearWarmupTimer();
          this.#warmupDeferred?.resolve({
            ok: true,
            value: {
              baselineFaceBox: message.faceBox,
            },
          });
        }
        break;
      case 'error':
        this.#inferenceInFlight = false;
        this.#snapshot = createErrorSnapshot('granted');

        if (message.stage === 'model-init') {
          this.#initDeferred?.resolve({
            ok: false,
            error: { kind: 'modelLoadFailed' },
          });
          break;
        }

        if (this.#warmupDeferred) {
          this.#clearWarmupTimer();
          this.#warmupDeferred.resolve({
            ok: false,
            error: {
              kind: 'deviceUnavailable',
              detail: 'inferenceFailed',
            },
          });
        }
        break;
    }
  };

  readonly #handleWorkerError = (): void => {
    this.#inferenceInFlight = false;
    this.#snapshot = createErrorSnapshot('granted');

    if (this.#initDeferred) {
      this.#initDeferred.resolve({
        ok: false,
        error: { kind: 'workerStartupFailed' },
      });
      return;
    }

    if (this.#warmupDeferred) {
      this.#clearWarmupTimer();
      this.#warmupDeferred.resolve({
        ok: false,
        error: { kind: 'workerStartupFailed' },
      });
    }
  };

  #clearWarmupTimer(): void {
    if (this.#warmupTimer !== null) {
      clearTimeout(this.#warmupTimer);
      this.#warmupTimer = null;
    }
  }

  #scheduleNextFrame(): void {
    if (!this.#running) {
      return;
    }

    this.#animationFrameId = this.#requestAnimationFrame((timestamp) => {
      void this.#processFrame(timestamp);
    });
  }

  async #processFrame(timestamp: number): Promise<void> {
    this.#animationFrameId = null;

    try {
      if (
        !this.#running ||
        this.#inferenceInFlight ||
        !this.#worker ||
        !this.#video ||
        this.#video.videoWidth <= 0 ||
        this.#video.videoHeight <= 0 ||
        (this.#lastInferenceRequestedAtMs !== null &&
          timestamp - this.#lastInferenceRequestedAtMs < this.#inferenceIntervalMs)
      ) {
        return;
      }

      this.#inferenceInFlight = true;
      this.#lastInferenceRequestedAtMs = timestamp;

      const frame = await this.#createImageBitmap(this.#video as unknown as CanvasImageSource);

      if (!this.#running || !this.#worker) {
        frame.close();
        this.#inferenceInFlight = false;
        return;
      }

      const requestId = this.#nextRequestId;
      this.#nextRequestId += 1;

      this.#worker.postMessage(
        {
          type: 'infer',
          requestId,
          timestampMs: timestamp,
          frame,
        },
        [frame],
      );
    } catch {
      this.#inferenceInFlight = false;
    } finally {
      this.#scheduleNextFrame();
    }
  }
}
