import type {
  DeviceChannelState,
  GamePhase,
  GameResult,
  GameState,
  WarningSeverity,
} from '../../domain/game/GameState';
import { createInitialGameState } from '../../domain/game/GameState';
import type {
  CookingTaskState,
  HandTaskState,
  TaskInstanceState,
  TaskUrgency,
} from '../../domain/tasks/TaskTypes';

export interface GaugeViewModel {
  label: string;
  current: number;
  max: number;
  tone: 'calm' | 'warning' | 'danger';
}

export interface TaskSummaryViewModel {
  id: string;
  label: string;
  inputTypeLabel: string;
  urgency: TaskUrgency;
  urgencyLabel: string;
  progressPercent: number;
}

export interface SensorStatusViewModel {
  label: string;
  active: boolean;
  tone: 'muted' | 'ready' | 'blocked' | 'error';
  helperText: string;
}

export interface ScreenViewModel {
  title: string;
  subtitle: string;
  body: string;
  highlights: string[];
}

export interface WarningViewModel {
  id: string;
  label: string;
  tone: WarningSeverity;
}

export interface ResultViewModel {
  rank: string;
  comment: string;
  outcomeLabel: string;
  metrics: {
    successCount: number;
    partialCount: number;
    comboCount: number;
    failureCount: number;
  };
  finalGauges: {
    babyMood: number;
    parentStress: number;
  };
}

export interface GameViewModel {
  phase: GamePhase;
  screen: ScreenViewModel;
  hud: {
    remainingTimeLabel: string;
    gauges: {
      babyMood: GaugeViewModel;
      parentStress: GaugeViewModel;
    };
    tasks: {
      maxConcurrent: number;
      active: TaskSummaryViewModel[];
    };
    sensors: {
      microphone: SensorStatusViewModel;
      camera: SensorStatusViewModel;
    };
    warnings: WarningViewModel[];
  };
  result: ResultViewModel | null;
}

export interface FocusedTaskSceneViewModel {
  id: string;
  kind: HandTaskState['kind'];
  title: string;
  progressPercent: number;
  detail: string;
}

export interface SceneViewModel {
  phase: GamePhase;
  scene: 'title' | 'idle' | 'cleanup' | 'cooking';
  headline: string;
  supportingText: string;
  focusedTask: FocusedTaskSceneViewModel | null;
}

export interface GameViewModelFactory {
  createGameViewModel(state: GameState): GameViewModel;
  createSceneViewModel(state: GameState): SceneViewModel;
}

function formatRemainingTime(remainingMs: number): string {
  const totalSeconds = Math.max(0, Math.ceil(remainingMs / 1000));
  const minutes = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, '0');
  const seconds = (totalSeconds % 60).toString().padStart(2, '0');

  return `${minutes}:${seconds}`;
}

function gaugeTone(current: number, dangerThreshold: number, reverse = false): GaugeViewModel['tone'] {
  if (reverse) {
    if (current >= dangerThreshold) {
      return current >= 90 ? 'danger' : 'warning';
    }

    return 'calm';
  }

  if (current <= dangerThreshold) {
    return current <= 10 ? 'danger' : 'warning';
  }

  return 'calm';
}

function urgencyLabel(urgency: TaskUrgency): string {
  switch (urgency) {
    case 'stable':
      return '余裕あり';
    case 'attention':
      return '気にしたい';
    case 'urgent':
      return '急ぎ';
    case 'critical':
      return '最優先';
  }
}

function inputTypeLabel(task: TaskInstanceState): string {
  switch (task.inputType) {
    case 'keyboard':
      return 'キーボード';
    case 'mouse':
      return 'マウス';
    case 'microphone':
      return 'マイク';
    case 'camera':
      return 'カメラ';
  }
}

