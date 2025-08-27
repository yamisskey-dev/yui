# 天気note投稿 [[noting]]

## 概要
- 天気APIから気象情報を取得し、季節や天候に応じた自動投稿を行う
- 時間帯・季節・気温・天候の変化を分析して適切なタイミングで投稿
- 絵文字を活用したビジュアル表現で天気情報を魅力的に伝達

## コード定義
- メイン実装: `src/modules/noting/index.ts`
- セリフ: `serifs.ts`の`weather_phrases`セクション
- 設定: `config.json`の`notingEnabled`

## コードでの扱い方
- 起動時に必ず1回投稿、その後ランダム間隔で定期投稿
- 天気API（tsukumijima.net）から気象データを取得
- 天気履歴を最大7日分保存してトレンド分析
- 同じ現象は1日1回のみ投稿する重複防止機能

## 天気判定ロジック
### 特殊気象現象
- **台風**: telop・detailに「台風」を含む場合
- **大雪**: 「大雪」または雪＋警報の組み合わせ
- **猛暑日**: 最高気温35℃以上
- **雷雨**: 雷＋雨の組み合わせ
- **霜**: 11月〜3月で最低気温0℃以下

### 季節イベント
- **桜**: 3月下旬〜4月上旬の晴れ・曇り
- **花粉**: 3〜4月の晴れ・風強い日
- **黄砂**: 春季（3〜5月）に黄砂情報あり

### 変化パターン
- **連続雨**: 過去3日間連続で雨
- **雨明け晴れ**: 雨の翌日が晴れ
- **急な暑さ/寒さ**: 前日比±5℃以上の変化

## 使い方・拡張方法
### 基本設定
```json
{
  "notingEnabled": "true"
}
```

### 投稿タイミング制御
- **夜間投稿無効**: `autoNoteDisableNightPosting`で制御
- **投稿間隔**: `autoNoteIntervalMinutes`で調整
- **投稿確率**: `geminiAutoNoteProbability`で頻度調整

### カスタマイズ例
- 新しい気象パターンの追加
- 地域固有の天候イベント対応
- より詳細な季節判定の実装

## 実装詳細
### 天気データ取得
```typescript
const res = await axios.get('https://weather.tsukumijima.net/api/forecast/city/400010');
// リトライ機能付きで最大3回試行
```

### 履歴管理
```typescript
// 日付ごとに最大7日分の天気データを保存
this.weatherHistoryByDate[todayStr] = weather;
// 重複投稿防止のため投稿済みphraseKeyを記録
this.weatherNoteHistory[todayStr] = [phraseKey];
```

### 絵文字選択
```typescript
// 天気に応じた絵文字を自動選択
const emojis = getEmojiListForAI(weather_phrases[phraseKey]);
const selectedEmojis = selectEmoji(emojis, weather_phrases[phraseKey]);
```

## 関連・連携
- [[features/communication/aichat.md]]（AIチャット機能との連携）
- [[features/automation/server.md]]（サーバー監視との組み合わせ）
- [[features/core/core.md]]（基本モジュール管理）

## TODO・改善点
- [ ] より詳細な地域別天気対応
- [ ] 週間天気予報を考慮した先読み投稿
- [ ] ユーザー設定による投稿内容のカスタマイズ
- [ ] 気象警報・注意報の自動通知機能
- [ ] 天気と連動したリマインダー機能
- [ ] 季節感をより豊かにする追加イベント
- [ ] 天気履歴の可視化・統計機能
- [ ] APIエラー時のフォールバック機能強化

## 技術的課題
- [ ] 天気APIの可用性向上（複数API対応）
- [ ] メモリ使用量の最適化（履歴データサイズ）
- [ ] 絵文字選択アルゴリズムの改善
- [ ] 投稿タイミングの機械学習による最適化

---

運用・開発Tipsは [[development.md]] を参照。