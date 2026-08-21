import { genItem, itemPrefixes } from './vocabulary.js';

describe('genItem', () => {
	test('関数プレフィックスが選ばれても関数ソースが混入しない', () => {
		for (let i = 0; i < 5000; i++) {
			const item = genItem();
			expect(item).not.toContain('=>');
			expect(item).not.toContain('function');
		}
	});

	test('同じシードなら同じ結果を返す（決定性）', () => {
		expect(genItem('seed-a')).toBe(genItem('seed-a'));
		expect(genItem(42)).toBe(genItem(42));
	});

	test('年製プレフィックスは「NNNN年製」形式に展開される', () => {
		const fn = itemPrefixes.find((p) => typeof p === 'function');
		expect(fn).toBeDefined();
		if (typeof fn === 'function') {
			expect(fn(() => 0.5)).toMatch(/^\d{4}年製$/);
		}
	});
});
