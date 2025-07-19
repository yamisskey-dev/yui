# 人間らしい記憶管理システム [[memory-management]]

## 概要
AIチャット機能で使用される人間らしい記憶管理システム。会話の重要度、時間、文脈を考慮して記憶を自然に整理・忘却し、より自然な会話体験を提供します。

## システム設計

### 記憶データ構造
```typescript
interface Memory {
  conversations: Conversation[];
  userProfile?: UserProfile;
  conversationContext?: ConversationContext;
}

interface Conversation {
  id: string;                    // 会話の一意識別子
  timestamp: number;             // タイムスタンプ
  userMessage: string;           // ユーザーメッセージ
  aiResponse: string;            // AI応答
  context?: string;              // 会話の文脈（感情、話題など）
  importance: number;            // 重要度（0-10）
  isActive: boolean;             // アクティブな記憶かどうか
}

interface UserProfile {
  name: string;                  // ユーザー名
  interests: string[];           // 興味・関心
  conversationStyle: string;     // 会話スタイル
  lastInteraction: number;       // 最後の相互作用時刻
}

interface ConversationContext {
  currentTopic: string;          // 現在の話題
  mood: string;                  // 相手の気分
  relationshipLevel: number;     // 親密度（0-10）
}
```

## 重要度計算システム

### 計算要素と重み
```typescript
// 基本重要度: 5点
let importance = 5;

// 感情分析結果
if (mood === 'happy') importance += 2;
if (mood === 'sad') importance += 3;      // 悲しい内容は重要
if (mood === 'angry') importance += 3;    // 怒っている内容は重要
if (mood === 'anxious') importance += 2;

// 質問
if (message.includes('？') || message.includes('?')) {
  importance += 2;
}

// 個人的な内容
if (message.includes('私') || message.includes('僕') || 
    message.includes('俺') || message.includes('自分')) {
  importance += 2;
}

// 緊急度
if (message.includes('急いで') || message.includes('すぐ') || 
    message.includes('今すぐ') || message.includes('助けて')) {
  importance += 3;
}

// メッセージ長
if (message.length > 50) importance += 1;
if (message.length > 100) importance += 1;

// 絵文字使用
const emojiCount = (message.match(/:[a-zA-Z_]+:/g) || []).length;
if (emojiCount > 0) {
  importance += Math.min(emojiCount, 2);
}

// 強調表現
if (message.includes('！') || message.includes('!')) importance += 1;
if (message.includes('すごく') || message.includes('とても') || 
    message.includes('めちゃくちゃ')) importance += 1;

// 最大値制限
return Math.min(importance, 10);
```

### 重要度の意味
- **0-3**: 非常に低い重要度（すぐに忘却）
- **4-6**: 低い重要度（短期間で忘却）
- **7-8**: 中程度の重要度（長期間保持）
- **9-10**: 高い重要度（長期保持）

## 記憶の整理・忘却アルゴリズム

### 時間ベース忘却
```typescript
const now = Date.now();
const oneDay = 24 * 60 * 60 * 1000;
const oneWeek = 7 * oneDay;

conversations.forEach(conv => {
  const age = now - conv.timestamp;
  
  // 1週間以上前で重要度が低いものは非アクティブ
  if (age > oneWeek && conv.importance < 6) {
    conv.isActive = false;
  }
  
  // 1日以上前で重要度が非常に低いものは非アクティブ
  if (age > oneDay && conv.importance < 4) {
    conv.isActive = false;
  }
});
```

### 容量制限による忘却
```typescript
// アクティブな記憶を最大20個まで保持
const activeMemories = conversations.filter(c => c.isActive);
if (activeMemories.length > 20) {
  // 重要度が低いものから削除
  activeMemories.sort((a, b) => a.importance - b.importance);
  const toDeactivate = activeMemories.slice(0, activeMemories.length - 20);
  toDeactivate.forEach(m => m.isActive = false);
}
```

## 話題分析システム

### 話題カテゴリ
```typescript
const topicKeywords = {
  weather: ['天気', '雨', '晴れ', '曇り', '雪', '台風', '気温', '暑い', '寒い', '湿度'],
  work: ['仕事', '会社', '職場', '上司', '同僚', '会議', '残業', '給料', '転職', '就職'],
  hobby: ['趣味', '好き', '興味', 'ゲーム', '映画', '音楽', '読書', 'スポーツ', '料理', '旅行'],
  family: ['家族', '親', '子供', '兄弟', '姉妹', '夫', '妻', '結婚', '離婚', '育児'],
  friends: ['友達', '友人', '仲間', '彼氏', '彼女', '恋人', 'デート', '飲み会', 'サークル'],
  food: ['食べ物', '料理', 'レストラン', 'カフェ', 'お酒', '甘い', '辛い', '美味しい', 'まずい'],
  technology: ['パソコン', 'スマホ', 'アプリ', 'プログラミング', 'AI', '機械学習', 'インターネット'],
  health: ['健康', '病気', '病院', '薬', 'ダイエット', '運動', '睡眠', 'ストレス', '疲れ'],
  money: ['お金', '貯金', '投資', '株', '保険', 'ローン', '節約', '浪費', '給料', '副業'],
  education: ['学校', '大学', '勉強', '試験', 'テスト', '宿題', '研究', '論文', '卒業', '入学']
};
```

