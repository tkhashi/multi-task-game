import type { RandomPort } from '../../app/runtime/RandomPort';
import { SESSION_DURATION_MS } from './GameState';
import type { GameState } from './GameState';
import type {
  CookingTaskState,
  FaceAlignTaskState,
  TaskChannel,
  TaskInputType,
  TaskInstanceState,
  TaskKind,
  TaskUrgency,
  VoiceRhythmTaskState,
  CleanupTaskState,
  ShhTaskState,
} from '../tasks/TaskTypes';

export interface PlannedSpawn {
  id: string;
  kind: TaskKind;
  channel: TaskChannel;
  inputType: TaskInputType;
  title: string;
  summary: string;
  urgency: TaskUrgency;
}

interface SpawnPhaseConfig {
  maxElapsedMs: number;
  desiredHandTasks: number;
  desiredSensorTasks: number;
  handWeights: Array<{ kind: 'cleanup' | 'cooking'; weight: number }>;
  microphoneWeights: Array<{ kind: 'voiceRhythm' | 'shh'; weight: number }>;
  cameraWeights: Array<{ kind: 'faceAlign'; weight: number }>;
}

const SPAWN_PHASES: SpawnPhaseConfig[] = [
  {
    maxElapsedMs: 60_000,
    desiredHandTasks: 1,
    desiredSensorTasks: 0,
    handWeights: [
      { kind: 'cleanup', weight: 0.55 },
      { kind: 'cooking', weight: 0.45 },
    ],
    microphoneWeights: [],
    cameraWeights: [],
  },
  {
    maxElapsedMs: 120_000,
    desiredHandTasks: 1,
    desiredSensorTasks: 1,
    handWeights: [
      { kind: 'cleanup', weight: 0.45 },
      { kind: 'cooking', weight: 0.55 },
    ],
    microphoneWeights: [{ kind: 'voiceRhythm', weight: 1 }],
    cameraWeights: [],
  },
  {
    maxElapsedMs: 180_000,
    desiredHandTasks: 1,
    desiredSensorTasks: 2,
    handWeights: [
      { kind: 'cleanup', weight: 0.4 },
      { kind: 'cooking', weight: 0.6 },
    ],
    microphoneWeights: [
      { kind: 'voiceRhythm', weight: 0.55 },
      { kind: 'shh', weight: 0.45 },
    ],
    cameraWeights: [{ kind: 'faceAlign', weight: 1 }],
  },
  {
    maxElapsedMs: 240_000,
    desiredHandTasks: 2,
    desiredSensorTasks: 2,
    handWeights: [
      { kind: 'cleanup', weight: 0.45 },
      { kind: 'cooking', weight: 0.55 },
    ],
    microphoneWeights: [
      { kind: 'voiceRhythm', weight: 0.45 },
      { kind: 'shh', weight: 0.55 },
    ],
    cameraWeights: [{ kind: 'faceAlign', weight: 1 }],
  },
  {
    maxElapsedMs: SESSION_DURATION_MS,
    desiredHandTasks: 2,
    desiredSensorTasks: 2,
    handWeights: [
      { kind: 'cleanup', weight: 0.35 },
      { kind: 'cooking', weight: 0.65 },
    ],
    microphoneWeights: [
      { kind: 'voiceRhythm', weight: 0.35 },
      { kind: 'shh', weight: 0.65 },
    ],
    cameraWeights: [{ kind: 'faceAlign', weight: 1 }],
  },
];

export interface GameSchedulerService {
  planSpawns(state: GameState, random: RandomPort): PlannedSpawn[];
}

function currentPhaseConfig(elapsedMs: number): SpawnPhaseConfig {
  return SPAWN_PHASES.find((phase) => elapsedMs < phase.maxElapsedMs) ?? SPAWN_PHASES[SPAWN_PHASES.length - 1];
}

function chooseWeightedKind<T extends { kind: TaskKind; weight: number }>(
  candidates: T[],
  random: RandomPort,
): T['kind'] | null {
  if (candidates.length === 0) {
    return null;
  }

  const totalWeight = candidates.reduce((sum, candidate) => sum + candidate.weight, 0);
  let cursor = random.next() * totalWeight;

  for (const candidate of candidates) {
    cursor -= candidate.weight;
    if (cursor <= 0) {
      return candidate.kind;
    }
  }

  return candidates[candidates.length - 1]?.kind ?? null;
}

