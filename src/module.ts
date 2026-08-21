import { bindThis } from '@/decorators.js';
import 唯, { InstallerResult } from '@/ai.js';
import config from '@/config.js';

// 応答済みIDの保持上限（超えたら古いものから破棄）
const RESPONDED_ID_LIMIT = 10000;

export default abstract class Module {
	public abstract readonly name: string;

	protected ai!: 唯;
	private doc: any;

	// 応答済みID管理用セット（モジュールごとに独立。プロセス再起動で消える揮発キャッシュ）
	private respondedIds = new Set<string>();

	public init(ai: 唯) {
		this.ai = ai;

		this.doc = this.ai.moduleData.findOne({
			module: this.name
		});

		if (this.doc == null) {
			this.doc = this.ai.moduleData.insertOne({
				module: this.name,
				data: {}
			});
		}
	}

	public abstract install(): InstallerResult;

	@bindThis
	protected log(msg: string) {
		this.ai.log(`[${this.name}]: ${msg}`);
	}

	/**
	 * マスター（config.master）にダイレクトメッセージで通知します。
	 * master が未設定、またはユーザー解決に失敗した場合はログのみ残します。
	 */
	@bindThis
	protected async notifyMaster(text: string) {
		if (!config.master) {
			this.log(`master 未設定のため通知をスキップ: ${text}`);
			return;
		}
		try {
			if (this.masterUserId == null) {
				const user = await this.ai.api('users/show', { username: config.master }) as { id?: string };
				this.masterUserId = user?.id ?? null;
			}
			if (this.masterUserId) {
				await this.ai.sendMessage(this.masterUserId, { text });
			} else {
				this.log(`master ユーザーを解決できないため通知をスキップ: ${text}`);
			}
		} catch (e) {
			this.log(`master への通知に失敗: ${e}`);
		}
	}

	private masterUserId: string | null = null;

	/**
	 * コンテキストを生成し、ユーザーからの返信を待ち受けます
	 * @param key コンテキストを識別するためのキー
	 * @param isChat チャット上のコンテキストかどうか
	 * @param id チャット上のコンテキストならばチャット相手のID、そうでないなら待ち受ける投稿のID
	 * @param data コンテキストに保存するオプションのデータ
	 */
	@bindThis
	protected subscribeReply(key: string | null, isChat: boolean, id: string, data?: any) {
		this.ai.subscribeReply(this, key, isChat, id, data);
	}

	/**
	 * 返信の待ち受けを解除します
	 * @param key コンテキストを識別するためのキー
	 */
	@bindThis
	protected unsubscribeReply(key: string | null) {
		this.ai.unsubscribeReply(this, key);
	}

	/**
	 * 指定したミリ秒経過後に、タイムアウトコールバックを呼び出します。
	 * このタイマーは記憶に永続化されるので、途中でプロセスを再起動しても有効です。
	 * @param delay ミリ秒
	 * @param data オプションのデータ
	 */
	@bindThis
	public setTimeoutWithPersistence(delay: number, data?: any) {
		this.ai.setTimeoutWithPersistence(this, delay, data);
	}

	/**
	 * 指定IDに既に応答済みか判定
	 */
	protected isAlreadyResponded(id: string): boolean {
		return this.respondedIds.has(id);
	}

	/**
	 * 指定IDを応答済みとして記録
	 */
	protected markResponded(id: string) {
		this.respondedIds.add(id);
		if (this.respondedIds.size > RESPONDED_ID_LIMIT) {
			// Set は挿入順を保持するため、最初の要素が最も古い
			const oldest = this.respondedIds.values().next().value;
			if (oldest !== undefined) this.respondedIds.delete(oldest);
		}
	}

	@bindThis
	protected getData() {
		return this.doc.data;
	}

	@bindThis
	protected setData(data: any) {
		this.doc.data = data;
		this.ai.moduleData.update(this.doc);
	}
}