### 会話の性質分析
```typescript
const context: string[] = [];

// 感情分析
const mood = this.analyzeMood(message);
if (mood === 'happy') {
  context.push('positive_emotion');
} else if (['sad', 'angry', 'anxious'].includes(mood)) {
  context.push('negative_emotion');
}

// 会話の種類
if (message.includes('？') || message.includes('?')) {
  context.push('question');
}
if (message.includes('！') || message.includes('!')) {
  context.push('exclamation');
}
if (message.includes('...') || message.includes('…')) {
  context.push('hesitation');
}

// 緊急度
if (message.includes('急いで') || message.includes('すぐ') || message.includes('今すぐ')) {
  context.push('urgent');
}
```

## 人間らしい文脈生成

### 文脈生成アルゴリズム
```typescript
private generateHumanLikeContext(memory: any): string {
  if (!memory || !memory.conversations) return '';
  
  const activeMemories = memory.conversations.filter((c: any) => c.isActive);
  if (activeMemories.length === 0) return '';
  
  // 最近の会話（最大5個）を自然な文脈として生成
  const recentMemories = activeMemories
    .sort((a: any, b: any) => b.timestamp - a.timestamp)
    .slice(0, 5);
  
  let context = '';
  
  // ユーザー名の表示
  if (memory.userProfile?.name) {
    context += `${memory.userProfile.name}さんとの過去の会話を参考にしてください。\n\n`;
  }
  
  // 過去の会話履歴
  context += '過去の会話の流れ：\n';
  recentMemories.forEach((mem: any, index: number) => {
    const date = new Date(mem.timestamp).toLocaleDateString('ja-JP');
    context += `${index + 1}. [${date}] ${mem.userMessage} → ${mem.aiResponse}\n`;
  });
  
  // 現在の話題
  if (memory.conversationContext?.currentTopic && 
      memory.conversationContext.currentTopic !== 'general') {
    context += `\n現在の話題: ${memory.conversationContext.currentTopic}\n`;
  }
  
  // 相手の気分
  if (memory.conversationContext?.mood && 
      memory.conversationContext.mood !== 'neutral') {
    const moodLabels = {
      'happy': '嬉しい',
      'sad': '悲しい', 
      'angry': '怒っている',
      'anxious': '不安・心配',
      'neutral': '普通'
    };
    context += `相手の気分: ${moodLabels[memory.conversationContext.mood]}\n`;
  }
  
  return context;
}
```

## 実装メソッド

### manageHumanLikeMemory(memory: any, newConversation: any): any
- **機能**: 新しい会話を記憶に追加し、記憶を整理
- **処理**: 重要度計算、記憶整理、文脈更新

### organizeMemories(conversations: any[]): any[]
- **機能**: 記憶の整理・忘却を実行
- **処理**: 時間ベース忘却、容量制限忘却

### calculateImportance(message: string): number
- **機能**: メッセージの重要度を計算
- **出力**: 0-10の重要度スコア

### extractCurrentTopic(message: string): string
- **機能**: メッセージから現在の話題を抽出
- **出力**: 話題カテゴリ名

## パフォーマンス最適化

### メモリ効率
- アクティブな記憶のみを処理対象とする
- 非アクティブな記憶は保持するが処理から除外

### 処理効率
- 重要度計算は一度のみ実行
- 記憶整理は会話追加時のみ実行
- 文脈生成は必要な時のみ実行

### データ永続化
- LokiJSを使用したJSONファイルでの永続化
- メモリ内での効率的な検索・更新

## 拡張方法

### 新しい話題の追加
```typescript
// topicKeywordsに新しい話題を追加
const topicKeywords = {
  // 既存の話題...
  newTopic: ['新しいキーワード1', '新しいキーワード2']
};
```

### 重要度計算の調整
```typescript
// calculateImportanceメソッドで新しい重みを追加
if (message.includes('新しい条件')) {
  importance += 新しい重み;
}
```

### 忘却条件の調整
```typescript
// organizeMemoriesメソッドで忘却条件を変更
if (age > newTimeLimit && conv.importance < newThreshold) {
  conv.isActive = false;
}
```

## 関連ファイル
- メイン実装: `src/modules/aichat/index.ts`
- データベース: `data/memory.json` (LokiJS)
- 関連機能: [[aichat]] (AIチャット機能)
- 感情分析: [[emotion-analysis]] (感情分析システム)

---

技術的な詳細や拡張方法については、開発チームにお問い合わせください。 