// Emoji processing utility extracted from aichat module

import emojilist from './emojilist.json' with { type: 'json' };

/**
 * emojiName→Unicodeのマップを生成
 */
const emojiMap: { [key: string]: string } = {};
for (const entry of emojilist) {
	if (typeof entry[1] === 'string' && typeof entry[0] === 'string') {
		emojiMap[entry[1]] = entry[0];
	}
}

/**
 * Misskeyカスタム絵文字リストをAPIから取得しSet<string>で返す
 * 失敗時はfallbackのカスタム絵文字セットを返す
 */
export async function loadCustomEmojis(aiApi: (endpoint: string, params: any) => Promise<any>, log?: (msg: string) => void): Promise<Set<string>> {
	const customEmojis = new Set<string>();
	try {
		if (log) log('[emoji-processor]: Loading custom emojis...');
		const response = await aiApi('emojis', {}) as any;
		if (response && response.emojis && Array.isArray(response.emojis)) {
			for (const emoji of response.emojis) {
				if (emoji.name) {
					customEmojis.add(emoji.name);
				}
			}
			if (log) log(`[emoji-processor]: Loaded ${customEmojis.size} custom emojis`);
		} else {
			throw new Error('Invalid emoji data format');
		}
	} catch (error) {
		if (log) log(`[emoji-processor]: Failed to load custom emojis: ${error}`);
		const basicCustomEmojis = [
			'blobsmile', 'blobsob', 'ablob_sadrain', '09neko', 'blobcatno',
			'blobcatyes', 'blobcatthink', 'blobcatcry', 'blobcatangry',
			'blobcatlove', 'blobcatwink', 'blobcatblush', 'blobcatpunch',
			'blobcatfearful', 'blobcatworried', 'blobcatcold_sweat',
			'blobcatsweat', 'blobcatneutral_face', 'blobcatexpressionless'
		];
		basicCustomEmojis.forEach(emoji => customEmojis.add(emoji));
		if (log) log(`[emoji-processor]: Using fallback custom emojis: ${customEmojis.size} emojis`);
	}
	return customEmojis;
}

/**
 * カスタム絵文字かどうか判定
 */
export function isCustomEmoji(emojiName: string, customEmojis: Set<string>): boolean {
	return customEmojis.has(emojiName);
}

/**
 * 絵文字処理ユーティリティ
 * @param text 入力テキスト
 * @param customEmojis Set<string> カスタム絵文字名集合
 * @returns 絵文字変換済みテキスト
 */
export function processEmojis(text: string, customEmojis: Set<string>): string {
	return text.replace(/:([^:]+):/g, (match, name) => {
		if (!/^[a-zA-Z0-9_]+$/.test(name)) return '';
		if (customEmojis.has(name)) return match;
		if (emojiMap[name]) return emojiMap[name];
		return '';
	});
}