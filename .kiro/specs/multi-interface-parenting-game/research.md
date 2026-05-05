# Research & Design Decisions

## Summary
- **Feature**: `multi-interface-parenting-game`
- **Discovery Scope**: New Feature
- **Key Findings**:
  - React 19.2、Vite 8、Phaser 4.1.0 はいずれも継続的に保守されており、Phaser 4.1.0 では ESM まわりの不具合が修正されている。
  - `getUserMedia()` は secure context と明示的な権限許可が必須であり、開始前チェックと localhost 前提の開発導線を設計へ反映する必要がある。
  - `face-api.js` は npm 上の更新が 2022-05-02 で止まっており、代わりに `@mediapipe/tasks-vision` の Face Landmarker を採用する方が安全である。

## Research Log

### フロントエンド土台
- **Context**: React + Vite + Phaser を前提とした MVP の開発基盤を確定したい。
- **Sources Consulted**:
  - https://react.dev/blog
  - https://vite.dev/blog/announcing-vite8
  - https://vite.dev/guide/
  - https://docs.phaser.io/phaser/getting-started/installation
  - `npm view react version license`
  - `npm view vite version license`
  - `npm view phaser version license`
- **Findings**:
  - React の公式ブログでは 2025-10-01 に React 19.2 が告知されており、2026-05-05 時点の npm 最新版は `19.2.5`、ライセンスは MIT。
  - Vite 8 は 2026-03-12 に安定版として公開され、Rolldown ベースへ移行している。npm 最新版は `8.0.10`、ライセンスは MIT。
  - Phaser の公式インストール文書は `npm create @phaserjs/game@latest` と `npm install phaser` を案内しており、npm 最新版は `4.1.0`、ライセンスは MIT。
- **Implications**:
  - 実装基盤は `React 19.2.x + Vite 8.x + Phaser 4.1.x` を標準前提にできる。
  - ESM と TypeScript を前提にした構成で問題ない。

### Phaser と React の共存方式
- **Context**: UI とゲーム描画の責務分離をどう実現するかを確定したい。
- **Sources Consulted**:
  - https://phaser.io/news/2024/02/official-phaser-3-and-react-template
  - https://phaser.io/news/2025/05/bringing-our-phaserjs-templates-into-the-future
  - https://phaser.io/news/2026/04/phaser-4-1-0-salusa-release
  - `docs/design.md`
- **Findings**:
  - Phaser 公式テンプレート群は React 連携を正式に扱っており、UI と Scene の通信を分離する構成を継続している。
  - Phaser 4.1.0 では ESM build の `default export` 問題が修正され、標準的な `import Phaser from 'phaser'` を前提にしやすくなった。
  - 既存 `docs/design.md` でも React は ViewModel 表示、Phaser は描画 Adapter として扱う方針が明示されている。
- **Implications**:
  - React は HUD と状態画面、Phaser は中央のゲームビュー描画に責務を限定する。
  - イベントバス中心ではなく、`GameRuntime` と購読可能な store を境界にした構成へ寄せる。

### マイクとカメラ入力
- **Context**: 権限、キャリブレーション、推論方法、プライバシー要件を満たす入力技術を選びたい。
- **Sources Consulted**:
  - https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia
  - https://developer.mozilla.org/en-US/docs/Web/API/AnalyserNode
  - https://ai.google.dev/edge/mediapipe/solutions/vision/face_landmarker
  - https://ai.google.dev/edge/mediapipe/solutions/vision/face_landmarker/web_js
  - `npm view @mediapipe/tasks-vision version license`
  - `npm view face-api.js version license time.modified`
- **Findings**:
  - MDN によると `getUserMedia()` は secure context でのみ利用可能で、ユーザー権限が常に必要。
  - Web Audio API の `AnalyserNode` はブラウザ標準で、RMS ベースの音量推定に使える。
  - MediaPipe Face Landmarker の Web 版は live video を扱え、`detect()` / `detectForVideo()` は同期呼び出しで UI スレッドをブロックし得るため、公式文書は Web Worker 実行を勧めている。
  - `@mediapipe/tasks-vision` の npm 最新版は `0.10.35`、Apache-2.0。対して `face-api.js` は `0.22.2`、MIT だが npm の `time.modified` は 2022-05-02。
- **Implications**:
  - マイク入力は Web Audio API を採用し、ノイズ床キャリブレーションと Too Loud 閾値を開始前に確定する。
  - 顔検出は MediaPipe を採用し、`InputFrameCollector` からは最新スナップショット参照だけを行う非同期キャッシュ方式にする。
  - MediaPipe 推論は Worker に逃がし、メインスレッドのレンダリング負荷を抑える。

### 開発前提と運用制約
- **Context**: greenfield であることと、不足しているプロジェクト文脈を把握したい。
- **Sources Consulted**:
  - リポジトリ直下のディレクトリ構成
  - `.kiro/specs/multi-interface-parenting-game/brief.md`
  - `.kiro/specs/multi-interface-parenting-game/requirements.md`
  - `docs/requirement.md`
  - `docs/design.md`
- **Findings**:
  - 実装コードは未作成で、現状の一次情報は `docs/` と生成済み spec ファイルのみである。
  - `.kiro/steering/` は未作成のため、プロジェクト共通規約は `AGENTS.md` と `docs` に依存する。
- **Implications**:
  - `design.md` は実装開始に必要なファイル構成まで具体化し、タスク分解の起点にする必要がある。
  - steering 不在は research に明記し、今後追加される steering が dependency direction を変える場合は再検証対象にする。

