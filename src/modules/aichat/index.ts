// Original code from: https://github.com/lqvp/ai
// Copyright (c) 2025 lqvp
// Licensed under MIT License

import { bindThis } from '@/decorators.js';
import Module from '@/module.js';
import serifs from '@/serifs.js';
import Message from '@/message.js';
import config from '@/config.js';
import Friend from '@/friend.js';
import urlToBase64 from '@/utils/url2base64.js';
import urlToJson from '@/utils/url2json.js';
import loki from 'lokijs';
import { processEmojis } from '@/utils/emoji-selector.js';
import {
	GeminiContents,
	GeminiOptions,
	GeminiParts,
	GeminiSystemInstruction,
	callGemini,
} from './gemini-client.js';
import {
	UrlPreview,
	buildBaseSystemInstruction,
	buildUrlPreviewSection,
	extractUrls,
	isEmotionalQuestion,
	isYoutubeUrl,
	normalizeYoutubeUrl,
} from './prompt.js';
import {
	AiChatMemory,
	createEmptyMemory,
	generateHumanLikeContext,
	manageHumanLikeMemory,
} from './memory.js';

type AiChat = {
	question: string;
	prompt: string;
	api: string;
	key: string;
	fromMention: boolean;
	friendName?: string;
	grounding?: boolean;
	history?: { role: string; content: string }[]; // 後方互換性のため残す
	memory?: AiChatMemory; // 人間らしい記憶システム
};
type base64File = {
	type: string;
	base64: string;
	url?: string;
};

type AiChatHist = {
	postId: string;
	createdAt: number;
	type: string;
	api?: string;
	// より自然な記憶管理のための構造
	memory?: AiChatMemory;
	// 後方互換性のため残す
	history?: {
		role: string;
		content: string;
		index?: number;
		isForgotten?: boolean;
	}[];
	friendName?: string;
	originalNoteId?: string;
	fromMention: boolean;
	grounding?: boolean;
	youtubeUrls?: string[];
	isChat?: boolean;
	chatUserId?: string;
};

const TYPE_GEMINI = 'gemini';
const geminiModel = config.geminiModel || 'gemini-2.5-flash';
const GEMINI_API = `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent`;
const GROUNDING_TARGET = 'ggg';

const RANDOMTALK_DEFAULT_PROBABILITY = 0.02; // デフォルトのrandomTalk確率
const TIMEOUT_TIME = 1000 * 60 * 60 * 0.5; // aichatの返信を監視する時間
const RANDOMTALK_DEFAULT_INTERVAL = 1000 * 60 * 60 * 12; // デフォルトのrandomTalk間隔

const AUTO_NOTE_DEFAULT_INTERVAL = 1000 * 60 * 360;
const AUTO_NOTE_DEFAULT_PROBABILITY = 0.02;

// 同一ユーザーからの連続 Gemini 呼び出しの最小間隔（コスト暴走・連投対策）
const USER_COOLDOWN_MS = 1000 * 10;
const COOLDOWN_MAP_LIMIT = 1000;

export default class extends Module {
	public readonly name = 'aichat';
	private aichatHist!: loki.Collection<AiChatHist>;
	private randomTalkProbability: number = RANDOMTALK_DEFAULT_PROBABILITY;
	private randomTalkIntervalMinutes: number = RANDOMTALK_DEFAULT_INTERVAL;
	// ユーザーごとの最終 Gemini 呼び出し時刻
	private lastGeminiCallAt = new Map<string, number>();

