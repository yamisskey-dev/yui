import { bindThis } from '@/decorators.js';
import Module from '@/module.js';
import config from '@/config.js';
import axios from 'axios';
import got from 'got';
import { weather_phrases } from '@/serifs.js';
import { processEmojis, getEmojiListForAI, selectEmoji, getCachedEmojis, emojiMapping } from '@/utils/emoji-selector.js';
import { determinePhraseKey, timeOfDayOf, ForecastSummary, TimeOfDay } from './phrase.js';

// つくもAPI（livedoor 天気互換）のレスポンスのうち利用する部分
interface WeatherForecast {
	telop: string;
	detail: { weather: string | null };
	temperature: {
		max: { celsius: string | null } | null;
		min: { celsius: string | null } | null;
	};
	chanceOfRain: Record<string, string>;
}
interface WeatherResponse {
	forecasts: WeatherForecast[];
}

const WEATHER_CITY_CODE_DEFAULT = '400010'; // 久留米
const WEATHER_RETRY_COUNT = 3;
const WEATHER_RETRY_DELAY_MS = 2000;
const HISTORY_DAYS = 7;
const POST_MIN_INTERVAL_HOURS = 12;
const POST_MAX_INTERVAL_HOURS = 36;
const POST_PROBABILITY = 0.5;
const STARTUP_POST_DELAY_MS = 1000 * 10;
const GEMINI_TIMEOUT_MS = 1000 * 60;

const TIME_OF_DAY_LABELS: Record<TimeOfDay, string> = {
	morning: '朝',
	afternoon: 'お昼',
	evening: '夕方',
	night: '夜',
};

const POSITIVE_WORDS = ['美味', '楽しい', '嬉しい', '幸せ', 'まったり', 'ほっこり', 'ご飯', '好き', '最高', 'いい', '素敵', '快適', '晴れ', '元気', '笑', '癒し'];
const NEGATIVE_WORDS = ['雨', '寒い', '悲しい', 'つらい', 'しんどい', '寂しい', '疲れ', 'どんより', '憂鬱', 'やだ', '嫌', '困る', '大変', '苦しい', '泣', '曇', '不安'];

function moodOf(text: string): 'positive' | 'negative' | 'neutral' {
	if (POSITIVE_WORDS.some(w => text.includes(w))) return 'positive';
	if (NEGATIVE_WORDS.some(w => text.includes(w))) return 'negative';
	return 'neutral';
}

function parseCelsius(value: { celsius: string | null } | null | undefined): number | null {
	if (value?.celsius == null) return null;
	const num = parseInt(value.celsius, 10);
	return Number.isNaN(num) ? null : num;
}

function toForecastSummary(forecast: WeatherForecast): ForecastSummary {
	return {
		telop: forecast.telop ?? '',
		detailWeather: forecast.detail?.weather ?? '',
		maxCelsius: parseCelsius(forecast.temperature?.max),
		minCelsius: parseCelsius(forecast.temperature?.min),
	};
}

export default class extends Module {
	public readonly name = 'noting';

	// 天気履歴を日付ごとに最大7日分保存（moduleData に永続化される）
	private weatherHistoryByDate: Record<string, WeatherResponse> = {};
	// 天気note投稿履歴（日付ごとに投稿したphraseKeyを記録。同じ現象は1日1回のみ投稿）
	private weatherNoteHistory: Record<string, string[]> = {};

	@bindThis
	public install() {
		if (!config.notingEnabled) return {};

		// 永続化された状態を復元
		const data = this.getData();
		this.weatherHistoryByDate = data.weatherHistoryByDate ?? {};
		this.weatherNoteHistory = data.weatherNoteHistory ?? {};
		const lastPostAt: number = data.lastPostAt ?? 0;

		// 前回投稿から十分な間隔が空いている場合のみ起動時に投稿する
		// （再起動ループでの投稿スパムを防ぐ）
		if (Date.now() - lastPostAt >= 1000 * 60 * 60 * POST_MIN_INTERVAL_HOURS) {
			setTimeout(() => {
				this.post(true)
					.catch(e => this.log('post() error: ' + e))
					.finally(() => this.scheduleNextPost());
			}, STARTUP_POST_DELAY_MS);
		} else {
			this.log('前回の投稿から間隔が短いため起動時投稿はスキップします');
			this.scheduleNextPost();
		}

		return {};
	}