function kindMetadata(kind: TaskKind): Pick<PlannedSpawn, 'channel' | 'inputType' | 'title' | 'summary'> {
  switch (kind) {
    case 'cleanup':
      return {
        channel: 'hand',
        inputType: 'keyboard',
        title: '片付け',
        summary: '散らかった物を収納して心労を下げる。',
      };
    case 'cooking':
      return {
        channel: 'hand',
        inputType: 'mouse',
        title: 'ベビーフード作り',
        summary: '工程を進めて赤ちゃんの機嫌と心労を立て直す。',
      };
    case 'voiceRhythm':
      return {
        channel: 'microphone',
        inputType: 'microphone',
        title: '呼びかけ連打',
        summary: '短い声かけでタイミングよくあやす。',
      };
    case 'shh':
      return {
        channel: 'microphone',
        inputType: 'microphone',
        title: 'しーっ',
        summary: '小さな声を保って落ち着かせる。',
      };
    case 'faceAlign':
      return {
        channel: 'camera',
        inputType: 'camera',
        title: '顔ポジション',
        summary: '顔を目標位置へ合わせて安心させる。',
      };
  }
}

function urgencyForElapsedMs(elapsedMs: number): TaskUrgency {
  if (elapsedMs >= 240_000) {
    return 'critical';
  }

  if (elapsedMs >= 180_000) {
    return 'urgent';
  }

  if (elapsedMs >= 120_000) {
    return 'attention';
  }

  return 'stable';
}

function nextTaskId(kind: TaskKind, elapsedMs: number, ordinal: number): string {
  return `${kind}-${elapsedMs}-${ordinal}`;
}

function activeKinds(activeTasks: Record<string, TaskInstanceState>): Set<TaskKind> {
  return new Set(Object.values(activeTasks).map((task) => task.kind));
}

function countByChannel(activeTasks: Record<string, TaskInstanceState>) {
  const tasks = Object.values(activeTasks);
  return {
    total: tasks.length,
    hand: tasks.filter((task) => task.channel === 'hand').length,
    sensor: tasks.filter((task) => task.channel !== 'hand').length,
    microphone: tasks.filter((task) => task.channel === 'microphone').length,
    camera: tasks.filter((task) => task.channel === 'camera').length,
  };
}

function appendPlannedTask(
  plannedKinds: Set<TaskKind>,
  plans: PlannedSpawn[],
  kind: TaskKind | null,
  state: GameState,
): void {
  if (!kind || plannedKinds.has(kind)) {
    return;
  }

  plannedKinds.add(kind);
  const metadata = kindMetadata(kind);
  plans.push({
    id: nextTaskId(kind, state.elapsedMs, plans.length + 1),
    kind,
    urgency: urgencyForElapsedMs(state.elapsedMs),
    ...metadata,
  });
}

