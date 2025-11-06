# Yamii (人生相談AI) [[yamii]]

## 概要
- [yamisskey-dev/yamii](https://github.com/yamisskey-dev/yamii) サーバーと連携した人生相談AI機能
- ユーザーの悩みや相談に対してAIが共感的な応答を生成
- **カスタムプロンプト機能**と**ユーザープロファイル管理**を実装
- **感情分析**と**クライシス検出**によるきめ細かなサポート

## 主な機能

### 1. 基本的な人生相談
- `yamii <相談内容>` でAIに相談を開始
- セッション形式で継続的な会話が可能
- `yamii 終了` でセッションを終了

### 2. カスタムプロンプト
ユーザーごとにAIの応答スタイルをカスタマイズ可能。

#### コマンド
- `yamii /custom set <プロンプト内容>` - カスタムプロンプトを設定
- `yamii /custom show` - 現在のカスタムプロンプトを表示
- `yamii /custom delete` - カスタムプロンプトを削除

#### 使用例
```
yamii /custom set あなたは優しい先生です。丁寧に教えてください。
```

### 3. ユーザープロファイル
AIがユーザーの情報を記憶し、より適切なアドバイスを提供。

#### コマンド
- `yamii /profile set <プロファイル情報>` - プロファイルを設定
- `yamii /profile show` - プロファイルを表示
- `yamii /profile delete` - プロファイルを削除

#### 使用例
```
yamii /profile set 山田太郎、会社員です。趣味は読書と散歩です。
```

### 4. 感情分析
- すべての相談内容に対して感情分析を実施
- 主要感情（primary_emotion）と感情の強度（intensity）を判定
- 複数の感情を同時に検出（all_emotions）

### 5. クライシス検出
- 自殺念慮や深刻な精神的危機を検出
- クライシス状態の場合は緊急時相談窓口の情報を提供
  - いのちの電話: 0570-783-556
  - こころの健康相談統一ダイヤル: 0570-064-556

### 6. セッション管理
- ユーザーごとにセッションを管理
- 30分間のタイムアウト設定
- セッション間で会話の文脈を保持

## 使い方

### 基本的な使い方
```
@唯 yamii 最近仕事がうまくいかなくて悩んでいます
```

### カスタムプロンプトの設定
```
@唯 yamii /custom set あなたは親身になって話を聞いてくれるカウンセラーです。
```

### プロファイルの設定
```
@唯 yamii /profile set 田中花子、大学生です。最近人間関係で悩んでいます。
```

### ステータス確認
```
@唯 yamii /status
```

## サーバー設定

### config.json
```json
{
  "yamiiApiUrl": "http://localhost:8000",
  "yamiiDebugMode": "false",
  "yamiiTimeoutNotification": "true"
}
```

### 設定項目
- `yamiiApiUrl`: yamii サーバーのURL（デフォルト: http://localhost:8000）
- `yamiiDebugMode`: デバッグモードの有効化
- `yamiiTimeoutNotification`: タイムアウト通知の有効化

## yamii サーバーについて

yamii サーバーは別途起動が必要です。詳細は以下を参照してください：
- リポジトリ: https://github.com/yamisskey-dev/yamii
- サーバーのセットアップ方法は yamii リポジトリのREADMEを参照

## レスポンス形式

yamii サーバーからのレスポンス：
```typescript
{
  response: string;              // AIの応答
  session_id: string;            // セッションID
  timestamp: string;             // タイムスタンプ
  emotion_analysis: {
    primary_emotion: string;     // 主要感情
    intensity: number;           // 感情の強度 (0-1)
    is_crisis: boolean;          // クライシス判定
    all_emotions: {              // 全感情スコア
      [emotion: string]: number;
    };
  };
  advice_type: string;           // アドバイスタイプ
  follow_up_questions: string[]; // フォローアップ質問
  is_crisis: boolean;            // クライシス状態
}
```

## 注意事項

- yamii サーバーが起動していない場合はエラーメッセージが表示されます
- クライシス状態が検出された場合は、専門機関への相談を推奨する情報が表示されます
- セッションは30分でタイムアウトします
- プライバシーに配慮し、相談内容は適切に管理してください

## トラブルシューティング

### サーバーに接続できない
```
❌ yamiiサーバーに接続できませんでした。
```
対処法：
- `yamii /status` でサーバー状況を確認
- yamii サーバーが起動していることを確認
- ネットワーク接続を確認
- config.json の yamiiApiUrl 設定を確認

### タイムアウトエラー
```
⏱️ サーバーからの応答がタイムアウトしました。
```
対処法：
- しばらく時間を置いてから再度お試しください
- 複雑な相談内容の場合は、短く分けてみてください

## 技術仕様

### モジュール情報
- モジュール名: yamii
- バージョン: 2.0.0
- 最終更新: 2025年8月27日
- AI エンジン: Gemini 2.0 Flash (yamii サーバー側)

### 対応機能
- 基本相談
- カスタムプロンプト
- プロファイル管理
- 感情分析
- クライシス検出
- セッション管理