	@bindThis
	private saveState() {
		const data = this.getData();
		data.weatherHistoryByDate = this.weatherHistoryByDate;
		data.weatherNoteHistory = this.weatherNoteHistory;
		this.setData(data);
	}

	@bindThis
	private async fetchWeatherWithRetry(): Promise<WeatherResponse | null> {
		const cityCode = config.notingWeatherCityCode || WEATHER_CITY_CODE_DEFAULT;
		for (let i = 0; i < WEATHER_RETRY_COUNT; i++) {
			try {
				const res = await axios.get<WeatherResponse>(
					`https://weather.tsukumijima.net/api/forecast/city/${cityCode}`,
					{ timeout: 10000 }
				);
				return res.data;
			} catch (e) {
				this.log(`天気APIの取得に失敗しました (リトライ${i + 1}/${WEATHER_RETRY_COUNT}): ` + e);
				if (i === WEATHER_RETRY_COUNT - 1) {
					await this.notifyMaster('[noting] 天気APIの取得に3回失敗しました。ネットワークやAPI障害の可能性があります。');
				} else {
					await new Promise(res => setTimeout(res, WEATHER_RETRY_DELAY_MS));
				}
			}
		}
		return null;
	}

	@bindThis
	private async post(forcePost = false) {
		try {
			this.log(`post() called (forcePost=${forcePost})`);
			const now = new Date();
			// ローカル時刻基準の YYYY-MM-DD（toISOString だと UTC 日付になり timeOfDay と基準がズレる）
			const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
			const timeOfDay = timeOfDayOf(now.getHours());

			const weather = await this.fetchWeatherWithRetry();
			if (!weather || !weather.forecasts?.[0]) {
				this.log('Weather fetch failed, aborting post.');
				return;
			}
			this.log(`Weather fetched: ${weather.forecasts[0].telop}`);

			// === 履歴を日付ごとに保存（最大7日分） ===
			this.weatherHistoryByDate[todayStr] = weather;
			const dates = Object.keys(this.weatherHistoryByDate).sort();
			while (dates.length > HISTORY_DAYS) {
				const oldest = dates.shift();
				if (oldest) delete this.weatherHistoryByDate[oldest];
			}
			// 投稿履歴も同様に剪定する（放置すると無限に増える）
			for (const date of Object.keys(this.weatherNoteHistory)) {
				if (!this.weatherHistoryByDate[date] && date !== todayStr) {
					delete this.weatherNoteHistory[date];
				}
			}
			this.saveState();

			// --- 天気状況判定（純関数に委譲） ---
			const pastDates = Object.keys(this.weatherHistoryByDate).sort().filter(d => d < todayStr);
			const pastTelops = pastDates.map(d => this.weatherHistoryByDate[d].forecasts?.[0]?.telop ?? '');
			const yesterdayForecast = pastDates.length > 0
				? this.weatherHistoryByDate[pastDates[pastDates.length - 1]].forecasts?.[0]
				: null;

			const { key: phraseKey, vars: phraseVars } = determinePhraseKey({
				today: toForecastSummary(weather.forecasts[0]),
				yesterday: yesterdayForecast ? toForecastSummary(yesterdayForecast) : null,
				pastTelops,
				month: now.getMonth() + 1,
				day: now.getDate(),
				timeOfDay,
			});
			this.log(`判定されたphraseKey=${phraseKey}, phraseVars=${JSON.stringify(phraseVars)}`);

			// === 1日2回同じ現象noteを投稿しない ===
			const postedToday = this.weatherNoteHistory[todayStr] ?? [];
			if (!forcePost && postedToday.includes(phraseKey)) {
				this.log(`本日すでに${phraseKey}でnote投稿済みのためスキップ`);
				return;
			}
			// forcePost=false時は確率で投稿
			if (!forcePost && Math.random() >= POST_PROBABILITY) {
				this.log('確率判定でスキップ');
				return;
			}

			let situation = '';
			let keywords: string[] = [];
			const today = weather.forecasts[0];
			if (phraseKey === 'unknown_weather') {
				// 未知・説明困難な天気はAIに柔軟なnote生成を指示
				situation = `今日は珍しい天気（API情報: telop=${today.telop}, 詳細=${today.detail?.weather ?? '不明'}）。どんな天気か説明が難しいけど、今の空や気分を自由に表現してみて。`;
				keywords = [today.telop, today.detail?.weather ?? '', '珍しい', '未知', '説明が難しい', '空', '気分'];
			} else {
				const phrase = weather_phrases[phraseKey] || weather_phrases['perfect_weather_day'];
				situation = phrase.situation.replace(/\{(\w+)\}/g, (_, k) => String(phraseVars[k] ?? ''));
				keywords = phrase.keywords;
			}

			const geminiNote = await this.generateNoteWithGemini({
				weather: today,
				situation,
				keywords,
				timeOfDay,
			});
			if (geminiNote == null) {
				// 生成に失敗した場合は投稿しない（エラー文字列を公開ノートにしない）
				this.log('Gemini生成に失敗したため投稿をスキップします');
				return;
			}

			// 投稿前に:emoji:→Unicode/カスタム絵文字変換
			const processedNote = processEmojis(geminiNote);
			try {
				await this.ai.post({ text: processedNote });
				this.log('note投稿成功');
				// 成功した場合のみ投稿履歴と最終投稿時刻を記録する
				this.weatherNoteHistory[todayStr] = [...postedToday, phraseKey];
				const data = this.getData();
				data.lastPostAt = Date.now();
				data.weatherNoteHistory = this.weatherNoteHistory;
				this.setData(data);
			} catch (e) {
				this.log('note投稿エラー: ' + e);
			}
		} catch (e) {
			this.log('post() top-level error: ' + e);
		}
	}

