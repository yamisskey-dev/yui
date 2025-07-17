# ピンポン応答 [[ping]]

## 概要
- ユーザーから「ping」と話しかけられた際に「PONG!」と即時返信するシンプルな応答機能

## コード定義
- メイン実装: `src/modules/ping/index.ts`

## コードでの扱い方
- `mentionHook`で「ping」キーワードを検出し、即時返信
- 他のフックや複雑な状態管理は不要

## 使い方・拡張方法
- 応答ワードや返答内容はコード内で編集可能
- 他のキーワード追加や応答パターン拡張も容易

## 関連・連携
- [[features/communication/core.md]]（モジュール管理・基本応答）

---

運用・開発Tipsは [[features/communication/development.md]] を参照。 