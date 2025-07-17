# 天気note自動投稿 [[noting]]

## 概要
- 福岡の天気APIを定期取得し、天気や気温、天候の変化に応じてMisskeyにnoteを自動投稿
- 投稿内容はAI（Gemini）で生成

## 主な仕様
- 起動時必ず1回投稿、以降12〜36時間ごとに乱数で投稿
- 同じ天気現象は1日1回のみ投稿、現象変化時は50%の確率で投稿
- 未知の天気は「珍しい天気」としてAIに柔軟note生成を指示
- 投稿パターンはserifs.tsのweather_phrasesで管理

## 関連・連携
- [[features/communication/reminder.md]]（天気noteの投稿タイミングをリマインダーで通知可能）
- [[features/communication/core.md]]（モジュール管理・基本応答）

---

詳細な運用・開発Tipsは [[features/communication/development.md]] を参照。 