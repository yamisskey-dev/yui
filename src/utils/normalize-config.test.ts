import { normalizeConfig } from './normalize-config.js';

const base = {
	host: 'https://misskey.example.com',
	i: 'token',
	notingEnabled: 'true',
	keywordEnabled: 'false',
	chartEnabled: 'false',
	reversiEnabled: 'true',
	serverMonitoring: 'true',
};

describe('normalizeConfig', () => {
	test('文字列の "true"/"false" を boolean に変換する', () => {
		const conf = normalizeConfig({ ...base });
		expect(conf.notingEnabled).toBe(true);
		expect(conf.keywordEnabled).toBe(false);
		expect(conf.chartEnabled).toBe(false);
	});

	test('boolean で書かれた値はそのまま通す', () => {
		const conf = normalizeConfig({ ...base, notingEnabled: false, reversiEnabled: true });
		expect(conf.notingEnabled).toBe(false);
		expect(conf.reversiEnabled).toBe(true);
	});

	test('数値キーは文字列でも number に変換する', () => {
		const conf = normalizeConfig({
			...base,
			aichatRandomTalkProbability: '0.08',
			aichatRandomTalkIntervalMinutes: '300',
			geminiAutoNoteProbability: 0.02,
		});
		expect(conf.aichatRandomTalkProbability).toBe(0.08);
		expect(conf.aichatRandomTalkIntervalMinutes).toBe(300);
		expect(conf.geminiAutoNoteProbability).toBe(0.02);
	});

	test('未指定のオプションキーは undefined のまま', () => {
		const conf = normalizeConfig({ ...base });
		expect(conf.aichatRandomTalkEnabled).toBeUndefined();
		expect(conf.geminiAutoNoteProbability).toBeUndefined();
	});

	test('boolean キーに解釈できない値が来たら投げる', () => {
		expect(() => normalizeConfig({ ...base, notingEnabled: 'yes' })).toThrow(/notingEnabled/);
	});

	test('数値キーに解釈できない値が来たら投げる', () => {
		expect(() => normalizeConfig({ ...base, aichatRandomTalkProbability: 'abc' })).toThrow(/aichatRandomTalkProbability/);
	});

	test('wsUrl と apiUrl を host から導出する', () => {
		const conf = normalizeConfig({ ...base });
		expect(conf.wsUrl).toBe('wss://misskey.example.com');
		expect(conf.apiUrl).toBe('https://misskey.example.com/api');
	});
});
