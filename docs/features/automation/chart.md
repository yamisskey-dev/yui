# チャート [[chart]]

## 概要
- Misskeyインスタンスの投稿数などをグラフ化し、自動投稿する機能
- 定期的にチャート画像を生成・投稿

## コード定義
- メイン実装: `src/modules/chart/index.ts`
- チャート描画: `src/modules/chart/render-chart.ts`

## コードでの扱い方
- `post`メソッドでチャート生成・投稿を実行
- 定期実行で自動投稿
- チャート内容や描画は`render-chart.ts`で管理

## 使い方・拡張方法
- 投稿内容やグラフ種類の追加は`render-chart.ts`を編集
- 投稿タイミングや対象データの拡張も容易

## 関連・連携
- [[features/communication/core.md]]（モジュール管理・基本応答）
- [[features/communication/reminder.md]]（リマインダーと組み合わせて通知も可能）

---

運用・開発Tipsは [[features/communication/development.md]] を参照。 