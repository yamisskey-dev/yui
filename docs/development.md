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

## その他
- serifs.tsやnotingモジュールはコメント充実・拡張性重視
- バージョン管理・タグ付けは「やるべきことが綺麗になってから」実施

---

運用・仕様の詳細は他のドキュメントを参照してください。 