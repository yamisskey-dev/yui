# 感情分析システム [[emotion-analysis]]

## 概要
AIチャット機能で使用される高度な感情分析システム。ユーザーのメッセージから感情を自動判定し、より自然な会話を実現します。

## 技術仕様

### 感情判定の優先順位
1. **Misskeyカスタム絵文字** (最優先)
2. **キーワード分析** (スコア計算)
3. **文脈分析** (否定語・強調語の考慮)
4. **デフォルト** (neutral)

### 絵文字感情マッピング

#### ポジティブ系絵文字
```typescript
':smile:' → 'happy'
':grin:' → 'happy'
':laughing:' → 'happy'
':joy:' → 'happy'
':heart:' → 'happy'
':heart_eyes:' → 'happy'
':blush:' → 'happy'
':wink:' → 'happy'
':ok_hand:' → 'happy'
':thumbsup:' → 'happy'
':clap:' → 'happy'
':tada:' → 'happy'
':sparkles:' → 'happy'
':star:' → 'happy'
':rainbow:' → 'happy'
':sunny:' → 'happy'
```

#### ネガティブ系絵文字
```typescript
':cry:' → 'sad'
':sob:' → 'sad'
':broken_heart:' → 'sad'
':disappointed:' → 'sad'
':rage:' → 'angry'
':angry:' → 'angry'
':punch:' → 'angry'
':middle_finger:' → 'angry'
':fearful:' → 'anxious'
':worried:' → 'anxious'
':cold_sweat:' → 'anxious'
':sweat:' → 'anxious'
```

#### 中立系絵文字
```typescript
':thinking:' → 'neutral'
':neutral_face:' → 'neutral'
':expressionless:' → 'neutral'
```

### キーワード感情マッピング

#### happy (嬉しい)
```typescript
[
  '嬉しい', '楽しい', '幸せ', '最高', '素晴らしい', '感動', '感激', '興奮',
  'ワクワク', 'ドキドキ', 'やったー', 'よっしゃ', 'やった', '成功', '達成',
  '感謝', 'ありがとう', '愛してる', '大好き', '完璧', '理想'
]
```

#### sad (悲しい)
```typescript
[
  '悲しい', '辛い', '苦しい', '切ない', '寂しい', '孤独', '絶望', '失望',
  '落ち込む', '凹む', 'しんどい', '疲れた', '死にたい', '消えたい', '終わり',
  '諦める', '無理', 'ダメ', '失敗', '後悔', '申し訳ない', 'ごめん'
]
```

#### angry (怒っている)
```typescript
[
  '怒', 'イライラ', '腹立つ', 'ムカつく', 'キレる', '許せない', '最悪',
  'クソ', 'うざい', 'うるさい', 'しつこい', 'めんどくさい', 'やだ',
  '嫌い', '大嫌い', '消えろ', '死ね', '殺す', 'ぶっ殺す', '殴る'
]
```

#### anxious (不安・心配)
```typescript
[
  '不安', '心配', '怖い', '恐い', '緊張', 'ドキドキ', 'ハラハラ',
  '焦る', '急ぐ', '間に合わない', 'やばい', 'まずい', '危険',
  '大変', '困る', 'どうしよう', '助けて', '助け', '救い'
]
```

### スコア計算アルゴリズム

#### 基本スコア計算
```typescript
// 各キーワードの出現回数 × 2 でスコア計算
const count = (message.match(new RegExp(keyword, 'g')) || []).length;
scores[sentiment] += count * 2;
```

#### 否定語処理
```typescript
// 否定語リスト
const negationWords = ['ない', 'ません', 'じゃない', 'ではない', '違う', 'ちがう'];

// 否定語がある場合の処理
if (hasNegation) {
  scores.happy = Math.max(0, scores.happy - 2);  // ポジティブ感情を減らす
  scores.sad = scores.sad + 1;                   // ネガティブ感情を増やす
  scores.anxious = scores.anxious + 1;
}
```

#### 強調語処理
```typescript
// 強調語リスト
const emphasisWords = ['すごく', 'とても', 'めちゃくちゃ', '超', '激', '死ぬほど', 'マジで'];

// 強調語がある場合の処理
if (hasEmphasis) {
  Object.keys(scores).forEach(key => {
    if (key !== 'neutral') {
      scores[key] *= 1.5;  // 感情スコアを1.5倍
    }
  });
}
```

### 感情判定ロジック
```typescript
// 最高スコアの感情を返す
const maxScore = Math.max(...Object.values(scores));
if (maxScore === 0) return 'neutral';

for (const [sentiment, score] of Object.entries(scores)) {
  if (score === maxScore) {
    return sentiment;
  }
}
```

## 実装メソッド

### analyzeMood(message: string): string
- **入力**: ユーザーメッセージ文字列
- **出力**: 感情タイプ ('happy' | 'sad' | 'angry' | 'anxious' | 'neutral')
- **処理**: 上記の優先順位で感情を判定

### 使用例
```typescript
// 絵文字優先
analyzeMood("今日はとても嬉しいです！:heart:") // → 'happy'

// キーワード分析
analyzeMood("今日は悲しい一日でした") // → 'sad'

// 否定語処理
analyzeMood("嬉しくない") // → 'sad' (happy-2, sad+1)

// 強調語処理
analyzeMood("すごく怒っている！") // → 'angry' (スコア1.5倍)

// デフォルト
analyzeMood("こんにちは") // → 'neutral'
```

## 拡張方法

### 新しい感情の追加
1. `sentimentKeywords`オブジェクトに新しい感情タイプを追加
2. `emojiSentiments`オブジェクトに絵文字マッピングを追加
3. `moodLabels`オブジェクトに日本語表示名を追加

### 新しいキーワードの追加
```typescript
// sentimentKeywordsに新しいキーワードを追加
happy: [
  // 既存のキーワード...
  '新しいキーワード'
]
```

### 新しい絵文字の追加
```typescript
// emojiSentimentsに新しい絵文字を追加
':new_emoji:' → 'happy'
```

## パフォーマンス考慮事項
- 絵文字チェックは最優先で早期リターン
- 正規表現マッチングは効率的な実装
- キーワードリストは定数として定義（メモリ効率）

## 関連ファイル
- メイン実装: `src/modules/aichat/index.ts`
- 関連機能: [[aichat]] (AIチャット機能)
- 記憶管理: [[memory-management]] (人間らしい記憶管理)

---

技術的な詳細や拡張方法については、開発チームにお問い合わせください。 