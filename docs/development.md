# 開発手順・開発効率化Tips

## 開発環境構築
- Node.js 20系推奨
- `npm install` で依存パッケージ導入
- TypeScriptで開発（`npm run build`でビルド）

## Docker開発Tips
- `docker compose build` でイメージ再構築
- `docker compose up -d` で起動
- 開発時は `built/` をボリュームマウント（docker-compose.ymlのコメント参照）
- ローカルで `npm run build` → `docker compose restart` で即反映

## コード修正・テスト
- 修正後は必ず `npm run build` で型・構文チェック
- エラー時は該当ファイル・行を確認し、型や参照先を修正

## 最近の重要な実装/テストに関する注意（追記）
- Reminder モジュール関連
  - `src/modules/reminder/index.ts` 側で lokijs の型依存を避けるため `MinimalCollection<T>` を導入しました。ランタイムは従来どおり loki を想定しますが、型参照が不要になったためビルド互換性が向上しています。将来的には `types/` 等へ共通化を検討してください。
  - パース処理は `src/modules/reminder/parse.ts` に移動し、`chrono-node` を動的 import する非同期関数（`parseTimeExpression`）になっています。これにより ESM/CJS の実行環境差異による import 時のエラーを回避しています。

- テスト実行に関する注意
  - 本プロジェクトは TypeScript + ESM の組み合わせでテストを動かすため、Jest 実行時に追加の Node オプションが必要な場合があります。ローカルでの実行例:
    - node --experimental-vm-modules node_modules/jest/bin/jest.js --runInBand --colors
  - `chrono-node` を使うテストやパースに依存する処理は、実行環境に `chrono-node` がインストールされていないとパースが無効化される（`null` を返す）ことがあります。CI/開発環境で安定して実行するには `npm install chrono-node` を含めるか、テスト側で依存チェックを行ってください。
  - 一部テストファイル（ping/dice/birthday）は ESM テスト実行時に「Your test suite must contain at least one test.」で失敗することが判明し、暫定的に最小プレースホルダを追加しています。元のテスト内容に戻すか、テストを ESM 対応で書き直すことを優先してください。

## 開発ワークフロー提案（短期）
1. Reminder のパース強化（`parseTimeExpression` のユニットテスト追加）
2. `MinimalCollection` を `src/types/` や `types/` に切り出し、他モジュールで再利用可能にする
3. CI（GitHub Actions 等）で ESM + ts-jest の組み合わせを安定化させる（`--experimental-vm-modules` を含める設定等）

## その他
- serifs.tsやnotingモジュールはコメント充実・拡張性重視
- バージョン管理・タグ付けは「やるべきことが綺麗になってから」実施
- ドキュメントは実装変更時に随時更新してください（今回のように実装が変わった箇所は docs/ に注記を追加済み）。

---

運用・仕様の詳細は他のドキュメントを参照してください。