	@bindThis
	public install() {
		this.aichatHist = this.ai.getCollection('aichatHist', {
			indices: ['postId', 'originalNoteId'],
		});

		if (config.aichatRandomTalkProbability != undefined) {
			this.randomTalkProbability = config.aichatRandomTalkProbability;
		}
		if (config.aichatRandomTalkIntervalMinutes != undefined) {
			this.randomTalkIntervalMinutes =
				1000 * 60 * config.aichatRandomTalkIntervalMinutes;
		}
		this.log('aichatRandomTalkEnabled:' + config.aichatRandomTalkEnabled);
		this.log('randomTalkProbability:' + this.randomTalkProbability);
		this.log(
			'randomTalkIntervalMinutes:' +
			this.randomTalkIntervalMinutes / (60 * 1000)
		);
		this.log(
			'aichatGroundingWithGoogleSearchAlwaysEnabled:' +
			config.aichatGroundingWithGoogleSearchAlwaysEnabled
		);

		if (config.aichatRandomTalkEnabled) {
			setInterval(() => {
				this.aichatRandomTalk().catch(err => this.log('aichatRandomTalk error: ' + err));
			}, this.randomTalkIntervalMinutes);
		}

		// ここで geminiPostMode が "auto" もしくは "both" の場合、自動ノート投稿を設定
		if (config.geminiPostMode === 'auto' || config.geminiPostMode === 'both') {
			const interval =
				config.autoNoteIntervalMinutes != undefined
					? 1000 * 60 * config.autoNoteIntervalMinutes
					: AUTO_NOTE_DEFAULT_INTERVAL;
			setInterval(() => {
				this.autoNote().catch(err => this.log('autoNote error: ' + err));
			}, interval);
			this.log('Gemini自動ノート投稿を有効化: interval=' + interval);
			const probability =
				config.geminiAutoNoteProbability ?? AUTO_NOTE_DEFAULT_PROBABILITY;
			this.log('Gemini自動ノート投稿確率: probability=' + probability);
		}

		return {
			mentionHook: this.mentionHook,
			contextHook: this.contextHook,
			timeoutCallback: this.timeoutCallback,
		};
	}

	@bindThis
	private async genTextByGemini(aiChat: AiChat, files: base64File[], isChat: boolean): Promise<string | null> {
		this.log('Generate Text By Gemini...');
		const now = new Date().toLocaleString('ja-JP', {
			timeZone: 'Asia/Tokyo',
			year: 'numeric',
			month: '2-digit',
			day: '2-digit',
			hour: '2-digit',
			minute: '2-digit',
		});

		// 感情的な質問や相談の場合はグラウンディングを無効化
		if (isEmotionalQuestion(aiChat.question)) {
			this.log('Emotional question detected, disabling grounding');
			aiChat.grounding = false;
		}

		let systemInstructionText = buildBaseSystemInstruction({
			prompt: aiChat.prompt,
			now,
			friendName: aiChat.friendName,
			fromMention: aiChat.fromMention,
			grounding: !!aiChat.grounding,
		});

		// URLから情報を取得
		let youtubeURLs: string[] = [];
		let hasYoutubeUrl = false;

		if (aiChat.question !== undefined) {
			for (const url of extractUrls(aiChat.question)) {
				this.log('URL:' + url);

				// YouTubeのURLの場合は特別処理
				if (isYoutubeUrl(url)) {
					const normalizedUrl = normalizeYoutubeUrl(url);
					this.log('Normalized YouTube URL: ' + normalizedUrl);
					youtubeURLs.push(normalizedUrl);
					hasYoutubeUrl = true;
					continue;
				}

				let result: unknown = null;
				try {
					result = await urlToJson(url);
				} catch (err: unknown) {
					systemInstructionText += '補足として提供されたURLは無効でした:URL=>' + url;
					this.log('Skip url because error in urlToJson');
					continue;
				}
				const urlpreview: UrlPreview = result as UrlPreview;
				if (urlpreview.title) {
					// リンク先が任意に設定できる文言のため、指示ではなく参考データとして渡す
					systemInstructionText += buildUrlPreviewSection(urlpreview);
					this.log('urlpreview.sitename:' + urlpreview.sitename);
					this.log('urlpreview.title:' + urlpreview.title);
				} else {
					// 多分ここにはこないが念のため
					this.log('urlpreview.title is nothing');
				}
			}
		}

		let contents: GeminiContents[] = [];

		// 保存されたYouTubeのURLを会話履歴から取得
		if (aiChat.history && aiChat.history.length > 0) {
			// 忘却されていない履歴のみを使用
			const activeHistory = this.getActiveHistory(aiChat.history);

			// historyの最初のユーザーメッセージをチェック
			const firstUserMessage = activeHistory.find((entry) => entry.role === 'user');
			if (firstUserMessage) {
				for (const url of extractUrls(firstUserMessage.content)) {
					if (isYoutubeUrl(url)) {
						const normalizedUrl = normalizeYoutubeUrl(url);
						// 重複を避ける
						if (!youtubeURLs.includes(normalizedUrl)) {
							this.log('Found YouTube URL in history: ' + normalizedUrl);
							youtubeURLs.push(normalizedUrl);
							hasYoutubeUrl = true;
						}
					}
				}
			}

			for (const hist of activeHistory) {
				contents.push({
					role: hist.role,
					parts: [{ text: hist.content }],
				});
			}
		}

		// 記憶システムから長期記憶の文脈を注入
		// （直近のやり取りは contents に入っているため、重要な長期記憶のみが返る）
		const humanContext = generateHumanLikeContext(aiChat.memory);
		if (humanContext) {
			systemInstructionText += '\n\n' + humanContext;
		}

		const systemInstruction: GeminiSystemInstruction = {
			role: 'system',
			parts: [{ text: systemInstructionText }],
		};

		// 質問文・YouTube・画像ファイルを parts として組み立てる
		const parts: GeminiParts = [{ text: aiChat.question }];
		for (const youtubeURL of youtubeURLs) {
			parts.push({
				fileData: {
					mimeType: 'video/mp4',
					fileUri: youtubeURL,
				},
			});
		}
		for (const file of files) {
			parts.push({
				inlineData: {
					mimeType: file.type,
					data: file.base64,
				},
			});
		}

		contents.push({ role: 'user', parts: parts });

		const geminiOptions: GeminiOptions = {
			contents: contents,
			systemInstruction: systemInstruction,
		};

		// YouTubeURLがある場合はグラウンディングを無効化
		if (aiChat.grounding && !hasYoutubeUrl) {
			geminiOptions.tools = [{ google_search: {} }];
		}

		this.log(`Calling Gemini API: model=${geminiModel}, grounding=${!!geminiOptions.tools}`);
		return await callGemini({
			apiUrl: aiChat.api,
			apiKey: aiChat.key,
			options: geminiOptions,
			includeSearchQueries: !isChat,
			log: this.log,
		});
	}

