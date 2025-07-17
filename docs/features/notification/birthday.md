# バースデー [[birthday]]

## 概要
- ユーザーの誕生日を祝う自動応答機能
- 誕生日当日にお祝いメッセージを自動投稿

## コード定義
- メイン実装: `src/modules/birthday/index.ts`

## コードでの扱い方
- `mentionHook`や定期実行で誕生日を判定し、該当ユーザーにお祝いメッセージを送信
- メッセージ内容は`serifs.ts`で管理

## 使い方・拡張方法
- お祝いメッセージや条件は`serifs.ts`やコード内で編集可能
- 他のイベント（記念日等）への拡張も容易

## 関連・連携
- [[features/communication/core.md]]（モジュール管理・基本応答）
- [[features/communication/reminder.md]]（リマインダーと組み合わせて通知も可能）

---

運用・開発Tipsは [[features/communication/development.md]] を参照。 