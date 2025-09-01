# 運用手順・管理者向けガイド

## 基本運用
- サーバ起動：`docker compose up -d` または `npm start`
- 停止：`docker compose down` または `Ctrl+C`
- 設定変更後は再ビルド・再起動が必要

## 障害時の対応
- 天気API取得失敗時は自動で3回リトライ
- 3回失敗時は管理者（config.master）にMisskey DMで通知
- ログ（標準出力）で詳細な状況を確認可能

## バージョンアップ・デプロイ
- コード修正後は `npm run build` → `docker compose build` → `docker compose up -d`
- 開発時は built/ のボリュームマウントでホットリロードも可能（docker-compose.yml参照）

## 注意事項
- 本番運用時は built/ のマウントを外すこと
- config.jsonの管理・バックアップを徹底

## Reminder 関連の運用注意（追記）
- 直近の実装変更により `src/modules/reminder/parse.ts` が実行時に `chrono-node` を動的 import する非同期処理へ移行しました。
  - 影響: リマインダー関連の連携テストや自動通知処理で日時パースが必要な場合、`chrono-node` が実行環境に存在しないとパースが行われず `null` が返ります（フォールバック動作は設計上存在しますが、期待する振る舞いにならない可能性があります）。
  - 対策: CI と本番環境のデプロイ時に `npm install chrono-node` を含めるか、コンテナイメージに組み込むことを推奨します。
- テスト/CI 実行時の ESM 対応:
  - Jest を ESM 環境で実行する際は Node に `--experimental-vm-modules` を付与する等の設定が必要になる場合があります。CI ワークフローに該当オプションを追加してください。
  - 例: `node --experimental-vm-modules node_modules/jest/bin/jest.js --runInBand --colors`
- 運用手順への反映:
  - リリース手順書やデプロイスクリプトに上記の `chrono-node` のインストールと ESM テスト実行オプションを明記してください。

---

その他の運用ノウハウ、障害復旧フローは上部の手順や `docs/IMPLEMENTATION_NOTES.md` を参照してください。
