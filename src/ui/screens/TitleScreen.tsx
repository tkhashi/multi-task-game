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

function isSetupPhase(phase: GameViewModel['phase']): boolean {
  return phase === 'permissionCheck' || phase === 'deviceCheck' || phase === 'ready';
}

function isHudPhase(phase: GameViewModel['phase']): boolean {
  return phase === 'playing' || phase === 'paused';
}

function isSummaryPhase(phase: GameViewModel['phase']): boolean {
  return phase === 'gameOver' || phase === 'result';
}

function sensorToneClass(tone: GameViewModel['hud']['sensors']['microphone']['tone']): string {
  switch (tone) {
    case 'ready':
      return 'is-ready';
    case 'blocked':
      return 'is-blocked';
    case 'error':
      return 'is-error';
    case 'muted':
      return 'is-muted';
  }
}

function setupReadiness(viewModel: GameViewModel): {
  title: string;
  detail: string;
  toneClass: string;
} {
  const microphoneReady = viewModel.hud.sensors.microphone.tone === 'ready';
  const cameraReady = viewModel.hud.sensors.camera.tone === 'ready';

  if (viewModel.phase === 'ready' && microphoneReady && cameraReady) {
    return {
      title: '本編を開始できます',
      detail: 'マイクとカメラの両方が利用可能です。',
      toneClass: 'is-ready',
    };
  }

  if (viewModel.phase === 'permissionCheck') {
    return {
      title: '開始前の確認が必要です',
      detail: '利用条件を確認してからデバイスチェックへ進みます。',
      toneClass: 'is-muted',
    };
  }

  return {
    title: '現在は開始できません',
    detail: 'マイクとカメラの両方が利用可能になるまで開始を待ちます。',
    toneClass:
      viewModel.hud.sensors.microphone.tone === 'blocked' || viewModel.hud.sensors.camera.tone === 'blocked'
        ? 'is-blocked'
        : 'is-muted',
  };
}

function gaugeToneClass(tone: GameViewModel['hud']['gauges']['babyMood']['tone']): string {
  switch (tone) {
    case 'danger':
      return 'is-danger';
    case 'warning':
      return 'is-warning';
    case 'calm':
      return 'is-calm';
  }
}

