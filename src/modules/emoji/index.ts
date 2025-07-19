import { bindThis } from '@/decorators.js';
import Module from '@/module.js';
import Message from '@/message.js';
import serifs from '@/serifs.js';
import { selectEmoji, selectContextualEmoji } from '@/utils/emoji-selector.js';

export default class extends Module {
	public readonly name = 'emoji';

	@bindThis
	public install() {
		return {
			mentionHook: this.mentionHook
		};
	}

	@bindThis
	private async mentionHook(msg: Message) {
		// 絵文字関連のコマンド
		if (msg.includes(['絵文字', 'emoji', 'カスタム絵文字'])) {
			const emoji = await selectEmoji('default');
			msg.reply(`Misskeyのカスタム絵文字です ${emoji}`);
			return true;
		}

		// 文脈に応じた絵文字選択
		if (msg.includes(['顔文字', '福笑い'])) {
			const emoji = await selectContextualEmoji(msg.text);
			msg.reply(serifs.emoji.suggest(emoji));
			return true;
		}

		return false;
	}
}
