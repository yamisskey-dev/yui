export const DEFAULT_STRENGTH = 2;

const STRENGTH_LABELS: Record<number, string> = {
	0: '接待',
	2: '弱',
	3: '中',
	4: '強',
	5: '最強',
};

/**
 * 数値の強さを文字表現に変換
 */
export function getStrengthText(strength: number): string {
	return STRENGTH_LABELS[strength] ?? '強';
}
