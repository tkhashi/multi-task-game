import { describe, expect, it } from 'vitest';

import type { AudioAnalyzerPort } from '../audio/AudioAnalyzerPort';
import type { FaceDetectorPort } from '../camera/FaceDetectorPort';
import { InputFrameCollector } from './InputFrameCollector';
import type { KeyboardSnapshotSource } from './KeyboardAdapter';
import type { MouseSnapshotSource } from './MouseAdapter';

describe('InputFrameCollector', () => {
  it('bundles keyboard, mouse, microphone, and camera snapshots into one frame', () => {
    const collector = new InputFrameCollector({
      keyboard: {
        sample: () => ({
          pressedKeys: ['ArrowLeft'],
          justPressedKeys: ['KeyZ'],
          movement: { horizontal: -1, vertical: 0 },
          modifiers: { shift: true, alt: false, ctrl: false, meta: false },
        }),
      } satisfies KeyboardSnapshotSource,
      mouse: {
        sample: () => ({
          position: { x: 120, y: 80 },
          delta: { x: 4, y: -2 },
          buttonsDown: ['left'],
          wheelDelta: 0,
          primaryReleased: false,
        }),
      } satisfies MouseSnapshotSource,
      microphone: {
        start: async () => {
          throw new Error('not used in collect test');
        },
        stop: () => {},
        sample: () => ({
          permission: 'granted',
          readiness: 'ready',
          ready: true,
          rms: 0.18,
          peak: 0.31,
          stability: 0.74,
          isSpeaking: true,
          isTooLoud: false,
        }),
      } satisfies AudioAnalyzerPort,
      camera: {
        start: async () => {
          throw new Error('not used in collect test');
        },
        stop: () => {},
        sample: () => ({
          permission: 'granted',
          readiness: 'ready',
          ready: true,
          faceDetected: true,
          faceBox: {
            centerX: 0.5,
            centerY: 0.48,
            width: 0.22,
            height: 0.28,
          },
          hint: 'hold',
          detection: {
            lastProcessedAtMs: 1234,
            lastDetectedAtMs: 1234,
            stale: false,
          },
        }),
      } satisfies FaceDetectorPort,
    });

    expect(collector.collect(1234)).toEqual({
      sampledAtMs: 1234,
      keyboard: {
        pressedKeys: ['ArrowLeft'],
        justPressedKeys: ['KeyZ'],
        movement: { horizontal: -1, vertical: 0 },
        modifiers: { shift: true, alt: false, ctrl: false, meta: false },
      },
      mouse: {
        position: { x: 120, y: 80 },
        delta: { x: 4, y: -2 },
        buttonsDown: ['left'],
        wheelDelta: 0,
        primaryReleased: false,
      },
      microphone: {
        permission: 'granted',
        readiness: 'ready',
        ready: true,
        rms: 0.18,
        peak: 0.31,
        stability: 0.74,
        isSpeaking: true,
        isTooLoud: false,
      },
      camera: {
        permission: 'granted',
        readiness: 'ready',
        ready: true,
        faceDetected: true,
        faceBox: {
          centerX: 0.5,
          centerY: 0.48,
          width: 0.22,
          height: 0.28,
        },
        hint: 'hold',
        detection: {
          lastProcessedAtMs: 1234,
          lastDetectedAtMs: 1234,
          stale: false,
        },
      },
    });
  });
});
