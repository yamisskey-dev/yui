# リマインダー [[reminder]]

## 概要
- ユーザーごとにやること（ToDo）やリマインダーを登録・通知
- 時間指定や繰り返し通知も可能

## コード定義
- メイン実装: `src/modules/reminder/index.ts`
- パース実装: `src/modules/reminder/parse.ts`
- データ管理: loki.js を使うランタイム実装が前提だが、型依存は排除済み（MinimalCollection<T> を採用）

## 重要な変更点（最近の更新）
- 型依存削減
  - 実行時に loki を使ったコレクションを利用しますが、型定義側で `loki` の型を直接参照しないよう `MinimalCollection<T>`（最小限のインターフェース）を `src/modules/reminder/index.ts` に導入しました。
  - 目的: 外部の型定義（lokijs 型定義）がない環境でもビルド/型チェックが通るようにするためです。将来的にはこの MinimalCollection を共通型ファイルに切り出すことを推奨します。

- 時刻パースの非同期化
  - 自然言語日時パーサ（`chrono-node`）のロードを実行時に動的 import する実装へ移行しました。これに伴い `parseTimeExpression` は async 関数となり `Promise<ParseResult>` を返します。
  - 型は `export type ParseResult = { when: number; text: string } | null;` として `src/modules/reminder/parse.ts` 側で提供され、コール側では `import type { ParseResult } from './parse.js';` のように type-only import を使うことを想定しています。
  - 目的: ESM/CJS 環境やテストランナーの違いによる import エラーを回避するため。

- テスト環境について
  - 本リポジトリは TypeScript + ESM 構成でテストを実行するため、一部テストで Jest の ESM 実行オプション（例: `node --experimental-vm-modules`）が必要です。
  - 一時対応として `src/modules/ping/ping.test.ts` などのテストファイルに最小プレースホルダを追加しています。これは「Your test suite must contain at least one test.」というエラーを回避するための暫定措置です。プレースホルダは速やかに本来のテストに戻してください。

## 実行上の注意
- ローカルでの ESM テスト実行例:
  - node --experimental-vm-modules node_modules/jest/bin/jest.js --runInBand --colors
- `chrono-node` は parse 実行時に動的に import されます。実行環境にインストールされていない場合は、実行時にパースが無効化され `null` が返ることがあります。必要に応じて `npm install chrono-node` を行ってください。
- コレクションのランタイム実装は loki.js 想定のままです。もし別のストレージ層へ差し替える場合は `MinimalCollection<T>` に準拠する薄いラッパーを用意すれば互換性を保てます。

## 使い方・拡張方法
- mentionHook による登録フローや contextHook による会話ベースの操作は従来通りです。内部で扱う日時は `parseTimeExpression` により正規化され、`when` はミリ秒タイムスタンプで返却されます。
- 将来的な改善案:
  - `MinimalCollection` をプロジェクト共通の型ファイルへ移動し、他モジュールでも使えるようにする。
  - `parse.ts` のエラーログを充実させテストでのノイズを減らす（現在はパース失敗時に無音で null を返しています）。
  - ユニットテストを ESM 環境下で安定して実行できるよう、Jest 設定や ts-jest のオプションを見直す。

## 関連・連携
- [[features/communication/timer.md]]（タイマー機能）
- [[features/communication/noting.md]]（天気noteの投稿タイミング通知など）
- [[features/communication/core.md]]（モジュール管理・基本応答）
- 実装・技術タスクの詳細は `docs/TECH_TASKS.md` を参照してください。

---

運用・開発Tipsは [[features/communication/development.md]] を参照。
