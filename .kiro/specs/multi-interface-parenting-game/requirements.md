# Requirements Document

## Introduction
本仕様は、0歳児育児の「同時に複数のことへ気を配り続ける忙しさ」を、PC ブラウザ上で体験できる5分間のシングルプレイゲームとして定義する。
プレイヤーは、赤ちゃんの機嫌と親の心労の2つの状態を崩壊させないように、手元操作とセンサー入力を並行して使い分けながら複数タスクへ短時間ずつ介入する。

## Boundary Context (Optional)
- **In scope**: タイトルからリザルトまでの1プレイ体験、マイクとカメラの利用説明、4系統入力を使うMVPタスク、並行操作の報酬、ローカル処理前提のプレイ導線
- **Out of scope**: スマートフォン対応、専用チュートリアル画面、ユーザー保存、オンラインランキング、表情判定、音程判定、外部サービス連携
- **Adjacent expectations**: ブラウザはマイクとカメラの権限確認を提供し、プレイヤーは PC 上でそれらを利用可能な状態にしていることを前提とする

## Requirements

### Requirement 1: 開始前確認とプレイ可能条件
**Objective:** As a プレイヤー, I want 開始前に必要な権限と入力状態を確認したい, so that プレイ不能な状態でゲームを始めずに済む

#### Acceptance Criteria
1. When プレイヤーがタイトル画面から開始を選択したとき, the game shall マイクとカメラの利用目的を説明する開始前確認画面を表示する。
2. If マイクまたはカメラの権限が拒否されている場合, then the game shall 標準プレイを開始させずに再許可の案内を表示する。
3. When 権限が許可されたとき, the game shall マイク入力と顔検出の簡易チェックを開始する。
4. If デバイスチェックが完了しない場合, then the game shall 開始不可の理由と改善案内を表示する。
5. The game shall マイクとカメラの両方が利用可能になった場合にのみプレイ開始を許可する。

### Requirement 2: プレイセッション進行
**Objective:** As a プレイヤー, I want セッションの流れが一貫して進行してほしい, so that 何をすればよいか迷わずにプレイできる

#### Acceptance Criteria
1. When プレイ開始条件が満たされたとき, the game shall 開始待機状態を表示し、プレイヤー操作で本編を開始できるようにする。
2. When 本編が開始されたとき, the game shall 1プレイを5分間のセッションとして進行させる。
3. While プレイ中である間, the game shall 一時停止と再開を可能にする。
4. When 残り時間が0になったとき, the game shall リザルト画面へ遷移する。
5. If 破綻条件が成立した場合, then the game shall ゲームオーバー画面へ遷移する。
6. When プレイヤーがリトライを選択したとき, the game shall タイトル画面へ戻して新しいプレイを始められるようにする。

### Requirement 3: ゲージと破綻条件
**Objective:** As a プレイヤー, I want 追うべき状態が明確であってほしい, so that どのタスクへ介入すべきか判断できる

#### Acceptance Criteria
1. The game shall 赤ちゃんの機嫌と親の心労の2つだけを主要ゲージとして管理し、常時表示する。
2. While プレイ中である間, the game shall 時間経過とタスク状況に応じて両ゲージを継続的に変動させる。
3. When 赤ちゃんの機嫌が危険域に入ったとき, the game shall 大泣きに近い状態であることを視覚的に示す。
4. When 親の心労が危険域に入ったとき, the game shall 限界に近い状態であることを視覚的に示す。
5. If 赤ちゃんの機嫌が0の状態が6秒継続した場合, then the game shall ゲームオーバーにする。
6. If 親の心労が最大の状態が6秒継続した場合, then the game shall ゲームオーバーにする。
7. If 赤ちゃんの機嫌が危険域かつ親の心労が危険域の状態が10秒継続した場合, then the game shall ゲームオーバーにする。

### Requirement 4: タスク発生と複合操作
**Objective:** As a プレイヤー, I want 同時に複数のタスクへ対処したい, so that 育児の忙しさと取捨選択の面白さを体験できる

#### Acceptance Criteria
1. While プレイ中である間, the game shall 手元タスクとセンサータスクを並行して発生させる。
2. The game shall 同時発生タスク数を最大4件に制限する。
3. The game shall 手元タスクを最大2件、センサータスクを最大2件まで表示する。
4. The game shall 同時に有効なマイクタスクを1件まで、カメラタスクを1件までに制限する。
5. When プレイヤーが手元タスクを選択したとき, the game shall 選択中タスクを明示し、そのタスクへの入力を優先して受け付ける。
6. While センサータスクが発生中である間, the game shall 手元タスクの操作と同時に進行できるようにする。
7. When センサータスク成功中に手元タスクも進行したとき, the game shall 複合操作として追加スコアまたは結果評価に反映される報酬を与える。
8. The game shall ゲーム後半ほど複数入力の同時利用が必要になる発生傾向を持たせる。

### Requirement 5: 片付けタスク
**Objective:** As a プレイヤー, I want キーボードで部屋を片付けたい, so that 親の心労を下げられる

#### Acceptance Criteria
1. When 片付けタスクが発生したとき, the game shall 散らかった物と収納先がある片付け用フィールドを表示する。
2. When プレイヤーが移動入力を行ったとき, the game shall 親キャラクターをフィールド内で移動させる。
3. When プレイヤーが対象物の近くで拾う操作を行ったとき, the game shall アイテムを保持状態にする。
4. When プレイヤーが正しい収納場所で収納操作を行ったとき, the game shall そのアイテムを片付け完了として心労を軽減する。
5. While 片付けタスクが未完了で散らかりが残っている間, the game shall 心労上昇の圧力を維持する。
6. The game shall アイテムを1個ずつ処理しても部分介入として報酬または心労軽減を与える。

