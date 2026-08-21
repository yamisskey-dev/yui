import { parseJstTimeString, toKmoniTimestamp } from './time.js';

describe('parseJstTimeString', () => {
	test('JST の時刻文字列をホストTZに依存せず epoch に変換する', () => {
		// 2024/01/01 09:00:00 JST == 2024-01-01T00:00:00Z
		const date = parseJstTimeString('2024/01/01 09:00:00');
		expect(date.getTime()).toBe(Date.UTC(2024, 0, 1, 0, 0, 0));
	});
});

describe('toKmoniTimestamp', () => {
	test('epoch を JST の yyyyMMddHHmmss に変換する', () => {
		// 2024-01-01T00:00:00Z == 2024/01/01 09:00:00 JST
		expect(toKmoniTimestamp(Date.UTC(2024, 0, 1, 0, 0, 0))).toBe('20240101090000');
	});

	test('日付をまたぐ変換も正しい', () => {
		// 2024-06-30T20:30:15Z == 2024/07/01 05:30:15 JST
		expect(toKmoniTimestamp(Date.UTC(2024, 5, 30, 20, 30, 15))).toBe('20240701053015');
	});

	test('parseJstTimeString と往復できる', () => {
		const original = '2025/08/21 12:34:56';
		expect(toKmoniTimestamp(parseJstTimeString(original).getTime())).toBe('20250821123456');
	});
});
