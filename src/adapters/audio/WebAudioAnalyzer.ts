import type { AudioCalibration } from '../../domain/game/GameState';
import {
  createIdleMicrophoneSnapshot,
  type MicrophoneSnapshot,
} from '../../domain/input/MicrophoneSnapshot';
import type { AudioAnalyzerPort, InputDeviceError, Result } from './AudioAnalyzerPort';
import { calculatePeak, calculateRms, calculateStability } from './rms';

const DEFAULT_CALIBRATION_SAMPLE_COUNT = 12;
const DEFAULT_SAMPLE_HISTORY_SIZE = 6;
const DEFAULT_ANALYSER_FFT_SIZE = 2048;
const DEFAULT_MINIMUM_SPEAKING_THRESHOLD = 0.08;
const DEFAULT_SPEAKING_MARGIN = 0.03;
const DEFAULT_MINIMUM_TOO_LOUD_THRESHOLD = 0.35;
const DEFAULT_TOO_LOUD_MULTIPLIER = 3;
const DEFAULT_TOO_LOUD_MARGIN = 0.2;

export interface WebAudioAnalyzerDependencies {
  getUserMedia?: (constraints: MediaStreamConstraints) => Promise<MediaStream>;
  createAudioContext?: () => AudioContext;
  isSecureContext?: () => boolean;
  calibrationSampleCount?: number;
  sampleHistorySize?: number;
  analyserFftSize?: number;
  minimumSpeakingThreshold?: number;
  speakingMargin?: number;
  minimumTooLoudThreshold?: number;
  tooLoudMultiplier?: number;
  tooLoudMargin?: number;
}

function getDefaultAudioContext(): AudioContext {
  const AudioContextConstructor = globalThis.AudioContext;
  if (!AudioContextConstructor) {
    throw new Error('AudioContext is not available');
  }

  return new AudioContextConstructor();
}

function getDefaultUserMedia(constraints: MediaStreamConstraints): Promise<MediaStream> {
  const mediaDevices = globalThis.navigator?.mediaDevices;
  if (!mediaDevices?.getUserMedia) {
    throw new Error('getUserMedia is not available');
  }

  return mediaDevices.getUserMedia(constraints);
}

function mean(values: readonly number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function createReadySnapshot(
  rms: number,
  peak: number,
  stability: number,
  calibration: AudioCalibration,
): MicrophoneSnapshot {
  return {
    permission: 'granted',
    readiness: 'ready',
    ready: true,
    rms,
    peak,
    stability,
    isSpeaking: rms >= calibration.speakingThreshold,
    isTooLoud: peak >= calibration.tooLoudThreshold || rms >= calibration.tooLoudThreshold,
  };
}

function mapInputDeviceError(error: unknown): InputDeviceError {
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
      error.message.includes('AudioContext is not available'))
  ) {
    return { kind: 'deviceUnavailable' };
  }

  return { kind: 'calibrationFailed' };
}

export class WebAudioAnalyzer implements AudioAnalyzerPort {
  readonly #getUserMedia: (constraints: MediaStreamConstraints) => Promise<MediaStream>;
  readonly #createAudioContext: () => AudioContext;
  readonly #isSecureContext: () => boolean;
  readonly #calibrationSampleCount: number;
  readonly #sampleHistorySize: number;
  readonly #analyserFftSize: number;
  readonly #minimumSpeakingThreshold: number;
  readonly #speakingMargin: number;
  readonly #minimumTooLoudThreshold: number;
  readonly #tooLoudMultiplier: number;
  readonly #tooLoudMargin: number;

  #stream: MediaStream | null = null;
  #audioContext: AudioContext | null = null;
  #sourceNode: MediaStreamAudioSourceNode | null = null;
  #analyserNode: AnalyserNode | null = null;
  #sampleBuffer: Uint8Array<ArrayBuffer> | null = null;
  #calibration: AudioCalibration | null = null;
  #snapshot: MicrophoneSnapshot = createIdleMicrophoneSnapshot();
  #sampleHistory: number[] = [];

