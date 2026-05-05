import { GAME_TASK_LIMITS, type TaskInstanceState } from '../tasks/TaskTypes';

export const SESSION_DURATION_MS = 5 * 60 * 1000;
export const GAUGE_MAX = 100;

export type GamePhase =
  | 'title'
  | 'permissionCheck'
  | 'deviceCheck'
  | 'ready'
  | 'playing'
  | 'paused'
  | 'gameOver'
  | 'result';

export type PermissionState = 'prompt' | 'granted' | 'denied' | 'unsupported';
export type DeviceReadiness = 'idle' | 'checking' | 'ready' | 'error';
export type GameOutcome = 'cleared' | 'timeout' | 'gameOver';
export type ResultRank = 'S' | 'A' | 'B' | 'C';
export type WarningSeverity = 'info' | 'warning' | 'danger';

export interface GaugeState {
  current: number;
  min: number;
  max: number;
  dangerThreshold: number;
}

export interface ScoreState {
  total: number;
  comboStreak: number;
  bestComboStreak: number;
}

export interface GameMetrics {
  successCount: number;
  partialCount: number;
  comboCount: number;
  failureCount: number;
}

export interface WarningState {
  id: string;
  type: 'babyMood' | 'parentStress' | 'doubleDanger' | 'task' | 'device';
  severity: WarningSeverity;
  message: string;
  createdAtMs: number;
}

export interface CollapseTimers {
  babyMoodZeroMs: number;
  parentStressMaxMs: number;
  bothDangerMs: number;
}

export interface AudioCalibration {
  noiseFloor: number;
  speakingThreshold: number;
  tooLoudThreshold: number;
}

export interface FaceCalibration {
  targetCenterX: number;
  targetCenterY: number;
  targetSize: number;
}

export interface DeviceChannelState {
  permission: PermissionState;
  readiness: DeviceReadiness;
  ready: boolean;
  inUse: boolean;
  lastError: string | null;
}

export interface SessionState {
  microphone: DeviceChannelState;
  camera: DeviceChannelState;
  audioCalibration: AudioCalibration | null;
  faceCalibration: FaceCalibration | null;
}

export interface GameResult {
  rank: ResultRank;
  outcome: GameOutcome;
  comment: string;
  finalGauges: {
    babyMood: number;
    parentStress: number;
  };
  metrics: GameMetrics;
  finishedAtMs: number;
}

export interface GameState {
  phase: GamePhase;
  elapsedMs: number;
  remainingMs: number;
  gauges: {
    babyMood: GaugeState;
    parentStress: GaugeState;
  };
  score: ScoreState;
  taskLimits: typeof GAME_TASK_LIMITS;
  activeTasks: Record<string, TaskInstanceState>;
  focusedHandTaskId: string | null;
  warnings: WarningState[];
  collapseTimers: CollapseTimers;
  session: SessionState;
  metrics: GameMetrics;
  result: GameResult | null;
}

function createDeviceChannelState(): DeviceChannelState {
  return {
    permission: 'prompt',
    readiness: 'idle',
    ready: false,
    inUse: false,
    lastError: null,
  };
}

export function createInitialGameState(): GameState {
  return {
    phase: 'title',
    elapsedMs: 0,
    remainingMs: SESSION_DURATION_MS,
    gauges: {
      babyMood: {
        current: GAUGE_MAX,
        min: 0,
        max: GAUGE_MAX,
        dangerThreshold: 25,
      },
      parentStress: {
        current: 0,
        min: 0,
        max: GAUGE_MAX,
        dangerThreshold: 75,
      },
    },
    score: {
      total: 0,
      comboStreak: 0,
      bestComboStreak: 0,
    },
    taskLimits: GAME_TASK_LIMITS,
    activeTasks: {},
    focusedHandTaskId: null,
    warnings: [],
    collapseTimers: {
      babyMoodZeroMs: 0,
      parentStressMaxMs: 0,
      bothDangerMs: 0,
    },
    session: {
      microphone: createDeviceChannelState(),
      camera: createDeviceChannelState(),
      audioCalibration: null,
      faceCalibration: null,
    },
    metrics: {
      successCount: 0,
      partialCount: 0,
      comboCount: 0,
      failureCount: 0,
    },
    result: null,
  };
}
