# 絵文字生成 [[emoji]]

## 概要
- ランダムな顔文字・手の絵文字を組み合わせて生成し、Misskeyに投稿
- 「顔文字」「絵文字」「emoji」「福笑い」などのキーワードで反応

## コード定義
- メイン実装: `src/modules/emoji/index.ts`
- 顔・手のパターン: ファイル内の配列で管理

## コードでの扱い方
- `mentionHook`でキーワードを検出し、ランダム生成して返信
- `serifs.ts`のセリフも活用

## 使い方・拡張方法
- 顔・手のパターン追加は配列を編集
- 応答パターンやキーワード追加も容易

## 関連・連携
- [[features/communication/emoji-react.md]]（絵文字リアクション機能）
- [[features/communication/check-custom-emojis.md]]（カスタム絵文字チェック）
- [[features/communication/core.md]]（モジュール管理・基本応答）

---

運用・開発Tipsは [[features/communication/development.md]] を参照。 