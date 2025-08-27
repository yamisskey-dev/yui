import { bindThis } from '@/decorators.js';
import Module from '@/module.js';
import serifs from '@/serifs.js';
import { genItem } from '@/vocabulary.js';
import config from '@/config.js';
import axios from 'axios';
import { weather_phrases } from '@/serifs.js';
import got from 'got';
import { processEmojis, loadCustomEmojis } from '@/utils/emoji-selector.js';
import { getEmojiListForAI, selectEmoji, fetchEmojis, emojiMapping } from '@/utils/emoji-selector.js';

// TODO: Notingモジュール改善計画
// - 実装: 複数の天気APIサポートとフォールバック機能
// - 実装: 地域別の天気対応と個別設定
// - パフォーマンス: メモリ使用量の最適化
// - 機能: 週間天気予報を考慮した先読み投稿
// - 機能: ユーザー設定による投稿内容カスタマイズ
// - 機能: 気象警報・注意報の自動通知
// - 分析: 天気履歴の可視化・統計機能
// - 監視: API可用性の監視とアラート

export default class extends Module {
	public readonly name = 'noting';

	// 天気履歴を日付ごとに最大7日分保存（最新7日分のみ保持）
	private weatherHistoryByDate: Record<string, any> = {};
	// 天気note投稿履歴（日付ごとに投稿したphraseKeyを記録。同じ現象は1日1回のみ投稿）
	private weatherNoteHistory: Record<string, string[]> = {};

	@bindThis
	public install() {
		this.log('[noting] install() called');
		if (config.notingEnabled === "false") return {};

		// 起動時に必ず1回投稿し、その後ランダム間隔で定期投稿をスケジューリング
		setTimeout(() => {
			try {
				this.log('[noting] setTimeout: calling post(forcePost=true)');
				this.post(true).then(() => {
					this.log('[noting] 起動時post()呼び出し完了');
					// 起動時の投稿後、次の投稿時刻を設定
					this.scheduleNextPost();
				}).catch(e => this.log('[noting] post() error: ' + e));
			} catch (e) {
				this.log('[noting] setTimeout error: ' + e);
			}
		}, 0);

		this.log('[noting] install() finished');
		return {};
	}

	@bindThis
	private async fetchWeatherWithRetry(retryCount = 3): Promise<any> {
		// 天気APIを最大3回リトライ。失敗時は管理者にDM通知。
		for (let i = 0; i < retryCount; i++) {
			try {
				const res = await axios.get('https://weather.tsukumijima.net/api/forecast/city/400010');
				return res.data;
			} catch (e) {
				this.log(`天気APIの取得に失敗しました (リトライ${i + 1}/${retryCount}): ` + e);
				if (i === retryCount - 1) {
					// 最終失敗時は管理者にDM通知
					if (config.master) {
						try {
							await this.ai.sendMessage(config.master, {
								text: '[noting] 天気APIの取得に3回失敗しました。ネットワークやAPI障害の可能性があります。'
							});
							this.log('[noting] 管理者に天気API障害を通知しました');
						} catch (notifyErr) {
							this.log('[noting] 管理者への通知にも失敗: ' + notifyErr);
						}
					}
				}
				await new Promise(res => setTimeout(res, 2000)); // 2秒待機してリトライ
			}
		}
		return null;
	}

