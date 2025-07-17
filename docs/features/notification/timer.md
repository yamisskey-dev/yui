# タイマー [[timer]]

## 概要
- ユーザーごとに「○分後」「○秒後」などのタイマーをセットし、時間経過後に通知
- DM・リプライどちらでも利用可能

## コード定義
- メイン実装: `src/modules/timer/index.ts`
- データ管理: setTimeoutと永続化用コレクション

## コードでの扱い方
- `mentionHook`でタイマーセット・キャンセル・残り時間確認などに反応
- `timeoutCallback`で時間経過後に自動通知

## 使い方・拡張方法
- 最大タイマー時間や応答文は定数・serifs.tsで調整可能
- 新しい通知パターンやUI拡張も容易

## 関連・連携
- [[features/communication/reminder.md]]（リマインダー機能）
- [[features/communication/core.md]]（モジュール管理・基本応答）

---

運用・開発Tipsは [[features/communication/development.md]] を参照。 