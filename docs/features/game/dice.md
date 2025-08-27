# サイコロ [[dice]]

## 概要
- サイコロ機能を提供するシンプルなゲームモジュール
- 標準的なTRPG形式（NdM）でのダイスロールに対応
- リプライでサイコロの結果を即座に表示

## コード定義
- メイン実装: `src/modules/dice/index.ts`
- セリフ: `serifs.ts`の`dice`セクション

## コードでの扱い方
- `mentionHook`で「NdM」形式のメッセージに反応
- 正規表現`([0-9]+)[dD]([0-9]+)`でパターンマッチング
- Math.randomを使用して乱数生成

## 使い方・拡張方法
### 基本的な使用例
```
@ai 1d6     // 6面ダイスを1回振る
@ai 2d10    // 10面ダイスを2回振る  
@ai 3D20    // 20面ダイスを3回振る（大文字・小文字両対応）
```

### 制限事項
- ダイス回数: 1〜10回まで
- ダイス面数: 2〜1000面まで
- 範囲外の値は無視される

### カスタマイズ例
- より複雑なダイス形式（修正値付きなど）への拡張
- ダイス履歴の保存機能
- 特定のゲームシステム対応

## 実装詳細
```typescript
// ダイス判定のコア処理
const query = msg.text.match(/([0-9]+)[dD]([0-9]+)/);
const times = parseInt(query[1], 10);  // ダイス回数
const dice = parseInt(query[2], 10);   // ダイス面数

// 範囲チェック
if (times < 1 || times > 10) return false;
if (dice < 2 || dice > 1000) return false;

// ダイスロール実行
for (let i = 0; i < times; i++) {
    results.push(Math.floor(Math.random() * dice) + 1);
}
```

## 関連・連携
- [[features/game/reversi.md]]（他のゲーム機能との並列実装）
- [[features/game/guessing-game.md]]（数値処理の参考実装）
- [[features/core/core.md]]（モジュール管理・基本応答）

## TODO・改善点
- [ ] ダイス結果の統計情報表示（合計値、平均値など）
- [ ] 修正値付きダイス（1d20+5など）への対応
- [ ] ダイス履歴の保存・表示機能
- [ ] 特殊ダイス（ファンブル・クリティカル）の判定機能
- [ ] より多様なダイス形式への対応（例：WoDの成功数カウント）

---

運用・開発Tipsは [[development.md]] を参照。