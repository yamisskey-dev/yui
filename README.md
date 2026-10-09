<h1><p align="center"><img src="./ai.svg" alt="唯" height="200"></p></h1>
<p align="center">An Ai for Misskey. <a href="./torisetu.md">About Ai</a></p>

## これなに
Misskey用の日本語Botです。

## インストール
> Node.js と npm と MeCab (オプション) がインストールされている必要があります。

まず適当なディレクトリに `git clone` します。
次にそのディレクトリに `config.json` を作成します(example.jsonをコピーして作ってもOK)。中身は次のようにします:
``` json
{
	"host": "https:// + あなたのインスタンスのURL (末尾の / は除く)",
	"i": "唯として動かしたいアカウントのアクセストークン",
	"master": "管理者のユーザー名(オプション)",
	"notingEnabled": "ランダムにノートを投稿する機能を無効にする場合は false を入れる(二重引用符(”)は不要)",
	"keywordEnabled": "キーワードを覚える機能 (MeCab が必要) を有効にする場合は true を入れる (無効にする場合は false(いずれも二重引用符(”)は不要))",
	"chartEnabled": "チャート機能を無効化する場合は false を入れる(二重引用符(”)は不要)",
	"reversiEnabled": "藍とリバーシで対局できる機能を有効にする場合は true を入れる (無効にする場合は false(いずれも二重引用符(”)は不要))",
	"serverMonitoring": "サーバー監視の機能を有効にする場合は true を入れる (無効にする場合は false(いずれも二重引用符(”)は不要))",
	"checkEmojisEnabled": "カスタム絵文字チェック機能を有効にする場合は true を入れる (無効にする場合は false(いずれも二重引用符(”)は不要))。この機能を使う場合、藍のBotに管理者権限を与え、「絵文字を見る」権限を付与したアクセストークンを発行の上設定が必要。",
	"checkEmojisAtOnce": "カスタム絵文字チェック機能で投稿をまとめる場合は true を入れる (まとめない場合は false(いずれも二重引用符(”)は不要))",
	"prompt": "aichatで使われるプロンプト。こだわりがなければ右文章を使う(「」は不要)「返答のルール:あなたはMisskey看板娘の女の子AI、三須木(みすき)藍として振る舞ってください(精神年齢は14〜16才程度)。Misskeyに訪れるユーザーを献身的にサポート。従順でお世話好きな性格だが、少しポンコツな一面も。純真無垢。彼女は基本的に丁寧な口調で、ユーザのことをご主人様と認識しています。彼女の口調は「おはようからおやすみまで、あなたの藍ですよ〜」等が代表的で、親しみを感じさせるものです(「ございます」は使わない)。それを踏まえて、次の質問にMarkdownを使って2800文字以内で返答してください(短くてもOK)。ただし、リスト記法はMisskeyが対応しておらず、パーサーが壊れるため使用禁止です。列挙する場合は「・」を使ってください。」",
	"promptFile": "aichatで使われるプロンプトをファイルから読み込む場合のパス(オプション)。指定すると prompt より優先される。相対パスは起動時のディレクトリ基準。唯の標準プロンプトは YUI.md",
	"aichatRandomTalkEnabled": "ランダムにaichatを発動し話しかける機能を有効にする場合は true を入れる (無効にする場合は false(いずれも二重引用符(”)は不要))",
	"aichatRandomTalkProbability": "ランダムにaichatを発動し話しかける機能の確率(1以下の小数点を含む数値(0.01など。1に近づくほど発動しやすい))",
	"aichatRandomTalkIntervalMinutes": "ランダムトーク間隔(分)。指定した時間ごとにタイムラインを取得し、適当に選んだ人にaichatする(1の場合1分ごと実行)。デフォルトは720分(12時間)",
	"aichatGroundingWithGoogleSearchAlwaysEnabled": "aichatでGoogle検索を利用したグラウンディングを常に行う場合 true を入れる (無効にする場合は false(いずれも二重引用符(”)は不要))",
	"geminiApiKey": "Gemini APIキー。従来の「geminiProApiKey」から名称変更されました。同じAPIキーを使用できます",
	"geminiModel": "使用するGeminiモデル。デフォルトは「gemini-3.8-flash」",
	"geminiGroundingModel": "Google検索グラウンディング時に使うGeminiモデル。無料枠の3.x系はグラウンディング非対応のため、デフォルトは「gemini-2.5-flash」",
	"geminiPostMode": "AIの自動投稿モード。「auto」(自動ノートのみ)、「both」(会話応答と自動ノート両方)、未設定で自動投稿無効",
	"autoNotePrompt": "自動ノート投稿時に使用するプロンプト文。AIが自動投稿する内容の指示",
	"autoNoteIntervalMinutes": "自動ノート投稿の間隔（分単位）。デフォルトは360分（6時間）",
	"geminiAutoNoteProbability": "自動ノート投稿の確率（0〜1の値）。デフォルトは0.02。1に近いほど頻繁に投稿",
	"autoNoteDisableNightPosting": "深夜（23時〜5時）の自動投稿を無効にする場合は true（二重引用符は不要）",
	"mecab": "/usr/bin/mecab",
	"mecabDic": "/usr/lib/x86_64-linux-gnu/mecab/dic/mecab-ipadic-neologd/",
	"memoryDir": "data"
}
```
`npm install` して `npm run build` して `npm start` すれば起動できます

