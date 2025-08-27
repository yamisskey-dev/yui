import { bindThis } from '@/decorators.js';
import Module from '@/module.js';
import Message from '@/message.js';
import serifs from '@/serifs.js';

// TODO: Diceモジュール改善計画
// - 機能: より複雑なダイス記法のサポート（修正値、成功数判定）
// - 機能: ダイス履歴の保存と統計表示
// - 機能: TRPG系システム固有のルール対応
// - パフォーマンス: 大量ダイスロール時の最適化
// - 拡張性: カスタムダイステーブルのサポート

export default class extends Module {
	public readonly name = 'dice';

	@bindThis
	public install() {
		return {
			mentionHook: this.mentionHook
		};
	}

	@bindThis
	private async mentionHook(msg: Message) {
		if (msg.text == null) return false;

		const query = msg.text.match(/([0-9]+)[dD]([0-9]+)/);

		if (query == null) return false;

		const times = parseInt(query[1], 10);
		const dice = parseInt(query[2], 10);

		if (times < 1 || times > 10) return false;
		if (dice < 2 || dice > 1000) return false;

		const results: number[] = [];

		for (let i = 0; i < times; i++) {
			results.push(Math.floor(Math.random() * dice) + 1);
		}

		msg.reply(serifs.dice.done(results.join(' ')));

		return true;
	}
}
