import { bindThis } from '@/decorators.js';
import 唯, { InstallerResult } from '@/ai.js';

// 応答済みID管理用セット
const respondedIdSet = new Set<string>();

export default abstract class Module {
	public abstract readonly name: string;

	protected ai: 唯;
	private doc: any;

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
		return respondedIdSet.has(id);
	}

	/**
	 * 指定IDを応答済みとして記録
	 */
	protected markResponded(id: string) {
		respondedIdSet.add(id);
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
