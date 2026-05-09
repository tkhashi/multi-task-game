import type { GameCommand } from '../../domain/game/GameCommand';
import { PhaserGameHost } from '../../adapters/phaser/PhaserGameHost';
import type { GameViewModel, SceneViewModel } from '../../app/runtime/GameViewModelFactory';

type ScreenAction = {
  label: string;
  command: GameCommand;
};

type TitleScreenProps = {
  viewModel: GameViewModel;
  sceneViewModel: SceneViewModel;
  actions: ScreenAction[];
  onAction(action: ScreenAction): void;
};

export function TitleScreen({ viewModel, sceneViewModel, actions, onAction }: TitleScreenProps) {
  const { screen, hud } = viewModel;

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
        <div className="title-screen__meta" aria-label="センサー状態">
          <span>マイク: {hud.sensors.microphone.label}</span>
          <span>{hud.sensors.microphone.helperText}</span>
          <span>カメラ: {hud.sensors.camera.label}</span>
          <span>{hud.sensors.camera.helperText}</span>
          <span>残り時間: {hud.remainingTimeLabel}</span>
        </div>
        <div className="title-screen__actions" aria-label="画面操作">
          {actions.map((action) => (
            <button key={action.label} type="button" onClick={() => onAction(action)}>
              {action.label}
            </button>
          ))}
        </div>
      </section>

      <PhaserGameHost viewModel={sceneViewModel} />
    </main>
  );
}