## Architecture Pattern Evaluation

| Option | Description | Strengths | Risks / Limitations | Notes |
|--------|-------------|-----------|---------------------|-------|
| Functional core + adapter shell | Core は純粋関数中心、React と Phaser は adapter | テスト容易、責務明確、入力技術を差し替えやすい | adapter 層の初期実装量は増える | 採用 |
| Phaser scene owns all state | Scene が進行と描画を一体で持つ | 実装開始は速い | テストしにくい、UI と結合しやすい | `docs/design.md` と不整合 |
| React only with DOM mini games | DOM 中心で minigame を構成 | 学習コストが低い | ゲームらしい描画表現と同時入力演出が弱い | MVP の体験価値を削る |

## Design Decisions

### Decision: Functional core を正規状態の唯一の所有者にする
- **Context**: 複数入力と複数タスクを並行させても、状態の真実を一箇所に保ちたい。
- **Alternatives Considered**:
  1. Phaser Scene に状態を持たせる
  2. React state を中心に進行管理する
- **Selected Approach**: `GameRuntime -> GameAggregator -> ViewModelFactory` を中心にし、GameState は Core が一元管理する。
- **Rationale**: `docs/design.md` の責務分離と一致し、TDD とタスク境界の明確化に最も向く。
- **Trade-offs**: 初期ファイル数は増えるが、後続の tasks と review が安定する。
- **Follow-up**: 実装時に input adapter が state を直接変更していないことをレビューで確認する。

### Decision: React HUD と Phaser viewport を分離する
- **Context**: HUD、権限説明、リザルトは React が得意で、中央ゲーム描画は Phaser が得意。
- **Alternatives Considered**:
  1. Phaser ですべて描画する
  2. React DOM ですべて描画する
- **Selected Approach**: React は画面フレームと HUD、Phaser は focused hand task の描画と物理的な入力表現に限定する。
- **Rationale**: 公式テンプレートの方向性と一致し、UI と gameplay の責務分離が自然。
- **Trade-offs**: React と Phaser 間の ViewModel 同期が必要。
- **Follow-up**: `GameViewModel` と `SceneViewModel` を分け、描画側が Domain State を直接参照しないことを維持する。

### Decision: 顔検出は MediaPipe Face Landmarker を採用する
- **Context**: camera task は MVP の必須要件だが、`face-api.js` は保守リスクが高い。
- **Alternatives Considered**:
  1. `face-api.js` Tiny Face Detector を継続採用
  2. `@mediapipe/tasks-vision` Face Landmarker を採用
- **Selected Approach**: `@mediapipe/tasks-vision` を採用し、Worker 上で `detectForVideo()` を実行して結果だけをメインへ返す。
- **Rationale**: 現行保守されており、公式文書に Web 実装例がある。同期推論の UI ブロックも Worker 分離で扱える。
- **Trade-offs**: Worker と asset 配置の設計が必要。
- **Follow-up**: 実装時に model と wasm asset の配布方法を固定し、localhost での起動手順へ反映する。

### Decision: UI store は custom subscribe store で十分とする
- **Context**: 要件は local-only の 1 プレイゲームであり、グローバル CRUD 状態管理は不要。
- **Alternatives Considered**:
  1. Zustand を導入する
  2. Runtime 内部 store + `useSyncExternalStore` を使う
- **Selected Approach**: `InMemoryGameStore` に `getState / setState / subscribe` を持たせ、React 側は `useSyncExternalStore` ベースで購読する。
- **Rationale**: 依存を減らし、GameRuntime を UI 非依存に保てる。
- **Trade-offs**: Devtools の利便性は下がる。
- **Follow-up**: 実装時に UI local state と Domain State の境界を明確に保つ。

## Risks & Mitigations
- MediaPipe Worker 連携がブラウザ差異で不安定になる可能性 — Worker message contract を明確にし、main-thread fallback は設計上の逃げ道として残す。
- 音量しきい値が環境差で誤判定する可能性 — 開始前キャリブレーションと再計測導線を必須にする。
- Phaser 4 系は新しいため周辺知見が少ない可能性 — 公式テンプレートと標準 ESM import の範囲から外れない構成に限定する。
- steering 不在で将来規約と衝突する可能性 — dependency direction と root 構成変更を revalidation trigger に入れる。

## References
- [React Blog](https://react.dev/blog) — React 19 系の公式更新履歴
- [Vite 8.0 is out](https://vite.dev/blog/announcing-vite8) — Vite 8 の公式リリース
- [Getting Started | Vite](https://vite.dev/guide/) — Vite 8 の開発前提と Node.js 要件
- [Installing | Phaser Help](https://docs.phaser.io/phaser/getting-started/installation) — Phaser の公式導入手順
- [Phaser v4.1.0 Salusa release](https://phaser.io/news/2026/04/phaser-4-1-0-salusa-release) — Phaser 4.1.0 の ESM 修正
- [Official Phaser 3 and React Template](https://phaser.io/news/2024/02/official-phaser-3-and-react-template) — React と Phaser の公式テンプレート方針
- [MediaDevices getUserMedia](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia) — secure context と権限要件
- [AnalyserNode](https://developer.mozilla.org/en-US/docs/Web/API/AnalyserNode) — Web Audio API の解析ノード
- [MediaPipe Face Landmarker overview](https://ai.google.dev/edge/mediapipe/solutions/vision/face_landmarker) — 機能概要
- [MediaPipe Face Landmarker web guide](https://ai.google.dev/edge/mediapipe/solutions/vision/face_landmarker/web_js) — Web 実装と同期実行制約
