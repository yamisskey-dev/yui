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
```markdown
# ドキュメント目次・全体ガイド

このドキュメントはコード実装状況に合わせて更新しています（最終更新: 2025-08-27）。

## 機能一覧（実装状況）

下表は `src/index.ts` のモジュール登録状況（起動時に new されているか）を基準にしています。コメントアウトされているモジュールは未稼働（未実装またはオプトアウト）です。

| カテゴリ | 機能 | ドキュメント | 実装状況 |
|:---|:---|:---|:---:|
| コア | core | [[features/core/core.md]] | 🟢 |
| コア | Welcome | [[features/core/welcome.md]] | 🟢 |
| コア | Follow | [[features/core/follow.md]] | 🟢 |
| コア | Ping | [[features/core/ping.md]] | 🟢 |
| 会話_AI | Talk（会話） | [[features/communication/talk.md]] | 🟢 |
| 会話_AI | AIチャット | [[features/communication/aichat.md]] | 🟢 |
| 会話_AI | 感情分析 | [[features/communication/emotion-analysis.md]] | 🟢 |
| 会話_AI | 記憶管理 | [[features/communication/memory-management.md]] | 🟢 |
| 会話_AI | キーワード学習 | [[features/communication/keyword.md]] | ❌ (未稼働) |
| ゲーム | Reversi | [[features/game/reversi.md]] | 🟢 |
| ゲーム | Guessing game | [[features/game/guessing-game.md]] | 🟢 |
| ゲーム | Kazutori | [[features/game/kazutori.md]] | 🟢 |
| ゲーム | Maze | [[features/game/maze.md]] | ❌ (未稼働) |
| 通知・自動投稿 | Reminder | [[features/notification/reminder.md]] | 🟢 |
| 通知・自動投稿 | Timer | [[features/notification/timer.md]] | 🟢 |
| 通知・自動投稿 | Birthday | [[features/notification/birthday.md]] | 🟢 |
| 通知・自動投稿 | Valentine | [[features/notification/valentine.md]] | 🟢 |
| 通知・自動投稿 | Sleep report | [[features/notification/sleep-report.md]] | 🟢 |
| 通知・自動投稿 | Weather note | [[features/automation/weather-note.md]] | 🟢 |
| 通知・自動投稿 | Earthquake warning | [[features/automation/earthquake-warning.md]] | ❌ (未稼働) |
| 通知・自動投稿 | Chart | [[features/automation/chart.md]] | ❌ (未稼働) |
| 通知・自動投稿 | Server monitoring | [[features/automation/server.md]] | 🟢 |
| 通知・自動投稿 | Poll | [[features/automation/poll.md]] | ❌ (未稼働) |
| 絵文字 | Emoji generation | [[features/emoji/emoji.md]] | 🟢 |
| 絵文字 | Emoji react | [[features/emoji/emoji-react.md]] | 🟢 |
| 絵文字 | Check custom emojis | [[features/emoji/check-custom-emojis.md]] | 🟢 |
| 占い | Fortune | [[features/notification/fortune.md]] | 🟢 |

---

注: 詳細な差分・改善タスクは `docs/TECH_TASKS.md` にまとめました。

運用・開発・バージョン管理・FAQは [[development.md]] にまとめてあります。

各機能の詳細・使い方・連携は、各ドキュメントを参照してください。
```
運用・開発・バージョン管理・FAQは [[development.md]] にまとめてあります。

各機能の詳細・使い方・連携は、各ドキュメントを参照してください。 