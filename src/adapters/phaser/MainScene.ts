import type {
  CleanupSceneViewModel,
  CookingSceneViewModel,
  SceneViewModel,
} from '../../app/runtime/GameViewModelFactory';

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

export interface CleanupSceneLayout {
  field: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  storages: Array<{
    kind: string;
    label: string;
    x: number;
    y: number;
    emphasis: 'target' | 'muted';
  }>;
  items: Array<{
    id: string;
    label: string;
    x: number;
    y: number;
    carrying: boolean;
    visible: boolean;
  }>;
  player: {
    x: number;
    y: number;
    carrying: boolean;
  };
}

export interface CookingSceneLayout {
  step: CookingSceneViewModel['step'];
  station: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  bowl: {
    x: number;
    y: number;
    radius: number;
  };
  heatMeter: {
    x: number;
    y: number;
    width: number;
    height: number;
    fillRatio: number;
    tone: CookingSceneViewModel['temperatureBand'];
  };
}

export function createCleanupSceneLayout(
  viewModel: SceneViewModel,
  viewport: { width: number; height: number },
): CleanupSceneLayout {
  const cleanup = viewModel.cleanup;
  if (!cleanup) {
    throw new Error('Cleanup scene layout requires cleanup data.');
  }

  const field = {
    x: 84,
    y: 112,
    width: viewport.width - 168,
    height: viewport.height - 172,
  };
  const toPoint = (normalized: { x: number; y: number }) => ({
    x: field.x + normalized.x * field.width,
    y: field.y + normalized.y * field.height,
  });

  return {
    field,
    storages: cleanup.storages.map((storage) => ({
      ...storage,
      ...toPoint(storage),
    })),
    items: cleanup.items.map((item) => ({
      ...item,
      ...toPoint(item),
    })),
    player: {
      ...cleanup.player,
      ...toPoint(cleanup.player),
    },
  };
}

function heatFillRatio(cooking: CookingSceneViewModel): number {
  switch (cooking.temperatureBand) {
    case 'cool':
      return 0.22;
    case 'warm':
      return 0.46;
    case 'hot':
      return 0.72;
    case 'danger':
      return 0.94;
  }
}

