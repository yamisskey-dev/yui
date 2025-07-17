# キーワード学習 [[keyword]]

## 概要
- タイムラインから固有名詞などのキーワードを自動抽出・学習
- 学習したキーワードをnoteや会話で活用

## 主な仕様
- MeCabを用いた形態素解析で名詞抽出
- 学習済みキーワードはDBに保存

## 関連・連携
- [[features/communication/noting.md]]（天気noteの生成キーワードに活用可能）
- [[features/communication/talk.md]]（会話時の話題生成に応用）

---

運用・開発Tipsは [[features/communication/development.md]] を参照。 