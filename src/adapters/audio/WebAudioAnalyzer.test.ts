import { describe, expect, it } from 'vitest';

import { createIdleMicrophoneSnapshot } from '../../domain/input/MicrophoneSnapshot';
import { WebAudioAnalyzer } from './WebAudioAnalyzer';

class FakeMediaStreamTrack {
  stopped = false;

  stop(): void {
    this.stopped = true;
  }
}

class FakeMediaStream {
  readonly #tracks: FakeMediaStreamTrack[];

  constructor(tracks: FakeMediaStreamTrack[]) {
    this.#tracks = tracks;
  }

  getTracks(): FakeMediaStreamTrack[] {
    return this.#tracks;
  }
}

class FakeAnalyserNode {
  fftSize = 32;
  readonly frames: Uint8Array[];
  frameIndex = 0;

  constructor(frames: Uint8Array[]) {
    this.frames = frames;
  }

  getByteTimeDomainData(target: Uint8Array): void {
    const frame = this.frames[Math.min(this.frameIndex, this.frames.length - 1)];
    target.set(frame);
    this.frameIndex += 1;
  }
}

class FakeMediaStreamSource {
  connectedNode: FakeAnalyserNode | null = null;

  connect(node: FakeAnalyserNode): void {
    this.connectedNode = node;
  }

  disconnect(): void {
    this.connectedNode = null;
  }
}

class FakeAudioContext {
  readonly analyser: FakeAnalyserNode;
  readonly source = new FakeMediaStreamSource();
  closed = false;

  constructor(analyser: FakeAnalyserNode) {
    this.analyser = analyser;
  }

  createAnalyser(): FakeAnalyserNode {
    return this.analyser;
  }

  createMediaStreamSource(): FakeMediaStreamSource {
    return this.source;
  }

  async close(): Promise<void> {
    this.closed = true;
  }
}

function toConstantFrame(level: number, size = 32): Uint8Array {
  const byte = Math.max(0, Math.min(255, Math.round(level * 128 + 128)));
  return Uint8Array.from({ length: size }, () => byte);
}

describe('WebAudioAnalyzer', () => {
  it('calibrates thresholds once and keeps returning speaking snapshots while running', async () => {
    const analyser = new FakeAnalyserNode([
      toConstantFrame(0.01),
      toConstantFrame(0.02),
      toConstantFrame(0.01),
      toConstantFrame(0.02),
      toConstantFrame(0.25),
      toConstantFrame(0.24),
      toConstantFrame(0.23),
      toConstantFrame(0.52),
    ]);
    const audioContext = new FakeAudioContext(analyser);
    const track = new FakeMediaStreamTrack();
    const stream = new FakeMediaStream([track]);
    const adapter = new WebAudioAnalyzer({
      getUserMedia: async () => stream as unknown as MediaStream,
      createAudioContext: () => audioContext as unknown as AudioContext,
      isSecureContext: () => true,
      calibrationSampleCount: 4,
      sampleHistorySize: 4,
      analyserFftSize: 32,
    });

    const started = await adapter.start();
    adapter.sample(100);
    adapter.sample(116);
    const speakingSnapshot = adapter.sample(132);
    const tooLoudSnapshot = adapter.sample(148);

    expect(started.ok).toBe(true);
    if (!started.ok) {
      return;
    }

    expect(started.value.noiseFloor).toBeGreaterThan(0);
    expect(started.value.speakingThreshold).toBeGreaterThan(started.value.noiseFloor);
    expect(started.value.tooLoudThreshold).toBeGreaterThan(started.value.speakingThreshold);
    expect(speakingSnapshot.permission).toBe('granted');
    expect(speakingSnapshot.readiness).toBe('ready');
    expect(speakingSnapshot.ready).toBe(true);
    expect(speakingSnapshot.isSpeaking).toBe(true);
    expect(speakingSnapshot.isTooLoud).toBe(false);
    expect(speakingSnapshot.peak).toBeGreaterThan(0.2);
    expect(speakingSnapshot.stability).toBeGreaterThan(0.65);
    expect(tooLoudSnapshot.isTooLoud).toBe(true);
    expect(tooLoudSnapshot.peak).toBeGreaterThan(0.5);
  });

  it('returns permissionDenied when microphone access is rejected', async () => {
    const adapter = new WebAudioAnalyzer({
      getUserMedia: async () => {
        throw new DOMException('blocked', 'NotAllowedError');
      },
      isSecureContext: () => true,
      createAudioContext: () => {
        throw new Error('should not create audio context');
      },
    });

    await expect(adapter.start()).resolves.toEqual({
      ok: false,
      error: { kind: 'permissionDenied' },
    });
    expect(adapter.sample(0)).toEqual(createIdleMicrophoneSnapshot());
  });

  it('returns deviceUnavailable when the browser cannot provide microphone input', async () => {
    const adapter = new WebAudioAnalyzer({
      getUserMedia: async () => {
        throw new DOMException('missing', 'NotFoundError');
      },
      isSecureContext: () => true,
    });

    await expect(adapter.start()).resolves.toEqual({
      ok: false,
      error: { kind: 'deviceUnavailable' },
    });
  });

  it('stops the active track and resets the snapshot after stop', async () => {
    const analyser = new FakeAnalyserNode([
      toConstantFrame(0.01),
      toConstantFrame(0.02),
      toConstantFrame(0.01),
      toConstantFrame(0.02),
      toConstantFrame(0.22),
    ]);
    const audioContext = new FakeAudioContext(analyser);
    const track = new FakeMediaStreamTrack();
    const stream = new FakeMediaStream([track]);
    const adapter = new WebAudioAnalyzer({
      getUserMedia: async () => stream as unknown as MediaStream,
      createAudioContext: () => audioContext as unknown as AudioContext,
      isSecureContext: () => true,
      calibrationSampleCount: 4,
      analyserFftSize: 32,
    });

    await adapter.start();
    adapter.sample(33);

    await adapter.stop();

    expect(track.stopped).toBe(true);
    expect(audioContext.closed).toBe(true);
    expect(adapter.sample(66)).toEqual(createIdleMicrophoneSnapshot());
  });
});
