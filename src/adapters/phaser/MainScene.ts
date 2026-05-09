import type { SceneViewModel } from '../../app/runtime/GameViewModelFactory';

export interface ScenePresentation {
  title: string;
  subtitle: string;
  backgroundColor: string;
  panelFill: number;
  panelStroke: number;
  accentFill: number;
  accentStroke: number;
}

export interface SceneController {
  render(viewModel: SceneViewModel): void;
}

export function createScenePresentation(viewModel: SceneViewModel): ScenePresentation {
  switch (viewModel.scene) {
    case 'cleanup':
      return {
        title: viewModel.focusedTask?.title ?? '片付け',
        subtitle: viewModel.focusedTask?.detail ?? '散らかった物を収納して心労を下げます。',
        backgroundColor: '#17324f',
        panelFill: 0x10243c,
        panelStroke: 0xf4c95d,
        accentFill: 0x2a9d8f,
        accentStroke: 0xe9f5db,
      };
    case 'cooking':
      return {
        title: viewModel.focusedTask?.title ?? 'ベビーフード作り',
        subtitle: viewModel.focusedTask?.detail ?? '工程を順番に進めて両ゲージを立て直します。',
        backgroundColor: '#4f2c1d',
        panelFill: 0x2d1b13,
        panelStroke: 0xffb703,
        accentFill: 0xe76f51,
        accentStroke: 0xffedd8,
      };
    case 'title':
      return {
        title: viewModel.headline,
        subtitle: viewModel.supportingText,
        backgroundColor: '#10233f',
        panelFill: 0x0c1729,
        panelStroke: 0xf7b267,
        accentFill: 0x1d4e89,
        accentStroke: 0x8ecae6,
      };
    case 'idle':
      return {
        title: viewModel.headline,
        subtitle: viewModel.supportingText,
        backgroundColor: '#1d2433',
        panelFill: 0x131927,
        panelStroke: 0xadb5bd,
        accentFill: 0x3a506b,
        accentStroke: 0xcbd5e1,
      };
  }
}

export function createMainSceneClass(
  Phaser: any,
  getViewModel: () => SceneViewModel,
  onReady: (controller: SceneController) => void,
) {
  return class MainScene extends Phaser.Scene implements SceneController {
    #panel?: any;
    #headline?: any;
    #subtitle?: any;
    #accent?: any;

    constructor() {
      super('main-scene');
    }

    create() {
      const { width, height } = this.scale;

      this.#panel = this.add.rectangle(width / 2, height / 2, width - 56, height - 56, 0x0c1729, 0.92);
      this.#headline = this.add
        .text(width / 2, height / 2 - 32, '', {
          color: '#fffaf2',
          fontFamily: 'Georgia, "Times New Roman", serif',
          fontSize: '28px',
          fontStyle: 'bold',
        })
        .setOrigin(0.5);
      this.#subtitle = this.add
        .text(width / 2, height / 2 + 18, '', {
          color: '#d8e6ff',
          fontFamily: '"Trebuchet MS", sans-serif',
          fontSize: '16px',
          align: 'center',
          wordWrap: {
            width: width - 120,
          },
        })
        .setOrigin(0.5);
      this.#accent = this.add.ellipse(width / 2, height / 2 + 74, 200, 34, 0x1d4e89, 0.95);

      this.render(getViewModel());
      onReady(this);
    }

    render(viewModel: SceneViewModel) {
      const presentation = createScenePresentation(viewModel);

      this.cameras.main.setBackgroundColor(presentation.backgroundColor);
      this.#panel?.setFillStyle(presentation.panelFill, 0.92);
      this.#panel?.setStrokeStyle(2, presentation.panelStroke, 0.8);
      this.#headline?.setText(presentation.title);
      this.#subtitle?.setText(presentation.subtitle);
      this.#accent?.setFillStyle(presentation.accentFill, 0.95);
      this.#accent?.setStrokeStyle(2, presentation.accentStroke, 0.9);
    }
  };
}
