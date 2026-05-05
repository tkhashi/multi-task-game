import { useEffect, useRef, useState } from 'react';

const READY_MESSAGE = 'ゲームビューを準備中';
const ACTIVE_MESSAGE = 'Phaser タイトルプレビューを表示中';
const ERROR_MESSAGE = 'ゲームビューの初期化に失敗しました';

type DestroyableGame = {
  destroy(removeCanvas?: boolean): void;
};

export function PhaserGameHost() {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [status, setStatus] = useState(READY_MESSAGE);

  useEffect(() => {
    let isDisposed = false;
    let game: DestroyableGame | undefined;

    async function bootGame() {
      if (!hostRef.current) {
        return;
      }

      const phaserModule = await import('phaser');
      const Phaser = phaserModule.default;

      if (isDisposed || !hostRef.current) {
        return;
      }

      class TitlePreviewScene extends Phaser.Scene {
        create() {
          const { width, height } = this.scale;

          this.cameras.main.setBackgroundColor(0x10233f);

          const panel = this.add.rectangle(
            width / 2,
            height / 2,
            width - 56,
            height - 56,
            0x0c1729,
            0.92,
          );
          panel.setStrokeStyle(2, 0xf7b267, 0.8);

          this.add
            .text(width / 2, height / 2 - 32, 'Title Screen Preview', {
              color: '#fffaf2',
              fontFamily: 'Georgia, "Times New Roman", serif',
              fontSize: '28px',
              fontStyle: 'bold',
            })
            .setOrigin(0.5);

          this.add
            .text(width / 2, height / 2 + 18, 'AppShell / Phaser viewport placeholder', {
              color: '#d8e6ff',
              fontFamily: '"Trebuchet MS", sans-serif',
              fontSize: '16px',
            })
            .setOrigin(0.5);

          this.add
            .ellipse(width / 2, height / 2 + 74, 200, 34, 0x1d4e89, 0.95)
            .setStrokeStyle(2, 0x8ecae6, 0.9);
        }
      }

      const config = {
        type: Phaser.AUTO,
        parent: hostRef.current,
        width: 960,
        height: 360,
        backgroundColor: '#10233f',
        scene: TitlePreviewScene,
      };

      game = new Phaser.Game(config);
      setStatus(ACTIVE_MESSAGE);
    }

    void bootGame().catch((error: unknown) => {
      console.error('Failed to boot Phaser preview', error);
      setStatus(ERROR_MESSAGE);
    });

    return () => {
      isDisposed = true;
      game?.destroy(true);
    };
  }, []);

  return (
    <section className="title-screen__viewport">
      <div className="title-screen__viewport-header">
        <div>
          <p className="title-screen__viewport-label">Game View</p>
          <h2>Phaser タイトルプレビュー</h2>
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
