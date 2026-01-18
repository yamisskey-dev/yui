# 技術レビュー / タスク一覧 (自動生成)

最終更新: 2025-09-01

目的: `docs/` と `src/` を照合し、未整合箇所の洗い出し、厳密なコードレビューの結果とタスク分割を記載します。

1) 概要
- このドキュメントは自動的に生成された初期タスク一覧です。
- 優先度は Red/Yellow/Green の三段階で付与しています。

2) 発見事項サマリ
- `src/index.ts` でコメントアウトされているモジュール: `EmojiReactModule`, `KeywordModule`, `MazeModule`, `ChartModule`, `PollModule`, `EarthQuakeWarningModule`。
  - ドキュメントでは一部が有効になっている表記があり、`docs/README.md` を実装に合わせて更新済み。
- ソース内にある TODO コメント:
  - `src/ai.ts` (行214–243): ルームチャット処理 実装済み（本PR）— フォローアップ: 安定化/テスト
  - `src/ai.ts` (別箇所): TODO: 改善提案 — 優先度: Green
  - `src/modules/reversi/back.ts`: TODO: 改善提案 — 優先度: Green
- テスト関連:
  - 一部テストファイル（ping, dice, birthday）は ESM テスト実行時に空テストで失敗する問題への暫定対応として最小プレースホルダを追加済み。早急に元のテストに戻すか、実装に合わせてテストを更新してください。

3) 推奨タスク（優先度付き）

- Red: ドキュメントと実装の齟齬修正
  - TASK-001: `docs` の機能表を `src/index.ts` の現状に合わせる（完了: `docs/README.md` 更新）
    - 担当: ドキュメント担当
    - 状態: Done（2025-09-01）

- Yellow: 実装に関わる修正（動作に影響）
  - TASK-002: `src/ai.ts` のルームチャット処理の安定化とテスト追加
    - 担当: 実装担当
    - 期限候補: 1週間
    - 前提: ルームチャットの仕様を `docs/features/communication` に追記
    - チェック項目: ルームでの mention/subscribe/unsubscribe の挙動、エラー時のフォールバック
  - TASK-003: `src/modules/reminder/index.ts` の入力パース改善
    - 目的: mentionHook の時間/内容パースが脆弱なため堅牢化
    - 期限: 3日
    - 詳細: 自然言語日時表現の正規化、chrono-node を使った解析の堅牢化、空入力検出の改善、ユニットテスト追加

- Green: 改善・ドキュメント整備（低リスク）
  - TASK-004: `src/modules/reversi/back.ts` の TODO を具体化して Issue を作成
  - TASK-005: `docs/*` の連携手順に `development.md` の Docker/ビルド手順を追記（完了検討）
  - TASK-006: README に `docs/TECH_TASKS.md` へのリンクを追加（完了）

4) 具体的な分割案（エピック -> チケット）

- EPIC-A: AI/Chat 安定化
  - CH-1: ルームチャット処理の安定化（TASK-002）
  - CH-2: aichat の API エラー処理改善（retry / backoff）
  - CH-3: URL プレビューと YouTube 正規化のユニットテスト作成

- EPIC-B: 通知・リマインダー強化
  - CH-4: Reminder の日時パース改善（TASK-003）
  - CH-5: Timeout 再試行ロジックの改善（投稿失敗時の取り扱い、500 系・404 系の具体的分岐）

- EPIC-C: ドキュメント整合 & QA
  - CH-6: docs と src の自動整合チェックツール作成（次フェーズ）
  - CH-7: 各機能の e2e テスト計画と CI 組込

5) 追加メモ・コードレビューの生データ
- TODO一覧:
  - src/ai.ts: 行214, 248
  - src/modules/reversi/back.ts: 行278
- モジュール起動一覧 (src/index.ts, 2025-09-01 時点):
  - 有効: Core, AiChat, Reminder, Talk, CheckCustomEmojis, Emoji, Fortune, GuessingGame, Kazutori, Reversi, Timer, Dice, Ping, Welcome, Server, Follow, Birthday, Valentine, SleepReport, Noting
  - 無効(コメントアウト): EmojiReactModule, KeywordModule, MazeModule, ChartModule, PollModule, EarthQuakeWarningModule

6) 次のステップ (推奨)
- (A) TECH_TASKS の内容をレビューし、Red/Yellow 項目の担当と期限を確定してください。
- (B) 優先度 Red の TASK-002 / TASK-003 をそれぞれブランチ化して段階的に PR を作成してください。
- (C) docs の自動整合チェック（EPIC-C CH-6）は中長期の投資として検討してください。

7) 参考コマンド
- テスト実行（ESM）
```bash
node --experimental-vm-modules node_modules/jest/bin/jest.js --runInBand --colors
```
- commit 履歴確認
```bash
git --no-pager log -n 10 --pretty=format:"%h %an <%ae> %s"
```

---

ドキュメント更新・改善のリクエストがあれば、具体的な変更箇所を指示してください。