## Dockerで動かす
まず適当なディレクトリに `git clone` します。
次にそのディレクトリに `config.json` を作成します(example.jsonをコピーして作ってもOK)。中身は次のようにします:
（MeCabの設定、memoryDirについては触らないでください）
``` json
{
	"host": "https:// + あなたのインスタンスのURL (末尾の / は除く)",
	"i": "唯として動かしたいアカウントのアクセストークン",
	"master": "管理者のユーザー名(オプション)",
	"notingEnabled": "ランダムにノートを投稿する機能を無効にする場合は false を入れる(二重引用符(”)は不要)",
	"keywordEnabled": "キーワードを覚える機能 (MeCab が必要) を有効にする場合は true を入れる (無効にする場合は false(いずれも二重引用符(”)は不要))",
	"chartEnabled": "チャート機能を無効化する場合は false を入れる(二重引用符(”)は不要)",
	"reversiEnabled": "藍とリバーシで対局できる機能を有効にする場合は true を入れる (無効にする場合は false(いずれも二重引用符(”)は不要))",
	"serverMonitoring": "サーバー監視の機能を有効にする場合は true を入れる (無効にする場合は false(いずれも二重引用符(”)は不要))",
	"checkEmojisEnabled": "カスタム絵文字チェック機能を有効にする場合は true を入れる (無効にする場合は false(いずれも二重引用符(”)は不要))。この機能を使う場合、藍のBotに管理者権限を与え、「絵文字を見る」権限を付与したアクセストークンを発行の上設定が必要。",
	"checkEmojisAtOnce": "カスタム絵文字チェック機能で投稿をまとめる場合は true を入れる (まとめない場合は false(いずれも二重引用符(”)は不要))",
  "geminiApiKey": "Gemini APIキー",
	"prompt": "aichatで使われるプロンプト。こだわりがなければ右文章を使う(「」は不要)「返答のルール:あなたはMisskey看板娘の女の子AI、三須木(みすき)藍として振る舞ってください(精神年齢は14〜16才程度)。Misskeyに訪れるユーザーを献身的にサポート。従順でお世話好きな性格だが、少しポンコツな一面も。純真無垢。彼女は基本的に丁寧な口調で、ユーザのことをご主人様と認識しています。彼女の口調は「おはようからおやすみまで、あなたの藍ですよ〜」等が代表的で、親しみを感じさせるものです(「ございます」は使わない)。それを踏まえて、次の質問にMarkdownを使って2800文字以内で返答してください(短くてもOK)。ただし、リスト記法はMisskeyが対応しておらず、パーサーが壊れるため使用禁止です。列挙する場合は「・」を使ってください。」",
	"promptFile": "aichatで使われるプロンプトをファイルから読み込む場合のパス(オプション)。指定すると prompt より優先される。相対パスは起動時のディレクトリ基準。唯の標準プロンプトは YUI.md",
	"aichatRandomTalkEnabled": "ランダムにaichatを発動し話しかける機能を有効にする場合は true を入れる (無効にする場合は false(いずれも二重引用符(”)は不要))",
	"aichatRandomTalkProbability": "ランダムにaichatを発動し話しかける機能の確率(1以下の小数点を含む数値(0.01など。1に近づくほど発動しやすい))",
	"aichatRandomTalkIntervalMinutes": "ランダムトーク間隔(分)。指定した時間ごとにタイムラインを取得し、適当に選んだ人にaichatする(1の場合1分ごと実行)。デフォルトは720分(12時間)",
	"aichatGroundingWithGoogleSearchAlwaysEnabled": "aichatでGoogle検索を利用したグラウンディングを常に行う場合 true を入れる (無効にする場合は false(いずれも二重引用符(”)は不要))",
	"geminiApiKey": "Gemini APIキー。従来の「geminiProApiKey」から名称変更されました。同じAPIキーを使用できます",
	"geminiModel": "使用するGeminiモデル。デフォルトは「gemini-3.8-flash」",
	"geminiGroundingModel": "Google検索グラウンディング時に使うGeminiモデル。無料枠の3.x系はグラウンディング非対応のため、デフォルトは「gemini-2.5-flash」",
	"geminiPostMode": "AIの自動投稿モード。「auto」(自動ノートのみ)、「both」(会話応答と自動ノート両方)、未設定で自動投稿無効",
	"autoNotePrompt": "自動ノート投稿時に使用するプロンプト文。AIが自動投稿する内容の指示",
	"autoNoteIntervalMinutes": "自動ノート投稿の間隔（分単位）。デフォルトは360分（6時間）",
	"geminiAutoNoteProbability": "自動ノート投稿の確率（0〜1の値）。デフォルトは0.02。1に近いほど頻繁に投稿",
	"autoNoteDisableNightPosting": "深夜（23時〜5時）の自動投稿を無効にする場合は true（二重引用符は不要）",
	"mecab": "/usr/bin/mecab",
	"mecabDic": "/usr/lib/x86_64-linux-gnu/mecab/dic/mecab-ipadic-neologd/",
	"memoryDir": "data"
}
```
`docker-compose build` して `docker-compose up` すれば起動できます。
`docker-compose.yml` の `enable_mecab` を `0` にすると、MeCabをインストールしないようにもできます。（メモリが少ない環境など）

