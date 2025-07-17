# サーバ監視 [[server]]

## 概要
- Misskeyサーバの状態や負荷を監視し、異常時に通知する機能
- CPU負荷やエラー発生時に自動でアラート投稿

## コード定義
- メイン実装: `src/modules/server/index.ts`

## コードでの扱い方
- サーバ状態を定期監視し、閾値超過時に自動投稿
- 通知内容は`serifs.ts`で管理

## 使い方・拡張方法
- 監視項目や閾値はコード・`serifs.ts`で調整可能
- 他の監視項目追加や通知方法の拡張も容易

## 関連・連携
- [[features/communication/core.md]]（モジュール管理・基本応答）
- [[features/communication/reminder.md]]（リマインダーと組み合わせて通知も可能）

---

運用・開発Tipsは [[features/communication/development.md]] を参照。 