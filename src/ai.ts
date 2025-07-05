// AI CORE

import * as fs from 'fs';
import { bindThis } from '@/decorators.js';
import loki from 'lokijs';
import got from 'got';
import { FormData, File } from 'formdata-node';
import chalk from 'chalk';
import { v4 as uuid } from 'uuid';

import config from '@/config.js';
import Module from '@/module.js';
import Message from '@/message.js';
import Friend, { FriendDoc } from '@/friend.js';
import type { User } from '@/misskey/user.js';
import Stream from '@/stream.js';
import log from '@/utils/log.js';
import { sleep } from './utils/sleep.js';
import pkg from '../package.json' with { type: 'json' };

type MentionHook = (msg: Message) => Promise<boolean | HandlerResult>;
type ContextHook = (key: any, msg: Message, data?: any) => Promise<void | boolean | HandlerResult>;
type TimeoutCallback = (data?: any) => void;

export type HandlerResult = {
	reaction?: string | null;
	immediate?: boolean;
};

export type InstallerResult = {
	mentionHook?: MentionHook;
	contextHook?: ContextHook;
	timeoutCallback?: TimeoutCallback;
};

export type Meta = {
	lastWakingAt: number;
};

/**
 * 唯
 */
export default class 唯 {
	public readonly version = pkg._v;
	public account: User;
	public connection: Stream;
	public modules: Module[] = [];
	private mentionHooks: MentionHook[] = [];
	private contextHooks: { [moduleName: string]: ContextHook } = {};
	private timeoutCallbacks: { [moduleName: string]: TimeoutCallback } = {};
	public db: loki;
	public lastSleepedAt: number;

	private meta: loki.Collection<Meta>;

	private contexts: loki.Collection<{
		isChat: boolean;
		noteId?: string;
		userId?: string;
		module: string;
		key: string | null;
		data?: any;
	}>;

	private timers: loki.Collection<{
		id: string;
		module: string;
		insertedAt: number;
		delay: number;
		data?: any;
	}>;

	public friends: loki.Collection<FriendDoc>;
	public moduleData: loki.Collection<any>;

	/**
	 * 唯インスタンスを生成します
	 * @param account 唯として使うアカウント
	 * @param modules モジュール。先頭のモジュールほど高優先度
	 */
	constructor(account: User, modules: Module[]) {
		this.account = account;
		this.modules = modules;

		let memoryDir = '.';
		if (config.memoryDir) {
			memoryDir = config.memoryDir;
		}
		const file = process.env.NODE_ENV === 'test' ? `${memoryDir}/test.memory.json` : `${memoryDir}/memory.json`;

		this.log(`Lodaing the memory from ${file}...`);

		this.db = new loki(file, {
			autoload: true,
			autosave: true,
			autosaveInterval: 1000,
			autoloadCallback: err => {
				if (err) {
					this.log(chalk.red(`Failed to load the memory: ${err}`));
				} else {
					this.log(chalk.green('The memory loaded successfully'));
					this.run();
				}
			}
		});
	}

	@bindThis
	public log(msg: string) {
		log(`[${chalk.magenta('AiOS')}]: ${msg}`);
	}

