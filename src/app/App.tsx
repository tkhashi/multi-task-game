import { createGameViewModel, createInitialGameState, createSceneViewModel } from './runtime/GameViewModelFactory';
import { TitleScreen } from '../ui/screens/TitleScreen';

export function App() {
  const state = createInitialGameState();
  const viewModel = createGameViewModel(state);
  const sceneViewModel = createSceneViewModel(state);

  return <TitleScreen viewModel={viewModel} sceneViewModel={sceneViewModel} />;
}