function sensorStatus(device: DeviceChannelState): SensorStatusViewModel {
  if (device.permission === 'denied') {
    return {
      label: '拒否されています',
      active: false,
      tone: 'blocked',
      helperText: 'ブラウザ設定から再許可が必要です。',
    };
  }

  if (device.permission === 'unsupported') {
    return {
      label: '非対応',
      active: false,
      tone: 'error',
      helperText: 'この環境では利用できません。',
    };
  }

  if (device.readiness === 'error') {
    return {
      label: '要確認',
      active: false,
      tone: 'error',
      helperText: device.lastError ?? 'デバイスの確認が必要です。',
    };
  }

  if (device.ready) {
    return {
      label: device.inUse ? '使用中' : '利用可能',
      active: device.inUse,
      tone: 'ready',
      helperText: 'プレイ中に状態を継続表示します。',
    };
  }

  if (device.readiness === 'checking') {
    return {
      label: '確認中',
      active: false,
      tone: 'muted',
      helperText: 'セットアップで利用可否を判定します。',
    };
  }

  return {
    label: '未確認',
    active: false,
    tone: 'muted',
    helperText: '開始前に利用可否を確認します。',
  };
}

function screenForPhase(phase: GamePhase): ScreenViewModel {
  switch (phase) {
    case 'title':
      return {
        title: '育児マルチタスクゲーム',
        subtitle: 'タイトル画面プレースホルダー',
        body: 'Vite・React・TypeScript・Phaser の開発基盤を起動できる最小構成です。次タスクから開始前確認、HUD、ゲーム進行をここへ積み上げます。',
        highlights: ['localhost secure context 前提', 'ローカル処理のみ', 'Phaser viewport 接続済み'],
      };
    case 'permissionCheck':
      return {
        title: '開始前確認',
        subtitle: 'マイクとカメラの利用説明',
        body: '音声と映像はブラウザ内でのみ処理されます。保存や外部送信は行いません。',
        highlights: ['マイク利用', 'カメラ利用', 'ローカル処理のみ'],
      };
    case 'deviceCheck':
      return {
        title: 'デバイス確認',
        subtitle: 'プレイ開始条件を確認中',
        body: 'マイク入力と顔検出の簡易チェックを行います。',
        highlights: ['マイクチェック', '顔検出チェック', 'ready 条件を判定'],
      };
    case 'ready':
      return {
        title: '開始待機',
        subtitle: '本編を開始できます',
        body: '準備ができています。プレイヤー操作でセッションを開始します。',
        highlights: ['5分セッション', '2つの主要ゲージ', '同時タスク制限あり'],
      };
    case 'playing':
      return {
        title: 'プレイ中',
        subtitle: '複数タスクへ短時間ずつ介入',
        body: '残り時間、主要ゲージ、発生中タスク、センサー状態を見ながら進めます。',
        highlights: ['手元2件まで', 'センサー2件まで', '複合操作で好評価'],
      };
    case 'paused':
      return {
        title: '一時停止',
        subtitle: 'プレイを中断中',
        body: '操作を再開すると同じ状態から続きます。',
        highlights: ['状態保持', '再開可能', 'センサー再利用'],
      };
    case 'gameOver':
      return {
        title: 'ゲームオーバー',
        subtitle: '破綻条件に到達しました',
        body: '主要ゲージと警告を見直して、次のプレイへ活かせます。',
        highlights: ['主要ゲージ確認', '警告を振り返る', 'タイトルへ戻れる'],
      };
    case 'result':
      return {
        title: 'リザルト',
        subtitle: '1プレイの結果',
        body: '評価ランクと各指標をまとめて確認できます。',
        highlights: ['評価ランク', '介入内訳', 'ひとことコメント'],
      };
  }
}

function toTaskSummary(task: TaskInstanceState): TaskSummaryViewModel {
  return {
    id: task.id,
    label: task.title,
    inputTypeLabel: inputTypeLabel(task),
    urgency: task.urgency,
    urgencyLabel: urgencyLabel(task.urgency),
    progressPercent: Math.round(task.progress * 100),
  };
}

function toResultViewModel(result: GameResult | null): ResultViewModel | null {
  if (!result) {
    return null;
  }

  return {
    rank: result.rank,
    comment: result.comment,
    outcomeLabel:
      result.outcome === 'cleared'
        ? 'クリア'
        : result.outcome === 'timeout'
          ? '時間切れ'
          : 'ゲームオーバー',
    metrics: result.metrics,
    finalGauges: result.finalGauges,
  };
}