	@bindThis
	private scheduleNextPost() {
		// 12〜36時間の乱数で次の投稿時刻を決定し、setTimeoutで再帰的にスケジューリング
		const randomHours = Math.floor(Math.random() * (POST_MAX_INTERVAL_HOURS - POST_MIN_INTERVAL_HOURS + 1)) + POST_MIN_INTERVAL_HOURS;
		const nextIntervalMs = randomHours * 60 * 60 * 1000;

		this.log(`次の投稿を${randomHours}時間後（${new Date(Date.now() + nextIntervalMs).toLocaleString('ja-JP')}）に予約`);

		setTimeout(() => {
			this.post(false)
				.catch(e => this.log('post() error: ' + e))
				.finally(() => this.scheduleNextPost());
		}, nextIntervalMs);
	}

	@bindThis
	private async generateNoteWithGemini({ weather, situation, keywords, timeOfDay }: {
		weather: WeatherForecast;
		situation: string;
		keywords: string[];
		timeOfDay: TimeOfDay;
	}): Promise<string | null> {
		const emojiList = getEmojiListForAI();

		const prompt = config.autoNotePrompt || config.prompt || 'あなたはMisskeyの女の子AI「唯」として振る舞い、天気や気温、空模様に合わせて自然な一言noteを生成してください。280文字以内。';
		const now = new Date();
		const nowStr = now.toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
		const timeOfDayStr = TIME_OF_DAY_LABELS[timeOfDay];

		const systemInstructionText = `${prompt}\n現在日時は${nowStr}（${timeOfDayStr}）。天気情報・状況・キーワードを参考に、${timeOfDayStr}の時間帯にふさわしい自然なnoteを生成してください。夜の時間帯では「ピクニック」や「外に出たい」などの表現は避けてください。

【重要】絵文字の使用について：
- Unicode絵文字（😀、🌞、🌧️など）は一切使用しないでください
- 代わりに、以下のMisskeyカスタム絵文字リストから適切なものを選んで使用してください
- 絵文字は「:絵文字名:」の形式で使用してください（例: :niko:、:blobsmile:）
- 天気や気分に応じて、自然に1-2個の絵文字を挿入してください
- 必ず以下のリストに含まれる絵文字のみを使用してください。リストにない絵文字は使用しないでください

【使用可能なMisskeyカスタム絵文字一覧】
${emojiList}`;
		const userContent = `【天気情報】\n- 天気: ${weather.telop}\n- 詳細: ${weather.detail?.weather ?? '不明'}\n- 最高気温: ${weather.temperature?.max?.celsius ?? '不明'}℃\n- 最低気温: ${weather.temperature?.min?.celsius ?? '不明'}℃\n- 降水確率: ${Object.entries(weather.chanceOfRain ?? {}).map(([k, v]) => `${k}:${v}`).join(' ')}\n【時間帯】\n${timeOfDayStr}\n【状況】\n${situation}\n【キーワード】\n${keywords.join('、')}`;

		const geminiModel = config.geminiModel || 'gemini-2.5-flash';
		const GEMINI_API = `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent`;
		const geminiOptions = {
			contents: [
				{ role: 'user', parts: [{ text: userContent }] }
			],
			systemInstruction: { role: 'system', parts: [{ text: systemInstructionText }] }
		};
		try {
			const res: any = await got.post(GEMINI_API, {
				searchParams: { key: config.geminiApiKey },
				json: geminiOptions,
				timeout: { request: GEMINI_TIMEOUT_MS },
			}).json();
			const rawText = res?.candidates?.[0]?.content?.parts?.[0]?.text;
			if (typeof rawText !== 'string' || rawText.trim() === '') {
				this.log('Gemini応答が空でした');
				return null;
			}
			return this.postProcessEmojis(rawText.trim());
		} catch (e) {
			this.log('Gemini APIエラー: ' + e);
			return null;
		}
	}

