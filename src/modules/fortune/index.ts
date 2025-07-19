import { bindThis } from '@/decorators.js';
import Module from '@/module.js';
import Message from '@/message.js';
import serifs from '@/serifs.js';
import seedrandom from 'seedrandom';
import { genItem } from '@/vocabulary.js';
import { selectEmoji } from '@/utils/emoji-selector.js';

export const blessing = [
	'唯吉',
	'ヨタ吉',
	'ゼタ吉',
	'エクサ吉',
	'ペタ吉',
	'テラ吉',
	'ギガ吉',
	'メガ吉',
	'キロ吉',
	'ヘクト吉',
	'デカ吉',
	'デシ吉',
	'センチ吉',
	'ミリ吉',
	'マイクロ吉',
	'ナノ吉',
	'ピコ吉',
	'フェムト吉',
	'アト吉',
	'ゼプト吉',
	'ヨクト吉',
	'超吉',
	'大大吉',
	'大吉',
	'吉',
	'中吉',
	'小吉',
	'凶',
	'大凶',
];

export default class extends Module {
	public readonly name = 'fortune';

	@bindThis
	public install() {
		return {
			mentionHook: this.mentionHook
		};
	}

	@bindThis
	private genOmikuji(): string {
		const date = new Date();
		const seed = `${date.getFullYear()}/${date.getMonth()}/${date.getDate()}@${this.ai.account.id}`;
		const rng = seedrandom(seed);
		return blessing[Math.floor(rng() * blessing.length)];
	}

	@bindThis
	private async mentionHook(msg: Message) {
		const id = msg.id;
		if (id && this.isAlreadyResponded(id)) return false;
		if (msg.includes(['おみくじ', 'omikuji', '占い'])) {
			const omikuji = this.genOmikuji();
			const item = genItem();
			const emoji = await selectEmoji('celebration');
			msg.reply(`**${omikuji}${emoji}**\nラッキーアイテム: ${item}`, {
				immediate: true
			});
			if (id) this.markResponded(id);
			return true;
		}
		return false;
	}
}
