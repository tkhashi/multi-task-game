import { PhaserGameHost } from '../../adapters/phaser/PhaserGameHost';

export function TitleScreen() {
  return (
    <main className="title-screen">
      <section className="title-screen__hero">
        <p className="title-screen__eyebrow">PC Browser Prototype</p>
        <h1>育児マルチタスクゲーム</h1>
        <p className="title-screen__lead">タイトル画面プレースホルダー</p>
        <p className="title-screen__body">
          Vite・React・TypeScript・Phaser の開発基盤を起動できる最小構成です。
          次タスクから開始前確認、HUD、ゲーム進行をここへ積み上げます。
        </p>
        <div className="title-screen__meta" aria-label="開発環境メモ">
          <span>localhost secure context 前提</span>
          <span>ローカル処理のみ</span>
          <span>Phaser viewport 接続済み</span>
        </div>
      </section>

      <PhaserGameHost />
    </main>
  );
}
