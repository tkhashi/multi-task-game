# Brief: multi-interface-parenting-game

## Problem
0歳児の育児で発生する「手・声・視線・姿勢を同時に使い続ける忙しさ」は、一般的な単一入力のゲームでは表現しにくい。
このプロジェクトでは、その負荷をブラウザ上で疑似体験できるゲームとして設計し、短時間で印象的に伝えられる形にしたい。

## Current State
現状は [docs/requirement.md](/Users/kazuhiro.takahashi/Documents/github/multi-task-game/docs/requirement.md) と [docs/design.md](/Users/kazuhiro.takahashi/Documents/github/multi-task-game/docs/design.md) に、MVP要件と責務分離を含む技術設計が整理されている。
一方で、実装用の仕様ディレクトリ、タスク分解、アーキテクチャ決定の確定版はまだ存在しない。

## Desired Outcome
PCブラウザで動作する5分間の育児マルチタスクゲームを実装できる状態にする。
具体的には、React + TypeScript + Vite + Phaser を基盤に、ゲームルールを純粋関数中心の Core に分離し、キーボード・マウス・マイク・カメラを使うMVPを段階的に実装できる仕様を確立する。

## Approach
採用方針は `React + TypeScript + Vite + Phaser + 純粋関数Core` とする。
描画と演出は Phaser、HUD と権限確認画面は React、状態遷移とタスク判定は Core / Runtime 側へ分離する。
なお、`docs` に記載された `face-api.js` は保守性と互換性のリスクがあるため、カメラ入力は spec フェーズで `MediaPipe Face Landmarker` など現行の保守されている候補を優先評価する。

## Scope
- **In**: タイトル、権限確認、デバイス確認、プレイ中、ポーズ、ゲームオーバー、リザルトの状態設計
- **In**: 赤ちゃんの機嫌と親の心労ゲージ、および破綻条件
- **In**: 片付け、ベビーフード、呼びかけ連打、しーっ、顔ポジション合わせのMVPタスク
- **In**: キーボード、マウス、マイク、カメラの4入力を扱う Input Adapter と判定ロジック
- **In**: Phaser によるゲーム描画と React による HUD / オーバーレイ表示
- **In**: TDD しやすい GameRuntime / GameAggregator / ViewModel 分離
- **Out**: バックエンド、認証、クラウド保存、ランキング
- **Out**: スマホ対応、専用チュートリアル画面、音程判定、歌唱スコア、表情判定
- **Out**: 高度なオンライン機能や永続データ管理

## Boundary Candidates
- Core ドメイン: GameState、GameAggregator、スケジューラ、ゲージ更新、勝敗判定
- Input / Sensor Adapter: キーボード、マウス、マイク、カメラの生入力収集と InputFrame 変換
- Presentation: Phaser 描画、React HUD、タスクカード、権限導線
- Task Logic: 片付け、料理、音声、顔位置の個別判定ロジック

## Out of Boundary
- 保守されていない外部ライブラリへの固定依存
- MVP 段階でのクロスプラットフォーム最適化
- サーバー連携を前提にしたスコア管理

## Upstream / Downstream
- **Upstream**: `docs/requirement.md` のゲーム要件、`docs/design.md` の責務分離と TDD 方針
- **Downstream**: requirements / design / tasks の各 spec、最終的な Phaser 実装、入力デバイス検証、E2E テスト

## Existing Spec Touchpoints
- **Extends**: なし
- **Adjacent**: `docs/` 配下の要件書と設計書を一次情報として参照する

## Constraints
PC ブラウザ前提で、カメラとマイクの許可が必須である。
ブラウザ完結を維持し、MVP では保存機能やバックエンドを持たない。
2026-05-05 時点の技術調査では、React / Vite / Phaser は継続的に更新されているが、`face-api.js` は更新停滞と古い TensorFlow.js 互換性リスクが見られるため、spec では代替技術を前提に設計する。
