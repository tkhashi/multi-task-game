import { describe, expect, it } from 'vitest';

import { createIdleInputFrame } from '../input/InputFrame';
import { TaskRegistry } from './TaskRegistry';
import type { CleanupTaskState, CookingTaskState } from './TaskTypes';

describe('TaskRegistry', () => {
  it('dispatches to the registered task logic by task kind', () => {
    const cleanupUpdates: string[] = [];
    const cookingUpdates: string[] = [];
    const registry = new TaskRegistry({
      cleanup: {
        updateTask(task) {
          cleanupUpdates.push(task.id);
          return { task: { ...task, progress: 0.5 } };
        },
      },
      cooking: {
        updateTask(task) {
          cookingUpdates.push(task.id);
          return { task: { ...task, progress: 0.75 } };
        },
      },
    });
    const cleanupTask: CleanupTaskState = {
      id: 'cleanup-1',
      kind: 'cleanup',
      channel: 'hand',
      inputType: 'keyboard',
      title: '片付け',
      summary: '散らかった物を収納する',
      urgency: 'stable',
      lifecycle: 'active',
      progress: 0,
      startedAtMs: 0,
      updatedAtMs: 0,
      totalItems: 3,
      storedItems: 0,
      remainingItems: 3,
      playerPosition: { x: 5, y: 3 },
      carriedItemId: null,
      items: [],
    };
    const cookingTask: CookingTaskState = {
      id: 'cooking-1',
      kind: 'cooking',
      channel: 'hand',
      inputType: 'mouse',
      title: 'ベビーフード作り',
      summary: '工程を進める',
      urgency: 'stable',
      lifecycle: 'active',
      progress: 0,
      startedAtMs: 0,
      updatedAtMs: 0,
      step: 'select',
      cue: 'safe',
    };

    const cleanupResult = registry.updateTask(cleanupTask, createIdleInputFrame(1_000), 16);
    const cookingResult = registry.updateTask(cookingTask, createIdleInputFrame(1_000), 16);

    expect(cleanupUpdates).toEqual(['cleanup-1']);
    expect(cookingUpdates).toEqual(['cooking-1']);
    expect(cleanupResult.task?.progress).toBe(0.5);
    expect(cookingResult.task?.progress).toBe(0.75);
  });

  it('falls back to no-op logic for unimplemented task kinds while advancing updatedAtMs', () => {
    const registry = new TaskRegistry();
    const task: CookingTaskState = {
      id: 'cooking-1',
      kind: 'cooking',
      channel: 'hand',
      inputType: 'mouse',
      title: 'ベビーフード作り',
      summary: '工程を進める',
      urgency: 'attention',
      lifecycle: 'active',
      progress: 0.2,
      startedAtMs: 0,
      updatedAtMs: 100,
      step: 'mash',
      cue: 'soon',
    };

    const result = registry.updateTask(task, createIdleInputFrame(1_200), 100);

    expect(result.task).not.toBeNull();
    expect(result.task?.updatedAtMs).toBe(1_200);
    expect(result.task?.progress).toBe(0.2);
  });
});
