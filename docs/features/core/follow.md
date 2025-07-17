# フォロー返し [[follow]]

## 概要
- ユーザーから「フォロー」「フォロバ」などのリクエストに応じて自動でフォロー返しを行う機能

## コード定義
- メイン実装: `src/modules/follow/index.ts`

## コードでの扱い方
- `mentionHook`でフォロー関連キーワードを検出し、APIでフォロー処理を実行
- 既にフォロー済みかどうかも判定し、応答を分岐

## 使い方・拡張方法
- キーワードや応答パターンはコード内で編集可能
- フォロー条件やリアクションのカスタマイズも容易

## 関連・連携
- [[features/communication/core.md]]（モジュール管理・基本応答）
- [[features/communication/reminder.md]]（リマインダーと組み合わせて通知も可能）

---

運用・開発Tipsは [[features/communication/development.md]] を参照。 