import { GameRuntime, type GameRuntimeDependencies, type GameRuntimeService } from '../runtime/GameRuntime';

let sharedRuntime: GameRuntimeService | null = null;

export function createGameRuntime(dependencies?: GameRuntimeDependencies): GameRuntimeService {
  return new GameRuntime(dependencies);
}

export function getSharedGameRuntime(): GameRuntimeService {
  if (!sharedRuntime) {
    sharedRuntime = createGameRuntime();
  }

  return sharedRuntime;
}
