# 迷路 [[maze]]

## 概要
- ランダムな迷路画像を自動生成し、Misskeyに投稿する機能
- 定期的に新しい迷路を投稿

## コード定義
- メイン実装: `src/modules/maze/index.ts`
- 迷路生成: `src/modules/maze/gen-maze.ts`
- 迷路描画: `src/modules/maze/render-maze.ts`
- テーマ: `src/modules/maze/themes.ts`

## コードでの扱い方
- `post`メソッドで迷路生成・投稿を実行
- 定期実行で自動投稿
- 迷路生成・描画・テーマは各ファイルで管理

## 使い方・拡張方法
- 迷路サイズやテーマの追加は各ファイルを編集
- 投稿タイミングや難易度調整も容易

## 関連・連携
- [[features/communication/core.md]]（モジュール管理・基本応答）
- [[features/communication/reminder.md]]（リマインダーと組み合わせて通知も可能）

---

運用・開発Tipsは [[features/communication/development.md]] を参照。 