	@bindThis
	private async note2base64File(notesId: string, isChat: boolean) {
		// チャットメッセージの場合は画像取得をスキップ
		if (isChat) {
			return [];
		}

		const noteData = await this.ai.api('notes/show', { noteId: notesId }) as any;
		if (!noteData || !noteData.files) {
			return [];
		}
		let files: base64File[] = [];
		for (let i = 0; i < noteData.files.length; i++) {
			let fileType: string | undefined;
			let fileUrl: string | undefined;
			if (noteData.files[i].hasOwnProperty('type')) {
				fileType = noteData.files[i].type;
			}
			if (
				noteData.files[i].hasOwnProperty('thumbnailUrl') &&
				noteData.files[i].thumbnailUrl
			) {
				fileUrl = noteData.files[i].thumbnailUrl;
			} else if (
				noteData.files[i].hasOwnProperty('url') &&
				noteData.files[i].url
			) {
				fileUrl = noteData.files[i].url;
			}
			if (fileType !== undefined && fileUrl !== undefined) {
				try {
					this.log('fileUrl:' + fileUrl);
					const file = await urlToBase64(fileUrl);
					const base64file: base64File = { type: fileType, base64: file };
					files.push(base64file);
				} catch (err: unknown) {
					if (err instanceof Error) {
						this.log(`${err.name}\n${err.message}\n${err.stack}`);
					}
				}
			}
		}
		return files;
	}

	/**
	 * 会話相手の表示名を解決する（friend 登録名 > 表示名 > username）
	 */
	@bindThis
	private resolveFriendName(msg: Message): string | undefined {
		const friend: Friend | null = this.ai.lookupFriend(msg.userId);
		if (friend != null && friend.name != null) return friend.name;
		return msg.user?.name || msg.user?.username;
	}

