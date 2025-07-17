# リマインダー [[reminder]]

## 概要
- ユーザーごとにやること（ToDo）やリマインダーを登録・通知
- 時間指定や繰り返し通知も可能

## コード定義
- メイン実装: `src/modules/reminder/index.ts`
- データ管理: loki.jsコレクション

## コードでの扱い方
- `mentionHook`でリマインダー登録・削除・一覧表示などに反応
- `timeoutCallback`で時間経過後に自動通知
- `contextHook`で会話文脈からリマインダー操作も可能

## 使い方・拡張方法
- 通知間隔や最大件数は定数で調整可能
- 新しい通知パターンやUI拡張も容易

## 関連・連携
- [[features/communication/timer.md]]（タイマー機能）
- [[features/communication/noting.md]]（天気noteの投稿タイミング通知など）
- [[features/communication/core.md]]（モジュール管理・基本応答）

---

運用・開発Tipsは [[features/communication/development.md]] を参照。 