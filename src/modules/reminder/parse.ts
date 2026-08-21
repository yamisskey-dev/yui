export type ParseResult = { when: number; text: string } | null;

/**
 * Parse natural language time expressions from the start of the input.
 * Returns { when: timestamp(ms), text: remainingText } or null when no time found.
 *
 * 時刻表現は入力の先頭にある場合のみ採用する。本文の途中に日付らしき語
 * （"3日", "Monday" など）が含まれるだけで時刻指定と解釈され、その語が
 * 本文から削られてしまう誤爆を防ぐため。
 *
 * Note: we intentionally perform a dynamic import of `chrono-node` inside the
 * function so the module can be loaded under both ESM and CommonJS test runners.
 */
export async function parseTimeExpression(input: string): Promise<ParseResult> {
	try {
		const chrono = await import('chrono-node');
		const results = chrono.parse(input, new Date(), { forwardDate: true });
		if (results && results.length > 0) {
			const r = results[0];
			if (r.index !== 0) return null; // 先頭以外の時刻表現は無視する
			const when = r.date().getTime();
			const text = input.slice(r.text.length).trim();
			return { when, text };
		}
	} catch (err) {
		// chrono の予期しない失敗は時刻指定なしとして扱う（リマインド自体は成立させる）
		console.warn('[reminder] time expression parse failed:', err);
	}
	return null;
}