	@bindThis
	private async mentionHook(msg: Message) {
		this.log('mentionHook... msg.id=' + msg.id + ', text=' + msg.text?.substring(0, 50));
		const id = msg.id;
		if (id && this.isAlreadyResponded(id)) return false;

		// 自分自身の投稿には絶対反応しない
		if (msg.userId === this.ai.account.id) {
			return false;
		}

		if (msg.isChat) {
			// 既に会話中かチェック
			const exist = this.aichatHist.findOne({
				isChat: true,
				chatUserId: msg.userId,
			});

			if (exist != null) return false;

			this.log('AiChat requested via direct chat');

			if (!msg.includes(['aichat', 'AIチャット', 'AI会話', this.name])) return false;

			// チャットモードでの直接会話開始
			const current: AiChatHist = {
				postId: msg.id,
				createdAt: Date.now(),
				type: TYPE_GEMINI,
				fromMention: true,
				isChat: msg.isChat,
				chatUserId: msg.userId,
			};

			// チャットモードでは返信投稿を作成
			const result = await this.handleAiChat(current, msg);
			if (result) {
				return { reaction: 'like' };
			}
			return false;
		}

		// 通常ノートの場合は「aichatトリガー」または「aichatへのリプライ」以外は反応しない
		// aichatトリガー: #aichat または "aichat" コマンドが含まれている
		const isAichatTrigger = msg.text && (msg.text.includes('#aichat') || msg.text.includes('aichat'));

		// aichatへのリプライかどうか判定
		let isReplyToAichat = false;
		if (msg.replyId) {
			try {
				const repliedNote = await this.ai.api('notes/show', { noteId: msg.replyId }) as any;
				if (repliedNote && repliedNote.text && repliedNote.text.includes('#aichat')) {
					isReplyToAichat = true;
				}
			} catch (error) {
				this.log('Error checking replied note: ' + error);
			}
		}

		// aichatトリガーまたはaichatへのリプライでなければ他機能に譲る
		if (!isAichatTrigger && !isReplyToAichat) {
			return false;
		}

		// aichatへのリプライ時は従来のaichat返信処理をそのまま使う
		if (isReplyToAichat) {
			this.log('AiChat requested via reply to #aichat note');
			// 既に返信済みかチェック
			const exist = this.aichatHist.findOne({ postId: msg.id });
			if (exist != null) {
				this.log('Already replied to this note');
				return false;
			}

			// 新しい会話を作成（既存の処理をそのまま使用）
			const current: AiChatHist = {
				postId: msg.id,
				createdAt: Date.now(),
				type: TYPE_GEMINI,
				fromMention: true,
				isChat: msg.isChat,
				chatUserId: msg.isChat ? msg.userId : undefined,
			};

			// 返信投稿を作成（既存の処理をそのまま使用）
			const result = await this.handleAiChat(current, msg);
			if (result) {
				return true;
			}
			return false;
		}

		// ノート投稿の場合はメンションがあれば応答
		this.log('AiChat requested via mention');

		// 既に返信済みかチェック
		const exist = this.aichatHist.findOne({ postId: msg.id });
		if (exist != null) {
			this.log('Already replied to this note');
			return false;
		}

		// 新しい会話を作成
		const current: AiChatHist = {
			postId: msg.id,
			createdAt: Date.now(),
			type: TYPE_GEMINI,
			fromMention: true,
			isChat: msg.isChat,
			chatUserId: msg.isChat ? msg.userId : undefined,
		};

		if (msg.quoteId) {
			// 引用元が削除済み・取得不可でも aichat 自体は続行する
			try {
				const quotedNote = await this.ai.api('notes/show', { noteId: msg.quoteId }) as any;
				if (quotedNote?.text) {
					const quotedMemory = createEmptyMemory(this.resolveFriendName(msg) || 'ユーザー');
					quotedMemory.conversations.push({
						id: 'quoted',
						timestamp: Date.now(),
						userMessage: quotedNote.text,
						aiResponse: '',
						context: 'quoted',
						importance: 7,
						isActive: true
					});
					current.memory = quotedMemory;
				}
			} catch (error) {
				this.log('Error fetching quoted note: ' + error);
			}
		}

		// 返信投稿を作成（リアクションはMisskeyの仕様で自動的に作成される）
		const result = await this.handleAiChat(current, msg);
		if (result) {
			return true; // リアクションは返さない（Misskeyが自動的に作成するため）
		}
		return false;
	}

