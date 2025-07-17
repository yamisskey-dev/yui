# コア（基本応答・モジュール管理） [[core]]

## 概要
- 唯の基本的な応答・モジュール管理・全体のフック処理を担う中核機能
- モジュール一覧表示や基本的な挨拶・応答も担当

## コード定義
- メイン実装: `src/modules/core/index.ts`

## コードでの扱い方
- `mentionHook`や`contextHook`で基本応答やモジュール一覧表示に反応
- 他モジュールの管理・呼び出しも担当

## 使い方・拡張方法
- 新しいモジュール追加時はここで管理
- 基本応答や挨拶パターンの追加も容易

## 関連・連携
- 全機能の基盤として他モジュールと密接に連携
- [[features/communication/development.md]]（運用・開発Tips）

---

詳細は各機能ドキュメントや [[features/communication/development.md]] を参照。 