  constructor({
    getUserMedia = getDefaultUserMedia,
    createAudioContext = getDefaultAudioContext,
    isSecureContext = () => globalThis.isSecureContext ?? false,
    calibrationSampleCount = DEFAULT_CALIBRATION_SAMPLE_COUNT,
    sampleHistorySize = DEFAULT_SAMPLE_HISTORY_SIZE,
    analyserFftSize = DEFAULT_ANALYSER_FFT_SIZE,
    minimumSpeakingThreshold = DEFAULT_MINIMUM_SPEAKING_THRESHOLD,
    speakingMargin = DEFAULT_SPEAKING_MARGIN,
    minimumTooLoudThreshold = DEFAULT_MINIMUM_TOO_LOUD_THRESHOLD,
    tooLoudMultiplier = DEFAULT_TOO_LOUD_MULTIPLIER,
    tooLoudMargin = DEFAULT_TOO_LOUD_MARGIN,
  }: WebAudioAnalyzerDependencies = {}) {
    this.#getUserMedia = getUserMedia;
    this.#createAudioContext = createAudioContext;
    this.#isSecureContext = isSecureContext;
    this.#calibrationSampleCount = calibrationSampleCount;
    this.#sampleHistorySize = sampleHistorySize;
    this.#analyserFftSize = analyserFftSize;
    this.#minimumSpeakingThreshold = minimumSpeakingThreshold;
    this.#speakingMargin = speakingMargin;
    this.#minimumTooLoudThreshold = minimumTooLoudThreshold;
    this.#tooLoudMultiplier = tooLoudMultiplier;
    this.#tooLoudMargin = tooLoudMargin;
  }

  async start(): Promise<Result<AudioCalibration, InputDeviceError>> {
    this.stop();

    if (!this.#isSecureContext()) {
      return { ok: false, error: { kind: 'deviceUnavailable' } };
    }

    try {
      const stream = await this.#getUserMedia({ audio: true, video: false });
      const audioContext = this.#createAudioContext();
      const sourceNode = audioContext.createMediaStreamSource(stream);
      const analyserNode = audioContext.createAnalyser();

      analyserNode.fftSize = this.#analyserFftSize;

      const bufferLength = analyserNode.fftSize;
      if (!Number.isFinite(bufferLength) || bufferLength <= 0) {
        throw new Error('invalid analyser fftSize');
      }

      const sampleBuffer = new Uint8Array(bufferLength) as Uint8Array<ArrayBuffer>;

      sourceNode.connect(analyserNode);

      const calibrationSamples: number[] = [];
      for (let index = 0; index < this.#calibrationSampleCount; index += 1) {
        analyserNode.getByteTimeDomainData(sampleBuffer);
        calibrationSamples.push(calculateRms(sampleBuffer));
      }

      const noiseFloor = mean(calibrationSamples);
      const speakingThreshold = Math.max(
        this.#minimumSpeakingThreshold,
        noiseFloor + this.#speakingMargin,
      );
      const tooLoudThreshold = Math.max(
        this.#minimumTooLoudThreshold,
        speakingThreshold * this.#tooLoudMultiplier,
        speakingThreshold + this.#tooLoudMargin,
      );

      if (
        !Number.isFinite(noiseFloor) ||
        !Number.isFinite(speakingThreshold) ||
        !Number.isFinite(tooLoudThreshold) ||
        tooLoudThreshold <= speakingThreshold
      ) {
        throw new Error('failed to calibrate thresholds');
      }

      const calibration: AudioCalibration = {
        noiseFloor,
        speakingThreshold,
        tooLoudThreshold,
      };

      this.#stream = stream;
      this.#audioContext = audioContext;
      this.#sourceNode = sourceNode;
      this.#analyserNode = analyserNode;
      this.#sampleBuffer = sampleBuffer;
      this.#calibration = calibration;
      this.#sampleHistory = [];
      this.#snapshot = createReadySnapshot(0, 0, 0, calibration);

      return { ok: true, value: calibration };
    } catch (error) {
      this.stop();
      return { ok: false, error: mapInputDeviceError(error) };
    }
  }

  stop(): void {
    this.#sourceNode?.disconnect();

    for (const track of this.#stream?.getTracks() ?? []) {
      track.stop();
    }

    void this.#audioContext?.close().catch(() => {
      // Closing can fail during browser teardown; the adapter only needs best-effort cleanup.
    });

    this.#stream = null;
    this.#audioContext = null;
    this.#sourceNode = null;
    this.#analyserNode = null;
    this.#sampleBuffer = null;
    this.#calibration = null;
    this.#sampleHistory = [];
    this.#snapshot = createIdleMicrophoneSnapshot();
  }

  sample(sampledAtMs: number): MicrophoneSnapshot {
    void sampledAtMs;

    if (!this.#analyserNode || !this.#sampleBuffer || !this.#calibration) {
      return this.#snapshot;
    }

    this.#analyserNode.getByteTimeDomainData(this.#sampleBuffer);

    const rms = calculateRms(this.#sampleBuffer);
    const peak = calculatePeak(this.#sampleBuffer);

    this.#sampleHistory.push(rms);
    if (this.#sampleHistory.length > this.#sampleHistorySize) {
      this.#sampleHistory.shift();
    }

    const stability =
      rms >= this.#calibration.speakingThreshold
        ? calculateStability(this.#sampleHistory, this.#calibration.speakingThreshold)
        : 0;

    this.#snapshot = createReadySnapshot(rms, peak, stability, this.#calibration);
    return this.#snapshot;
  }
}
