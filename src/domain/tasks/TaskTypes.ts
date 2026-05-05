export const GAME_TASK_LIMITS = {
  totalActive: 4,
  handTasks: 2,
  sensorTasks: 2,
  microphoneTasks: 1,
  cameraTasks: 1,
} as const;

export type TaskChannel = 'hand' | 'microphone' | 'camera';
export type TaskInputType = 'keyboard' | 'mouse' | 'microphone' | 'camera';
export type TaskUrgency = 'stable' | 'attention' | 'urgent' | 'critical';
export type TaskLifecycle = 'active' | 'completed' | 'failed';

export interface TaskBaseState {
  id: string;
  kind: TaskKind;
  channel: TaskChannel;
  inputType: TaskInputType;
  title: string;
  summary: string;
  urgency: TaskUrgency;
  lifecycle: TaskLifecycle;
  progress: number;
  startedAtMs: number;
  updatedAtMs: number;
}

export interface CleanupTaskState extends TaskBaseState {
  kind: 'cleanup';
  channel: 'hand';
  inputType: 'keyboard';
  totalItems: number;
  storedItems: number;
  remainingItems: number;
}

export type CookingStep = 'select' | 'mash' | 'heat' | 'cool' | 'feed';
export type CookingCue = 'safe' | 'soon' | 'now' | 'danger';

export interface CookingTaskState extends TaskBaseState {
  kind: 'cooking';
  channel: 'hand';
  inputType: 'mouse';
  step: CookingStep;
  cue: CookingCue;
}

export interface VoiceRhythmTaskState extends TaskBaseState {
  kind: 'voiceRhythm';
  channel: 'microphone';
  inputType: 'microphone';
  noteCount: number;
  hitCount: number;
  tooLoudCount: number;
}

export type ShhStability = 'stable' | 'shaky' | 'silent' | 'loud';

export interface ShhTaskState extends TaskBaseState {
  kind: 'shh';
  channel: 'microphone';
  inputType: 'microphone';
  targetHoldMs: number;
  heldMs: number;
  stability: ShhStability;
}

export type FaceAlignHint =
  | 'show-face'
  | 'move-left'
  | 'move-right'
  | 'move-up'
  | 'move-down'
  | 'move-forward'
  | 'move-back'
  | 'hold';

export interface FaceAlignTaskState extends TaskBaseState {
  kind: 'faceAlign';
  channel: 'camera';
  inputType: 'camera';
  targetSlots: number;
  heldMs: number;
  hint: FaceAlignHint;
}

export type HandTaskState = CleanupTaskState | CookingTaskState;
export type SensorTaskState = VoiceRhythmTaskState | ShhTaskState | FaceAlignTaskState;

export type TaskInstanceState =
  | CleanupTaskState
  | CookingTaskState
  | VoiceRhythmTaskState
  | ShhTaskState
  | FaceAlignTaskState;

export type TaskKind = TaskInstanceState['kind'];
