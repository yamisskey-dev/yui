import { bindThis } from '@/decorators.js';
import Module from '@/module.js';
import serifs from '@/serifs.js';
import { genItem } from '@/vocabulary.js';
import config from '@/config.js';
import axios from 'axios';
import { weather_phrases } from '@/serifs.js';
import got from 'got';

export default class extends Module {
	public readonly name = 'noting';

	// 天気履歴を日付ごとに最大7日分保存
	private weatherHistoryByDate: Record<string, any> = {};
	// 天気note投稿履歴（日付ごとに投稿したphraseKeyを記録）
	private weatherNoteHistory: Record<string, string[]> = {};

	@bindThis
	public install() {
		this.log('[noting] install() called');
		if (config.notingEnabled === "false") return {};

		setTimeout(() => {
			try {
				this.log('[noting] setTimeout: calling post(forcePost=true)');
				this.post(true).then(() => {
					this.log('[noting] 起動時post()呼び出し完了');
				}).catch(e => this.log('[noting] post() error: ' + e));
			} catch (e) {
				this.log('[noting] setTimeout error: ' + e);
			}
		}, 0);

		setInterval(() => {
			try {
				this.log('[noting] setInterval: calling post(forcePost=false)');
				this.post(false).then(() => {
					this.log('[noting] 定期post()呼び出し完了');
				}).catch(e => this.log('[noting] post() error: ' + e));
			} catch (e) {
				this.log('[noting] setInterval error: ' + e);
			}
		}, 1000 * 60 * 60 * 6);

		this.log('[noting] install() finished');
		return {};
	}

	@bindThis
	private async fetchWeather() {
		try {
			const res = await axios.get('https://weather.tsukumijima.net/api/forecast/city/400010');
			return res.data;
		} catch (e) {
			this.log('天気APIの取得に失敗しました: ' + e);
			return null;
		}
	}

	@bindThis
	private async post(forcePost = false) {
		try {
			this.log(`[noting] post() called at ${new Date().toISOString()} forcePost=${forcePost}`);
			const now = new Date();
			const todayStr = now.toISOString().slice(0, 10); // YYYY-MM-DD
			const month = now.getMonth() + 1;
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
			const weather = await this.fetchWeather();
			if (!weather) {
				this.log('[noting] Weather fetch failed, aborting post.');
				return;
			}
			this.log(`[noting] Weather fetched: ${JSON.stringify(weather)}`);

			// === 履歴を日付ごとに保存 ===
			this.weatherHistoryByDate[todayStr] = weather;
			// 7日以上前の履歴を削除
			const dates = Object.keys(this.weatherHistoryByDate).sort();
			while (dates.length > 7) {
				const oldest = dates.shift();
				if (oldest) delete this.weatherHistoryByDate[oldest];
			}

			// 履歴配列を作成（新しい順）
			const weatherHistoryArr = Object.values(this.weatherHistoryByDate).slice(-7);

			// --- 天気状況判定ロジック（時間帯考慮） ---
			let phraseKey = '';
			let phraseVars: Record<string, any> = {};
			const today = weather.forecasts[0];
			const yesterday = weatherHistoryArr.length > 1 ? weatherHistoryArr[weatherHistoryArr.length-2].forecasts[0] : null;

			this.log(`[noting] today.telop=${today.telop}, yesterday.telop=${yesterday ? yesterday.telop : 'N/A'}`);

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
				phraseKey = 'perfect_weather_day';
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

			const phrase = weather_phrases[phraseKey] || weather_phrases['perfect_weather_day'];
			const situation = phrase.situation.replace(/\{(\w+)\}/g, (_, k) => phraseVars[k] ?? '');
			const keywords = phrase.keywords;

			this.log(`[noting] Gemini入力: situation=${situation}, keywords=${JSON.stringify(keywords)}`);

			const geminiNote = await this.generateNoteWithGemini({
				weather: today,
				situation,
				keywords
			});

			this.log(`[noting] Gemini生成note: ${geminiNote}`);

			try {
				await this.ai.post({
					text: geminiNote
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

	private async generateNoteWithGemini({ weather, situation, keywords }) {
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
		
		const systemInstructionText = `${prompt}\n現在日時は${nowStr}（${timeOfDayStr}）。天気情報・状況・キーワードを参考に、${timeOfDayStr}の時間帯にふさわしい自然なnoteを生成してください。夜の時間帯では「ピクニック」や「外に出たい」などの表現は避けてください。`;
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
				return res.candidates[0].content.parts[0].text.trim();
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
