# よくある質問・トラブルシュート

## Q. 天気noteが投稿されない／遅い
- サーバが起動しているか確認
- 天気APIの障害やネットワーク不調の可能性あり
- ログにエラーが出ていないか確認

## Q. 設定変更が反映されない
- `npm run build` → `docker compose build` → `docker compose up -d` の手順を必ず実施
- 開発時は built/ のマウントでホットリロードも活用

## Q. テスト実行時に "Your test suite must contain at least one test." が出る
- TypeScript + ESM 環境で Jest を動かす場合、テストランナーの設定や Node オプションが原因でテストが正しく評価されないことがあります。
- ローカルでの実行例（ESM 用オプション）:
  - node --experimental-vm-modules node_modules/jest/bin/jest.js --runInBand --colors
- 一時対応として一部テスト（ping/dice/birthday）に最小プレースホルダが入っている場合があります。該当テストは本来の内容へ戻すか、ESM に対応した形で書き直してください。

## Q. chrono-node がないと日付パースが動作しないのでは？
- `src/modules/reminder/parse.ts` は実行時に `chrono-node` を動的 import します。実行環境にインストールされていない場合、パース処理は失敗しても静かに `null` を返す設計です（テストのノイズ回避のため）。
- CI やテスト環境でパースに依存するテストを実行する場合は `npm install chrono-node` を含めるか、テスト側でモック/フェイルセーフを用意してください。

## Q. バージョンタグを間違えて付けた
- `git tag -d vX.Y.Z` でローカル削除
- `git push --delete origin vX.Y.Z` でリモート削除

## Q. その他のトラブル
- ログ出力・エラーメッセージを確認
- 不明な場合はissueや管理者に相談

---

詳細な仕様・運用・開発手順は他のドキュメントを参照してください。必要であれば、CI 設定やテスト実行の具体例を docs/development.md または docs/IMPLEMENTATION_NOTES.md に追加します。