	@bindThis
	private async contextHook(key: any, msg: Message) {
		this.log('contextHook... msg.id=' + msg.id + ', text=' + msg.text?.substring(0, 50));
		if (msg.text == null) return false;

		// チャットモードでaichat終了コマンド
		if (
			msg.isChat &&
			(msg.includes(['aichat 終了']) ||
				msg.includes(['aichat 終わり']) ||
				msg.includes(['aichat やめる']) ||
				msg.includes(['aichat 止めて']))
		) {
			const exist = this.aichatHist.findOne({ isChat: true, chatUserId: msg.userId });
			if (exist) {
				this.aichatHist.remove(exist);
				this.unsubscribeReply(key);
				msg.reply(serifs.aichat.endChat);
				return true;
			}
			return false;
		}
		// チャットモード中のみaichatが応答
		if (msg.isChat) {
			const exist = this.aichatHist.findOne({ isChat: true, chatUserId: msg.userId });
			if (!exist) return false;
			const result = await this.handleAiChat(exist, msg);
			if (result) {
				// 成功時のみ旧コンテキストを破棄する
				// （Gemini 呼び出しが失敗しても会話が失われないように、先に消さない）
				this.unsubscribeReply(key);
				this.aichatHist.remove(exist);
				return { reaction: 'like' };
			}
			return false;
		}

		// 通常の会話継続の場合
		let exist: AiChatHist | null = null;
		const conversationData = await this.ai.api('notes/conversation', { noteId: msg.id }) as any;

		if (!Array.isArray(conversationData) || conversationData.length == 0) {
			this.log('conversationData is nothing.');
			return false;
		}

		for (const message of conversationData) {
			exist = this.aichatHist.findOne({ postId: message.id });
			if (exist != null) break;
		}

		if (exist == null) {
			this.log('conversation context is not found.');
			return false;
		}

		const result = await this.handleAiChat(exist, msg);

		if (result) {
			// 成功時のみ旧コンテキストを破棄する
			this.unsubscribeReply(key);
			this.aichatHist.remove(exist);
			return { reaction: 'like' };
		}
		return false;
	}

	@bindThis
	private async aichatRandomTalk() {
		this.log('AiChat(randomtalk) started');
		const tl = await this.ai.api('notes/timeline', { limit: 30 }) as any;
		const interestedNotes = tl.filter(
			(note) =>
				note.userId !== this.ai.account.id &&
				note.text != null &&
				note.replyId == null &&
				note.renoteId == null &&
				note.cw == null &&
				(note.visibility === 'public' || note.visibility === 'home') &&
				(note.files || []).length == 0 &&
				!note.user.isBot
		);

		if (interestedNotes == undefined || interestedNotes.length == 0)
			return false;

		if (Math.random() >= this.randomTalkProbability) return false;

		const choseNote =
			interestedNotes[Math.floor(Math.random() * interestedNotes.length)];

		let exist: AiChatHist | null = null;

		exist = this.aichatHist.findOne({
			postId: choseNote.id,
		});
		if (exist != null) return false;

		const childrenData = await this.ai.api('notes/children', { noteId: choseNote.id }) as any;
		if (Array.isArray(childrenData)) {
			for (const message of childrenData) {
				exist = this.aichatHist.findOne({
					postId: message.id,
				});
				if (exist != null) return false;
			}
		}

		const conversationData = await this.ai.api('notes/conversation', { noteId: choseNote.id }) as any;

		if (Array.isArray(conversationData)) {
			for (const message of conversationData) {
				exist = this.aichatHist.findOne({ postId: message.id });
				if (exist != null) return false;
			}
		}

		exist = this.aichatHist.findOne({ originalNoteId: choseNote.id });
		if (exist != null) {
			this.log('Already replied to this note via originalNoteId');
			return false;
		}

		// users/relation は配列で渡すと配列で返る（単一IDで渡すと単一オブジェクトが返り、
		// relation[0] が常に undefined になってランダムトークが一度も発火しなかった）
		const relation = await this.ai.api('users/relation', { userId: [choseNote.userId] }) as any;

		if (relation[0]?.isFollowing === true) {
			const current: AiChatHist = {
				postId: choseNote.id,
				createdAt: Date.now(),
				type: TYPE_GEMINI,
				fromMention: false,
			};

			let targetedMessage = choseNote;
			if (choseNote.extractedText == undefined) {
				const data = await this.ai.api('notes/show', { noteId: choseNote.id });
				targetedMessage = new Message(this.ai, data, false);
			}

			const result = await this.handleAiChat(current, targetedMessage);

			if (result) {
				return { reaction: 'like' };
			}
		}

		return false;
	}

