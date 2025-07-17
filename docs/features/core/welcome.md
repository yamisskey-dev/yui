# ノート歓迎 [[welcome]]

## 概要
- Misskeyのローカルタイムラインで初投稿したユーザーに自動で歓迎メッセージやリアクションを送る機能

## コード定義
- メイン実装: `src/modules/welcome/index.ts`

## コードでの扱い方
- ローカルタイムラインの`note`イベントを監視し、初投稿ユーザーを検出
- `notes/create`や`notes/reactions/create`で歓迎メッセージ・リアクションを送信
- メッセージ内容は`serifs.ts`で管理

## 使い方・拡張方法
- 歓迎メッセージやリアクションは`serifs.ts`やコード内で編集可能
- 他のイベント（初リプライ等）への拡張も容易

## 関連・連携
- [[features/communication/core.md]]（モジュール管理・基本応答）
- [[features/communication/reminder.md]]（リマインダーと組み合わせて通知も可能）

---

運用・開発Tipsは [[features/communication/development.md]] を参照。 