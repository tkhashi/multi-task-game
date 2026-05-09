import type { GameEvent, GameOverReason } from './GameEvent';
import type { CollapseTimers, GameState, WarningState } from './GameState';

const BABY_MOOD_DECAY_PER_SECOND = 0.2;
const PARENT_STRESS_INCREASE_PER_SECOND = 0.1;
const BABY_MOOD_COLLAPSE_MS = 6_000;
const PARENT_STRESS_COLLAPSE_MS = 6_000;
const DOUBLE_DANGER_COLLAPSE_MS = 10_000;

export interface GaugeTickOptions {
  babyMoodDelta?: number;
  parentStressDelta?: number;
  reason?: string;
  nowMs?: number;
}

export interface GaugeTickResult {
  gauges: GameState['gauges'];
  collapseTimers: CollapseTimers;
  warnings: WarningState[];
  events: GameEvent[];
  collapseReason: GameOverReason | null;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function toWarningState(
  previousWarnings: Map<string, WarningState>,
  warning: Omit<WarningState, 'createdAtMs'>,
  nowMs: number,
): WarningState {
  const previous = previousWarnings.get(warning.id);

  return {
    ...warning,
    createdAtMs: previous?.createdAtMs ?? nowMs,
  };
}

function deriveWarnings(state: GameState, nowMs: number): WarningState[] {
  const previousWarnings = new Map(state.warnings.map((warning) => [warning.id, warning]));
  const warnings: WarningState[] = [];
  const babyMoodDanger = state.gauges.babyMood.current <= state.gauges.babyMood.dangerThreshold;
  const parentStressDanger =
    state.gauges.parentStress.current >= state.gauges.parentStress.dangerThreshold;

  if (babyMoodDanger) {
    warnings.push(
      toWarningState(
        previousWarnings,
        {
          id: 'warning-babyMood',
          type: 'babyMood',
          severity: 'danger',
          message: '赤ちゃんの機嫌が危険です。',
        },
        nowMs,
      ),
    );
  }

  if (parentStressDanger) {
    warnings.push(
      toWarningState(
        previousWarnings,
        {
          id: 'warning-parentStress',
          type: 'parentStress',
          severity: 'danger',
          message: '親の心労が限界に近づいています。',
        },
        nowMs,
      ),
    );
  }

  if (babyMoodDanger && parentStressDanger) {
    warnings.push(
      toWarningState(
        previousWarnings,
        {
          id: 'warning-doubleDanger',
          type: 'doubleDanger',
          severity: 'danger',
          message: '両方が危険域です。すぐに立て直してください。',
        },
        nowMs,
      ),
    );
  }

  return warnings;
}

function createWarningEvents(
  previousWarnings: WarningState[],
  nextWarnings: WarningState[],
): GameEvent[] {
  const previousIds = new Map(previousWarnings.map((warning) => [warning.id, warning]));
  const nextIds = new Map(nextWarnings.map((warning) => [warning.id, warning]));
  const events: GameEvent[] = [];

  for (const warning of nextWarnings) {
    if (!previousIds.has(warning.id)) {
      events.push({
        type: 'warningRaised',
        warningId: warning.id,
        severity: warning.severity,
        message: warning.message,
      });
    }
  }

  for (const warning of previousWarnings) {
    if (!nextIds.has(warning.id)) {
      events.push({
        type: 'warningCleared',
        warningId: warning.id,
      });
    }
  }

  return events;
}

export function applyGaugeTick(
  state: GameState,
  dtMs: number,
  options: GaugeTickOptions = {},
): GaugeTickResult {
  const seconds = dtMs / 1_000;
  const reason = options.reason ?? 'timeProgress';
  const babyMoodDelta = (options.babyMoodDelta ?? 0) - BABY_MOOD_DECAY_PER_SECOND * seconds;
  const parentStressDelta =
    (options.parentStressDelta ?? 0) + PARENT_STRESS_INCREASE_PER_SECOND * seconds;

  const nextBabyMood = clamp(
    state.gauges.babyMood.current + babyMoodDelta,
    state.gauges.babyMood.min,
    state.gauges.babyMood.max,
  );
  const nextParentStress = clamp(
    state.gauges.parentStress.current + parentStressDelta,
    state.gauges.parentStress.min,
    state.gauges.parentStress.max,
  );

  const gauges: GameState['gauges'] = {
    babyMood: {
      ...state.gauges.babyMood,
      current: nextBabyMood,
    },
    parentStress: {
      ...state.gauges.parentStress,
      current: nextParentStress,
    },
  };

  const collapseTimers: CollapseTimers = {
    babyMoodZeroMs:
      nextBabyMood <= state.gauges.babyMood.min ? state.collapseTimers.babyMoodZeroMs + dtMs : 0,
    parentStressMaxMs:
      nextParentStress >= state.gauges.parentStress.max
        ? state.collapseTimers.parentStressMaxMs + dtMs
        : 0,
    bothDangerMs:
      nextBabyMood <= state.gauges.babyMood.dangerThreshold &&
      nextParentStress >= state.gauges.parentStress.dangerThreshold
        ? state.collapseTimers.bothDangerMs + dtMs
        : 0,
  };

  const warningState = deriveWarnings(
    {
      ...state,
      gauges,
    },
    options.nowMs ?? state.elapsedMs + dtMs,
  );

  const events: GameEvent[] = [];
  if (nextBabyMood !== state.gauges.babyMood.current) {
    events.push({
      type: 'gaugeChanged',
      target: 'babyMood',
      before: state.gauges.babyMood.current,
      after: nextBabyMood,
      reason,
    });
  }

  if (nextParentStress !== state.gauges.parentStress.current) {
    events.push({
      type: 'gaugeChanged',
      target: 'parentStress',
      before: state.gauges.parentStress.current,
      after: nextParentStress,
      reason,
    });
  }

  events.push(...createWarningEvents(state.warnings, warningState));

  let collapseReason: GameOverReason | null = null;
  if (collapseTimers.babyMoodZeroMs >= BABY_MOOD_COLLAPSE_MS) {
    collapseReason = 'babyMoodCollapsed';
  } else if (collapseTimers.parentStressMaxMs >= PARENT_STRESS_COLLAPSE_MS) {
    collapseReason = 'parentStressCollapsed';
  } else if (collapseTimers.bothDangerMs >= DOUBLE_DANGER_COLLAPSE_MS) {
    collapseReason = 'doubleDanger';
  }

  return {
    gauges,
    collapseTimers,
    warnings: warningState,
    events,
    collapseReason,
  };
}
