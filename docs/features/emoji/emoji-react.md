# 絵文字リアクション [[emoji-react]]

## 概要
- Misskeyのノートに対して自動で絵文字リアクションを付与する機能
- 特定の条件やキーワードで反応

## コード定義
- メイン実装: `src/modules/emoji-react/index.ts`

## コードでの扱い方
- ノート内容や条件を判定し、APIでリアクションを付与
- リアクション内容や条件はコード内で管理

## 使い方・拡張方法
- リアクションパターンや条件はコードで編集可能
- 他のノートイベントやカスタム絵文字との連携も容易

## 関連・連携
- [[features/communication/emoji.md]]（絵文字生成機能）
- [[features/communication/check-custom-emojis.md]]（カスタム絵文字チェック）
- [[features/communication/core.md]]（モジュール管理・基本応答）

---

運用・開発Tipsは [[features/communication/development.md]] を参照。 