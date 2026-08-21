import { determinePhraseKey, timeOfDayOf, ForecastSummary } from './phrase.js';

function forecast(overrides: Partial<ForecastSummary> = {}): ForecastSummary {
	return {
		telop: '晴れ',
		detailWeather: '晴れ',
		maxCelsius: 20,
		minCelsius: 10,
		...overrides,
	};
}

const base = {
	yesterday: null,
	pastTelops: [] as string[],
	month: 6,
	day: 15,
	timeOfDay: 'morning' as const,
};

describe('determinePhraseKey', () => {
	test('台風は他のどの条件よりも優先される', () => {
		// 従来の実装では第2チェーンに必ず上書きされ台風noteが出なかった
		const result = determinePhraseKey({
			...base,
			today: forecast({ telop: '台風接近 晴れ', maxCelsius: 36 }),
		});
		expect(result.key).toBe('typhoon');
	});

	test('猛暑日（35℃以上）は extreme_heat', () => {
		const result = determinePhraseKey({
			...base,
			today: forecast({ maxCelsius: 35 }),
		});
		expect(result.key).toBe('extreme_heat');
	});

	test('連続雨は履歴3日分（今日含む）が揃ってから発動する', () => {
		const today = forecast({ telop: '雨' });
		// 過去1日しか雨でない場合は発動しない
		expect(
			determinePhraseKey({ ...base, today, pastTelops: ['雨'] }).key
		).toBe('drizzle');
		// 過去2日+今日=3日連続で発動
		const result = determinePhraseKey({ ...base, today, pastTelops: ['雨', '雨'] });
		expect(result.key).toBe('consecutive_rain');
		expect(result.vars.days).toBe(3);
	});

	test('雨明け晴れの days は連続していた雨の日数になる', () => {
		// 従来の実装では常に0日になっていた
		const result = determinePhraseKey({
			...base,
			today: forecast({ telop: '晴れ' }),
			yesterday: forecast({ telop: '雨' }),
			pastTelops: ['曇り', '雨', '雨', '雨'],
		});
		expect(result.key).toBe('sun_after_long_rain');
		expect(result.vars.days).toBe(3);
	});

	test('急な暑さは前日比+5℃以上で temp_diff 付き', () => {
		const result = determinePhraseKey({
			...base,
			today: forecast({ maxCelsius: 28 }),
			yesterday: forecast({ maxCelsius: 22 }),
		});
		expect(result.key).toBe('sudden_heat');
		expect(result.vars.temp_diff).toBe(6);
	});

	test('春でも雷雨・虹は桜・花粉より優先される', () => {
		const spring = { ...base, month: 4, day: 5 };
		expect(
			determinePhraseKey({
				...spring,
				today: forecast({ telop: '雷を伴う雨', detailWeather: '雷雨 風強い' }),
			}).key
		).toBe('thunderstorm');
		expect(
			determinePhraseKey({
				...spring,
				today: forecast({ telop: '晴れ', detailWeather: '虹が見られるかも' }),
				yesterday: forecast({ telop: '雨' }),
				pastTelops: ['雨'],
			}).key
		).toBe('rainbow');
	});

	test('快晴は時間帯別のキーになる', () => {
		expect(
			determinePhraseKey({ ...base, today: forecast(), timeOfDay: 'night' }).key
		).toBe('perfect_clear_sky_night');
	});

	test('どの条件にも該当しなければ unknown_weather', () => {
		const result = determinePhraseKey({
			...base,
			today: forecast({ telop: '砂嵐', detailWeather: '観測不能', maxCelsius: null, minCelsius: null }),
		});
		expect(result.key).toBe('unknown_weather');
	});
});

describe('timeOfDayOf', () => {
	test('時間帯の境界が正しい', () => {
		expect(timeOfDayOf(5)).toBe('morning');
		expect(timeOfDayOf(12)).toBe('afternoon');
		expect(timeOfDayOf(17)).toBe('evening');
		expect(timeOfDayOf(21)).toBe('night');
		expect(timeOfDayOf(3)).toBe('night');
	});
});