	@bindThis
	private async post(forcePost = false) {
		try {
			this.log(`[noting] post() called at ${new Date().toISOString()} forcePost=${forcePost}`);
		const now = new Date();
			const todayStr = now.toISOString().slice(0, 10); // YYYY-MM-DD
			const month = now.getMonth() + 1;
		// 季節判定
		let season: 'spring' | 'summer' | 'autumn' | 'winter';
		if (month >= 3 && month <= 5) {
			season = 'spring';
		} else if (month >= 6 && month <= 8) {
			season = 'summer';
		} else if (month >= 9 && month <= 11) {
			season = 'autumn';
		} else {
			season = 'winter';
		}

			// 時間帯判定
			const hour = now.getHours();
			let timeOfDay: 'morning' | 'afternoon' | 'evening' | 'night' | 'late_night';
			if (hour >= 5 && hour < 12) {
				timeOfDay = 'morning';
			} else if (hour >= 12 && hour < 17) {
				timeOfDay = 'afternoon';
			} else if (hour >= 17 && hour < 21) {
				timeOfDay = 'evening';
			} else if (hour >= 21 || hour < 5) {
				timeOfDay = 'night';
			} else {
				timeOfDay = 'late_night';
			}

			this.log(`[noting] Time of day: ${timeOfDay} (hour: ${hour})`);

			this.log('[noting] Fetching weather...');
			const weather = await this.fetchWeatherWithRetry();
			if (!weather) {
				this.log('[noting] Weather fetch failed, aborting post.');
				return;
			}
			this.log(`[noting] Weather fetched: ${JSON.stringify(weather)}`);

			// === 履歴を日付ごとに保存（最大7日分） ===
			this.weatherHistoryByDate[todayStr] = weather;
			// 7日以上前の履歴を削除
			const dates = Object.keys(this.weatherHistoryByDate).sort();
			while (dates.length > 7) {
				const oldest = dates.shift();
				if (oldest) delete this.weatherHistoryByDate[oldest];
			}

			// 履歴配列を作成（新しい順）
			const weatherHistoryArr = Object.values(this.weatherHistoryByDate).slice(-7);

			// --- 天気状況判定ロジック（時間帯・季節・気温・telop/detailを考慮） ---
			let phraseKey = '';
			let phraseVars: Record<string, any> = {};
			const today = weather.forecasts[0];
			const yesterday = weatherHistoryArr.length > 1 ? weatherHistoryArr[weatherHistoryArr.length-2].forecasts[0] : null;

			this.log(`[noting] today.telop=${today.telop}, yesterday.telop=${yesterday ? yesterday.telop : 'N/A'}`);

			// === 新しい天候・季節イベントの判定 ===
			// ここから下は各現象ごとに分岐。今後も拡張しやすいように記述。
			// 台風
			if (today.telop.includes('台風') || today.detail.weather.includes('台風')) {
				phraseKey = 'typhoon';
			}
			// 大雪
			else if (today.telop.includes('大雪') || today.detail.weather.includes('大雪') || (today.telop.includes('雪') && today.detail.weather.includes('警報'))) {
				phraseKey = 'heavy_snow';
			}
			// 猛暑日（最高気温35℃以上）
			else if (today.temperature.max && parseInt(today.temperature.max.celsius) >= 35) {
				phraseKey = 'extreme_heat';
			}
			// 桜（3月下旬〜4月上旬、晴れ or 曇り）
			else if ((month === 3 && now.getDate() >= 20) || (month === 4 && now.getDate() <= 10)) {
				if (today.telop.includes('晴') || today.telop.includes('曇')) {
					phraseKey = 'cherry_blossom';
				}
			}
			// 花粉（3月〜4月、晴れ or 風強い）
			else if ((month === 3 || month === 4) && (today.telop.includes('晴') || today.detail.weather.includes('風'))) {
				phraseKey = 'pollen';
			}
			// 黄砂（春、telopやdetailに黄砂）
			else if ((month >= 3 && month <= 5) && (today.telop.includes('黄砂') || today.detail.weather.includes('黄砂'))) {
				phraseKey = 'yellow_sand';
			}
			// 雷雨
			else if ((today.telop.includes('雷') || today.detail.weather.includes('雷')) && today.telop.includes('雨')) {
				phraseKey = 'thunderstorm';
			}
			// 霜（11月〜3月、最低気温0℃以下）
			else if ((month >= 11 || month <= 3) && today.temperature.min && today.temperature.min.celsius && parseInt(today.temperature.min.celsius) <= 0) {
				phraseKey = 'frost';
			}
			// 虹（雨明け晴れ、かつtelopやdetailに虹）
			else if ((yesterday && yesterday.telop.includes('雨') && today.telop.includes('晴')) && (today.detail.weather.includes('虹') || today.telop.includes('虹'))) {
				phraseKey = 'rainbow';
			}

			// 連続雨（過去3日間）
			if (weatherHistoryArr.slice(-3).every(w => w.forecasts[0].telop.includes('雨'))) {
				phraseKey = 'consecutive_rain';
				phraseVars = { days: weatherHistoryArr.slice(-3).length };
			}
			// 雨明け晴れ
			else if (yesterday && yesterday.telop.includes('雨') && today.telop.includes('晴')) {
				const days = weatherHistoryArr.slice().reverse().findIndex(w => !w.forecasts[0].telop.includes('雨'));
				phraseKey = 'sun_after_long_rain';
				phraseVars = { days };
			}
			// 急な暑さ
			else if (yesterday && today.temperature.max && yesterday.temperature.max && parseInt(today.temperature.max.celsius) - parseInt(yesterday.temperature.max.celsius) >= 5) {
				phraseKey = 'sudden_heat';
				phraseVars = { temp_diff: parseInt(today.temperature.max.celsius) - parseInt(yesterday.temperature.max.celsius) };
			}
			// 純粋に暑い日（最高気温30℃以上）
			else if (today.temperature.max && parseInt(today.temperature.max.celsius) >= 30) {
				phraseKey = 'hot_day';
			}
			// 急な寒さ
			else if (yesterday && today.temperature.max && yesterday.temperature.max && parseInt(yesterday.temperature.max.celsius) - parseInt(today.temperature.max.celsius) >= 5) {
				phraseKey = 'sudden_cold';
				phraseVars = { temp_diff: parseInt(yesterday.temperature.max.celsius) - parseInt(today.temperature.max.celsius) };
			}
			// 快晴（時間帯別）
			else if (today.telop.includes('晴') && !today.telop.includes('雨') && !today.telop.includes('曇')) {
				if (timeOfDay === 'morning') {
					phraseKey = 'perfect_clear_sky_morning';
				} else if (timeOfDay === 'afternoon') {
					phraseKey = 'perfect_clear_sky_afternoon';
				} else if (timeOfDay === 'evening') {
					phraseKey = 'perfect_clear_sky_evening';
				} else if (timeOfDay === 'night') {
					phraseKey = 'perfect_clear_sky_night';
				} else {
					phraseKey = 'perfect_clear_sky';
				}
			}
			// 曇天（時間帯別）
			else if (today.telop.includes('曇') && !today.telop.includes('晴') && !today.telop.includes('雨')) {
				if (timeOfDay === 'morning') {
					phraseKey = 'heavy_clouds_morning';
				} else if (timeOfDay === 'afternoon') {
					phraseKey = 'heavy_clouds_afternoon';
				} else if (timeOfDay === 'evening') {
					phraseKey = 'heavy_clouds_evening';
				} else if (timeOfDay === 'night') {
					phraseKey = 'heavy_clouds_night';
				} else {
					phraseKey = 'heavy_clouds';
				}
			}
			// 雨
			else if (today.telop.includes('雨')) {
				phraseKey = 'drizzle';
			}
			// デフォルト
			else {
				// 既存パターンに該当しない場合は、AIに未知・珍しい・説明が難しい天気として状況を説明し、柔軟なnoteを生成させる
				phraseKey = 'unknown_weather';
			}

			this.log(`[noting] 判定されたphraseKey=${phraseKey}, phraseVars=${JSON.stringify(phraseVars)}`);

			// === 1日2回同じ現象noteを投稿しない ===
			if (!this.weatherNoteHistory[todayStr]) {
				this.weatherNoteHistory[todayStr] = [];
			}
			if (!forcePost && this.weatherNoteHistory[todayStr].includes(phraseKey)) {
				this.log(`[noting] 本日すでに${phraseKey}でnote投稿済みのためスキップ`);
				return;
			}
			// forcePost=false時は50%の確率で投稿
			if (!forcePost) {
				const rand = Math.random();
				if (rand >= 0.5) {
					this.log(`[noting] 確率判定でスキップ (rand=${rand})`);
					return;
				}
				this.log(`[noting] 確率判定で投稿 (rand=${rand})`);
			}
			this.weatherNoteHistory[todayStr].push(phraseKey);

			let situation = '';
			let keywords: string[] = [];
			if (phraseKey === 'unknown_weather') {
				// 未知・説明困難な天気はAIに柔軟なnote生成を指示
				situation = `今日は珍しい天気（API情報: telop=${today.telop}, 詳細=${today.detail.weather}）。どんな天気か説明が難しいけど、今の空や気分を自由に表現してみて。`;
				keywords = [today.telop, today.detail.weather, '珍しい', '未知', '説明が難しい', '空', '気分'];
			} else {
				const phrase = weather_phrases[phraseKey] || weather_phrases['perfect_weather_day'];
				situation = phrase.situation.replace(/\{(\w+)\}/g, (_, k) => phraseVars[k] ?? '');
				keywords = phrase.keywords;
			}

			this.log(`[noting] Gemini入力: situation=${situation}, keywords=${JSON.stringify(keywords)}`);

			const geminiNote = await this.generateNoteWithGemini({
				weather: today,
				situation,
				keywords
			});

			this.log(`[noting] Gemini生成note: ${geminiNote}`);

				// 投稿前に:emoji:→Unicode/カスタム絵文字変換
				const customEmojis = await loadCustomEmojis(this.ai.api.bind(this.ai), this.log.bind(this));
				const processedNote = processEmojis(geminiNote, customEmojis);
			try {
				await this.ai.post({
					text: processedNote
				});
				this.log('[noting] note投稿成功');
			} catch (e) {
				this.log('[noting] note投稿エラー: ' + e);
			}
			this.log('[noting] post() 完了');
		} catch (e) {
			this.log('[noting] post() top-level error: ' + e);
		}
	}

