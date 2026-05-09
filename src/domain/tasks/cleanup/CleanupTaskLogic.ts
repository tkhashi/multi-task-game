import type { InputFrame } from '../../input/InputFrame';
import type { TaskUpdateResult } from '../TaskRegistry';
import type {
  CleanupFieldItem,
  CleanupTaskState,
  FieldPosition,
} from '../TaskTypes';
import { CLEANUP_FIELD_BOUNDS, CLEANUP_STORAGE_POSITIONS } from './CleanupField';
const MOVE_SPEED_UNITS_PER_SECOND = 2;
const DASH_MULTIPLIER = 1.75;
const ITEM_PICKUP_RANGE = 0.75;
const STORAGE_RANGE = 1;
const BASE_IDLE_STRESS_PER_SECOND = 0.3;
const PER_ITEM_IDLE_STRESS_PER_SECOND = 0.06;
const DASH_STRESS_PER_SECOND = 0.1;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function movePlayer(
  position: FieldPosition,
  input: InputFrame,
  dtMs: number,
): FieldPosition {
  const speedMultiplier = input.keyboard.modifiers.shift ? DASH_MULTIPLIER : 1;
  const deltaSeconds = dtMs / 1_000;
  const nextX =
    position.x + input.keyboard.movement.horizontal * MOVE_SPEED_UNITS_PER_SECOND * speedMultiplier * deltaSeconds;
  const nextY =
    position.y + input.keyboard.movement.vertical * MOVE_SPEED_UNITS_PER_SECOND * speedMultiplier * deltaSeconds;

  return {
    x: clamp(nextX, CLEANUP_FIELD_BOUNDS.minX, CLEANUP_FIELD_BOUNDS.maxX),
    y: clamp(nextY, CLEANUP_FIELD_BOUNDS.minY, CLEANUP_FIELD_BOUNDS.maxY),
  };
}

function distance(a: FieldPosition, b: FieldPosition): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function canPickup(item: CleanupFieldItem, playerPosition: FieldPosition): boolean {
  return !item.picked && !item.stored && distance(item.position, playerPosition) <= ITEM_PICKUP_RANGE;
}

function canStore(
  item: CleanupFieldItem,
  playerPosition: FieldPosition,
): boolean {
  return distance(CLEANUP_STORAGE_POSITIONS[item.targetStorage], playerPosition) <= STORAGE_RANGE;
}

function isPickupPressed(input: InputFrame): boolean {
  return input.keyboard.justPressedKeys.some((key) => key.toLowerCase() === 'space');
}

function isStorePressed(input: InputFrame): boolean {
  return input.keyboard.justPressedKeys.some((key) => key.toLowerCase() === 'e');
}

function nextUrgency(task: CleanupTaskState): CleanupTaskState['urgency'] {
  if (task.remainingItems >= 4) {
    return 'critical';
  }
  if (task.remainingItems >= 3) {
    return 'urgent';
  }
  if (task.remainingItems >= 2) {
    return 'attention';
  }
  return 'stable';
}

export function updateCleanupTask(
  task: CleanupTaskState,
  input: InputFrame,
  dtMs: number,
): TaskUpdateResult {
  if (task.lifecycle !== 'active') {
    return { task };
  }

  const playerPosition = movePlayer(task.playerPosition, input, dtMs);
  let items = task.items.map((item) => ({ ...item }));
  let carriedItemId = task.carriedItemId;
  let gaugeDelta = {
    parentStress:
      (BASE_IDLE_STRESS_PER_SECOND + task.remainingItems * PER_ITEM_IDLE_STRESS_PER_SECOND) *
      (dtMs / 1_000) +
      (input.keyboard.modifiers.shift ? DASH_STRESS_PER_SECOND * (dtMs / 1_000) : 0),
    reason: 'cleanupPressure',
  };
  let scoreDelta: TaskUpdateResult['scoreDelta'] | undefined;

  if (!carriedItemId && isPickupPressed(input)) {
    const pickupItem = items.find((item) => canPickup(item, playerPosition));
    if (pickupItem) {
      pickupItem.picked = true;
      carriedItemId = pickupItem.id;
      gaugeDelta = {
        parentStress: -pickupItem.pickupReward,
        reason: 'cleanupPickup',
      };
      scoreDelta = {
        points: 30,
        partialCount: 1,
        reason: 'cleanupPickup',
      };
    }
  } else if (carriedItemId && isStorePressed(input)) {
    const carriedItem = items.find((item) => item.id === carriedItemId) ?? null;
    if (carriedItem && canStore(carriedItem, playerPosition)) {
      carriedItem.stored = true;
      carriedItem.picked = false;
      carriedItem.position = { ...CLEANUP_STORAGE_POSITIONS[carriedItem.targetStorage] };
      carriedItemId = null;
      gaugeDelta = {
        parentStress: -(carriedItem.storeReward + 1),
        reason: 'cleanupStored',
      };
      scoreDelta = {
        points: 80,
        comboIncrement: 1,
        partialCount: 1,
        reason: 'cleanupStored',
      };
    }
  }

  const storedItems = items.filter((item) => item.stored).length;
  const remainingItems = items.length - storedItems;
  const completed = remainingItems === 0;
  if (completed) {
    scoreDelta = {
      ...(scoreDelta ?? {}),
      points: (scoreDelta?.points ?? 0) + 120,
      comboIncrement: (scoreDelta?.comboIncrement ?? 0) + 1,
      successCount: 1,
      reason: 'cleanupCompleted',
    };
  }

  const nextTask: CleanupTaskState = {
    ...task,
    playerPosition,
    carriedItemId,
    items,
    storedItems,
    remainingItems,
    progress: task.totalItems === 0 ? 1 : storedItems / task.totalItems,
    updatedAtMs: input.sampledAtMs,
    lifecycle: completed ? 'completed' : 'active',
    urgency: completed ? 'stable' : nextUrgency({ ...task, remainingItems }),
  };

  return {
    task: nextTask,
    gaugeDelta,
    scoreDelta,
  };
}
