import type { GameOutcome, GamePhase, WarningSeverity } from './GameState';
import type { TaskKind } from '../tasks/TaskTypes';

export type GameEvent =
  | { type: 'phaseChanged'; phase: GamePhase }
  | { type: 'taskSpawned'; taskId: string; taskKind: TaskKind }
  | { type: 'taskCompleted'; taskId: string; taskKind: TaskKind }
  | { type: 'taskFailed'; taskId: string; taskKind: TaskKind }
  | { type: 'warningRaised'; warningId: string; severity: WarningSeverity; message: string }
  | { type: 'warningCleared'; warningId: string }
  | { type: 'focusChanged'; taskId: string | null }
  | { type: 'sensorReadinessChanged'; device: 'microphone' | 'camera'; ready: boolean }
  | { type: 'sessionFinished'; outcome: GameOutcome };
