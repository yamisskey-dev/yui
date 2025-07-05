import * as childProcess from 'child_process';
import { bindThis } from '@/decorators.js';
import Module from '@/module.js';
import serifs from '@/serifs.js';
import config from '@/config.js';
import Message from '@/message.js';
import Friend from '@/friend.js';
import getDate from '@/utils/get-date.js';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const _filename = fileURLToPath(import.meta.url);
const _dirname = dirname(_filename);

export default class extends Module {
	public readonly name = 'reversi';

	/**
	 * リバーシストリーム
	 */
	private reversiConnection?: any;
  /**
   * ユーザーごとの難易度設定を一時保存するマップ
  */
  private pendingGames?: Map<string, number>;

	@bindThis
	public install() {
		if (!config.reversiEnabled) return {};

		this.reversiConnection = this.ai.connection.useSharedConnection('reversi');

		// 招待されたとき
		this.reversiConnection.on('invited', msg => this.onReversiInviteMe(msg.user));

		// マッチしたとき
		this.reversiConnection.on('matched', msg => this.onReversiGameStart(msg.game));

		if (config.reversiEnabled) {
			const mainStream = this.ai.connection.useSharedConnection('main');
			mainStream.on('pageEvent', msg => {
				if (msg.event === 'inviteReversi') {
					this.ai.api('games/reversi/match', {
						userId: msg.user.id
					});
				}
			});
		}

		return {
			mentionHook: this.mentionHook
		};
	}

	@bindThis
	private async mentionHook(msg: Message) {
		if (msg.includes(['リバーシ', 'オセロ', 'reversi', 'othello'])) {
			if (config.reversiEnabled) {
				// 難易度を検出（デフォルト値は4）
				let strength = this.detectStrength(msg);
				
				// 難易度の文字表現を取得
				const strengthText = this.getStrengthText(strength);
				
				// 難易度情報を含めた返信
				msg.reply(`${serifs.reversi.ok} 強さは「${strengthText}」で対戦します！`);

				// フレンドの場合は設定を記憶
				const friend = this.ai.lookupFriend(msg.userId);
				if (friend) {
					friend.updateReversiStrength(strength);
				}

				// グローバルなマップに一時保存
				if (!this.pendingGames) this.pendingGames = new Map();
				this.pendingGames.set(msg.userId, strength);

				this.ai.api('reversi/match', {
					userId: msg.userId
				});
			} else {
				msg.reply(serifs.reversi.decline);
			}

			return true;
		} else {
			return false;
		}
	}

	/**
	 * メッセージから強さを検出
	 */
	@bindThis
	private detectStrength(msg: Message): number {
		if (msg.includes(['接待'])) return 0;
		if (msg.includes(['弱'])) return 2;
		if (msg.includes(['中'])) return 3;
		if (msg.includes(['強']) && !msg.includes(['最強'])) return 4;
		if (msg.includes(['最強'])) return 5;
		return 4; // デフォルト値
	}

	/**
	 * 数値の強さを文字表現に変換
	 */
	@bindThis
	private getStrengthText(strength: number): string {
		switch (strength) {
			case 0: return '接待';
			case 2: return '弱';
			case 3: return '中';
			case 4: return '強';
			case 5: return '最強';
			default: return '強';
		}
	}

	@bindThis
	private async onReversiInviteMe(inviter: any) {
		this.log(`Someone invited me: @${inviter.username}`);

		if (config.reversiEnabled) {
			// 承認
			const game = await this.ai.api('reversi/match', {
				userId: inviter.id
			});

			this.onReversiGameStart(game);
		} else {
			// リバーシが無効の場合のメッセージを送信
			this.ai.sendMessage(inviter.id, {
				text: serifs.reversi.decline
			});
		}
	}

	@bindThis
	private onReversiGameStart(game: any) {
		const opponentId = game.user1Id !== this.ai.account.id ? game.user1Id : game.user2Id;
		
		// 1. 一時保存から難易度を取得（コマンドで直接指定された場合）
		let strength = 4;
		if (this.pendingGames && this.pendingGames.has(opponentId)) {
			strength = this.pendingGames.get(opponentId) ?? 4;
			this.pendingGames.delete(opponentId);
		} 
		// 2. 一時保存になければフレンド情報から取得
		else {
			const friend = this.ai.lookupFriend(opponentId);
			if (friend != null) {
				strength = friend.doc.reversiStrength ?? 4;
				friend.updateReversiStrength(null);
			}
		}

		this.log(`enter reversi game room: ${game.id} with strength ${strength}`);

		// ゲームストリームに接続
		const gw = this.ai.connection.connectToChannel('reversiGame', {
			gameId: game.id
		});

		// フォーム
		const form = [{
			id: 'publish',
			type: 'switch',
			label: '唯が対局情報を投稿するのを許可',
			value: true,
		}, {
			id: 'strength',
			type: 'radio',
			label: '強さ',
			value: strength,
			items: [{
				label: '接待',
				value: 0
			}, {
				label: '弱',
				value: 2
			}, {
				label: '中',
				value: 3
			}, {
				label: '強',
				value: 4
			}, {
				label: '最強',
				value: 5
			}]
		}];

		//#region バックエンドプロセス開始
		const ai = childProcess.fork(_dirname + '/back.js');

		// バックエンドプロセスに情報を渡す
		ai.send({
			type: '_init_',
			body: {
				game: game,
				form: form,
				account: this.ai.account
			}
		});

		ai.on('message', (msg: Record<string, any>) => {
			if (msg.type == 'putStone') {
				gw.send('putStone', {
					pos: msg.pos,
					id: msg.id,
				});
			} else if (msg.type == 'ended') {
				gw.dispose();

				this.onGameEnded(game);
			}
		});

		// ゲームストリームから情報が流れてきたらそのままバックエンドプロセスに伝える
		gw.addListener('*', message => {
			ai.send(message);

			if (message.type === 'updateSettings') {
				if (message.body.key === 'canPutEverywhere') {
					if (message.body.value === true) {
						gw.send('ready', false);
					} else {
						gw.send('ready', true);
					}
				}
			}
		});
		//#endregion

		// どんな設定内容の対局でも受け入れる
		setTimeout(() => {
			gw.send('ready', true);
		}, 1000);
	}

	@bindThis
	private onGameEnded(game: any) {
		const user = game.user1Id == this.ai.account.id ? game.user2 : game.user1;

		//#region 1日に1回だけ親愛度を上げる
		const today = getDate();

		const friend = new Friend(this.ai, { user: user });

		const data = friend.getPerModulesData(this);

		if (data.lastPlayedAt != today) {
			data.lastPlayedAt = today;
			friend.setPerModulesData(this, data);

			friend.incLove();
		}
		//#endregion
	}
}
