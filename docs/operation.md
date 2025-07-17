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

---

詳細な仕様や開発手順は他のドキュメントを参照してください。 