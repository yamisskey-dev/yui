export type TimeOfDay = 'morning' | 'afternoon' | 'evening' | 'night';

export interface ForecastSummary {
	telop: string;
	detailWeather: string;
	maxCelsius: number | null;
	minCelsius: number | null;
}

export interface PhraseInput {
	today: ForecastSummary;
	yesterday: ForecastSummary | null;
	/** 今日を除いた過去の telop（古い順） */
	pastTelops: string[];
	month: number; // 1-12
	day: number; // 1-31
	timeOfDay: TimeOfDay;
}

export interface PhraseResult {
	key: string;
	vars: Record<string, number>;
}

export function timeOfDayOf(hour: number): TimeOfDay {
	if (hour >= 5 && hour < 12) return 'morning';
	if (hour >= 12 && hour < 17) return 'afternoon';
	if (hour >= 17 && hour < 21) return 'evening';
	return 'night';
}

/** 末尾から連続して雨だった日数を数える */
function trailingRainDays(telops: string[]): number {
	let count = 0;
	for (let i = telops.length - 1; i >= 0; i--) {
		if (telops[i].includes('雨')) count++;
		else break;
	}
	return count;
}

/**
 * 天気・履歴・季節・時間帯から weather_phrases のキーを決定する。
 * 上にある条件ほど優先される（特殊な現象 > 気温イベント > 通常の空模様）。
 */
export function determinePhraseKey(input: PhraseInput): PhraseResult {
	const { today, yesterday, pastTelops, month, day, timeOfDay } = input;
	const rainStreakBeforeToday = trailingRainDays(pastTelops);

	// --- 特殊な天候・季節イベント ---
	if (today.telop.includes('台風') || today.detailWeather.includes('台風')) {
		return { key: 'typhoon', vars: {} };
	}
	if (
		today.telop.includes('大雪') ||
		today.detailWeather.includes('大雪') ||
		(today.telop.includes('雪') && today.detailWeather.includes('警報'))
	) {
		return { key: 'heavy_snow', vars: {} };
	}
	if (today.maxCelsius != null && today.maxCelsius >= 35) {
		return { key: 'extreme_heat', vars: {} };
	}
	// 具体的な現象（雷雨・虹・黄砂）は、月日ベースの汎用イベント（桜・花粉）より先に判定する
	if ((today.telop.includes('雷') || today.detailWeather.includes('雷')) && today.telop.includes('雨')) {
		return { key: 'thunderstorm', vars: {} };
	}
	if (
		yesterday != null &&
		yesterday.telop.includes('雨') &&
		today.telop.includes('晴') &&
		(today.detailWeather.includes('虹') || today.telop.includes('虹'))
	) {
		return { key: 'rainbow', vars: {} };
	}
	if (month >= 3 && month <= 5 && (today.telop.includes('黄砂') || today.detailWeather.includes('黄砂'))) {
		return { key: 'yellow_sand', vars: {} };
	}
	if (
		((month === 3 && day >= 20) || (month === 4 && day <= 10)) &&
		(today.telop.includes('晴') || today.telop.includes('曇'))
	) {
		return { key: 'cherry_blossom', vars: {} };
	}
	if ((month === 3 || month === 4) && (today.telop.includes('晴') || today.detailWeather.includes('風'))) {
		return { key: 'pollen', vars: {} };
	}
	if ((month >= 11 || month <= 3) && today.minCelsius != null && today.minCelsius <= 0) {
		return { key: 'frost', vars: {} };
	}

	// --- 履歴・気温イベント ---
	// 連続雨: 今日を含めて3日以上雨が続いている場合のみ（履歴が足りないうちは発動しない）
	if (today.telop.includes('雨') && rainStreakBeforeToday >= 2) {
		return { key: 'consecutive_rain', vars: { days: rainStreakBeforeToday + 1 } };
	}
	// 雨明け晴れ: 昨日まで雨が続き、今日晴れた（days は雨が続いていた日数）
	if (rainStreakBeforeToday >= 1 && today.telop.includes('晴')) {
		return { key: 'sun_after_long_rain', vars: { days: rainStreakBeforeToday } };
	}
	if (
		yesterday != null &&
		today.maxCelsius != null &&
		yesterday.maxCelsius != null &&
		today.maxCelsius - yesterday.maxCelsius >= 5
	) {
		return { key: 'sudden_heat', vars: { temp_diff: today.maxCelsius - yesterday.maxCelsius } };
	}
	if (today.maxCelsius != null && today.maxCelsius >= 30) {
		return { key: 'hot_day', vars: {} };
	}
	if (
		yesterday != null &&
		today.maxCelsius != null &&
		yesterday.maxCelsius != null &&
		yesterday.maxCelsius - today.maxCelsius >= 5
	) {
		return { key: 'sudden_cold', vars: { temp_diff: yesterday.maxCelsius - today.maxCelsius } };
	}

	// --- 通常の空模様（時間帯別） ---
	if (today.telop.includes('晴') && !today.telop.includes('雨') && !today.telop.includes('曇')) {
		return { key: `perfect_clear_sky_${timeOfDay}`, vars: {} };
	}
	if (today.telop.includes('曇') && !today.telop.includes('晴') && !today.telop.includes('雨')) {
		return { key: `heavy_clouds_${timeOfDay}`, vars: {} };
	}
	if (today.telop.includes('雨')) {
		return { key: 'drizzle', vars: {} };
	}

	// 既存パターンに該当しない場合は、AIに未知・珍しい天気として柔軟に生成させる
	return { key: 'unknown_weather', vars: {} };
}