export function TitleScreen({ viewModel, sceneViewModel, actions, onAction }: TitleScreenProps) {
  const { screen, hud } = viewModel;
  const setupMode = isSetupPhase(viewModel.phase);
  const hudMode = isHudPhase(viewModel.phase);
  const summaryResult = isSummaryPhase(viewModel.phase) ? viewModel.result : null;
  const readiness = setupReadiness(viewModel);

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

        {setupMode ? (
          <section className="title-screen__setup" aria-label="開始前セットアップ">
            <div className={`title-screen__setup-card ${readiness.toneClass}`}>
              <p className="title-screen__setup-label">開始条件</p>
              <h2>{readiness.title}</h2>
              <p>{readiness.detail}</p>
            </div>

            <div className="title-screen__setup-grid">
              <article className="title-screen__setup-card">
                <p className="title-screen__setup-label">プライバシー</p>
                <ul className="title-screen__setup-list">
                  <li>音声と映像は保存しません</li>
                  <li>外部サーバーへ送信しません</li>
                  <li>ブラウザ内でのみ処理します</li>
                </ul>
              </article>

              <article
                className={`title-screen__setup-card ${sensorToneClass(hud.sensors.microphone.tone)}`}
              >
                <p className="title-screen__setup-label">マイク</p>
                <h3>{hud.sensors.microphone.label}</h3>
                <p>{hud.sensors.microphone.helperText}</p>
              </article>

              <article className={`title-screen__setup-card ${sensorToneClass(hud.sensors.camera.tone)}`}>
                <p className="title-screen__setup-label">カメラ</p>
                <h3>{hud.sensors.camera.label}</h3>
                <p>{hud.sensors.camera.helperText}</p>
              </article>
            </div>
          </section>
        ) : hudMode ? (
          <section className="title-screen__hud" aria-label="プレイ中HUD">
            <div className="title-screen__hud-topline">
              <article className="title-screen__hud-card">
                <p className="title-screen__setup-label">残り時間</p>
                <h2>{hud.remainingTimeLabel}</h2>
              </article>

              <article className={`title-screen__hud-card ${gaugeToneClass(hud.gauges.babyMood.tone)}`}>
                <p className="title-screen__setup-label">{hud.gauges.babyMood.label}</p>
                <h3>
                  {hud.gauges.babyMood.current} / {hud.gauges.babyMood.max}
                </h3>
              </article>

              <article
                className={`title-screen__hud-card ${gaugeToneClass(hud.gauges.parentStress.tone)}`}
              >
                <p className="title-screen__setup-label">{hud.gauges.parentStress.label}</p>
                <h3>
                  {hud.gauges.parentStress.current} / {hud.gauges.parentStress.max}
                </h3>
              </article>
            </div>

            <div className="title-screen__hud-grid">
              <article className="title-screen__hud-card">
                <p className="title-screen__setup-label">発生中タスク</p>
                <ul className="title-screen__task-list">
                  {hud.tasks.active.map((task) => (
                    <li key={task.id} className="title-screen__task-item">
                      <div>
                        <strong>{task.label}</strong>
                        <p>
                          {task.inputTypeLabel} ・ {task.urgencyLabel}
                        </p>
                      </div>
                      <span>{task.progressPercent}%</span>
                    </li>
                  ))}
                </ul>
              </article>

              <article className="title-screen__hud-card">
                <p className="title-screen__setup-label">センサー状態</p>
                <div className="title-screen__sensor-stack">
                  <div className={`title-screen__sensor-card ${sensorToneClass(hud.sensors.microphone.tone)}`}>
                    <strong>マイク: {hud.sensors.microphone.label}</strong>
                    <p>{hud.sensors.microphone.helperText}</p>
                  </div>
                  <div className={`title-screen__sensor-card ${sensorToneClass(hud.sensors.camera.tone)}`}>
                    <strong>カメラ: {hud.sensors.camera.label}</strong>
                    <p>{hud.sensors.camera.helperText}</p>
                  </div>
                </div>
              </article>

              <article className="title-screen__hud-card">
                <p className="title-screen__setup-label">警告</p>
                <div className="title-screen__warning-list">
                  {hud.warnings.length === 0 ? (
                    <span className="title-screen__warning-chip is-calm">いまは安定しています</span>
                  ) : (
                    hud.warnings.map((warning) => (
                      <span
                        key={warning.id}
                        className={`title-screen__warning-chip ${gaugeToneClass(
                          warning.tone === 'info' ? 'calm' : warning.tone,
                        )}`}
                      >
                        {warning.label}
                      </span>
                    ))
                  )}
                </div>
              </article>
            </div>
          </section>
        ) : summaryResult ? (
          <section className="title-screen__summary" aria-label="セッション結果">
            <div className="title-screen__summary-grid">
              <article className="title-screen__summary-card is-strong">
                <p className="title-screen__setup-label">評価ランク</p>
                <h2>{summaryResult.rank}</h2>
                <p>{summaryResult.outcomeLabel}</p>
              </article>

              <article className="title-screen__summary-card">
                <p className="title-screen__setup-label">最終ゲージ</p>
                <ul className="title-screen__summary-list">
                  <li>赤ちゃんの機嫌: {summaryResult.finalGauges.babyMood}</li>
                  <li>親の心労: {summaryResult.finalGauges.parentStress}</li>
                </ul>
              </article>

              <article className="title-screen__summary-card">
                <p className="title-screen__setup-label">主要指標</p>
                <ul className="title-screen__summary-list">
                  <li>成功数: {summaryResult.metrics.successCount}</li>
                  <li>部分介入数: {summaryResult.metrics.partialCount}</li>
                  <li>複合操作数: {summaryResult.metrics.comboCount}</li>
                  <li>失敗数: {summaryResult.metrics.failureCount}</li>
                </ul>
              </article>
            </div>

            <article className="title-screen__summary-card title-screen__summary-card--comment">
              <p className="title-screen__setup-label">ひとこと</p>
              <p>{summaryResult.comment}</p>
            </article>
          </section>
        ) : (
          <div className="title-screen__meta" aria-label="センサー状態">
            <span>マイク: {hud.sensors.microphone.label}</span>
            <span>{hud.sensors.microphone.helperText}</span>
            <span>カメラ: {hud.sensors.camera.label}</span>
            <span>{hud.sensors.camera.helperText}</span>
            <span>残り時間: {hud.remainingTimeLabel}</span>
          </div>
        )}

        <div className="title-screen__actions" aria-label="画面操作">
          {actions.map((action) => (
            <button key={action.label} type="button" onClick={() => onAction(action)}>
              {action.label}
            </button>
          ))}
        </div>
      </section>

      <PhaserGameHost viewModel={sceneViewModel} />

      {viewModel.phase === 'paused' ? (
        <section className="title-screen__pause-overlay" aria-label="一時停止中">
          <p className="title-screen__setup-label">Pause</p>
          <h2>一時停止中</h2>
          <p>再開すると同じ状態から続きます。</p>
        </section>
      ) : null}
    </main>
  );
}
