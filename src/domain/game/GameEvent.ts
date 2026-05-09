import type { GameOutcome, GamePhase, GameResult, WarningSeverity } from './GameState';
import type { TaskKind } from '../tasks/TaskTypes';

export type GameOverReason = 'babyMoodCollapsed' | 'parentStressCollapsed' | 'doubleDanger';

export type GameEvent =
  | { type: 'phaseChanged'; phase: GamePhase }
  | { type: 'taskSpawned'; taskId: string; taskKind: TaskKind }
  | { type: 'taskCompleted'; taskId: string; taskKind: TaskKind }
  | { type: 'taskFailed'; taskId: string; taskKind: TaskKind }
  | { type: 'gaugeChanged'; target: 'babyMood' | 'parentStress'; before: number; after: number; reason: string }
  | { type: 'warningRaised'; warningId: string; severity: WarningSeverity; message: string }
  | { type: 'warningCleared'; warningId: string }
  | { type: 'focusChanged'; taskId: string | null }
  | { type: 'sensorReadinessChanged'; device: 'microphone' | 'camera'; ready: boolean }
  | { type: 'gameOver'; reason: GameOverReason }
  | { type: 'gameCleared'; result: GameResult }
  | { type: 'scoreAdded'; amount: number; reason: string }
  | { type: 'sessionFinished'; outcome: GameOutcome };
