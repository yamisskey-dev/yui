# 技術レビュー / タスク一覧 (自動生成)

最終更新: 2025-08-27

目的: `docs/` と `src/` を照合し、未整合箇所の洗い出し、厳密なコードレビューの結果とタスク分割を記載します。

1) 概要
- このドキュメントは自動的に生成された初期タスク一覧です。
- 優先度は Red/Yellow/Green の三段階で付与しています。

2) 発見事項サマリ
- `src/index.ts` でコメントアウトされているモジュール: `EmojiReactModule`, `KeywordModule`, `MazeModule`, `ChartModule`, `PollModule`, `EarthQuakeWarningModule`。
  - ドキュメントでは一部が有効になっている表記があり、`docs/README.md` を実装に合わせて更新済み。
- ソース内にあるTODOコメント:
  - `src/ai.ts` (行214–243): ルームチャット処理 実装済み（本PR）— フォローアップ: 安定化/テスト
  - `src/ai.ts` (別箇所): TODO: 改善提案 — 優先度: Green
  - `src/modules/reversi/back.ts`: TODO: 改善提案 — 優先度: Green

3) 推奨タスク（優先度付き）

- Red: ドキュメントと実装の齟齬修正
  - TASK-001: docs の機能表を src/index.ts の現状に合わせる（完了: `docs/README.md` 更新）

- Yellow: 実装に関わる修正（動作に影響）
  - TASK-002: `src/ai.ts` のルームチャット処理実装
    - 担当: 実装者
    - 期限候補: 1週間
    - 前提: ルームチャットの仕様を `docs/features/communication` に追記
    - チェック項目: ルームでの mention/subscribe/unsubscribe の挙動
  - TASK-003: Reminder モジュールの入力パース改善
    - 目的: `src/modules/reminder/index.ts` の mentionHook の時間/内容パースが脆弱
    - 期限: 3日
    - 詳細: 日時指定（"in 2 hours", "tomorrow 9:00" 等）の正規化を追加。自然言語日付パーサ導入を検討（chrono-node 等）

- Green: 改善・ドキュメント整備（低リスク）
  - TASK-004: `src/modules/reversi/back.ts` の TODO を具体化（改善案の実装 or issue 化）
  - TASK-005: `docs/*` の連携手順に `development.md` の Docker/ビルド手順を明確化
  - TASK-006: README に `docs/TECH_TASKS.md` へのリンクを追加 (完了)

4) 具体的な分割案（エピック -> チケット）

- EPIC-A: AI/Chat 安定化
  - CH-1: ルームチャット処理 (TASK-002)
  - CH-2: Gemini API エラー処理の改善（aichat の genTextByGemini の retry/バックオフ）
  - CH-3: URL プレビューと YouTube 正規化のユニットテスト作成

- EPIC-B: 通知・リマインダー強化
  - CH-4: Reminder の日時パース (TASK-003)
  - CH-5: Timeout 再試行ロジックの改善（投稿失敗時の取り扱い）

- EPIC-C: ドキュメント整合 & QA
  - CH-6: docs の自動整合ツール作成（次フェーズ）
  - CH-7: 各機能の e2e テスト計画

5) 追加メモ・コードレビューの生データ
- TODO一覧:
  - src/ai.ts: 行214, 248
  - src/modules/reversi/back.ts: 行278

- モジュール起動一覧 (src/index.ts):
  - 有効: Core, Navi, AiChat, Reminder, Talk, CheckCustomEmojis, Emoji, Fortune, GuessingGame, Kazutori, Reversi, Timer, Dice, Ping, Welcome, Server, Follow, Birthday, Valentine, SleepReport, Noting
  - 無効(コメントアウト): EmojiReactModule, KeywordModule, MazeModule, ChartModule, PollModule, EarthQuakeWarningModule

6) 次のステップ
- (A) この TECH_TASKS を確認して優先度・担当を確定してください
- (B) 優先 Red/Yellow のタスクを 1 つずつ取り組み、PR を作成します



