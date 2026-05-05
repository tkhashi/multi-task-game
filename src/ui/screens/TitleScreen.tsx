import { PhaserGameHost } from '../../adapters/phaser/PhaserGameHost';
import type { GameViewModel, SceneViewModel } from '../../app/runtime/GameViewModelFactory';

type TitleScreenProps = {
  viewModel: GameViewModel;
  sceneViewModel: SceneViewModel;
};

export function TitleScreen({ viewModel, sceneViewModel }: TitleScreenProps) {
  const { screen } = viewModel;

  return (
    <main className="title-screen">
      <section className="title-screen__hero">
        <p className="title-screen__eyebrow">PC Browser Prototype</p>
        <h1>{screen.title}</h1>
        <p className="title-screen__lead">{screen.subtitle}</p>
        <p className="title-screen__body">{screen.body}</p>
        <div className="title-screen__meta" aria-label="開発環境メモ">
          {screen.highlights.map((highlight) => (
            <span key={highlight}>{highlight}</span>
          ))}
        </div>
      </section>

      <PhaserGameHost viewModel={sceneViewModel} />
    </main>
  );
}
