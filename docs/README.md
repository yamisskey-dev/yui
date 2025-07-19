# ドキュメント目次・全体ガイド

このプロジェクトの機能仕様・使い方は、以下の各ドキュメントに分割して管理しています。

## 機能一覧（有効/無効ステータス付き）

| 機能カテゴリ | 機能名 | ドキュメント | 状態 |
|:---|:---|:---|:---|
| コア | コア | [[features/core/core.md]] | 🟢 |
| コア | Welcome | [[features/core/welcome.md]] | 🟢 |
| コア | Follow | [[features/core/follow.md]] | 🟢 |
| コア | Ping | [[features/core/ping.md]] | 🟢 |
| 会話・AI | 会話 | [[features/communication/talk.md]] | 🟢 |
| 会話・AI | AIチャット | [[features/communication/aichat.md]] | 🟢 |
| 会話・AI | 感情分析システム | [[features/communication/emotion-analysis.md]] | 🟢 |
| 会話・AI | 記憶管理システム | [[features/communication/memory-management.md]] | 🟢 |
| 会話・AI | キーワード学習 | [[features/communication/keyword.md]] | ❌ |
| ゲーム | リバーシ | [[features/game/reversi.md]] | 🟢 |
| ゲーム | 数当てゲーム | [[features/game/guessing-game.md]] | 🟢 |
| ゲーム | 数取りゲーム | [[features/game/kazutori.md]] | 🟢 |
| ゲーム | 迷路 | [[features/game/maze.md]] | ❌ |
| 通知・自動投稿 | リマインダー | [[features/notification/reminder.md]] | 🟢 |
| 通知・自動投稿 | タイマー | [[features/notification/timer.md]] | 🟢 |
| 通知・自動投稿 | バースデー | [[features/notification/birthday.md]] | 🟢 |
| 通知・自動投稿 | バレンタイン | [[features/notification/valentine.md]] | 🟢 |
| 通知・自動投稿 | 睡眠レポート | [[features/notification/sleep-report.md]] | 🟢 |
| 通知・自動投稿 | 天気note | [[features/automation/weather-note.md]] | 🟢 |
| 通知・自動投稿 | 地震速報 | [[features/automation/earthquake-warning.md]] | ❌ |
| 通知・自動投稿 | チャート | [[features/automation/chart.md]] | ❌ |
| 通知・自動投稿 | サーバ監視 | [[features/automation/server.md]] | 🟢 |
| 通知・自動投稿 | 投票 | [[features/automation/poll.md]] | ❌ |
| 絵文字 | 絵文字生成 | [[features/emoji/emoji.md]] | 🟢 |
| 絵文字 | 絵文字リアクション | [[features/emoji/emoji-react.md]] | 🟢 |
| 絵文字 | カスタム絵文字チェック | [[features/emoji/check-custom-emojis.md]] | 🟢 |
| 占い | 占い | [[features/notification/fortune.md]] | 🟢 |

---

※「有効/無効」は `src/index.ts` のimport/comment状態に基づきます。

運用・開発・バージョン管理・FAQは [[development.md]] にまとめてあります。

各機能の詳細・使い方・連携は、各ドキュメントを参照してください。 