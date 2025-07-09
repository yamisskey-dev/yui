import { bindThis } from '@/decorators.js';
import Module from '@/module.js';
import serifs from '@/serifs.js';
import { genItem } from '@/vocabulary.js';
import config from '@/config.js';

export default class extends Module {
	public readonly name = 'noting';

	@bindThis
	public install() {
		if (config.notingEnabled === "false") return {};

		setInterval(() => {
			if (Math.random() < 0.04) {
				this.post();
			}
		}, 1000 * 60 * 10);

		return {};
	}

	@bindThis
	private post() {
		// TODO: 改善提案
		// - 時間帯に応じたセリフ（朝・昼・夜）
		// - 天気APIとの連携
		// - ユーザーの活動状況に応じたセリフ
		// - イベント（誕生日、記念日など）に応じた特別なセリフ
		const now = new Date();
		const month = now.getMonth() + 1; // 0-11 → 1-12
		
		// 季節判定
		let season: 'spring' | 'summer' | 'autumn' | 'winter';
		if (month >= 3 && month <= 5) {
			season = 'spring';
		} else if (month >= 6 && month <= 8) {
			season = 'summer';
		} else if (month >= 9 && month <= 11) {
			season = 'autumn';
		} else {
			season = 'winter';
		}

		const notes = [
			...serifs.noting.notes,
			...serifs.noting.seasonal[season],
			() => {
				const item = genItem();
				return serifs.noting.want(item);
			},
			() => {
				const item = genItem();
				return serifs.noting.see(item);
			},
			() => {
				const item = genItem();
				return serifs.noting.expire(item);
			},
		];

		const note = notes[Math.floor(Math.random() * notes.length)];

		this.ai.post({
			text: typeof note === 'function' ? note() : note
		});
	}
}