export function createCookingSceneLayout(
  viewModel: SceneViewModel,
  viewport: { width: number; height: number },
): CookingSceneLayout {
  const cooking = viewModel.cooking;
  if (!cooking) {
    throw new Error('Cooking scene layout requires cooking data.');
  }

  return {
    step: cooking.step,
    station: {
      x: 96,
      y: 112,
      width: viewport.width - 192,
      height: viewport.height - 172,
    },
    bowl: {
      x: viewport.width / 2,
      y: viewport.height / 2 + 8,
      radius: 56,
    },
    heatMeter: {
      x: viewport.width - 212,
      y: 134,
      width: 34,
      height: 132,
      fillRatio: heatFillRatio(cooking),
      tone: cooking.temperatureBand,
    },
  };
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
    #graphics?: any;
    #footer?: any;

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
      this.#graphics = this.add.graphics();
      this.#footer = this.add
        .text(width / 2, height - 28, '', {
          color: '#d8e6ff',
          fontFamily: '"Trebuchet MS", sans-serif',
          fontSize: '14px',
          align: 'center',
        })
        .setOrigin(0.5);

      this.render(getViewModel());
      onReady(this);
    }

    drawCleanupScene(cleanup: CleanupSceneViewModel, presentation: ScenePresentation) {
      if (!this.#graphics) {
        return;
      }

      const layout = createCleanupSceneLayout(
        {
          phase: 'playing',
          scene: 'cleanup',
          headline: '',
          supportingText: '',
          focusedTask: null,
          cleanup,
          cooking: null,
        },
        { width: this.scale.width, height: this.scale.height },
      );

      this.#graphics.clear();
      this.#graphics.fillStyle(0x0b1524, 0.85);
      this.#graphics.fillRoundedRect(layout.field.x, layout.field.y, layout.field.width, layout.field.height, 20);
      this.#graphics.lineStyle(2, 0xe9f5db, 0.16);
      this.#graphics.strokeRoundedRect(layout.field.x, layout.field.y, layout.field.width, layout.field.height, 20);

      for (const storage of layout.storages) {
        const fill = storage.emphasis === 'target' ? presentation.panelStroke : 0x34506f;
        this.#graphics.fillStyle(fill, storage.emphasis === 'target' ? 0.34 : 0.2);
        this.#graphics.fillRoundedRect(storage.x - 44, storage.y - 24, 88, 48, 14);
        this.#graphics.lineStyle(2, fill, 0.9);
        this.#graphics.strokeRoundedRect(storage.x - 44, storage.y - 24, 88, 48, 14);
      }

      for (const item of layout.items) {
        if (!item.visible) {
          continue;
        }

        const fill = item.carrying ? presentation.accentStroke : presentation.accentFill;
        this.#graphics.fillStyle(fill, item.carrying ? 0.98 : 0.86);
        this.#graphics.fillCircle(item.x, item.y, item.carrying ? 16 : 12);
      }

      this.#graphics.fillStyle(presentation.panelStroke, 1);
      this.#graphics.fillCircle(layout.player.x, layout.player.y, 20);
      this.#graphics.fillStyle(0xfffaf2, 0.95);
      this.#graphics.fillCircle(layout.player.x, layout.player.y - 10, 8);

      if (layout.player.carrying) {
        this.#graphics.fillStyle(presentation.accentStroke, 0.95);
        this.#graphics.fillCircle(layout.player.x + 18, layout.player.y - 26, 8);
      }

      this.#footer?.setText(`${cleanup.progressLabel}  |  ${cleanup.hintLabel}`);
      this.#footer?.setVisible(true);
    }

    drawCookingScene(cooking: CookingSceneViewModel, presentation: ScenePresentation) {
      if (!this.#graphics) {
        return;
      }

      const layout = createCookingSceneLayout(
        {
          phase: 'playing',
          scene: 'cooking',
          headline: '',
          supportingText: '',
          focusedTask: null,
          cleanup: null,
          cooking,
        },
        { width: this.scale.width, height: this.scale.height },
      );
      const heatTone =
        cooking.temperatureBand === 'danger'
          ? 0xe63946
          : cooking.temperatureBand === 'hot'
            ? 0xf4a261
            : cooking.temperatureBand === 'warm'
              ? 0xe9c46a
              : 0x8ecae6;

      this.#graphics.clear();
      this.#graphics.fillStyle(0x120d0a, 0.82);
      this.#graphics.fillRoundedRect(
        layout.station.x,
        layout.station.y,
        layout.station.width,
        layout.station.height,
        24,
      );
      this.#graphics.lineStyle(2, presentation.panelStroke, 0.2);
      this.#graphics.strokeRoundedRect(
        layout.station.x,
        layout.station.y,
        layout.station.width,
        layout.station.height,
        24,
      );

      this.#graphics.fillStyle(0x2f221b, 0.95);
      this.#graphics.fillCircle(layout.bowl.x, layout.bowl.y, layout.bowl.radius);
      this.#graphics.lineStyle(6, presentation.accentStroke, 0.75);
      this.#graphics.strokeCircle(layout.bowl.x, layout.bowl.y, layout.bowl.radius);

      if (cooking.step === 'mash' || cooking.step === 'feed') {
        this.#graphics.lineStyle(4, presentation.accentFill, 0.92);
        this.#graphics.strokeEllipse(layout.bowl.x, layout.bowl.y, 90, 48);
      }

      if (cooking.step === 'heat') {
        this.#graphics.fillStyle(cooking.isHeating ? 0xff7f11 : 0x6c584c, 0.9);
        this.#graphics.fillTriangle(
          layout.bowl.x - 22,
          layout.bowl.y + 86,
          layout.bowl.x,
          layout.bowl.y + 36,
          layout.bowl.x + 22,
          layout.bowl.y + 86,
        );
      }

      if (cooking.step === 'cool') {
        this.#graphics.lineStyle(3, 0xbde0fe, 0.95);
        this.#graphics.strokeArc(layout.bowl.x - 70, layout.bowl.y - 38, 18, 0, Math.PI, false);
        this.#graphics.strokeArc(layout.bowl.x - 30, layout.bowl.y - 52, 22, 0, Math.PI, false);
      }

      this.#graphics.fillStyle(0x2b211c, 0.95);
      this.#graphics.fillRoundedRect(
        layout.heatMeter.x,
        layout.heatMeter.y,
        layout.heatMeter.width,
        layout.heatMeter.height,
        12,
      );
      this.#graphics.fillStyle(heatTone, 0.95);
      this.#graphics.fillRoundedRect(
        layout.heatMeter.x + 4,
        layout.heatMeter.y + layout.heatMeter.height * (1 - layout.heatMeter.fillRatio),
        layout.heatMeter.width - 8,
        layout.heatMeter.height * layout.heatMeter.fillRatio,
        8,
      );

      if (cooking.isReady) {
        this.#graphics.fillStyle(0xd9ed92, 0.95);
        this.#graphics.fillCircle(layout.station.x + 42, layout.station.y + 32, 12);
      }

      this.#footer?.setText(`${cooking.stepLabel}  |  ${cooking.statusLabel}  |  ${cooking.qualityLabel}`);
      this.#footer?.setVisible(true);
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
      this.#graphics?.clear();

      if (viewModel.scene === 'cleanup' && viewModel.cleanup) {
        this.#accent?.setVisible(false);
        this.drawCleanupScene(viewModel.cleanup, presentation);
        return;
      }

      if (viewModel.scene === 'cooking' && viewModel.cooking) {
        this.#accent?.setVisible(false);
        this.drawCookingScene(viewModel.cooking, presentation);
        return;
      }

      this.#accent?.setVisible(true);
      this.#footer?.setVisible(false);
    }
  };
}
