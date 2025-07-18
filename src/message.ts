import { bindThis } from '@/decorators.js';
import chalk from 'chalk';

import 唯 from '@/ai.js';
import Friend from '@/friend.js';
import type { User } from '@/misskey/user.js';
import includes from '@/utils/includes.js';
import or from '@/utils/or.js';
import config from '@/config.js';
import { sleep } from '@/utils/sleep.js';

export default class Message {
	private ai: 唯;
	private chatMessage: { id: string; fromUser: any; fromUserId: string; text: string; } | null;
	private note: { id: string; user: any; userId: string; text: string; renoteId: string; replyId: string; } | null;
	public isChat: boolean;

	public get id(): string {
		return this.chatMessage ? this.chatMessage.id : (this.note ? this.note.id : "");
	}

	public get user(): any {
		return this.chatMessage ? this.chatMessage.fromUser : (this.note ? this.note.user : null);
	}

	public get userId(): string {
		return this.chatMessage ? this.chatMessage.fromUserId : (this.note ? this.note.userId : "");
	}

	public get text(): string {
		return this.chatMessage ? this.chatMessage.text : (this.note ? this.note.text : "");
	}

	public get quoteId(): string | null {
		return this.chatMessage ? null : (this.note ? this.note.renoteId : null);
	}

	public get replyId(): string | null {
		return this.chatMessage ? null : (this.note ? this.note.replyId : null);
	}

	public get visibility(): string | null {
		return this.chatMessage ? null : (this.note && (this.note as any).visibility ? (this.note as any).visibility : null);
	}

	/**
	 * メンション部分を除いたテキスト本文
	 */
	public get extractedText(): string {
		const host = new URL(config.host).host.replace(/\./g, '\\.');
		return this.text
			.replace(new RegExp(`^@${this.ai.account.username}@${host}\\s`, 'i'), '')
			.replace(new RegExp(`^@${this.ai.account.username}\\s`, 'i'), '')
			.trim();
	}

	public friend: Friend;

	constructor(ai: 唯, chatMessageOrNote: any, isChat: boolean) {
		this.ai = ai;
		this.chatMessage = isChat ? chatMessageOrNote : null;
		this.note = isChat ? null : chatMessageOrNote;
		this.isChat = isChat;

		this.friend = new Friend(ai, { user: this.user });

		// メッセージなどに付いているユーザー情報は省略されている場合があるので完全なユーザー情報を持ってくる
		this.ai.api('users/show', {
			userId: this.userId
		}).then(user => {
			this.friend.updateUser(user as any);
		});
	}

	@bindThis
	public async reply(text: string | null, opts?: {
		file?: any;
		cw?: string;
		renote?: string;
		immediate?: boolean;
	}) {
		if (text == null) return;

		this.ai.log(`>>> Sending reply to ${chalk.underline(this.id)}`);

		if (!opts?.immediate) {
			await sleep(2000);
		}

		if (this.chatMessage) {
			return await this.ai.sendMessage(this.chatMessage.fromUserId, {
				text: text,
				fileId: opts?.file?.id
			});
		} else {
			return await this.ai.post({
				replyId: this.note ? this.note.id : "",
				text: text,
				fileIds: opts?.file ? [opts?.file.id] : undefined,
				cw: opts?.cw,
				renoteId: opts?.renote
			});
		}
	}

	@bindThis
	public includes(words: string[]): boolean {
		return includes(this.text, words);
	}

	@bindThis
	public or(words: (string | RegExp)[]): boolean {
		return or(this.text, words);
	}
}
