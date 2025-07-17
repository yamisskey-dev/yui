# 睡眠レポート [[sleep-report]]

## 概要
- サーバの稼働時間やAIの「睡眠」状態をレポートする機能
- 一定時間ごとに「寝てた」「うたた寝」などのメッセージを自動投稿

## コード定義
- メイン実装: `src/modules/sleep-report/index.ts`
- 状態管理: AIインスタンスのlastSleepedAt

## コードでの扱い方
- `report`メソッドで稼働時間を計算し、条件に応じてメッセージ投稿
- メッセージ内容は`serifs.ts`で管理

## 使い方・拡張方法
- レポート間隔やメッセージはコード・`serifs.ts`で調整可能
- 他の状態監視や通知機能への拡張も容易

## 関連・連携
- [[features/communication/core.md]]（モジュール管理・基本応答）
- [[features/communication/reminder.md]]（リマインダーと組み合わせて通知も可能）

---

運用・開発Tipsは [[features/communication/development.md]] を参照。 