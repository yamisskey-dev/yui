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

※「有効/無効」は `src/index.ts` の import/comment 状態に基づきます。

補足（直近の変更）
- 最終更新: 2025-09-01
- reminder モジュールの実装調整:
  - `src/modules/reminder/index.ts` 側で lokijs の型依存を避けるために `MinimalCollection<T>` を導入しています。これはランタイムの依存性を減らすための最小インターフェース定義です（実装の互換性に問題がないことを確認済み）。
  - `src/modules/reminder/parse.ts` は動的 import（chrono-node）を行う非同期関数のままです。テスト/実行環境によっては ESM 対応の実行オプションが必要です（下記参照）。

テスト実行に関する注意
- 本リポジトリは TypeScript + ESM の組み合わせでテストを動かすため、ローカルでの実行例:
  - node --experimental-vm-modules node_modules/jest/bin/jest.js --runInBand --colors
- いくつかのテストファイルは一時的にプレースホルダが入っています（ping/dice/birthday）。これは Jest の ESM 実行時に「Your test suite must contain at least one test.」で落ちる現象への暫定対応です。早めに本来のテスト実装に戻してください。

ドキュメントと実装の整合性について
- docs/TECH_TASKS.md に自動生成された差分レポートと対応タスクを掲載しています。ドキュメント更新は実装が変更された際に随時反映してください。

運用・開発・バージョン管理・FAQ は [[development.md]] にまとめてあります。

各機能の詳細・使い方・連携は、各ドキュメントを参照してください。
