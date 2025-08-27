// Original code from: https://github.com/lqvp/ai
// Copyright (c) 2025 lqvp
// Licensed under MIT License

// TODO: AiChatモジュール改善計画
// - パフォーマンス: API呼び出しの最適化とキャッシュ機能
// - 機能: より高度な感情分析とコンテキスト理解
// - セキュリティ: APIキーの安全な管理とレート制限
// - 拡張性: 複数のAIプロバイダーサポート
// - メンテナンス: エラーハンドリングの強化
// - 機能: マルチターン会話の改善

import { bindThis } from '@/decorators.js';
import Module from '@/module.js';
import serifs from '@/serifs.js';
import Message from '@/message.js';
import config from '@/config.js';
import Friend from '@/friend.js';
import urlToBase64 from '@/utils/url2base64.js';
import urlToJson from '@/utils/url2json.js';
import got from 'got';
import loki from 'lokijs';
import { loadCustomEmojis, processEmojis } from '@/utils/emoji-selector.js';

type AiChat = {
	question: string;
	prompt: string;
	api: string;
	key: string;
	fromMention: boolean;
	friendName?: string;
	grounding?: boolean;
	history?: { role: string; content: string }[]; // 後方互換性のため残す
	memory?: any; // 新しい人間らしい記憶システム
};
type base64File = {
	type: string;
	base64: string;
	url?: string;
};
type GeminiOptions = {
	contents?: GeminiContents[];
	systemInstruction?: GeminiSystemInstruction;
	tools?: [{}];
};
type GeminiParts = {
	inlineData?: {
		mimeType: string;
		data: string;
	};
	fileData?: {
		mimeType: string;
		fileUri: string;
	};
	text?: string;
}[];
type GeminiSystemInstruction = {
	role: string;
	parts: [{ text: string }];
};
type GeminiContents = {
	role: string;
	parts: GeminiParts;
};