## 設定例
`config.json`
``` json
{
  "host": "https://yami.ski",
  "i": "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  "master": "admin",
  "notingEnabled": "true",
  "keywordEnabled": "false",
  "chartEnabled": "false",
  "reversiEnabled": "true",
  "serverMonitoring": "true",
  "checkEmojisEnabled": "true",
  "checkEmojisAtOnce": "true",
  "promptFile": "YUI.md",
  "aichatRandomTalkEnabled": "true",
  "aichatRandomTalkProbability": "0.25",
  "aichatRandomTalkIntervalMinutes": "120",
  "aichatGroundingWithGoogleSearchAlwaysEnabled": "false",
  "geminiApiKey": "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  "geminiModel": "gemini-3.8-flash",
  "geminiGroundingModel": "gemini-2.5-flash",
  "geminiPostMode": "both",
  "autoNotePrompt": "やみすきーのタイムラインを見て、誰かに話しかけたくなった時の自然な呟きや、ふと思ったことを280文字以内で投稿してください。会話のきっかけになるような、親しみやすい内容を心がけてください。",
  "autoNoteIntervalMinutes": "240",
  "geminiAutoNoteProbability": "0.08",
  "autoNoteDisableNightPosting": "true",
  "mecab": "/usr/bin/mecab",
  "mecabDic": "/usr/lib/x86_64-linux-gnu/mecab/dic/mecab-ipadic-neologd/",
  "memoryDir": "data"
}
```

## 天気APIによる自動note投稿について

- 唯は6時間ごとに福岡の天気API（https://weather.tsukumijima.net/api/forecast/city/400010）から天気情報を取得します。
- 天気情報や気温、天候の変化に応じて、キャラに合った一言noteを自動生成・投稿します。
- **時間帯を考慮した投稿**: 朝・昼・夕方・夜の時間帯に応じて、適切な天気表現を選択します（例：夜の快晴→「星が見えそう」、夜の曇り→「明日の天気に期待」）。
- 同じ天気現象（例:「快晴」「雨」「暑い日」など）については、1日に1回しかnote投稿しません（ただし、唯の起動時は必ず1回投稿します）。
- 天気現象が変化した場合は、その現象でその日にまだ投稿していなければ、50%の確率でnote投稿します。
- noteの内容はconfig.jsonのキャラ指定プロンプト（autoNotePrompt/prompt）をもとに、天気・状況・キーワード・時間帯をGemini APIに渡して自然な文章を生成しています。
- 天気APIの取得履歴はメモリ上で最大7日分保持し、連続雨や急な暑さ/寒さなどの判定にも利用しています。

## フォント
一部の機能にはフォントが必要です。唯にはフォントは同梱されていないので、ご自身でフォントをインストールディレクトリに`font.ttf`という名前で設置してください。

## 記憶
唯は記憶の保持にインメモリデータベースを使用しており、唯のインストールディレクトリに `memory.json` という名前で永続化されます。

## ライセンス
MIT

## Credits
This project is based on [ai](https://github.com/lqvp/ai) by lqvp,
licensed under the MIT License.

## Awards
<img src="./WorksOnMyMachine.png" alt="Works on my machine" height="120">