function toFocusedTaskSceneViewModel(task: HandTaskState | null): FocusedTaskSceneViewModel | null {
  if (!task) {
    return null;
  }

  if (task.kind === 'cleanup') {
    return {
      id: task.id,
      kind: task.kind,
      title: task.title,
      progressPercent: Math.round(task.progress * 100),
      detail: `${task.storedItems}/${task.totalItems} 個を片付け済み`,
    };
  }

  const cookingTask = task as CookingTaskState;

  return {
    id: cookingTask.id,
    kind: cookingTask.kind,
    title: cookingTask.title,
    progressPercent: Math.round(cookingTask.progress * 100),
    detail: `${cookingStepLabel(cookingTask.step)} / ${cookingCueLabel(cookingTask.cue)}`,
  };
}

function cookingStepLabel(step: CookingTaskState['step']): string {
  switch (step) {
    case 'select':
      return '食材選択';
    case 'mash':
      return 'すり潰し';
    case 'heat':
      return '加熱';
    case 'cool':
      return '冷ます';
    case 'feed':
      return '食べさせる';
  }
}

function cookingCueLabel(cue: CookingTaskState['cue']): string {
  switch (cue) {
    case 'safe':
      return 'まだ';
    case 'soon':
      return 'そろそろ';
    case 'now':
      return '今';
    case 'danger':
      return '危険';
  }
}

function findFocusedHandTask(state: GameState): HandTaskState | null {
  if (!state.focusedHandTaskId) {
    return null;
  }

  const task = state.activeTasks[state.focusedHandTaskId];
  if (!task || task.channel !== 'hand') {
    return null;
  }

  return task;
}

export function createGameViewModel(state: GameState): GameViewModel {
  return {
    phase: state.phase,
    screen: screenForPhase(state.phase),
    hud: {
      remainingTimeLabel: formatRemainingTime(state.remainingMs),
      gauges: {
        babyMood: {
          label: '赤ちゃんの機嫌',
          current: state.gauges.babyMood.current,
          max: state.gauges.babyMood.max,
          tone: gaugeTone(state.gauges.babyMood.current, state.gauges.babyMood.dangerThreshold),
        },
        parentStress: {
          label: '親の心労',
          current: state.gauges.parentStress.current,
          max: state.gauges.parentStress.max,
          tone: gaugeTone(
            state.gauges.parentStress.current,
            state.gauges.parentStress.dangerThreshold,
            true,
          ),
        },
      },
      tasks: {
        maxConcurrent: state.taskLimits.totalActive,
        active: Object.values(state.activeTasks).map(toTaskSummary),
      },
      sensors: {
        microphone: sensorStatus(state.session.microphone),
        camera: sensorStatus(state.session.camera),
      },
      warnings: state.warnings.map((warning) => ({
        id: warning.id,
        label: warning.message,
        tone: warning.severity,
      })),
    },
    result: toResultViewModel(state.result),
  };
}

export function createSceneViewModel(state: GameState): SceneViewModel {
  const focusedTask = findFocusedHandTask(state);

  if (focusedTask?.kind === 'cleanup') {
    return {
      phase: state.phase,
      scene: 'cleanup',
      headline: 'Cleanup Task View',
      supportingText: 'Focused keyboard task scene',
      focusedTask: toFocusedTaskSceneViewModel(focusedTask),
    };
  }

  if (focusedTask?.kind === 'cooking') {
    return {
      phase: state.phase,
      scene: 'cooking',
      headline: 'Cooking Task View',
      supportingText: 'Focused mouse task scene',
      focusedTask: toFocusedTaskSceneViewModel(focusedTask),
    };
  }

  return {
    phase: state.phase,
    scene: state.phase === 'title' ? 'title' : 'idle',
    headline: 'Title Screen Preview',
    supportingText: 'AppShell / Phaser viewport placeholder',
    focusedTask: null,
  };
}

export const gameViewModelFactory: GameViewModelFactory = {
  createGameViewModel,
  createSceneViewModel,
};

export { createInitialGameState };