	@bindThis
	private run() {
		//#region Init DB
		this.meta = this.getCollection('meta', {});

		this.contexts = this.getCollection('contexts', {
			indices: ['key']
		});

		this.timers = this.getCollection('timers', {
			indices: ['module']
		});

		this.friends = this.getCollection('friends', {
			indices: ['userId']
		});

		this.moduleData = this.getCollection('moduleData', {
			indices: ['module']
		});
		//#endregion

		const meta = this.getMeta();
		this.lastSleepedAt = meta.lastWakingAt;

		// Init stream
		this.connection = new Stream();

		//#region Main stream
		const mainStream = this.connection.useSharedConnection('main');

		// メンションされたとき
		mainStream.on('mention', async data => {
			if (data.userId == this.account.id) return; // 自分は弾く
			if (data.text && data.text.startsWith('@' + this.account.username)) {
				// Misskeyのバグで投稿が非公開扱いになる
				if (data.text == null) data = await this.api('notes/show', { noteId: data.id });
				this.onReceiveMessage(new Message(this, data, false));
			}
		});

		// 返信されたとき
		mainStream.on('reply', async data => {
			if (data.userId == this.account.id) return; // 自分は弾く
			if (data.text && data.text.startsWith('@' + this.account.username)) return;
			// Misskeyのバグで投稿が非公開扱いになる
			if (data.text == null) data = await this.api('notes/show', { noteId: data.id });
			this.onReceiveMessage(new Message(this, data, false));
		});

		// Renoteされたとき
		mainStream.on('renote', async data => {
			if (data.userId == this.account.id) return; // 自分は弾く
			if (data.text == null && (data.files || []).length == 0) return;

			// リアクションする
			this.api('notes/reactions/create', {
				noteId: data.id,
				reaction: 'love'
			});
		});

		// 通知
		mainStream.on('notification', data => {
			this.onNotification(data);
		});

		// チャット
		mainStream.on('newChatMessage', data => {
			const fromUser = data.fromUser;
			if (data.fromUserId == this.account.id) return; // 自分は弾く
			this.onReceiveMessage(new Message(this, data, true));

			// 一定期間 chatUser / chatRoom のストリームに接続して今後のやり取りに備える
			if (data.fromUserId) {
				const chatStream = this.connection.connectToChannel('chatUser', {
					otherId: data.fromUserId,
				});

				let timer;
				function setTimer() {
					if (timer) clearTimeout(timer);
					timer = setTimeout(() => {
						chatStream.dispose();
					}, 1000 * 60 * 2);
				}
				setTimer();

				chatStream.on('message', (data) => {
					if (data.fromUserId == this.account.id) return; // 自分は弾く
					chatStream.send('read', {
						id: data.id,
					});
					this.onReceiveMessage(new Message(this, {
						...data,
						// fromUserは省略されてくるため
						fromUser: fromUser,
					}, true));
					setTimer();
				});
			} else {
				// TODO: ルームチャットの処理を実装
				// 現在は個別チャットのみ対応
				this.log('Room chat not implemented yet');
			}
		});
		//#endregion

		// Install modules
		this.modules.forEach(m => {
			this.log(`Installing ${chalk.cyan.italic(m.name)}\tmodule...`);
			m.init(this);
			const res = m.install();
			if (res != null) {
				if (res.mentionHook) this.mentionHooks.push(res.mentionHook);
				if (res.contextHook) this.contextHooks[m.name] = res.contextHook;
				if (res.timeoutCallback) this.timeoutCallbacks[m.name] = res.timeoutCallback;
			}
		});

		// タイマー監視
		this.crawleTimer();
		setInterval(this.crawleTimer, 1000);

		setInterval(this.logWaking, 10000);

		this.log(chalk.green.bold('Ai am now running!'));
	}

	/**
	 * ユーザーから話しかけられたとき
	 * (メンション、リプライ、トークのメッセージ)
	 */
	@bindThis
	private async onReceiveMessage(msg: Message): Promise<void> {
		this.log(chalk.gray(`<<< An message received: ${chalk.underline(msg.id)}`));

		// Ignore message if the user is a bot
		// To avoid infinity reply loop.
		if (msg.user.isBot) {
			return;
		}

		const isNoContext = !msg.isChat && msg.replyId == null;

		// Look up the context
		const context = isNoContext ? null : this.contexts.findOne(msg.isChat ? {
			isChat: true,
			userId: msg.userId
		} : {
			isChat: false,
			noteId: msg.replyId
		});

		let reaction: string | null = 'love';
		let immediate: boolean = false;

		//#region
		const invokeMentionHooks = async () => {
			let res: boolean | HandlerResult | null = null;

			for (const handler of this.mentionHooks) {
				res = await handler(msg);
				if (res === true || typeof res === 'object') break;
			}

			if (res != null && typeof res === 'object') {
				if (res.reaction != null) reaction = res.reaction;
				if (res.immediate != null) immediate = res.immediate;
			}
		};

		// コンテキストがあればコンテキストフック呼び出し
		// なければそれぞれのモジュールについてフックが引っかかるまで呼び出し
		if (context != null) {
			const handler = this.contextHooks[context.module];
			const res = await handler(context.key, msg, context.data);

			if (res != null && typeof res === 'object') {
				if (res.reaction != null) reaction = res.reaction;
				if (res.immediate != null) immediate = res.immediate;
			}

			if (res === false) {
				await invokeMentionHooks();
			}
		} else {
			await invokeMentionHooks();
		}
		//#endregion

		if (!immediate) {
			await sleep(1000);
		}

		if (msg.isChat) {
			// チャットでもリアクションする（絵文字で表現）
			if (reaction) {
				// チャットでは絵文字でリアクションを表現
				const emojiMap: { [key: string]: string } = {
					'like': '👍',
					'love': '❤️',
					'laugh': '😄',
					'hmm': '🤔',
					'surprise': '😲',
					'congrats': '🎉',
					'angry': '😠',
					'confused': '😕',
					'rip': '😢',
					'pudding': '🍮',
					'star': '⭐',
				};
				
				const emoji = emojiMap[reaction] || '👍';
				// チャットではリアクションの代わりに絵文字を送信
				this.sendMessage(msg.userId, {
					text: emoji
				});
			}
		} else {
			// リアクションする
			if (reaction) {
				this.api('notes/reactions/create', {
					noteId: msg.id,
					reaction: reaction
				});
			}
		}
	}

