# リバーシ [[reversi]]

## 概要
- Misskey上でユーザーとリバーシ（オセロ）対戦ができる機能
- 難易度設定や招待、AI対戦も可能

## コード定義
- メイン実装: `src/modules/reversi/index.ts`
- エンジン: `src/modules/reversi/engine.ts`, `src/modules/reversi/back.ts`

## コードでの扱い方
- `export default class extends Module` でモジュール化
- `mentionHook`でリバーシ関連コマンドに反応
- Misskeyのリアルタイムイベント（招待・マッチ・対局開始）をWebSocketで受信し処理
- 難易度や対戦相手管理はクラス内のMapやストリームで管理

## 使い方・拡張方法
- 設定: `config.reversiEnabled` で有効/無効切り替え
- 新しい戦略やAI強化は `engine.ts` を拡張
- 招待・対戦イベントの追加は `index.ts` のWebSocketハンドラを拡張

## 関連・連携
- [[features/communication/core.md]]（モジュール管理・基本応答）
- [[features/communication/talk.md]]（会話と組み合わせた遊びも可能）

---

運用・開発Tipsは [[features/communication/development.md]] を参照。 