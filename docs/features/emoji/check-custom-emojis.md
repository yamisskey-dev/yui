# カスタム絵文字チェック [[check-custom-emojis]]

## 概要
- Misskeyサーバに追加されたカスタム絵文字を自動で検出・通知する機能
- 新規追加時にノートやリアクションでお知らせ

## コード定義
- メイン実装: `src/modules/check-custom-emojis/index.ts`

## コードでの扱い方
- サーバの絵文字リストを定期取得し、差分を検出
- 新規追加時にノート投稿やリアクションで通知
- 通知内容や条件はコード内で管理

## 使い方・拡張方法
- チェック間隔や通知パターンはコードで編集可能
- 他の絵文字機能やノートイベントとの連携も容易

## 関連・連携
- [[features/communication/emoji.md]]（絵文字生成機能）
- [[features/communication/emoji-react.md]]（絵文字リアクション機能）
- [[features/communication/core.md]]（モジュール管理・基本応答）

---

運用・開発Tipsは [[features/communication/development.md]] を参照。 