	/**
	 * 生成された note の絵文字を整える:
	 * 絵文字がなければムードに応じて1つ追加し、存在しない絵文字の置換と重複の解消を行う
	 */
	@bindThis
	private postProcessEmojis(generatedNote: string): string {
		const mood = moodOf(generatedNote);

		if (!generatedNote.includes(':')) {
			const weatherEmoji =
				mood === 'positive' ? selectEmoji('happy') :
					mood === 'negative' ? selectEmoji('rainy') :
						selectEmoji('default');
			if (!generatedNote.includes(weatherEmoji)) {
				return `${generatedNote} ${weatherEmoji}`;
			}
			return generatedNote;
		}

		// 存在しない絵文字をムードに応じた実在絵文字に置換
		const existingEmojiNames = getCachedEmojis().map(e => e.name);
		const emojiRegex = /:([a-zA-Z0-9_+-]+):/g;
		const seenOnce: string[] = [];
		let note = generatedNote.replace(emojiRegex, (match, emojiName) => {
			if (existingEmojiNames.includes(emojiName)) {
				if (seenOnce.includes(emojiName)) return '';
				seenOnce.push(emojiName);
				return match;
			}
			if (mood === 'positive') return ':blobsmile:';
			if (mood === 'negative') return ':ablob_sadrain:';
			return ':niko:';
		});

		// 置換の結果同じ絵文字が複数回現れた場合、同カテゴリの未使用絵文字に置き換える
		const usedEmojis: string[] = [];
		let match: RegExpExecArray | null;
		let replacedNote = note;
		while ((match = emojiRegex.exec(note)) !== null) {
			const emojiName = match[1];
			if (usedEmojis.includes(emojiName)) {
				const category = Object.entries(emojiMapping).find(([, arr]) => arr.includes(emojiName));
				if (category) {
					const candidates = category[1].filter(e => !usedEmojis.includes(e));
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
		return replacedNote;
	}
}
