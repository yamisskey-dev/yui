# バレンタイン [[valentine]]

## 概要
- バレンタインデー（2月14日）に親愛度の高いユーザーへチョコレートメッセージを自動送信

## コード定義
- メイン実装: `src/modules/valentine/index.ts`
- 親愛度管理: Friendクラス

## コードでの扱い方
- `crawleValentine`メソッドで日付判定・親愛度判定・送信済み管理
- 定期実行で毎日チェック
- メッセージ内容は`serifs.ts`で管理

## 使い方・拡張方法
- メッセージや条件は`serifs.ts`やコード内で編集可能
- 他の記念日イベントへの拡張も容易

## 関連・連携
- [[features/communication/core.md]]（モジュール管理・基本応答）
- [[features/communication/reminder.md]]（リマインダーと組み合わせて通知も可能）

---

運用・開発Tipsは [[features/communication/development.md]] を参照。 