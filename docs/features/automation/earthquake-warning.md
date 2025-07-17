# 地震速報 [[earthquake-warning]]

## 概要
- 気象庁の地震速報APIを定期取得し、揺れや警報をMisskeyに自動投稿
- 揺れの強さや誤報・更新も判定して通知

## コード定義
- メイン実装: `src/modules/earthquake_warning/index.ts`
- APIエンドポイント・閾値等はクラス定数で管理

## コードでの扱い方
- 定期実行でAPI取得・判定・投稿を繰り返す
- 揺れの強さごとに異なるメッセージを投稿
- メッセージ内容は`serifs.ts`で管理

## 使い方・拡張方法
- 閾値や通知パターンはクラス定数・`serifs.ts`で調整可能
- 他の災害情報APIへの拡張も容易

## 関連・連携
- [[features/communication/core.md]]（モジュール管理・基本応答）
- [[features/communication/reminder.md]]（リマインダーと組み合わせて通知も可能）

---

運用・開発Tipsは [[features/communication/development.md]] を参照。 