	@bindThis
	private async autoNote() {
		if (config.autoNoteDisableNightPosting) {
			const now = new Date();
			const hour = now.getHours();
			if (hour >= 23 || hour < 5) {
				this.log('深夜のため自動ノート投稿をスキップします（' + hour + '時）');
				return;
			}
		}

		// 確率ゲートは未設定でもデフォルト値で必ず適用する（以前は未設定時に毎回100%投稿されていた）
		const probability =
			config.geminiAutoNoteProbability ?? AUTO_NOTE_DEFAULT_PROBABILITY;
		if (Math.random() >= probability) {
			this.log(
				`Gemini自動ノート投稿の確率によりスキップされました: probability=${probability}`
			);
			return;
		}
		this.log('Gemini自動ノート投稿開始');
		if (!config.geminiApiKey || !config.autoNotePrompt) {
			this.log('APIキーまたは自動ノート用プロンプトが設定されていません。');
			return;
		}
		const aiChat: AiChat = {
			question: '',
			prompt: config.autoNotePrompt,
			api: GEMINI_API,
			key: config.geminiApiKey,
			fromMention: false,
		};
		const base64Files: base64File[] = [];
		const text = await this.genTextByGemini(aiChat, base64Files, false);
		if (text) {
			this.ai.post({ text: text + ' #aichat' });
		} else {
			this.log('Gemini自動ノートの生成に失敗しました。');
		}
	}