### Requirement 6: ベビーフード作りタスク
**Objective:** As a プレイヤー, I want マウス操作でベビーフードを作りたい, so that 赤ちゃんの機嫌と親の心労の両方を改善できる

#### Acceptance Criteria
1. When ベビーフード作りタスクが発生したとき, the game shall 食材選択、すり潰し、加熱、冷ます、食べさせるの工程を順番に進めるタスクとして表示する。
2. When プレイヤーが各工程に対応した操作を行ったとき, the game shall その工程の進捗を更新する。
3. While ベビーフード作りが途中段階である間, the game shall 工程ごとの進捗を保持し、途中離脱後も再開できるようにする。
4. When 加熱工程が適切なタイミングで止められたとき, the game shall 成功として次工程へ進める。
5. If 加熱しすぎて焦げた場合, then the game shall 赤ちゃんの機嫌を悪化させ、親の心労を上昇させる。
6. When ベビーフード作りが完了したとき, the game shall 赤ちゃんの機嫌を回復させ、親の心労を軽減する。
7. The game shall 内部数値をそのまま表示せず、「まだ」「そろそろ」「今」「危険」などの状態表示で工程の危険度や仕上がりを伝える。

### Requirement 7: 呼びかけ連打タスク
**Objective:** As a プレイヤー, I want 声のタイミング入力で赤ちゃんをあやしたい, so that 手元操作と並行して機嫌を回復できる

#### Acceptance Criteria
1. When 呼びかけ連打タスクが発生したとき, the game shall 発声タイミングを示すノーツ列を表示する。
2. When プレイヤーがノーツに近いタイミングで短く発声したとき, the game shall 判定結果を表示して赤ちゃんの機嫌を回復する。
3. If 発声がタイミング範囲外である場合, then the game shall その入力を失点なしの不成功として扱う。
4. If 大きすぎる声が検出された場合, then the game shall 機嫌悪化と心労上昇のペナルティを与える。
5. When ノーツ列が終了したとき, the game shall 成功率に応じて高効果または低効果でタスクを終了する。

### Requirement 8: しーっタスク
**Objective:** As a プレイヤー, I want 小さな声を保って赤ちゃんを落ち着かせたい, so that 他の操作をしながら機嫌低下を抑えられる

#### Acceptance Criteria
1. When しーっタスクが発生したとき, the game shall 現在の声量位置と必要維持時間を示すメーターを表示する。
2. While 声が成功帯に収まっている間, the game shall 維持時間を加算し、赤ちゃんの機嫌低下を抑制する。
3. If 無音または不安定な声量になった場合, then the game shall 維持時間の加算を停止し、無音が継続した場合は進行中の維持を失敗扱いにする。
4. If 声量が大きすぎる場合, then the game shall ペナルティを与える。
5. When 必要維持時間を満たしたとき, the game shall タスク成功として赤ちゃんの機嫌を追加回復する。

### Requirement 9: 顔ポジション合わせタスク
**Objective:** As a プレイヤー, I want 顔の位置と距離を調整して赤ちゃんをあやしたい, so that 手元操作と並行して別系統の入力負荷を体験できる

#### Acceptance Criteria
1. When 顔ポジション合わせタスクが発生したとき, the game shall 目標枠と現在の顔位置の状態を示す表示を出す。
2. While 顔が検出されている間, the game shall 顔の位置ずれ、上下ずれ、距離ずれに応じたヒントを表示する。
3. When 顔の位置と大きさが目標条件を満たしたとき, the game shall 維持時間の計測を開始する。
4. If 顔が長時間検出されない場合, then the game shall 顔を映すためのヒントを表示し、親の心労を上昇させる。
5. When 必要維持時間を満たしたとき, the game shall タスク成功として赤ちゃんの機嫌を回復する。
6. The game shall 後半フェーズで複数の目標枠に対応する難易度上昇を提供する。

### Requirement 10: HUD とリザルト表示
**Objective:** As a プレイヤー, I want 重要な状況を一画面で把握したい, so that 次の優先行動をすばやく選べる

#### Acceptance Criteria
1. While プレイ中である間, the game shall 残り時間、2つの主要ゲージ、発生中タスク一覧、センサー状態を常時表示する。
2. The game shall 発生中タスクごとに入力種別と急ぎ度を識別できる表示を行う。
3. The game shall 音量数値、顔座標、料理温度などの内部数値をそのまま表示しない。
4. When タスク状態が変化したとき, the game shall 成功、危険、失敗、急ぎの変化を視覚的に伝える。
5. When セッションが終了したとき, the game shall 評価ランク、最終ゲージ状態、成功数、部分介入数、複合操作数、失敗数、および一言コメントを含むリザルトを表示する。

### Requirement 11: 利用環境、プライバシー、最低限の配慮
**Objective:** As a プレイヤー, I want PCブラウザで安心して遊びたい, so that 端末の利用条件とデータの扱いを理解したうえでプレイできる

#### Acceptance Criteria
1. The game shall PC ブラウザ向けの1プレイ体験として提供される。
2. The game shall マイク音声とカメラ映像を保存しない。
3. The game shall マイク音声とカメラ映像を外部へ送信しない。
4. When プレイヤーが開始前確認画面を見るとき, the game shall 音声と映像がブラウザ内で処理されることを明示する。
5. While プレイ中である間, the game shall マイクとカメラを使用していることを識別できる表示を維持する。
6. The game shall 色だけに依存せず、アイコン、文言、または動きでも危険状態と入力状態を伝える。
7. The game shall 環境音や顔位置に関する補助ヒントを表示し、入力成立に必要な左右、上下、前後の調整方向をプレイヤーへ示す。
