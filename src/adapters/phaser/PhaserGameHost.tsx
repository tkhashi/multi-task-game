import { useEffect, useRef, useState } from 'react';

import type { SceneViewModel } from '../../app/runtime/GameViewModelFactory';
import { getSharedKeyboardAdapter } from '../input/KeyboardAdapter';
import { getSharedMouseAdapter } from '../input/MouseAdapter';
import type { SceneController } from './MainScene';

const READY_MESSAGE = 'ゲームビューを準備中';
const ERROR_MESSAGE = 'ゲームビューの初期化に失敗しました';

type DestroyableGame = {
  destroy(removeCanvas?: boolean): void;
};

type PhaserGameHostProps = {
  viewModel: SceneViewModel;
};

function activeMessage(viewModel: SceneViewModel): string {
  switch (viewModel.scene) {
    case 'cleanup':
      return 'Phaser 片付けビューを表示中';
    case 'cooking':
      return 'Phaser ベビーフードビューを表示中';
    case 'title':
      return 'Phaser タイトルビューを表示中';
    case 'idle':
      return 'Phaser 待機ビューを表示中';
  }
}

export function PhaserGameHost({ viewModel }: PhaserGameHostProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const sceneControllerRef = useRef<SceneController | null>(null);
  const viewModelRef = useRef(viewModel);
  const [status, setStatus] = useState(READY_MESSAGE);

  viewModelRef.current = viewModel;

  useEffect(() => {
    getSharedKeyboardAdapter().setActive(viewModel.scene === 'cleanup');
    getSharedMouseAdapter().setActive(viewModel.scene === 'cooking');
  }, [viewModel.scene]);

  useEffect(() => {
    let isDisposed = false;
    let game: DestroyableGame | undefined;

    async function bootGame() {
      if (!hostRef.current) {
        return;
      }

      const phaserModule = await import('phaser');
      const Phaser = phaserModule.default;
      const { createMainSceneClass } = await import('./MainScene');

      if (isDisposed || !hostRef.current) {
        return;
      }
      const MainScene = createMainSceneClass(
        Phaser,
        () => viewModelRef.current,
        (controller) => {
          sceneControllerRef.current = controller;
          controller.render(viewModelRef.current);
        },
      );

      const config = {
        type: Phaser.AUTO,
        parent: hostRef.current,
        width: 960,
        height: 360,
        backgroundColor: '#10233f',
        scene: MainScene,
      };

      game = new Phaser.Game(config);
      setStatus(activeMessage(viewModelRef.current));
    }

    void bootGame().catch((error: unknown) => {
      console.error('Failed to boot Phaser preview', error);
      setStatus(ERROR_MESSAGE);
    });

    return () => {
      isDisposed = true;
      sceneControllerRef.current = null;
      getSharedKeyboardAdapter().setActive(false);
      getSharedMouseAdapter().setActive(false);
      game?.destroy(true);
    };
  }, []);

  useEffect(() => {
    sceneControllerRef.current?.render(viewModel);
    setStatus((currentStatus) =>
      currentStatus === ERROR_MESSAGE ? currentStatus : activeMessage(viewModel),
    );
  }, [viewModel]);

  return (
    <section className="title-screen__viewport">
      <div className="title-screen__viewport-header">
        <div>
          <p className="title-screen__viewport-label">Game View</p>
          <h2>{viewModel.headline}</h2>
        </div>
        <p className="title-screen__viewport-status">{status}</p>
      </div>

      <div
        ref={hostRef}
        aria-label="ゲームビューキャンバス"
        className="title-screen__viewport-canvas"
      />
    </section>
  );
}
