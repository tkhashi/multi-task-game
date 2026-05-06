import type { GameState } from '../../domain/game/GameState';

export type GameStoreListener = () => void;

export interface GameStore {
  getState(): GameState;
  setState(nextState: GameState): void;
  subscribe(listener: GameStoreListener): () => void;
}

export class InMemoryGameStore implements GameStore {
  #state: GameState;
  #listeners = new Set<GameStoreListener>();

  constructor(initialState: GameState) {
    this.#state = initialState;
  }

  getState(): GameState {
    return this.#state;
  }

  setState(nextState: GameState): void {
    if (Object.is(this.#state, nextState)) {
      return;
    }

    this.#state = nextState;

    for (const listener of this.#listeners) {
      listener();
    }
  }

  subscribe(listener: GameStoreListener): () => void {
    this.#listeners.add(listener);

    return () => {
      this.#listeners.delete(listener);
    };
  }
}
