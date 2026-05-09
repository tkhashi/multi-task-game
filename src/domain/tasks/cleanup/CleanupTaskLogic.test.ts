import { describe, expect, it } from 'vitest';

import { createIdleInputFrame } from '../../input/InputFrame';
import { updateCleanupTask } from './CleanupTaskLogic';
import type { CleanupTaskState } from '../TaskTypes';

function createCleanupTask(): CleanupTaskState {
  return {
    id: 'cleanup-1',
    kind: 'cleanup',
    channel: 'hand',
    inputType: 'keyboard',
    title: '片付け',
    summary: '散らかった物を収納する',
    urgency: 'attention',
    lifecycle: 'active',
    progress: 0,
    startedAtMs: 0,
    updatedAtMs: 0,
    totalItems: 2,
    storedItems: 0,
    remainingItems: 2,
    playerPosition: { x: 2, y: 2 },
    carriedItemId: null,
    items: [
      {
        id: 'sock-1',
        label: '靴下',
        targetStorage: 'basket',
        pickupReward: 2,
        storeReward: 4,
        position: { x: 2.2, y: 2 },
        picked: false,
        stored: false,
      },
      {
        id: 'toy-1',
        label: 'おもちゃ',
        targetStorage: 'box',
        pickupReward: 2,
        storeReward: 5,
        position: { x: 7, y: 2 },
        picked: false,
        stored: false,
      },
    ],
  };
}

describe('CleanupTaskLogic', () => {
  it('moves the parent character within the field bounds from keyboard input', () => {
    const input = createIdleInputFrame(500);
    input.keyboard.movement.horizontal = 1;
    input.keyboard.movement.vertical = -1;

    const result = updateCleanupTask(createCleanupTask(), input, 500);
    const task = result.task as CleanupTaskState;

    expect(task.playerPosition.x).toBeGreaterThan(2);
    expect(task.playerPosition.y).toBeLessThan(2);
  });

  it('picks up a nearby item and grants a partial stress reduction', () => {
    const input = createIdleInputFrame(1_000);
    input.keyboard.justPressedKeys = ['Space'];

    const result = updateCleanupTask(createCleanupTask(), input, 100);
    const task = result.task as CleanupTaskState;

    expect(task.carriedItemId).toBe('sock-1');
    expect(task.items[0]?.picked).toBe(true);
    expect(result.gaugeDelta?.parentStress).toBeLessThan(0);
    expect(result.scoreDelta?.partialCount).toBe(1);
  });

  it('stores a carried item at the correct storage and updates completion counts', () => {
    const task = createCleanupTask();
    task.playerPosition = { x: 1.5, y: 1.5 };
    task.carriedItemId = 'sock-1';
    task.items[0]!.picked = true;
    const input = createIdleInputFrame(1_200);
    input.keyboard.justPressedKeys = ['e'];

    const result = updateCleanupTask(task, input, 100);
    const nextTask = result.task as CleanupTaskState;

    expect(nextTask.carriedItemId).toBeNull();
    expect(nextTask.storedItems).toBe(1);
    expect(nextTask.remainingItems).toBe(1);
    expect(nextTask.items[0]?.stored).toBe(true);
    expect(result.gaugeDelta?.parentStress).toBeLessThan(0);
  });

  it('adds cleanup pressure while clutter remains and no intervention happens', () => {
    const input = createIdleInputFrame(1_000);

    const result = updateCleanupTask(createCleanupTask(), input, 1_000);

    expect(result.gaugeDelta?.parentStress).toBeGreaterThan(0);
    expect(result.gaugeDelta?.reason).toBe('cleanupPressure');
  });
});