export class GameScheduler implements GameSchedulerService {
  planSpawns(state: GameState, random: RandomPort): PlannedSpawn[] {
    if (state.phase !== 'playing') {
      return [];
    }

    const phase = currentPhaseConfig(state.elapsedMs);
    const activeTaskKinds = activeKinds(state.activeTasks);
    const counts = countByChannel(state.activeTasks);
    const plans: PlannedSpawn[] = [];
    const plannedKinds = new Set<TaskKind>();

    const pickKind = <T extends { kind: TaskKind; weight: number }>(candidates: T[]): TaskKind | null =>
      chooseWeightedKind(
        candidates.filter((candidate) => !activeTaskKinds.has(candidate.kind) && !plannedKinds.has(candidate.kind)),
        random,
      );

    while (
      counts.total + plans.length < state.taskLimits.totalActive &&
      counts.hand + plans.filter((plan) => plan.channel === 'hand').length < phase.desiredHandTasks
    ) {
      appendPlannedTask(plannedKinds, plans, pickKind(phase.handWeights), state);
      if (phase.handWeights.every((candidate) => activeTaskKinds.has(candidate.kind) || plannedKinds.has(candidate.kind))) {
        break;
      }
    }

    while (
      counts.total + plans.length < state.taskLimits.totalActive &&
      counts.sensor + plans.filter((plan) => plan.channel !== 'hand').length < phase.desiredSensorTasks
    ) {
      const microphoneActive =
        counts.microphone + plans.filter((plan) => plan.channel === 'microphone').length >=
        state.taskLimits.microphoneTasks;
      const cameraActive =
        counts.camera + plans.filter((plan) => plan.channel === 'camera').length >=
        state.taskLimits.cameraTasks;

      const sensorCandidates: Array<{ kind: TaskKind; weight: number }> = [];
      if (!microphoneActive) {
        sensorCandidates.push(...phase.microphoneWeights);
      }
      if (!cameraActive) {
        sensorCandidates.push(...phase.cameraWeights);
      }

      appendPlannedTask(plannedKinds, plans, pickKind(sensorCandidates), state);
      if (sensorCandidates.every((candidate) => activeTaskKinds.has(candidate.kind) || plannedKinds.has(candidate.kind))) {
        break;
      }
    }

    return plans;
  }
}

export const gameScheduler: GameSchedulerService = new GameScheduler();

export function createTaskFromSpawn(plan: PlannedSpawn, startedAtMs: number): TaskInstanceState {
  const base = {
    id: plan.id,
    kind: plan.kind,
    channel: plan.channel,
    inputType: plan.inputType,
    title: plan.title,
    summary: plan.summary,
    urgency: plan.urgency,
    lifecycle: 'active' as const,
    progress: 0,
    startedAtMs,
    updatedAtMs: startedAtMs,
  };

  switch (plan.kind) {
    case 'cleanup':
      return {
        ...base,
        kind: 'cleanup',
        channel: 'hand',
        inputType: 'keyboard',
        totalItems: 3,
        storedItems: 0,
        remainingItems: 3,
        playerPosition: { x: 5, y: 3 },
        carriedItemId: null,
        items: [
          {
            id: `${plan.id}-sock`,
            label: '靴下',
            targetStorage: 'basket',
            pickupReward: 2,
            storeReward: 4,
            position: { x: 2.1, y: 2.2 },
            picked: false,
            stored: false,
          },
          {
            id: `${plan.id}-toy`,
            label: 'おもちゃ',
            targetStorage: 'box',
            pickupReward: 2,
            storeReward: 5,
            position: { x: 6.4, y: 2.8 },
            picked: false,
            stored: false,
          },
          {
            id: `${plan.id}-bottle`,
            label: '哺乳瓶',
            targetStorage: 'kitchen',
            pickupReward: 2,
            storeReward: 7,
            position: { x: 7.8, y: 4.7 },
            picked: false,
            stored: false,
          },
        ],
      } satisfies CleanupTaskState;
    case 'cooking':
      return {
        ...base,
        kind: 'cooking',
        channel: 'hand',
        inputType: 'mouse',
        step: 'select',
        cue: 'safe',
      } satisfies CookingTaskState;
    case 'voiceRhythm':
      return {
        ...base,
        kind: 'voiceRhythm',
        channel: 'microphone',
        inputType: 'microphone',
        noteCount: 4,
        judgedCount: 0,
        hitCount: 0,
        missCount: 0,
        tooLoudCount: 0,
        lastJudgement: 'idle',
      } satisfies VoiceRhythmTaskState;
    case 'shh':
      return {
        ...base,
        kind: 'shh',
        channel: 'microphone',
        inputType: 'microphone',
        targetHoldMs: 3_000,
        heldMs: 0,
        silentMs: 0,
        stability: 'silent',
      } satisfies ShhTaskState;
    case 'faceAlign':
      return {
        ...base,
        kind: 'faceAlign',
        channel: 'camera',
        inputType: 'camera',
        targetSlots: startedAtMs >= 240_000 ? 2 : 1,
        heldMs: 0,
        missingMs: 0,
        hint: 'show-face',
      } satisfies FaceAlignTaskState;
  }
}
