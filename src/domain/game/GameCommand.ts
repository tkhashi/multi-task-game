import type { GameOutcome, PermissionState } from './GameState';

export type GameCommand =
  | { type: 'openPermissionCheck' }
  | { type: 'setDevicePermission'; device: 'microphone' | 'camera'; permission: PermissionState }
  | { type: 'beginDeviceCheck' }
  | { type: 'completeDeviceCheck' }
  | { type: 'startSession' }
  | { type: 'pauseSession' }
  | { type: 'resumeSession' }
  | { type: 'focusHandTask'; taskId: string | null }
  | { type: 'finishSession'; outcome: GameOutcome }
  | { type: 'returnToTitle' }
  | { type: 'retrySession' };