type AiChatHist = {
	postId: string;
	createdAt: number;
	type: string;
	api?: string;
	// より自然な記憶管理のための構造
	memory?: {
		conversations: {
			id: string;
			timestamp: number;
			userMessage: string;
			aiResponse: string;
			context?: string; // 会話の文脈（感情、話題など）
			importance: number; // 重要度（0-10）
			isActive: boolean; // アクティブな記憶かどうか
		}[];
		userProfile?: {
			name: string;
			interests: string[];
			conversationStyle: string;
			lastInteraction: number;
		};
		conversationContext?: {
			currentTopic: string;
			mood: string;
			relationshipLevel: number; // 親密度
		};
	};
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

type UrlPreview = {
	title: string;
	icon: string;
	description: string;
	thumbnail: string;
	player: {
		url: string;
		width: number;
		height: number;
		allow: [];
	};
	sitename: string;
	sensitive: boolean;
	activityPub: string;
	url: string;
};

const TYPE_GEMINI = 'gemini';
const geminiModel = config.geminiModel || 'gemini-2.0-flash-exp';
const GEMINI_API = `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent`;
const GROUNDING_TARGET = 'ggg';

const RANDOMTALK_DEFAULT_PROBABILITY = 0.02; // デフォルトのrandomTalk確率
const TIMEOUT_TIME = 1000 * 60 * 60 * 0.5; // aichatの返信を監視する時間
const RANDOMTALK_DEFAULT_INTERVAL = 1000 * 60 * 60 * 12; // デフォルトのrandomTalk間隔

const AUTO_NOTE_DEFAULT_INTERVAL = 1000 * 60 * 360;
const AUTO_NOTE_DEFAULT_PROBABILITY = 0.02;

export default class extends Module {
	public readonly name = 'aichat';
	private aichatHist: loki.Collection<AiChatHist>;
	private randomTalkProbability: number = RANDOMTALK_DEFAULT_PROBABILITY;
	private randomTalkIntervalMinutes: number = RANDOMTALK_DEFAULT_INTERVAL;
	private customEmojis: Set<string> = new Set(); // カスタム絵文字の名前をキャッシュ


	@bindThis
	public install() {
		this.aichatHist = this.ai.getCollection('aichatHist', {
			indices: ['postId', 'originalNoteId'],
		});

		if (
			config.aichatRandomTalkProbability != undefined &&
			!Number.isNaN(
				Number.parseFloat(String(config.aichatRandomTalkProbability))
			)
		) {
			this.randomTalkProbability = Number.parseFloat(
				String(config.aichatRandomTalkProbability)
			);
		}
		if (
			config.aichatRandomTalkIntervalMinutes != undefined &&
			!Number.isNaN(
				Number.parseInt(String(config.aichatRandomTalkIntervalMinutes))
			)
		) {
			this.randomTalkIntervalMinutes =
				1000 *
				60 *
				Number.parseInt(String(config.aichatRandomTalkIntervalMinutes));
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
			setInterval(this.aichatRandomTalk, this.randomTalkIntervalMinutes);
		}

		// ここで geminiPostMode が "auto" もしくは "both" の場合、自動ノート投稿を設定
		if (config.geminiPostMode === 'auto' || config.geminiPostMode === 'both') {
			const interval =
				config.autoNoteIntervalMinutes != undefined &&
					!isNaN(parseInt(String(config.autoNoteIntervalMinutes)))
					? 1000 * 60 * parseInt(String(config.autoNoteIntervalMinutes))
					: AUTO_NOTE_DEFAULT_INTERVAL;
			setInterval(this.autoNote, interval);
			this.log('Gemini自動ノート投稿を有効化: interval=' + interval);
			const probability =
				config.geminiAutoNoteProbability &&
					!isNaN(parseFloat(String(config.geminiAutoNoteProbability)))
					? parseFloat(String(config.geminiAutoNoteProbability))
					: AUTO_NOTE_DEFAULT_PROBABILITY;
			this.log('Gemini自動ノート投稿確率: probability=' + probability);
		}

		// カスタム絵文字の情報を取得
		loadCustomEmojis(this.ai.api.bind(this.ai), this.log.bind(this)).then(set => {
			this.customEmojis = set;
		});

		return {
			mentionHook: this.mentionHook,
			contextHook: this.contextHook,
			timeoutCallback: this.timeoutCallback,
		};
	}

	@bindThis
	private isYoutubeUrl(url: string): boolean {
		return (
			url.includes('www.youtube.com') ||
			url.includes('m.youtube.com') ||
			url.includes('youtu.be')
		);
	}

	@bindThis
	private normalizeYoutubeUrl(url: string): string {
		try {
			// URLオブジェクトを使用してパラメータを正確に解析
			const urlObj = new URL(url);
			let videoId = '';

			// youtu.beドメインの場合
			if (urlObj.hostname.includes('youtu.be')) {
				// パスから直接ビデオIDを取得
				videoId = urlObj.pathname.split('/')[1];
			}
			// youtube.comドメインの場合
			else if (urlObj.hostname.includes('youtube.com')) {
				// URLSearchParamsを使用してvパラメータを取得
				videoId = urlObj.searchParams.get('v') || '';
			}

			// ビデオIDが見つかった場合は標準形式のURLを返す
			if (videoId) {
				return `https://www.youtube.com/watch?v=${videoId}`;
			}
		} catch (error) {
			this.log(`YouTube URL解析エラー: ${error}`);
		}

		// 解析に失敗した場合は元のURLを返す
		return url;
	}

	@bindThis
	private async genTextByGemini(aiChat: AiChat, files: base64File[], isChat: boolean): Promise<string | null> {
		this.log('Generate Text By Gemini...');
		let parts: GeminiParts = [];
		const now = new Date().toLocaleString('ja-JP', {
			timeZone: 'Asia/Tokyo',
			year: 'numeric',
			month: '2-digit',
			day: '2-digit',
			hour: '2-digit',
			minute: '2-digit',
		});
		let systemInstructionText =
			aiChat.prompt +
			'また、現在日時は' +
			now +
			'であり、これは回答の参考にし、絶対に時刻を聞かれるまで時刻情報は提供しないこと(なお、他の日時は無効とすること)。' +
			'絵文字については、Misskeyカスタム絵文字（:smile:, :heart:, :cry:, :angry:, :thinking:など）を使用してください。標準絵文字は使用しないでください。';
		if (aiChat.friendName != undefined) {
			systemInstructionText +=
				'なお、会話相手の名前は' + aiChat.friendName + 'とする。';
		}
		// ランダムトーク機能(利用者が意図(メンション)せず発動)の場合、ちょっとだけ配慮しておく
		if (!aiChat.fromMention) {
			systemInstructionText +=
				'これらのメッセージは、あなたに対するメッセージではないことを留意し、返答すること(会話相手は突然話しかけられた認識している)。';
		}
		
		// 感情的な質問や相談の場合はグラウンディングを無効化
		const emotionalKeywords = [
			'辛い', '苦しい', '悲しい', '寂しい', '死にたい', '消えたい', '生きる意味', '希望がない',
			'かまって', '愛して', '好き', '嫌い', '怒り', '不安', '怖い', '心配',
			'疲れた', '眠い', 'だるい', 'やる気がない', '無価値', 'ダメ', '失敗',
			'助けて', 'どうすれば', 'どうしたら', '困ってる', '悩んでる'
		];
		
		const isEmotionalQuestion = emotionalKeywords.some(keyword => 
			aiChat.question.includes(keyword)
		);
		
		if (isEmotionalQuestion) {
			this.log('Emotional question detected, disabling grounding');
			aiChat.grounding = false;
		}
		
		// グラウンディングについてもsystemInstructionTextに追記(こうしないとあまり使わないので)
		if (aiChat.grounding) {
			systemInstructionText += '返答のルール2:Google search with grounding.';
		}

		// URLから情報を取得
		let youtubeURLs: string[] = [];
		let hasYoutubeUrl = false;

		if (aiChat.question !== undefined) {
			const urlexp = RegExp("(https?://[a-zA-Z0-9!?/+_~=:;.,*&@#$%'-]+)", 'g');
			const urlarray = [...aiChat.question.matchAll(urlexp)];
			if (urlarray.length > 0) {
				for (const url of urlarray) {
					this.log('URL:' + url[0]);

					// YouTubeのURLの場合は特別処理
					if (this.isYoutubeUrl(url[0])) {
						this.log('YouTube URL detected: ' + url[0]);
						const normalizedUrl = this.normalizeYoutubeUrl(url[0]);
						this.log('Normalized YouTube URL: ' + normalizedUrl);
						youtubeURLs.push(normalizedUrl);
						hasYoutubeUrl = true;
						continue;
					}

					let result: unknown = null;
					try {
						result = await urlToJson(url[0]);
					} catch (err: unknown) {
						systemInstructionText +=
							'補足として提供されたURLは無効でした:URL=>' + url[0];
						this.log('Skip url becase error in urlToJson');
						continue;
					}
					const urlpreview: UrlPreview = result as UrlPreview;
					if (urlpreview.title) {
						systemInstructionText +=
							'補足として提供されたURLの情報は次の通り:URL=>' +
							urlpreview.url +
							'サイト名(' +
							urlpreview.sitename +
							')、';
						if (!urlpreview.sensitive) {
							systemInstructionText +=
								'タイトル(' +
								urlpreview.title +
								')、' +
								'説明(' +
								urlpreview.description +
								')、' +
								'質問にあるURLとサイト名・タイトル・説明を組み合わせ、回答の参考にすること。';
							this.log('urlpreview.sitename:' + urlpreview.sitename);
							this.log('urlpreview.title:' + urlpreview.title);
							this.log('urlpreview.description:' + urlpreview.description);
						} else {
							systemInstructionText +=
								'これはセンシティブなURLの可能性があるため、質問にあるURLとサイト名のみで、回答の参考にすること(使わなくても良い)。';
						}
					} else {
						// 多分ここにはこないが念のため
						this.log('urlpreview.title is nothing');
					}
				}
			}
		}

		let contents: GeminiContents[] = [];

		// 保存されたYouTubeのURLを会話履歴から取得
		if (aiChat.history && aiChat.history.length > 0) {
			// 忘却されていない履歴のみを使用
			const activeHistory = this.getActiveHistory(aiChat.history);
			this.log(`[aichat] 使用する履歴: ${activeHistory.length}件（忘却済み: ${aiChat.history.length - activeHistory.length}件）`);
			
			// historyの最初のユーザーメッセージをチェック
			const firstUserMessage = activeHistory.find(
				(entry) => entry.role === 'user'
			);
			if (firstUserMessage) {
				const urlexp = RegExp(
					"(https?://[a-zA-Z0-9!?/+_~=:;.,*&@#$%'-]+)",
					'g'
				);
				const urlarray = [...firstUserMessage.content.matchAll(urlexp)];

				for (const url of urlarray) {
					if (this.isYoutubeUrl(url[0])) {
						const normalizedUrl = this.normalizeYoutubeUrl(url[0]);
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

		// 人間らしい記憶システムを使用
		if (aiChat.memory) {
			const humanContext = this.generateHumanLikeContext(aiChat.memory);
			if (humanContext) {
				systemInstructionText += '\n\n' + humanContext;
				this.log(`[aichat] 人間らしい文脈を追加: ${humanContext.length}文字`);
			}
		}

		const systemInstruction: GeminiSystemInstruction = {
			role: 'system',
			parts: [{ text: systemInstructionText }],
		};

		// ファイルが存在する場合、ファイルを添付して問い合わせ
		parts = [{ text: aiChat.question }];

		// YouTubeのURLをfileDataとして追加
		for (const youtubeURL of youtubeURLs) {
			parts.push({
				fileData: {
					mimeType: 'video/mp4',
					fileUri: youtubeURL,
				},
			});
		}

		// 画像ファイルを追加
		if (files.length >= 1) {
			for (const file of files) {
				parts.push({
					inlineData: {
						mimeType: file.type,
						data: file.base64,
					},
				});
			}
		}

		contents.push({ role: 'user', parts: parts });

		let geminiOptions: GeminiOptions = {
			contents: contents,
			systemInstruction: systemInstruction,
		};

		// YouTubeURLがある場合はグラウンディングを無効化
		if (aiChat.grounding && !hasYoutubeUrl) {
			geminiOptions.tools = [{ google_search: {} }];
		}

		let options = {
			url: aiChat.api,
			searchParams: {
				key: aiChat.key,
			},
			json: geminiOptions,
		};
		this.log(JSON.stringify(options));
		let res_data: any = null;
		let responseText: string = '';
		try {
			res_data = await (got as any)
				.post(options.url, { searchParams: options.searchParams, json: options.json, parseJson: (res: string) => JSON.parse(res) })
				.json();
			this.log(JSON.stringify(res_data));
			if (res_data.hasOwnProperty('candidates')) {
				if (res_data.candidates?.length > 0) {
					// 結果を取得
					if (res_data.candidates[0].hasOwnProperty('content')) {
						if (res_data.candidates[0].content.hasOwnProperty('parts')) {
							for (
								let i = 0;
								i < res_data.candidates[0].content.parts.length;
								i++
							) {
								if (
									res_data.candidates[0].content.parts[i].hasOwnProperty('text')
								) {
									responseText += res_data.candidates[0].content.parts[i].text;
								}
							}
						}
					}
				}
				// groundingMetadataを取得
				let groundingMetadata = '';
				if (res_data.candidates[0].hasOwnProperty('groundingMetadata')) {
					// 参考サイト情報
					if (
						res_data.candidates[0].groundingMetadata.hasOwnProperty(
							'groundingChunks'
						)
					) {
						// 参考サイトが多すぎる場合があるので、3つに制限
						let checkMaxLength =
							res_data.candidates[0].groundingMetadata.groundingChunks.length;
						if (
							res_data.candidates[0].groundingMetadata.groundingChunks.length >
							3
						) {
							checkMaxLength = 3;
						}
						for (let i = 0; i < checkMaxLength; i++) {
							if (
								res_data.candidates[0].groundingMetadata.groundingChunks[
									i
								].hasOwnProperty('web')
							) {
								if (
									res_data.candidates[0].groundingMetadata.groundingChunks[
										i
									].web.hasOwnProperty('uri') &&
									res_data.candidates[0].groundingMetadata.groundingChunks[
										i
									].web.hasOwnProperty('title')
								) {
									groundingMetadata += `参考(${i + 1}): [${res_data.candidates[0].groundingMetadata.groundingChunks[i]
											.web.title
										}](${res_data.candidates[0].groundingMetadata.groundingChunks[i]
											.web.uri
										})\n`;
								}
							}
						}
					}
					// 検索ワード
					if (!isChat &&
						res_data.candidates[0].groundingMetadata.hasOwnProperty(
							'webSearchQueries'
						)
					) {
						const queries = res_data.candidates[0].groundingMetadata.webSearchQueries;
						if (Array.isArray(queries) && queries.length > 0) {
							groundingMetadata +=
								'検索ワード: ' +
								queries.join(',') +
								'\n';
						}
					}
				}
				responseText += groundingMetadata;
			}
		} catch (err: unknown) {
			this.log('Error By Call Gemini');
			let errorCode = null;
			let errorMessage = null;

			// HTTPErrorからエラーコードと内容を取得
			if (err && typeof err === 'object' && 'response' in err) {
				const httpError = err as any;
				errorCode = httpError.response?.statusCode;
				errorMessage = httpError.response?.statusMessage || httpError.message;
			}

			if (err instanceof Error) {
				this.log(`${err.name}\n${err.message}\n${err.stack}`);
			}

			// エラー情報を返す
			return null;
		}
		return responseText;
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
			const result = await this.handleAiChat(current, msg, false);
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

			// friendNameを取得（既存の処理をそのまま使用）
			const friend: Friend | null = this.ai.lookupFriend(msg.userId);
			let friendName: string | undefined;
			if (friend != null && friend.name != null) {
				friendName = friend.name;
			} else if (msg.user.name) {
				friendName = msg.user.name;
			} else {
				friendName = msg.user.username;
			}

			// 返信投稿を作成（既存の処理をそのまま使用）
			const result = await this.handleAiChat(current, msg, false);
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

		// friendNameを取得
		const friend: Friend | null = this.ai.lookupFriend(msg.userId);
		let friendName: string | undefined;
		if (friend != null && friend.name != null) {
			friendName = friend.name;
		} else if (msg.user.name) {
			friendName = msg.user.name;
		} else {
			friendName = msg.user.username;
		}

		if (msg.quoteId) {
			const quotedNote = await this.ai.api('notes/show', { noteId: msg.quoteId }) as any;
			current.memory = {
				conversations: [{
					id: 'quoted',
					timestamp: Date.now(),
					userMessage: quotedNote.text,
					aiResponse: '',
					context: 'quoted',
					importance: 7,
					isActive: true
				}],
				userProfile: {
					name: friendName || 'ユーザー',
					interests: [],
					conversationStyle: 'casual',
					lastInteraction: Date.now()
				},
				conversationContext: {
					currentTopic: '',
					mood: 'neutral',
					relationshipLevel: 5
				}
			};
		}

		// 返信投稿を作成（リアクションはMisskeyの仕様で自動的に作成される）
		const result = await this.handleAiChat(current, msg, false);
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
				msg.reply('藍チャットを終了しました。また何かあればお声がけくださいね！');
				return true;
			}
			return false;
		}
		// チャットモード中のみaichatが応答
		if (msg.isChat) {
			const exist = this.aichatHist.findOne({ isChat: true, chatUserId: msg.userId });
			if (!exist) return false;
			this.unsubscribeReply(key);
			this.aichatHist.remove(exist);
			const result = await this.handleAiChat(exist, msg);
			if (result) return { reaction: 'like' };
			return false;
		}

		let exist: AiChatHist | null = null;

		// チャットメッセージの場合
		if (msg.isChat) {
			exist = this.aichatHist.findOne({
				isChat: true,
				chatUserId: msg.userId,
			});
		} else {
			// 通常の会話継続の場合
			const conversationData = await this.ai.api('notes/conversation', { noteId: msg.id }) as any;

			if (Array.isArray(conversationData) && conversationData.length == 0) {
				this.log('conversationData is nothing.');
				return false;
			}

			for (const message of conversationData) {
				exist = this.aichatHist.findOne({ postId: message.id });
				if (exist != null) break;
			}
		}

		if (exist == null) {
			this.log('conversation context is not found.');
			return false;
		}

		this.unsubscribeReply(key);
		this.aichatHist.remove(exist);

		const result = await this.handleAiChat(exist, msg);

		if (result) {
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
				note.files.length == 0 &&
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

		if (choseNote.user.isBot) return false;

		const relation = await this.ai.api('users/relation', { userId: choseNote.userId }) as any;

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

		if (
			config.geminiAutoNoteProbability !== undefined &&
			!isNaN(Number.parseFloat(String(config.geminiAutoNoteProbability)))
		) {
			const probability = Number.parseFloat(
				String(config.geminiAutoNoteProbability)
			);
			if (Math.random() >= probability) {
				this.log(
					`Gemini自動ノート投稿の確率によりスキップされました: probability=${probability}`
				);
				return;
			}
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
	private async handleAiChat(exist: AiChatHist, msg: Message, skipReply: boolean = false) {
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

		const urlexp = RegExp("(https?://[a-zA-Z0-9!?/+_~=:;.,*&@#$%'-]+)", 'g');
		const urlarray = [...question.matchAll(urlexp)];
		if (urlarray.length > 0) {
			for (const url of urlarray) {
				if (this.isYoutubeUrl(url[0])) {
					const normalizedUrl = this.normalizeYoutubeUrl(url[0]);
					if (!youtubeUrls.includes(normalizedUrl)) {
						youtubeUrls.push(normalizedUrl);
					}
				}
			}
		}

		const friend: Friend | null = this.ai.lookupFriend(msg.userId);
		let friendName: string | undefined;
		if (friend != null && friend.name != null) {
			friendName = friend.name;
		} else if (msg.user.name) {
			friendName = msg.user.name;
		} else {
			friendName = msg.user.username;
		}

		if (!config.geminiApiKey) {
			msg.reply(serifs.aichat.nothing);
			return false;
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
		text = processEmojis(text, this.customEmojis);

		// handleAiChat内で、msg.isChatがtrueの場合はtext末尾の (gemini) #aichat などを除去
		if (msg.isChat && typeof text === 'string') {
			text = text.replace(/\n?\(gemini\) ?#aichat/g, '').replace(/#aichat/g, '').replace(/\(gemini\)/g, '');
		}

		// skipReplyがtrueの場合は返信投稿をスキップ
		if (skipReply) {
			this.log('Skipping reply due to skipReply flag');
			return true;
		}

		// msg.reply()を常に使用し、内部で適切なAPIが呼ばれるようにする
		msg.reply(serifs.aichat.post(text)).then((reply) => {
			// memoryシステムを使用した記憶管理
			if (!exist.memory) {
				exist.memory = {
					conversations: [],
					userProfile: {
						name: friendName || 'ユーザー',
						interests: [],
						conversationStyle: 'casual',
						lastInteraction: Date.now()
					},
					conversationContext: {
						currentTopic: '',
						mood: 'neutral',
						relationshipLevel: 5
					}
				};
			}

			// 新しい会話を記憶に追加
			const newConversation = {
				id: reply.id,
				userMessage: question,
				aiResponse: text
			};

			exist.memory = this.manageHumanLikeMemory(exist.memory, newConversation);

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
		});

		// チャットモードで、かつ最初のメッセージ（履歴が2つしかない）の場合に終了方法を教える
		if (msg.isChat && exist.history && exist.history.length <= 2) {
			setTimeout(() => {
				this.ai.sendMessage(msg.userId, {
					text: '💡 チャット中に「aichat 終了」「aichat 終わり」「aichat やめる」「aichat 止めて」のいずれかと送信すると会話を終了できます。',
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
			this.unsubscribeReply(data.userId);
		} else {
			exist = this.aichatHist.findOne({ postId: data.id });
			this.unsubscribeReply(data.id);
		}

		if (exist != null) {
			this.aichatHist.remove(exist);
		}
	}

	/**
	 * 会話履歴の部分忘却機能
	 * 履歴を削除するのではなく、インデックスのリンクを外して参照できなくする
	 */
	@bindThis
	private forgetHistory(history: any[], forgetCount: number = 3): any[] {
		if (!history || history.length <= forgetCount) return history;

		// 古い履歴から指定数分を忘却フラグを立てる
		for (let i = 0; i < forgetCount && i < history.length; i++) {
			if (history[i]) {
				history[i].isForgotten = true;
			}
		}

		return history;
	}

	/**
	 * 忘却された履歴を復元する
	 */
	@bindThis
	private restoreHistory(history: any[]): any[] {
		if (!history) return history;

		// 忘却フラグを外す
		history.forEach(item => {
			if (item && item.isForgotten) {
				item.isForgotten = false;
			}
		});

		return history;
	}

	/**
	 * 忘却されていない履歴のみを取得
	 */
	@bindThis
	private getActiveHistory(history: any[]): any[] {
		if (!history) return [];
		return history.filter(item => !item.isForgotten);
	}

	/**
	 * 履歴の管理（部分忘却を適用）
	 */
	@bindThis
	private manageHistory(history: any[], maxActiveHistory: number = 10): any[] {
		if (!history) {
			history = [];
		}

		// アクティブな履歴の数をチェック
		const activeHistory = this.getActiveHistory(history);
		
		if (activeHistory.length > maxActiveHistory) {
			// アクティブな履歴が上限を超えた場合、古いものを忘却
			const forgetCount = activeHistory.length - maxActiveHistory + 2; // 少し余裕を持たせる
			this.forgetHistory(history, forgetCount);
		}

		return history;
	}

	/**
	 * 人間らしい記憶管理システム
	 */
	@bindThis
	private manageHumanLikeMemory(memory: any, newConversation: any): any {
		if (!memory) {
			memory = {
				conversations: [],
				userProfile: {
					name: '',
					interests: [],
					conversationStyle: 'casual',
					lastInteraction: Date.now()
				},
				conversationContext: {
					currentTopic: '',
					mood: 'neutral',
					relationshipLevel: 5
				}
			};
		}

		// 新しい会話を追加
		memory.conversations.push({
			id: newConversation.id,
			timestamp: Date.now(),
			userMessage: newConversation.userMessage,
			aiResponse: newConversation.aiResponse,
			context: this.analyzeConversationContext(newConversation.userMessage),
			importance: this.calculateImportance(newConversation.userMessage),
			isActive: true
		});

		// 記憶の整理（重要度と時間に基づく）
		memory.conversations = this.organizeMemories(memory.conversations);
		
		// ユーザープロファイルの更新
		memory.userProfile.lastInteraction = Date.now();
		
		// 会話コンテキストの更新
		memory.conversationContext.currentTopic = this.extractCurrentTopic(newConversation.userMessage);
		memory.conversationContext.mood = this.analyzeMood(newConversation.userMessage);

		return memory;
	}

	/**
	 * 会話の文脈を分析（高度な分析）
	 */
	@bindThis
	private analyzeConversationContext(message: string): string {
		const context: string[] = [];
		
		// 感情分析（新しいanalyzeMoodメソッドを使用）
		const mood = this.analyzeMood(message);
		if (mood === 'happy') {
			context.push('positive_emotion');
		} else if (['sad', 'angry', 'anxious'].includes(mood)) {
			context.push('negative_emotion');
		}
		
		// 高度な話題分析
		const topicKeywords = {
			weather: ['天気', '雨', '晴れ', '曇り', '雪', '台風', '気温', '暑い', '寒い', '湿度'],
			work: ['仕事', '会社', '職場', '上司', '同僚', '会議', '残業', '給料', '転職', '就職'],
			hobby: ['趣味', '好き', '興味', 'ゲーム', '映画', '音楽', '読書', 'スポーツ', '料理', '旅行'],
			family: ['家族', '親', '子供', '兄弟', '姉妹', '夫', '妻', '結婚', '離婚', '育児'],
			friends: ['友達', '友人', '仲間', '彼氏', '彼女', 'デート', '恋愛', '片思い', '告白'],
			food: ['食べ物', '料理', 'レストラン', 'カフェ', 'お酒', '飲み会', 'グルメ', 'ダイエット'],
			health: ['健康', '病気', '病院', '薬', '痛い', '疲れ', 'ストレス', '睡眠', '運動'],
			technology: ['パソコン', 'スマホ', 'アプリ', 'プログラミング', 'AI', '機械学習', 'インターネット'],
			education: ['学校', '大学', '勉強', '試験', 'テスト', '宿題', '研究', '論文', '卒業'],
			money: ['お金', '貯金', '投資', '株', '保険', 'ローン', '借金', '節約', '浪費']
		};
		
		for (const [topic, keywords] of Object.entries(topicKeywords)) {
			if (keywords.some(keyword => message.includes(keyword))) {
				context.push(topic);
			}
		}
		
		// 会話の種類分析
		if (message.includes('？') || message.includes('?')) {
			context.push('question');
		}
		if (message.includes('！') || message.includes('!')) {
			context.push('exclamation');
		}
		if (message.includes('...') || message.includes('…')) {
			context.push('hesitation');
		}
		
		return context.join(',') || 'general';
	}

	/**
	 * メッセージの重要度を計算（高度な分析）
	 */
	@bindThis
	private calculateImportance(message: string): number {
		let importance = 5; // デフォルト重要度
		
		// 感情分析を利用
		const mood = this.analyzeMood(message);
		if (mood === 'happy') importance += 2;
		if (mood === 'sad') importance += 3;
		if (mood === 'angry') importance += 3;
		if (mood === 'anxious') importance += 2;
		
		// 質問は重要
		if (message.includes('？') || message.includes('?')) {
			importance += 2;
		}
		
		// 個人的な内容は重要
		if (message.includes('私') || message.includes('僕') || message.includes('俺') || message.includes('自分')) {
			importance += 2;
		}
		
		// 緊急度の高い内容
		if (message.includes('急いで') || message.includes('すぐ') || message.includes('今すぐ') || message.includes('助けて')) {
			importance += 3;
		}
		
		// 長いメッセージは重要
		if (message.length > 50) {
			importance += 1;
		}
		if (message.length > 100) {
			importance += 1;
		}
		
		// 絵文字の使用（感情表現）
		const emojiCount = (message.match(/:[a-zA-Z_]+:/g) || []).length;
		if (emojiCount > 0) {
			importance += Math.min(emojiCount, 2);
		}
		
		// 強調表現
		if (message.includes('！') || message.includes('!')) {
			importance += 1;
		}
		if (message.includes('すごく') || message.includes('とても') || message.includes('めちゃくちゃ')) {
			importance += 1;
		}
		
		return Math.min(importance, 10);
	}

	/**
	 * 記憶を整理（重要度と時間に基づく）
	 */
	@bindThis
	private organizeMemories(conversations: any[]): any[] {
		const now = Date.now();
		const oneDay = 24 * 60 * 60 * 1000;
		const oneWeek = 7 * oneDay;
		
		// 重要度と時間に基づいてアクティブ状態を更新
		conversations.forEach(conv => {
			const age = now - conv.timestamp;
			
			// 1週間以上前で重要度が低いものは非アクティブ
			if (age > oneWeek && conv.importance < 6) {
				conv.isActive = false;
			}
			
			// 1日以上前で重要度が非常に低いものは非アクティブ
			if (age > oneDay && conv.importance < 4) {
				conv.isActive = false;
			}
		});
		
		// アクティブな記憶を最大20個まで保持
		const activeMemories = conversations.filter(c => c.isActive);
		if (activeMemories.length > 20) {
			// 重要度が低いものから削除
			activeMemories.sort((a, b) => a.importance - b.importance);
			const toDeactivate = activeMemories.slice(0, activeMemories.length - 20);
			toDeactivate.forEach(m => m.isActive = false);
		}
		
		return conversations;
	}

	/**
	 * 現在の話題を抽出
	 */
	@bindThis
	private extractCurrentTopic(message: string): string {
		const topicKeywords = {
			weather: ['天気', '雨', '晴れ', '曇り', '雪', '台風', '気温', '暑い', '寒い', '湿度'],
			work: ['仕事', '会社', '職場', '上司', '同僚', '会議', '残業', '給料', '転職', '就職'],
			hobby: ['趣味', '好き', '興味', 'ゲーム', '映画', '音楽', '読書', 'スポーツ', '料理', '旅行'],
			family: ['家族', '親', '子供', '兄弟', '姉妹', '夫', '妻', '結婚', '離婚', '育児'],
			friends: ['友達', '友人', '仲間', '彼氏', '彼女', '恋人', 'デート', '飲み会', 'サークル'],
			food: ['食べ物', '料理', 'レストラン', 'カフェ', 'お酒', '甘い', '辛い', '美味しい', 'まずい'],
			technology: ['パソコン', 'スマホ', 'アプリ', 'プログラミング', 'AI', '機械学習', 'インターネット'],
			health: ['健康', '病気', '病院', '薬', 'ダイエット', '運動', '睡眠', 'ストレス', '疲れ'],
			money: ['お金', '貯金', '投資', '株', '保険', 'ローン', '節約', '浪費', '給料', '副業'],
			education: ['学校', '大学', '勉強', '試験', 'テスト', '宿題', '研究', '論文', '卒業', '入学']
		};
		
		for (const [topic, keywords] of Object.entries(topicKeywords)) {
			if (keywords.some(keyword => message.includes(keyword))) {
				return topic;
			}
		}
		
		return 'general';
	}

	/**
	 * メッセージの感情を分析（高度な分析）
	 */
	@bindThis
	private analyzeMood(message: string): string {
		// Misskeyカスタム絵文字の感情分析
		const emojiSentiments = {
			// ポジティブ系
			':smile:': 'happy', ':grin:': 'happy', ':laughing:': 'happy', ':joy:': 'happy',
			':heart:': 'happy', ':heart_eyes:': 'happy', ':blush:': 'happy', ':wink:': 'happy',
			':ok_hand:': 'happy', ':thumbsup:': 'happy', ':clap:': 'happy', ':tada:': 'happy',
			':sparkles:': 'happy', ':star:': 'happy', ':rainbow:': 'happy', ':sunny:': 'happy',
			
			// ネガティブ系
			':cry:': 'sad', ':sob:': 'sad', ':broken_heart:': 'sad', ':disappointed:': 'sad',
			':rage:': 'angry', ':angry:': 'angry', ':punch:': 'angry', ':middle_finger:': 'angry',
			':fearful:': 'anxious', ':worried:': 'anxious', ':cold_sweat:': 'anxious', ':sweat:': 'anxious',
			
			// その他
			':thinking:': 'neutral', ':neutral_face:': 'neutral', ':expressionless:': 'neutral'
		};

		// 絵文字の感情をチェック
		for (const [emoji, sentiment] of Object.entries(emojiSentiments)) {
			if (message.includes(emoji)) {
				return sentiment;
			}
		}

		// 高度なキーワード分析
		const sentimentKeywords = {
			happy: [
				'嬉しい', '楽しい', '幸せ', '最高', '素晴らしい', '感動', '感激', '興奮',
				'ワクワク', 'ドキドキ', 'やったー', 'よっしゃ', 'やった', '成功', '達成',
				'感謝', 'ありがとう', '愛してる', '大好き', '完璧', '理想'
			],
			sad: [
				'悲しい', '辛い', '苦しい', '切ない', '寂しい', '孤独', '絶望', '失望',
				'落ち込む', '凹む', 'しんどい', '疲れた', '死にたい', '消えたい', '終わり',
				'諦める', '無理', 'ダメ', '失敗', '後悔', '申し訳ない', 'ごめん'
			],
			angry: [
				'怒', 'イライラ', '腹立つ', 'ムカつく', 'キレる', '許せない', '最悪',
				'クソ', 'うざい', 'うるさい', 'しつこい', 'めんどくさい', 'やだ',
				'嫌い', '大嫌い', '消えろ', '死ね', '殺す', 'ぶっ殺す', '殴る'
			],
			anxious: [
				'不安', '心配', '怖い', '恐い', '緊張', 'ドキドキ', 'ハラハラ',
				'焦る', '急ぐ', '間に合わない', 'やばい', 'まずい', '危険',
				'大変', '困る', 'どうしよう', '助けて', '助け', '救い'
			]
		};

		// 感情スコアを計算
		const scores = { happy: 0, sad: 0, angry: 0, anxious: 0, neutral: 0 };
		
		for (const [sentiment, keywords] of Object.entries(sentimentKeywords)) {
			for (const keyword of keywords) {
				const count = (message.match(new RegExp(keyword, 'g')) || []).length;
				scores[sentiment as keyof typeof scores] += count * 2; // キーワードは重み2
			}
		}

		// 文脈分析（否定語、強調語の考慮）
		const negationWords = ['ない', 'ません', 'じゃない', 'ではない', '違う', 'ちがう'];
		const emphasisWords = ['すごく', 'とても', 'めちゃくちゃ', '超', '激', '死ぬほど', 'マジで'];
		
		// 否定語の処理（より自然な方法）
		const hasNegation = negationWords.some(word => message.includes(word));
		const hasEmphasis = emphasisWords.some(word => message.includes(word));
		
		if (hasNegation) {
			// 否定語がある場合、ポジティブな感情を減らし、ネガティブな感情を増やす
			scores.happy = Math.max(0, scores.happy - 2);
			scores.sad = scores.sad + 1;
			scores.anxious = scores.anxious + 1;
		}
		
		if (hasEmphasis) {
			// 強調語がある場合は感情スコアを倍増
			Object.keys(scores).forEach(key => {
				if (key !== 'neutral') {
					scores[key as keyof typeof scores] *= 1.5;
				}
			});
		}

		// 最高スコアの感情を返す
		const maxScore = Math.max(...Object.values(scores));
		if (maxScore === 0) return 'neutral';
		
		for (const [sentiment, score] of Object.entries(scores)) {
			if (score === maxScore) {
				return sentiment;
			}
		}
		
		return 'neutral';
	}

	/**
	 * 人間らしい文脈を生成（高度な分析）
	 */
	@bindThis
	private generateHumanLikeContext(memory: any): string {
		if (!memory || !memory.conversations) {
			return '';
		}
		
		const activeMemories = memory.conversations.filter((c: any) => c.isActive);
		if (activeMemories.length === 0) {
			return '';
		}
		
		// 最近の会話（最大5個）を自然な文脈として生成
		const recentMemories = activeMemories
			.sort((a: any, b: any) => b.timestamp - a.timestamp)
			.slice(0, 5);
		
		let context = '';
		if (memory.userProfile?.name) {
			context += `${memory.userProfile.name}さんとの過去の会話を参考にしてください。\n\n`;
		}
		
		context += '過去の会話の流れ：\n';
		recentMemories.forEach((mem: any, index: number) => {
			const date = new Date(mem.timestamp).toLocaleDateString('ja-JP');
			context += `${index + 1}. [${date}] ${mem.userMessage} → ${mem.aiResponse}\n`;
		});
		
		if (memory.conversationContext?.currentTopic && memory.conversationContext.currentTopic !== 'general') {
			context += `\n現在の話題: ${memory.conversationContext.currentTopic}\n`;
		}
		
		if (memory.conversationContext?.mood && memory.conversationContext.mood !== 'neutral') {
			const moodLabels = {
				'happy': '嬉しい',
				'sad': '悲しい', 
				'angry': '怒っている',
				'anxious': '不安・心配',
				'neutral': '普通'
			};
			context += `相手の気分: ${moodLabels[memory.conversationContext.mood as keyof typeof moodLabels]}\n`;
		}
		
		return context;
	}
}
