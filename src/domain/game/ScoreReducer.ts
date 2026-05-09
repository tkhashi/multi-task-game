import type { GameEvent } from './GameEvent';
import type { GameMetrics, GameOutcome, GameResult, GameState, ResultRank, ScoreState } from './GameState';

export interface ScoreDelta {
  points?: number;
  comboIncrement?: number;
  resetCombo?: boolean;
  successCount?: number;
  partialCount?: number;
  comboCount?: number;
  failureCount?: number;
  reason?: string;
}

export interface ScoreReductionResult {
  score: ScoreState;
  metrics: GameMetrics;
  events: GameEvent[];
}

function calculateRank(state: GameState, outcome: GameOutcome): ResultRank {
  const stabilityScore =
    state.gauges.babyMood.current + (state.gauges.parentStress.max - state.gauges.parentStress.current);
  const performanceScore =
    state.score.total +
    state.metrics.successCount * 60 +
    state.metrics.partialCount * 25 +
    state.metrics.comboCount * 40 -
    state.metrics.failureCount * 50 +
    stabilityScore;

  let rank: ResultRank;
  if (performanceScore >= 900) {
    rank = 'S';
  } else if (performanceScore >= 650) {
    rank = 'A';
  } else if (performanceScore >= 350) {
    rank = 'B';
  } else {
    rank = 'C';
  }

  if (outcome === 'gameOver' && rank !== 'C') {
    return 'C';
  }

  return rank;
}

function buildComment(rank: ResultRank, outcome: GameOutcome): string {
  if (outcome === 'gameOver') {
    return '一度崩れても、危険域へ入る前の介入タイミングは次につながります。';
  }

  switch (rank) {
    case 'S':
      return '複数の入力を落ち着いてさばき切れています。理想的な立て直しでした。';
    case 'A':
      return 'かなり安定した進行です。複合操作の精度がしっかり出ています。';
    case 'B':
      return '最後まで持ちこたえました。危険域へ入る前の先回りが次の伸びしろです。';
    case 'C':
      return '必要な対応はできています。優先順位の切り替えを早めると安定します。';
  }
}

export function applyScoreDelta(state: GameState, delta: ScoreDelta): ScoreReductionResult {
  const points = delta.points ?? 0;
  const comboIncrement = delta.comboIncrement ?? 0;
  const nextComboStreak = delta.resetCombo
    ? 0
    : Math.max(0, state.score.comboStreak + comboIncrement);
  const score: ScoreState = {
    total: Math.max(0, state.score.total + points),
    comboStreak: nextComboStreak,
    bestComboStreak: Math.max(state.score.bestComboStreak, nextComboStreak),
  };
  const metrics: GameMetrics = {
    successCount: state.metrics.successCount + (delta.successCount ?? 0),
    partialCount: state.metrics.partialCount + (delta.partialCount ?? 0),
    comboCount: state.metrics.comboCount + (delta.comboCount ?? 0),
    failureCount: state.metrics.failureCount + (delta.failureCount ?? 0),
  };
  const events: GameEvent[] =
    points !== 0
      ? [
          {
            type: 'scoreAdded',
            amount: points,
            reason: delta.reason ?? 'scoreDelta',
          },
        ]
      : [];

  return {
    score,
    metrics,
    events,
  };
}

export function createGameResult(state: GameState, outcome: GameOutcome): GameResult {
  const rank = calculateRank(state, outcome);

  return {
    rank,
    outcome,
    comment: buildComment(rank, outcome),
    finalGauges: {
      babyMood: Math.round(state.gauges.babyMood.current),
      parentStress: Math.round(state.gauges.parentStress.current),
    },
    metrics: state.metrics,
    finishedAtMs: state.elapsedMs,
  };
}
