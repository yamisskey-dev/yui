# 占い [[fortune]]

## 概要
- ユーザーごとに日替わりで運勢（大吉〜大凶など）とラッキーアイテムを占う
- 「占」「うらな」「運勢」「おみくじ」などのキーワードで反応

## コード定義
- メイン実装: `src/modules/fortune/index.ts`
- おみくじパターン: ファイル内の配列で管理

## コードでの扱い方
- `mentionHook`でキーワードを検出し、日替わりで運勢・アイテムを返信
- `serifs.ts`のセリフも活用

## 使い方・拡張方法
- 運勢やアイテムのパターン追加は配列を編集
- 応答パターンやキーワード追加も容易

## 関連・連携
- [[features/communication/core.md]]（モジュール管理・基本応答）
- [[features/communication/talk.md]]（会話と組み合わせた遊びも可能）

---

運用・開発Tipsは [[features/communication/development.md]] を参照。 