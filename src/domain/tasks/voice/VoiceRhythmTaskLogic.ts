import type { InputFrame } from '../../input/InputFrame';
import type { TaskUpdateResult } from '../TaskRegistry';
import type { VoiceRhythmTaskState } from '../TaskTypes';

const NOTE_LEAD_IN_MS = 1_000;
const NOTE_INTERVAL_MS = 900;
const PERFECT_WINDOW_MS = 100;
const GOOD_WINDOW_MS = 220;

function nextNoteTime(task: VoiceRhythmTaskState): number {
  return task.startedAtMs + NOTE_LEAD_IN_MS + task.judgedCount * NOTE_INTERVAL_MS;
}

function judgeNote(task: VoiceRhythmTaskState, input: InputFrame): 'idle' | 'perfect' | 'good' | 'miss' | 'tooLoud' {
  const microphone = input.microphone;
  const noteTime = nextNoteTime(task);
  const deltaMs = input.sampledAtMs - noteTime;

  if (microphone.isTooLoud && Math.abs(deltaMs) <= GOOD_WINDOW_MS) {
    return 'tooLoud';
  }

  if (microphone.isSpeaking && Math.abs(deltaMs) <= PERFECT_WINDOW_MS) {
    return 'perfect';
  }

  if (microphone.isSpeaking && Math.abs(deltaMs) <= GOOD_WINDOW_MS) {
    return 'good';
  }

  if (deltaMs > GOOD_WINDOW_MS) {
    return 'miss';
  }

  return 'idle';
}

export function updateVoiceRhythmTask(
  task: VoiceRhythmTaskState,
  input: InputFrame,
  dtMs: number,
): TaskUpdateResult {
  void dtMs;

  if (task.lifecycle !== 'active') {
    return { task };
  }

  const judgement = judgeNote(task, input);
  if (judgement === 'idle') {
    return {
      task: {
        ...task,
        updatedAtMs: input.sampledAtMs,
      },
    };
  }

  const judgedCount = task.judgedCount + 1;
  const hitCount = task.hitCount + (judgement === 'perfect' || judgement === 'good' ? 1 : 0);
  const missCount = task.missCount + (judgement === 'miss' ? 1 : 0);
  const tooLoudCount = task.tooLoudCount + (judgement === 'tooLoud' ? 1 : 0);
  const progress = Math.min(1, judgedCount / task.noteCount);
  const completed = judgedCount >= task.noteCount;
  const nextTask: VoiceRhythmTaskState = {
    ...task,
    judgedCount,
    hitCount,
    missCount,
    tooLoudCount,
    lastJudgement: judgement,
    progress,
    updatedAtMs: input.sampledAtMs,
    lifecycle: completed ? 'completed' : 'active',
    urgency: progress >= 0.75 ? 'stable' : progress >= 0.5 ? 'attention' : task.urgency,
  };

  if (judgement === 'tooLoud') {
    return {
      task: nextTask,
      gaugeDelta: {
        babyMood: -6,
        parentStress: 5,
        reason: 'voiceRhythmTooLoud',
      },
      scoreDelta: {
        points: -30,
        resetCombo: true,
        reason: 'voiceRhythmTooLoud',
      },
    };
  }

  if (judgement === 'miss') {
    return {
      task: nextTask,
    };
  }

  const recovery = judgement === 'perfect' ? 8 : 5;
  const points = judgement === 'perfect' ? 120 : 80;
  const completionBonus =
    completed && hitCount / task.noteCount >= 0.75
      ? 12
      : completed
        ? 6
        : 0;

  return {
    task: nextTask,
    gaugeDelta: {
      babyMood: recovery + completionBonus,
      reason: judgement === 'perfect' ? 'voiceRhythmPerfect' : 'voiceRhythmGood',
    },
    scoreDelta: {
      points: points + (completionBonus > 0 ? 60 : 0),
      comboIncrement: 1,
      successCount: completed ? 1 : 0,
      reason: judgement === 'perfect' ? 'voiceRhythmPerfect' : 'voiceRhythmGood',
    },
  };
}