	@bindThis
	private async handleAiChat(exist: AiChatHist, msg: Message) {
		let text: string | null, aiChat: AiChat;
		let prompt: string = '';
		if (config.prompt) {
			prompt = config.prompt;
		}

		if (msg.includes([GROUNDING_TARGET])) {
			exist.grounding = true;
		}
		if (
			exist.fromMention &&
			config.aichatGroundingWithGoogleSearchAlwaysEnabled
		) {
			exist.grounding = true;
		}

		const reName = RegExp(this.name, 'i');
		const extractedText = msg.extractedText;
		if (extractedText == undefined || extractedText.length == 0) return false;

		let question = extractedText
			.replace(reName, '')
			.replace(GROUNDING_TARGET, '')
			.trim();

		const youtubeUrls: string[] = exist.youtubeUrls || [];

		for (const url of extractUrls(question)) {
			if (isYoutubeUrl(url)) {
				const normalizedUrl = normalizeYoutubeUrl(url);
				if (!youtubeUrls.includes(normalizedUrl)) {
					youtubeUrls.push(normalizedUrl);
				}
			}
		}

		const friendName = this.resolveFriendName(msg);

		if (!config.geminiApiKey) {
			msg.reply(serifs.aichat.nothing);
			return false;
		}

		// 同一ユーザーの連投による Gemini 呼び出しの暴走（コスト増）を防ぐ
		const lastCallAt = this.lastGeminiCallAt.get(msg.userId) ?? 0;
		if (Date.now() - lastCallAt < USER_COOLDOWN_MS) {
			this.log(`Cooldown active for user ${msg.userId}, skipping Gemini call`);
			return false;
		}
		this.lastGeminiCallAt.set(msg.userId, Date.now());
		if (this.lastGeminiCallAt.size > COOLDOWN_MAP_LIMIT) {
			const oldestKey = this.lastGeminiCallAt.keys().next().value;
			if (oldestKey !== undefined) this.lastGeminiCallAt.delete(oldestKey);
		}

		aiChat = {
			question: question,
			prompt: prompt,
			api: GEMINI_API,
			key: config.geminiApiKey,
			history: exist.history, // 後方互換性のため残す
			memory: exist.memory, // 新しい人間らしい記憶システム
			friendName: friendName,
			fromMention: exist.fromMention,
			grounding: exist.grounding,
		};

		const base64Files: base64File[] = await this.note2base64File(
			msg.id,
			msg.isChat
		);
		text = await this.genTextByGemini(aiChat, base64Files, msg.isChat);
		if (text == null || text === '') {
			this.log(
				'The result is invalid. It seems that tokens and other items need to be reviewed.'
			);
			msg.reply(serifs.aichat.error);
			return false;
		}

		// 絵文字処理を適用
		text = processEmojis(text);

		// handleAiChat内で、msg.isChatがtrueの場合はtext末尾の (gemini) #aichat などを除去
		if (msg.isChat && typeof text === 'string') {
			text = text.replace(/\n?\(gemini\) ?#aichat/g, '').replace(/#aichat/g, '').replace(/\(gemini\)/g, '');
		}

		// チャットでは #aichat タグを付けず、ノートではタグ付きで投稿する
		// （タグ除去(上記)の直後に serifs.aichat.post で再付与されてしまっていた）
		const replyText = msg.isChat ? text : serifs.aichat.post(text);

		let reply;
		try {
			reply = await msg.reply(replyText);
		} catch (err) {
			// 返信に失敗した場合は状態を変更せず終了する（呼び出し元が旧コンテキストを保持する）
			this.log('Failed to post reply: ' + err);
			return false;
		}
		if (reply == null) {
			this.log('Reply was not created.');
			return false;
		}

		// memoryシステムを使用した記憶管理
		if (!exist.memory) {
			exist.memory = createEmptyMemory(friendName || 'ユーザー');
		}

		// 新しい会話を記憶に追加
		exist.memory = manageHumanLikeMemory(exist.memory, {
			id: reply.id,
			userMessage: question,
			aiResponse: text
		});

		// 後方互換性のためhistoryも更新
		if (!exist.history) {
			exist.history = [];
		}
		exist.history.push({ role: 'user', content: question });
		exist.history.push({ role: 'model', content: text ?? '' });
		if (exist.history.length > 10) { // 履歴の最大長制限
			exist.history.shift();
			exist.history.shift();
		}

		const newRecord: AiChatHist = {
			postId: reply.id,
			createdAt: Date.now(),
			type: exist.type,
			api: aiChat.api,
			memory: exist.memory, // memoryシステムを使用
			history: exist.history, // 後方互換性のため残す
			grounding: exist.grounding,
			fromMention: exist.fromMention,
			originalNoteId: exist.postId,
			youtubeUrls: youtubeUrls.length > 0 ? youtubeUrls : undefined,
			isChat: msg.isChat,
			chatUserId: msg.isChat ? msg.userId : undefined,
		};

		this.aichatHist.insertOne(newRecord);

		this.subscribeReply(
			reply.id,
			msg.isChat,
			msg.isChat ? msg.userId : reply.id
		);
		this.setTimeoutWithPersistence(TIMEOUT_TIME, {
			id: reply.id,
			isChat: msg.isChat,
			userId: msg.userId,
		});

		// チャットモードで、かつ最初のメッセージ（履歴が2つしかない）の場合に終了方法を教える
		if (msg.isChat && exist.history && exist.history.length <= 2) {
			setTimeout(() => {
				this.ai.sendMessage(msg.userId, {
					text: serifs.aichat.endChatGuide,
				});
			}, 1000); // 少し間を空けて送信
		}
		return true;
	}

	@bindThis
	private async timeoutCallback(data) {
		this.log('timeoutCallback...');
		let exist: AiChatHist | null = null;

		if (data.isChat) {
			exist = this.aichatHist.findOne({
				isChat: true,
				chatUserId: data.userId,
			});
		} else {
			exist = this.aichatHist.findOne({ postId: data.id });
		}
		// 購読キーはチャット・ノートいずれも reply.id（= data.id）で登録している
		this.unsubscribeReply(data.id);

		if (exist != null) {
			this.aichatHist.remove(exist);
		}
	}

	/**
	 * 忘却されていない履歴のみを取得
	 * （過去に isForgotten を立てたレコードが DB に残っている可能性があるため残す）
	 */
	@bindThis
	private getActiveHistory(history: any[]): any[] {
		if (!history) return [];
		return history.filter(item => !item.isForgotten);
	}
}
