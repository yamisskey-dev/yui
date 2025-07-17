# バージョン管理・タグ付け運用ルール

## 基本方針
- package.jsonのversionフィールドとGitタグを一致させる
- 安定版リリース時のみタグ付け（調査・修正・ドキュメント化まで完了後に実施）
- タグ例：v2.0.1

## 運用手順
1. すべての実装・修正・ドキュメント化が完了したら、package.jsonのversionを更新
2. `git commit`で変更を反映
3. `git tag vX.Y.Z`でタグ付与
4. `git push && git push origin vX.Y.Z`でリモート反映

## 注意事項
- タグ付けは「やるべきことが綺麗になってから」行う
- 誤ったタグは `git tag -d` および `git push --delete origin` で削除可能

---

開発・運用の詳細は他のドキュメントを参照してください。 