import { bindThis } from '@/decorators.js';
import Module from '@/module.js';
import Message from '@/message.js';
import serifs from '@/serifs.js';
import { selectEmoji } from '@/utils/emoji-selector.js';

export default class extends Module {
	public readonly name = 'emoji-react';

	@bindThis
	public install() {
		return {
			mentionHook: this.mentionHook
		};
	}

	@bindThis
	private async mentionHook(msg: Message) {
		if (msg.includes(['ぴざ', 'ピザ'])) {
			const emoji = selectEmoji('food');
			msg.reply(serifs.emojiReact.pizza(emoji));
			return true;
		}

		if (msg.includes(['ぷりん', 'プリン'])) {
			const emoji = selectEmoji('food');
			msg.reply(serifs.emojiReact.pudding(emoji));
			return true;
		}

		if (msg.includes(['寿司', 'すし', 'sushi'])) {
			const emoji = selectEmoji('food');
			msg.reply(serifs.emojiReact.sushi(emoji));
			return true;
		}

		if (msg.includes(['唯'])) {
			const emoji = selectEmoji('greeting');
			msg.reply(serifs.emojiReact.yui(emoji));
			return true;
		}

		return false;
	}
}
