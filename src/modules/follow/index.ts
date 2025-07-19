import { bindThis } from '@/decorators.js';
import Module from '@/module.js';
import Message from '@/message.js';

export default class extends Module {
	public readonly name = 'follow';

	@bindThis
	public install() {
		return {
			mentionHook: this.mentionHook,
			followHook: this.followHook
		};
	}

	@bindThis
	private async mentionHook(msg: Message) {
		if (msg.text && msg.includes(['フォロー', 'フォロバ', 'follow me'])) {
			if (!msg.user.isFollowing) {
				this.ai.api('following/create', {
					userId: msg.userId,
				});
				return {
					reaction: msg.friend.love >= 0 ? 'like' : null
				};
			} else {
				return {
					reaction: msg.friend.love >= 0 ? 'hmm' : null
				};
			}
		} else {
			return false;
		}
	}

	@bindThis
	private async followHook(msg: Message) {
		// フォローされたら自動でフォローを返す
		if (!msg.user.isFollowing) {
			this.log(`[follow]: Auto-following user ${msg.user.username} (${msg.userId})`);
			await this.ai.api('following/create', {
				userId: msg.userId,
			});
			this.log(`[follow]: Successfully followed ${msg.user.username}`);
		} else {
			this.log(`[follow]: Already following ${msg.user.username}, skipping auto-follow`);
		}
		return true;
	}
}