	@bindThis
	private scheduleNextPost() {
		// 12〜36時間の乱数で次の投稿時刻を決定し、setTimeoutで再帰的にスケジューリング
		const minHours = 12;
		const maxHours = 36;
		const randomHours = Math.floor(Math.random() * (maxHours - minHours + 1)) + minHours;
		const nextIntervalMs = randomHours * 60 * 60 * 1000;
		
		this.log(`[noting] 次の投稿を${randomHours}時間後（${new Date(Date.now() + nextIntervalMs).toLocaleString('ja-JP')}）に予約`);
		
		setTimeout(() => {
			try {
				this.log('[noting] scheduled post: calling post(forcePost=false)');
				this.post(false).then(() => {
					this.log('[noting] 定期post()呼び出し完了');
					// 投稿後、次の投稿時刻を再設定
					this.scheduleNextPost();
				}).catch(e => this.log('[noting] post() error: ' + e));
			} catch (e) {
				this.log('[noting] scheduled post error: ' + e);
			}
		}, nextIntervalMs);
	}

	private async generateNoteWithGemini({ weather, situation, keywords }) {
		// Misskeyカスタム絵文字リストを取得
		const emojiList = await getEmojiListForAI();
		
		// Gemini API本実装
		const prompt = config.autoNotePrompt || config.prompt || 'あなたはMisskeyの女の子AI「唯」として振る舞い、天気や気温、空模様に合わせて自然な一言noteを生成してください。280文字以内。';
		const now = new Date();
		const nowStr = now.toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
		
		// 時間帯判定
		const hour = now.getHours();
		let timeOfDayStr = '';
		if (hour >= 5 && hour < 12) {
			timeOfDayStr = '朝';
		} else if (hour >= 12 && hour < 17) {
			timeOfDayStr = 'お昼';
		} else if (hour >= 17 && hour < 21) {
			timeOfDayStr = '夕方';
		} else if (hour >= 21 || hour < 5) {
			timeOfDayStr = '夜';
		} else {
			timeOfDayStr = '深夜';
		}
		
		const systemInstructionText = `${prompt}\n現在日時は${nowStr}（${timeOfDayStr}）。天気情報・状況・キーワードを参考に、${timeOfDayStr}の時間帯にふさわしい自然なnoteを生成してください。夜の時間帯では「ピクニック」や「外に出たい」などの表現は避けてください。

【重要】絵文字の使用について：
- Unicode絵文字（😀、🌞、🌧️など）は一切使用しないでください
- 代わりに、以下のMisskeyカスタム絵文字リストから適切なものを選んで使用してください
- 絵文字は「:絵文字名:」の形式で使用してください（例: :niko:、:blobsmile:）
- 天気や気分に応じて、自然に1-2個の絵文字を挿入してください
- 必ず以下のリストに含まれる絵文字のみを使用してください。リストにない絵文字は使用しないでください

【使用可能なMisskeyカスタム絵文字一覧】
${emojiList}`;
		const userContent = `【天気情報】\n- 天気: ${weather.telop}\n- 詳細: ${weather.detail.weather}\n- 最高気温: ${weather.temperature.max?.celsius ?? '不明'}℃\n- 最低気温: ${weather.temperature.min?.celsius ?? '不明'}℃\n- 降水確率: ${Object.entries(weather.chanceOfRain).map(([k,v])=>`${k}:${v}`).join(' ')}\n【時間帯】\n${timeOfDayStr}\n【状況】\n${situation}\n【キーワード】\n${keywords.join('、')}`;
		const geminiModel = config.geminiModel || 'gemini-2.0-flash-exp';
		const GEMINI_API = `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent`;
		const apiKey = config.geminiApiKey;
		const geminiOptions = {
			contents: [
				{ role: 'user', parts: [{ text: userContent }] }
			],
			systemInstruction: { role: 'system', parts: [{ text: systemInstructionText }] }
		};
		try {
			const res: any = await got.post(GEMINI_API, {
				searchParams: { key: apiKey },
				json: geminiOptions
			}).json();
			if (res && res.candidates && Array.isArray(res.candidates) && res.candidates[0] && res.candidates[0].content && res.candidates[0].content.parts && res.candidates[0].content.parts[0].text) {
				let generatedNote = res.candidates[0].content.parts[0].text.trim();
				
				// AIが絵文字を使わなかった場合、天気に応じた絵文字を自動追加
				if (!generatedNote.includes(':')) {
					let weatherEmoji = '';
					// ポジティブ・ネガティブ判定
					const positiveWords = ['美味', '楽しい', '嬉しい', '幸せ', 'まったり', 'ほっこり', 'ご飯', '好き', '最高', 'いい', '素敵', '快適', '晴れ', '元気', '笑', '癒し'];
					const negativeWords = ['雨', '寒い', '悲しい', 'つらい', 'しんどい', '寂しい', '疲れ', 'どんより', '憂鬱', 'やだ', '嫌', '困る', '大変', '苦しい', '泣', '曇', '不安'];
					const text = generatedNote;
					let mood: 'positive' | 'negative' | 'neutral' = 'neutral';
					if (positiveWords.some(w => text.includes(w))) mood = 'positive';
					else if (negativeWords.some(w => text.includes(w))) mood = 'negative';
					// 絵文字選択
					if (mood === 'positive') {
						weatherEmoji = await selectEmoji('happy');
					} else if (mood === 'negative') {
						weatherEmoji = await selectEmoji('rainy');
					} else {
						weatherEmoji = await selectEmoji('default');
					}
					// note内に既に同じ絵文字が含まれていれば追加しない
					if (!generatedNote.includes(weatherEmoji)) {
						generatedNote += ` ${weatherEmoji}`;
					}
				} else {
					// AIが絵文字を使った場合、存在しない絵文字を置換
					const emojis = await fetchEmojis();
					const existingEmojiNames = emojis.map(e => e.name);
					const emojiRegex = /:([^:]+):/g;
					let usedEmojis: string[] = [];
					generatedNote = generatedNote.replace(emojiRegex, (match, emojiName) => {
						if (existingEmojiNames.includes(emojiName)) {
							if (usedEmojis.includes(emojiName)) return '';
							usedEmojis.push(emojiName);
							return match;
						} else {
							// 存在しない絵文字は感情に応じて置換
							const positiveWords = ['美味', '楽しい', '嬉しい', '幸せ', 'まったり', 'ほっこり', 'ご飯', '好き', '最高', 'いい', '素敵', '快適', '晴れ', '元気', '笑', '癒し'];
							const negativeWords = ['雨', '寒い', '悲しい', 'つらい', 'しんどい', '寂しい', '疲れ', 'どんより', '憂鬱', 'やだ', '嫌', '困る', '大変', '苦しい', '泣', '曇', '不安'];
							const text = generatedNote;
							let mood: 'positive' | 'negative' | 'neutral' = 'neutral';
							if (positiveWords.some(w => text.includes(w))) mood = 'positive';
							else if (negativeWords.some(w => text.includes(w))) mood = 'negative';
							if (mood === 'positive') return ':blobsmile:';
							if (mood === 'negative') return ':ablob_sadrain:';
							return ':niko:';
						}
					});
				}
				
				// note内で同じ絵文字が複数回使われていたら、同カテゴリの未使用絵文字に置換
				const emojiRegex = /:([^:]+):/g;
				let match;
				let usedEmojis: string[] = [];
				let replacedNote = generatedNote;
				while ((match = emojiRegex.exec(generatedNote)) !== null) {
					const emojiName = match[1];
					if (usedEmojis.includes(emojiName)) {
						// 同カテゴリの未使用絵文字を探す
						const category = Object.entries(emojiMapping).find(([_, arr]) => (arr as string[]).includes(emojiName));
						if (category) {
							const [cat, arr] = category;
							const candidates = (arr as string[]).filter(e => !usedEmojis.includes(e));
							if (candidates.length > 0) {
								const newEmoji = candidates[Math.floor(Math.random() * candidates.length)];
								replacedNote = replacedNote.replace(`:${emojiName}:`, `:${newEmoji}:`);
								usedEmojis.push(newEmoji);
							} // 使い切ったらそのまま
						}
					} else {
						usedEmojis.push(emojiName);
					}
				}
				generatedNote = replacedNote;
				
				return generatedNote;
			}
			return '[Gemini応答なし]';
		} catch (e) {
			this.log('Gemini APIエラー: ' + e);
			return '[Gemini APIエラー]';
		}
	}

	// テスト用: 任意の天気データでnote生成を試す
	public async testWeatherNoteGen(testWeather) {
		const phraseKey = 'perfect_clear_sky';
		const phrase = weather_phrases[phraseKey];
		const situation = phrase.situation;
		const keywords = phrase.keywords;
		const note = await this.generateNoteWithGemini({ weather: testWeather, situation, keywords });
		console.log('=== Gemini生成noteテスト ===');
		console.log(note);
		return note;
	}
}