	@bindThis
	private onNotification(notification: any) {
		switch (notification.type) {
			// リアクションされたら親愛度を少し上げる
			case 'reaction': {
				const friend = new Friend(this, { user: notification.user });
				friend.incLove(0.1);
				break;
			}
			
			// リアクション取り消しを処理
			case 'unreaction': {
				const friend = new Friend(this, { user: notification.user });
				// 親愛度を少し下げる（リアクションの半分）
				friend.incLove(-0.05);
				break;
			}

			default:
				break;
		}
	}

	@bindThis
	private crawleTimer() {
		const timers = this.timers.find();
		for (const timer of timers) {
			// タイマーが時間切れかどうか
			if (Date.now() - (timer.insertedAt + timer.delay) >= 0) {
				this.log(`Timer expired: ${timer.module} ${timer.id}`);
				this.timers.remove(timer);
				this.timeoutCallbacks[timer.module](timer.data);
			}
		}
	}

	@bindThis
	private logWaking() {
		this.setMeta({
			lastWakingAt: Date.now(),
		});
	}

	/**
	 * データベースのコレクションを取得します
	 */
	@bindThis
	public getCollection(name: string, opts?: any): loki.Collection {
		let collection: loki.Collection;

		collection = this.db.getCollection(name);

		if (collection == null) {
			collection = this.db.addCollection(name, opts);
		}

		return collection;
	}

	@bindThis
	public lookupFriend(userId: User['id']): Friend | null {
		const doc = this.friends.findOne({
			userId: userId
		});

		if (doc == null) return null;

		const friend = new Friend(this, { doc: doc });

		return friend;
	}

	/**
	 * ファイルをドライブにアップロードします
	 */
	@bindThis
	public async upload(file: Buffer | fs.ReadStream, meta: { filename: string, contentType: string }) {
		const form = new FormData();
		form.set('i', config.i);
		form.set('file', new File([file], meta.filename, { type: meta.contentType }));

		const res = await got.post({
			url: `${config.apiUrl}/drive/files/create`,
			body: form
		}).json();
		return res;
	}

	/**
	 * 投稿します
	 */
	@bindThis
	public async post(param: any) {
		const res = await this.api('notes/create', param);
		return res.createdNote;
	}

	/**
	 * 指定ユーザーにチャットメッセージを送信します
	 */
	@bindThis
	public sendMessage(userId: any, param: any) {
		return this.api('chat/messages/create-to-user', Object.assign({
			toUserId: userId,
		}, param));
	}

	/**
	 * APIを呼び出します
	 */
	@bindThis
	public api(endpoint: string, param?: any) {
		this.log(`API: ${endpoint}`);
		return got.post(`${config.apiUrl}/${endpoint}`, {
			json: Object.assign({
				i: config.i
			}, param)
		}).json();
	};

	/**
	 * コンテキストを生成し、ユーザーからの返信を待ち受けます
	 * @param module 待ち受けるモジュール名
	 * @param key コンテキストを識別するためのキー
	 * @param isChat チャット上のコンテキストかどうか
	 * @param id チャット上のコンテキストならばチャット相手のID、そうでないなら待ち受ける投稿のID
	 * @param data コンテキストに保存するオプションのデータ
	 */
	@bindThis
	public subscribeReply(module: Module, key: string | null, isChat: boolean, id: string, data?: any) {
		this.contexts.insertOne(isChat ? {
			isChat: true,
			userId: id,
			module: module.name,
			key: key,
			data: data
		} : {
			isChat: false,
			noteId: id,
			module: module.name,
			key: key,
			data: data
		});
	}

	/**
	 * 返信の待ち受けを解除します
	 * @param module 解除するモジュール名
	 * @param key コンテキストを識別するためのキー
	 */
	@bindThis
	public unsubscribeReply(module: Module, key: string | null) {
		this.contexts.findAndRemove({
			key: key,
			module: module.name
		});
	}

	/**
	 * 指定したミリ秒経過後に、そのモジュールのタイムアウトコールバックを呼び出します。
	 * このタイマーは記憶に永続化されるので、途中でプロセスを再起動しても有効です。
	 * @param module モジュール名
	 * @param delay ミリ秒
	 * @param data オプションのデータ
	 */
	@bindThis
	public setTimeoutWithPersistence(module: Module, delay: number, data?: any) {
		const id = uuid();
		this.timers.insertOne({
			id: id,
			module: module.name,
			insertedAt: Date.now(),
			delay: delay,
			data: data
		});

		this.log(`Timer persisted: ${module.name} ${id} ${delay}ms`);
	}

	@bindThis
	public getMeta() {
		const rec = this.meta.findOne();

		if (rec) {
			return rec;
		} else {
			const initial: Meta = {
				lastWakingAt: Date.now(),
			};

			this.meta.insertOne(initial);
			return initial;
		}
	}

	@bindThis
	public setMeta(meta: Partial<Meta>) {
		const rec = this.getMeta();

		for (const [k, v] of Object.entries(meta)) {
			rec[k] = v;
		}

		this.meta.update(rec);
	}
}
