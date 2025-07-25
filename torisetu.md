<img src="https://github.com/syuilo/ai/blob/master/ai.png?raw=true" align="right" height="320px"/>

# 取扱説明書

## プロフィール
[こちら](https://xn--931a.moe/)

## 唯の主な機能
### 挨拶
「おはよう」「おやすみ」などと話しかけると反応してくれます。

### 占い
唯に「占い」と言うと、あなたの今日の運勢を占ってくれます。

### タイマー
指定した時間、分、秒を経過したら教えてくれます。「3分40秒」のように単位を混ぜることもできます。

### リマインダー
```
@ai remind 部屋の掃除
```
のようにメンションを飛ばすと12時間おきにせっつかれます。その飛ばしたメンションか、唯ちゃんからの催促に「やった」または「やめた」と返信することでリマインダー解除されます。
また、引用Renoteでメンションすることもできます。

### 福笑い
唯に「絵文字」と言うと、唯が考えた絵文字の組み合わせを教えてくれます。

### サイコロ
ダイスノーテーションを伝えるとサイコロを振ってくれます。
例: "2d6" (6面サイコロを2回振る)、"3d5" (5面サイコロを3回振る)

### 数当てゲーム
唯にメッセージで「数当てゲーム」と言うと遊べます。
唯の考えている数字を当てるゲームです。

### 数取りゲーム
唯に「数取りゲーム」と言うと遊べます。
複数人で行うゲームで、もっとも大きい数字を言った人が勝ちです。

### リバーシ
唯とリバーシで対局できます。(この機能はインスタンスによっては無効になっている可能性があります)
唯に「リバーシ」と言うか、リバーシで唯を指名すれば対局できます。
強さも調整できます。

### 覚える
たまにタイムラインにあるキーワードを「覚え」ます。
(この機能はインスタンスによっては無効になっている可能性があります)

### 呼び方を教える
唯があなたのことをなんて呼べばいいか教えられます。
ただし後述の親愛度が一定の値に達している必要があります。
(トークでのみ反応します)

### いらっしゃい
Misskeyにアカウントを作成して初めて投稿を行うと、唯がネコミミアンテナでそれを補足し、Renoteしてみんなに知らせてくれる機能です。

### Follow me
唯に「フォローして」と言うとフォローしてくれます。

### HappyBirthday
唯があなたの誕生日を祝ってくれます。

### バレンタイン
唯がチョコレートをくれます。

### チャート
インスタンスの投稿チャートなどを投稿してくれます。

### サーバー監視
サーバーの状態を監視し、負荷が高くなっているときは教えてくれます。

### ping
PONGを返します。生存確認にどうぞ

### カスタム絵文字チェック
1日に1回、カスタム絵文字の追加を監視してくれます。「カスタム絵文字チェック」または「カスタムえもじチェック」、「カスタムえもじを確認して」ですぐに確認してくれます。この機能を使う際は、藍用アクセストークンの作り直しが必要となる可能性があります。**藍を動かすBotアカウントに管理者権限を付与し、Botアカウントで「絵文字をみる」権限を追加で付与したアクセストークンを作成し、そのトークンを設定**してください。

### aichat
```
@ai aichat 部屋の片付けの手順を教えて
```
のようにメンションを飛ばすと、GoogleのGemini APIなどを使って返答してくれます(今のバージョンではGemini APIのみ対応)。利用するにはAPIキーの登録が必要です。藍ちゃんの返信に対し、返信するとさらに返信されます(指定時間以内のみ)。**ggg**を文章に入れると、Google検索によるグラウンディング(モデルを検証可能な情報源に接続するプロセス)を行った回答を行います(ただし、AI側で判断し、検索しないこともある)。
APIキーを登録の上、設定でaichatRandomTalkEnabledをtrueにすると、ランダムトーク(ランダムでaichatを発動)させることも可能です。ランダムトーク間隔、ランダムトーク確率を設定で指定可能です。
設定でaichatGroundingWithGoogleSearchAlwaysEnabledをtrueにすると、メンションの場合、つねにGoogle検索によるグラウンディングを行った回答を試みます(gggの入力は不要。AI側で判断し、検索をしないこともある)。このグラウンディング機能は2025年2月現在、[1日1,000件利用可能](https://ai.google.dev/gemini-api/docs/models/gemini-v2?hl=ja#search-tool)です。

#### aichatの細かすぎる話

* aichat、または、返信にURLがある場合、Misskeyのサマリプロキシ？を使って、情報を取得した上で返答します。
* aichat、または、返信したものにファイルが添付されている場合、そのファイルをもとに返答します。
  * 画像、PDF、音声、動画(短いもの)、テキスト形式のファイルが利用可能です。
  * ただし、センシティブなファイルは送らないほうが無難です、よくないことが起こる可能性があります。
* aichatを行った際(mentionHook)、引用ノートがあれば、そのノートの本文を参照し、返答します。
* aichatの結果に対し、返信すると、その情報を加味して返信します。
  * 返信は10個を超えると参照しなくなります
  * 「exist.history.length > 10」の数字を変更すれば、参照する返信の数を増減できます(返信数が多くなり、送る文章が長すぎるとレスポンスが返ってこなかったり、エラーになったりするので気をつけてください)
  * 返信を監視する時間は定数TIMEOUT_TIMEで変更可能です(デフォルトは30分)
* ランダムトーク機能は確率(設定で指定)をクリアし、親愛度が指定(7)以上、かつ、Botでない場合のみ実行されます
  * 条件を変更したい場合はソース修正してください

### その他反応するフレーズ (トークのみ)
* かわいい
* なでなで
* 好き
* ぎゅー
* 罵って
* 踏んで
* 痛い

## 親愛度
唯はあなたに対する親愛度を持っています。
唯に挨拶したりすると、少しずつ上がっていきます。
親愛度によって反応や各種セリフが変化します。親愛度がある程度ないとしてくれないこともあります。
