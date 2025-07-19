import { bindThis } from '@/decorators.js';
import Module from '@/module.js';
import Message from '@/message.js';
import serifs from '@/serifs.js';
import { sleep } from '@/utils/sleep.js';
import { selectContextualEmoji } from '@/utils/emoji-selector.js';

export default class extends Module {
	public readonly name = 'emoji-react';

	@bindThis
	public install() {
		return {
			mentionHook: this.mentionHook,
			noteHook: this.noteHook
		};
	}

	@bindThis
	private async mentionHook(msg: Message) {
		if (msg.includes(['ぴざ', 'ピザ'])) {
			const emoji = await selectContextualEmoji('食べ物');
			msg.reply(serifs.emojiReact.pizza(emoji));
			return true;
		}

		if (msg.includes(['ぷりん', 'プリン'])) {
			const emoji = await selectContextualEmoji('食べ物');
			msg.reply(serifs.emojiReact.pudding(emoji));
			return true;
		}

		if (msg.includes(['寿司', 'すし', 'sushi'])) {
			const emoji = await selectContextualEmoji('食べ物');
			msg.reply(serifs.emojiReact.sushi(emoji));
			return true;
		}

		if (msg.includes(['唯'])) {
			const emoji = await selectContextualEmoji('挨拶');
			msg.reply(serifs.emojiReact.yui(emoji));
			return true;
		}

		return false;
	}

	@bindThis
	private async noteHook(note: any) {
		if (note.replyId != null) return;
		// 自分の投稿にはリアクションしない
		if (note.userId === this.ai.account.id) return;

		// ノート内容に絵文字が含まれているかチェック
		const text = note.text || '';
		if (text.includes(':')) {
			// カスタム絵文字が含まれている場合
			const emoji = await selectContextualEmoji(text);
			await sleep(1000);
			await this.ai.api('notes/reactions/create', {
				noteId: note.id,
				reaction: emoji
			});
		}
	}
}
