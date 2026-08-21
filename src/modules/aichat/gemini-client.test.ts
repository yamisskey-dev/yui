import { extractResponseText, formatGroundingMetadata, GeminiResponse } from './gemini-client.js';

describe('extractResponseText', () => {
	test('複数 parts のテキストを連結する', () => {
		const res: GeminiResponse = {
			candidates: [{ content: { parts: [{ text: 'こんにち' }, { text: 'は' }] } }],
		};
		expect(extractResponseText(res)).toBe('こんにちは');
	});

	test('candidates が無い・parts が無い場合は空文字', () => {
		expect(extractResponseText({})).toBe('');
		expect(extractResponseText({ candidates: [{}] })).toBe('');
	});
});

describe('formatGroundingMetadata', () => {
	const res: GeminiResponse = {
		candidates: [{
			groundingMetadata: {
				groundingChunks: [
					{ web: { uri: 'https://a.example', title: 'A' } },
					{ web: { uri: 'https://b.example', title: 'B' } },
					{ web: { uri: 'https://c.example', title: 'C' } },
					{ web: { uri: 'https://d.example', title: 'D' } },
				],
				webSearchQueries: ['天気', 'ニュース'],
			},
		}],
	};

	test('参考サイトは3件までに制限される', () => {
		const text = formatGroundingMetadata(res, false);
		expect(text).toContain('参考(3): [C](https://c.example)');
		expect(text).not.toContain('D');
	});

	test('includeSearchQueries が true のときだけ検索ワードを含む', () => {
		expect(formatGroundingMetadata(res, true)).toContain('検索ワード: 天気,ニュース');
		expect(formatGroundingMetadata(res, false)).not.toContain('検索ワード');
	});

	test('groundingMetadata が無ければ空文字', () => {
		expect(formatGroundingMetadata({ candidates: [{}] }, true)).toBe('');
	});
});
