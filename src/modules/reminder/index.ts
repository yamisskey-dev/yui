import { bindThis } from '@/decorators.js';
import Module from '@/module.js';
import Message from '@/message.js';
import serifs, { getSerif } from '@/serifs.js';
import { acct } from '@/utils/acct.js';
import config from '@/config.js';
import { parseTimeExpression } from './parse.js';
import type { ParseResult } from './parse.js';

const NOTIFY_INTERVAL = 1000 * 60 * 60 * 12;

type RemindRecord = { userId: string; id: string; isChat: boolean; thing: string | null; quoteId?: string | null; times: number; createdAt: number };

// Minimal interface for a collection to avoid depending on lokijs types
interface MinimalCollection<T> {
  find(query?: Partial<T> | any): T[];
  findOne(query?: Partial<T> | any): T | null;
  insertOne(doc: T): T;
  update(doc: T): void;
  remove(doc: T): void;
  findAndRemove?(query: Partial<T> | any): void;
}

export default class Reminder extends Module {
  public readonly name = 'reminder';

  private reminds!: MinimalCollection<RemindRecord>;

@bindThis
public install() {
this.reminds = this.ai.getCollection('reminds', {
indices: ['userId', 'id']
});

		return {
			mentionHook: this.mentionHook,
			contextHook: this.contextHook,
			timeoutCallback: this.timeoutCallback,
		};
	}

@bindThis
private async mentionHook(msg: Message) {
let text = msg.extractedText.toLowerCase();
if (!text.startsWith('remind') && !text.startsWith('todo')) return false;

		if (text.startsWith('reminds') || text.startsWith('todos')) {
			const reminds = this.reminds.find({
				userId: msg.userId,
			});

			const getQuoteLink = id => `[${id}](${config.host}/notes/${id})`;

			msg.reply(serifs.reminder.reminds + '\n' + reminds.map(remind => `・${remind.thing ? remind.thing : getQuoteLink(remind.quoteId)}`).join('\n'));
			return true;
		}

		if (text.match(/^(.+?)\s(.+)/)) {
			text = text.replace(/^(.+?)\s/, '');
		} else {
			text = '';
		}


 // simple parsing: support optional time expressions at the start like:
 // "in 2 hours buy milk", "tomorrow 09:00 meeting", "at 14:30 call"
 const timeParse = await parseTimeExpression(text);
 let thing: string | null = null;
 let scheduledAt: number | null = null;
 if (timeParse) {
   scheduledAt = timeParse.when;
   thing = timeParse.text.trim();
 } else {
   const separatorIndex = text.indexOf(' ') > -1 ? text.indexOf(' ') : text.indexOf('\n');
   thing = text.substr(separatorIndex + 1).trim();
 }

		// フォロワー限定チェックを削除し、内容が空でかつ引用もない場合のみ無効とする
		if (thing === '' && msg.quoteId == null) {
			msg.reply(serifs.reminder.invalid);
			return {
				reaction: '🆖',
				immediate: true,
			};
		}

		const remind = this.reminds.insertOne({
			id: msg.id,
			userId: msg.userId,
			isChat: msg.isChat,
			thing: thing === '' ? null : thing,
			quoteId: msg.quoteId,
			times: 0,
			createdAt: Date.now(),
		});

		// メンションをsubscribe
this.subscribeReply(remind.id, msg.isChat, msg.isChat ? msg.userId : msg.id, {
id: remind.id
});

		if (msg.quoteId) {
			// 引用元をsubscribe
this.subscribeReply(remind.id, false, msg.quoteId, {
id: remind.id
});
		}


		// タイマーセット: scheduledAt があればそこに、それ以外はデフォルト間隔
if (scheduledAt) {
const delay = Math.max(0, scheduledAt - Date.now());
this.setTimeoutWithPersistence(delay, { id: remind.id });
} else {
this.setTimeoutWithPersistence(NOTIFY_INTERVAL, { id: remind.id });
}

		return {
			reaction: '🆗',
			immediate: true,
		};
	}

@bindThis
private async contextHook(key: any, msg: Message, data: any) {
if (msg.text == null) return;

		const remind = this.reminds.findOne({
			id: data.id,
		});

		if (remind == null) {
			this.unsubscribeReply(key);
			return;
		}

		const done = msg.includes(['done', 'やった', 'やりました', 'はい']);
		const cancel = msg.includes(['やめる', 'やめた', 'キャンセル']);
		const isOneself = msg.userId === remind.userId;

		if ((done || cancel) && isOneself) {
			this.unsubscribeReply(key);
			this.reminds.remove(remind);
			msg.reply(done ? getSerif(serifs.reminder.done(msg.friend.name)) : serifs.reminder.cancel);
			return;
		} else if (isOneself === false) {
			msg.reply(serifs.reminder.doneFromInvalidUser);
			return;
		} else {
			if (msg.isChat) this.unsubscribeReply(key);
			return false;
		}
	}

@bindThis
private async timeoutCallback(data) {
const remind = this.reminds.findOne({
id: data.id
});
		if (remind == null) return;

		remind.times++;
		this.reminds.update(remind);

		const friend = this.ai.lookupFriend(remind.userId);
		if (friend == null) return; // 処理の流れ上、実際にnullになることは無さそうだけど一応

		let reply;
		if (remind.isChat) {
			this.ai.sendMessage(friend.userId, {
				text: serifs.reminder.notifyWithThing(remind.thing, friend.name)
			});
		} else {
			try {
				reply = await this.ai.post({
					renoteId: remind.thing == null && remind.quoteId ? remind.quoteId : remind.id,
					text: acct(friend.doc.user) + ' ' + serifs.reminder.notify(friend.name)
				});
			} catch (err) {
				// renote対象が消されていたらリマインダー解除
				if (err.statusCode === 400) {
					this.unsubscribeReply(remind.thing == null && remind.quoteId ? remind.quoteId : remind.id);
					this.reminds.remove(remind);
					return;
				}
				return;
			}
		}

		this.subscribeReply(remind.id, remind.isChat, remind.isChat ? remind.userId : reply.id, {
			id: remind.id
		});

		// タイマーセット
		this.setTimeoutWithPersistence(NOTIFY_INTERVAL, {
			id: remind.id,
		});
	}

	/**
	 * Parse very simple time expressions at the start of the text.
	 * Supported patterns:
	 * - in (\d+) hours? <text>
	 * - tomorrow HH:MM <text>
	 * - at HH:MM <text>
	 */
	// parseTimeExpression は外部 util に移動しました

}
