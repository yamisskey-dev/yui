# AIチャット [[aichat]]

## 概要
- GeminiやOpenAIなどの外部AI APIを利用したチャット機能
- ユーザーの入力に対してAIが自然な応答を生成

## コード定義
- メイン実装: `src/modules/aichat/index.ts`
- APIキーやモデル設定: `config.json`や環境変数

## コードでの扱い方
- `mentionHook`でAIチャットコマンドや通常会話に反応
- 外部API呼び出し・応答生成は非同期で実行
- エラー時は`serifs.ts`のエラーメッセージを利用

## 使い方・拡張方法
- 利用するAIモデルやAPIキーは`config.json`で設定
- 応答パターンやプロンプトのカスタマイズも可能
- 他の会話系機能との連携も容易

## 関連・連携
- [[features/communication/talk.md]]（通常会話との違い・連携）
- [[features/communication/core.md]]（モジュール管理・基本応答）

---

運用・開発Tipsは [[features/communication/development.md]] を参照。 