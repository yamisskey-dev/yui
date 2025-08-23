import fetch from 'node-fetch';
import emojilist from './emojilist.json' with { type: 'json' };

// Misskeyカスタム絵文字の型定義
interface MisskeyEmoji {
	name: string;
	aliases?: string[];
	category?: string;
	url?: string;
}

// 用途別絵文字マッピング（実際の絵文字名に基づく）
export const emojiMapping: Record<string, string[]> = {
	// 挨拶・日常
	greeting: ['09neko', 'Shiropuyo_ohayou', 'niko', 'blobsmile'],
	goodbye: ['09neko', 'niko', 'blobsmile'],
	
	// 感情・反応
	happy: ['niko', 'blobsmile', 'kaw_pinkheart'],
	sad: ['ablob_sadrain', 'blobsob'],
	angry: ['blobcat_boronaki', 'blobcat_frustration'],
	surprised: ['blobcat_surprised', 'blobcat_yikes'],
	
	// お祝い・感謝
	celebration: ['kumapu_ome', 'blobs_blobthanks', 'kaw_pinkheart'],
	thanks: ['blobs_blobthanks', 'kumapu_ome'],
	birthday: ['kumapu_ome', 'kaw_pinkheart', 'blobsmile'],
	
	// 天気関連
	sunny: ['blobcat_ohayosan_kansai', 'blobsmile'],
	rainy: ['ablob_sadrain', 'blobsob'],
	cloudy: ['blobsmile'],
	rainbow: ['blobrainbow'],
	hot: ['Shiropuyo_ase', 'blobcat_sweatflip'],
	cold: ['polarbear', 'cold_bear'],
	
	// ゲーム・遊び
	game: ['blobcat_ok_sign', 'blobsmile'],
	win: ['kumapu_ome', 'blobsmile'],
	lose: ['blobsob', 'ablob_sadrain'],
	
	// 食べ物
	food: ['Shiropuyo_pudding', 'Shiropuyo_icecream', 'blobcat_ramen'],
	
	// デフォルト・汎用
	default: ['niko', 'blobsmile', 'wara'],
	love: ['kaw_pinkheart', 'love', 'Shiropuyo_heart'],
	laugh: ['wara', 'blobcat_yay'],
};

// 絵文字キャッシュ
let cachedEmojis: MisskeyEmoji[] = [];
let lastFetchTime = 0;
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24時間

/**
 * Misskeyのカスタム絵文字リストを取得・キャッシュ
 */
export async function fetchEmojis(): Promise<MisskeyEmoji[]> {
	const now = Date.now();
	
	// キャッシュが有効な場合はキャッシュを返す
	if (cachedEmojis.length > 0 && (now - lastFetchTime) < CACHE_DURATION) {
		return cachedEmojis;
	}
	
	try {
		const response = await fetch('https://yami.ski/api/emojis');
		const emojis = await response.json();
		
		if (Array.isArray(emojis)) {
			cachedEmojis = emojis;
			lastFetchTime = now;
			console.log(`[emoji-selector] ${emojis.length}件のカスタム絵文字をキャッシュしました`);
		}
		
		return cachedEmojis;
	} catch (error) {
		console.error('[emoji-selector] 絵文字取得エラー:', error);
		return cachedEmojis; // 既存キャッシュがあれば返す
	}
}

/**
 * 指定された用途に適した絵文字を選択
 */
export async function selectEmoji(category: keyof typeof emojiMapping): Promise<string> {
	const emojis = await fetchEmojis();
	const candidates = emojiMapping[category] || emojiMapping.default;
	
	// 候補の中から実際に存在する絵文字をフィルタ
	const availableEmojis = candidates.filter(name => 
		emojis.some(emoji => emoji.name === name)
	);
	
	if (availableEmojis.length === 0) {
		// 候補が存在しない場合は、存在する絵文字からランダム選択
		const fallbackEmojis = emojis.filter(emoji => 
			['niko', 'blobsmile', 'wara', 'kaw_pinkheart'].includes(emoji.name)
		);
		
		if (fallbackEmojis.length > 0) {
			const randomEmoji = fallbackEmojis[Math.floor(Math.random() * fallbackEmojis.length)];
			return `:${randomEmoji.name}:`;
		}
		
		// 最後の手段：最初の絵文字
		return emojis.length > 0 ? `:${emojis[0].name}:` : ':niko:';
	}
	
	// 候補からランダム選択
	const selectedName = availableEmojis[Math.floor(Math.random() * availableEmojis.length)];
	return `:${selectedName}:`;
}

/**
 * 複数の絵文字を組み合わせて返す
 */
export async function selectMultipleEmojis(categories: (keyof typeof emojiMapping)[], count: number = 1): Promise<string> {
	const emojis: string[] = [];
	
	for (let i = 0; i < count; i++) {
		const category = categories[i % categories.length];
		const emoji = await selectEmoji(category);
		emojis.push(emoji);
	}
	
	return emojis.join(' ');
}

/**
 * 文脈に応じて自動で絵文字を選択
 */
export async function selectContextualEmoji(context: string): Promise<string> {
	const lowerContext = context.toLowerCase();
	
	// 文脈に基づいてカテゴリを決定
	if (lowerContext.includes('おはよう') || lowerContext.includes('こんにちは') || lowerContext.includes('こんばんは')) {
		return selectEmoji('greeting');
	}
	
	if (lowerContext.includes('おめでとう') || lowerContext.includes('誕生日')) {
		return selectEmoji('birthday');
	}
	
	if (lowerContext.includes('ありがとう') || lowerContext.includes('感謝')) {
		return selectEmoji('thanks');
	}
	
	if (lowerContext.includes('晴れ') || lowerContext.includes('暑い')) {
		return selectEmoji('sunny');
	}
	
	if (lowerContext.includes('雨') || lowerContext.includes('曇り')) {
		return selectEmoji('rainy');
	}
	
	if (lowerContext.includes('虹')) {
		return selectEmoji('rainbow');
	}
	
	if (lowerContext.includes('勝') || lowerContext.includes('勝利')) {
		return selectEmoji('win');
	}
	
	if (lowerContext.includes('負') || lowerContext.includes('敗北')) {
		return selectEmoji('lose');
	}
	
	if (lowerContext.includes('笑') || lowerContext.includes('面白')) {
		return selectEmoji('laugh');
	}
	
	if (lowerContext.includes('愛') || lowerContext.includes('好き')) {
		return selectEmoji('love');
	}
	
	// デフォルト
	return selectEmoji('default');
}

/**
 * 絵文字リストをGemini等のAIに渡すためのJSON形式で取得
 */
export async function getEmojiListForAI(): Promise<string> {
	const emojis = await fetchEmojis();
	
	// 実際に存在する絵文字のみをフィルタ
	const existingEmojis = emojis.filter(emoji => 
		Object.values(emojiMapping).flat().includes(emoji.name)
	);
	
	// AIが使いやすい形式に整形
	const aiFriendlyList = existingEmojis.map(emoji => ({
		name: emoji.name,
		shortcode: `:${emoji.name}:`,
		category: emoji.category || 'general',
		aliases: emoji.aliases || []
	}));
	
	return JSON.stringify(aiFriendlyList, null, 2);
} 
/**
 * Misskeyカスタム絵文字リストをAPIから取得しSet<string>で返す
 * 失敗時はfallbackのカスタム絵文字セットを返す
 */
export async function loadCustomEmojis(
	aiApi: (endpoint: string, params: any) => Promise<any>,
	log?: (msg: string) => void
): Promise<Set<string>> {
	const customEmojis = new Set<string>();
	try {
		if (log) log('[emoji-selector]: Loading custom emojis...');
		const response = await aiApi('emojis', {}) as any;
		if (response && response.emojis && Array.isArray(response.emojis)) {
			for (const emoji of response.emojis) {
				if (emoji.name) {
					customEmojis.add(emoji.name);
				}
			}
			if (log) log(`[emoji-selector]: Loaded ${customEmojis.size} custom emojis`);
		} else {
			throw new Error('Invalid emoji data format');
		}
	} catch (error) {
		if (log) log(`[emoji-selector]: Failed to load custom emojis: ${error}`);
		const basicCustomEmojis = [
			'blobsmile', 'blobsob', 'ablob_sadrain', '09neko', 'blobcatno',
			'blobcatyes', 'blobcatthink', 'blobcatcry', 'blobcatangry',
			'blobcatlove', 'blobcatwink', 'blobcatblush', 'blobcatpunch',
			'blobcatfearful', 'blobcatworried', 'blobcatcold_sweat',
			'blobcatsweat', 'blobcatneutral_face', 'blobcatexpressionless'
		];
		basicCustomEmojis.forEach(emoji => customEmojis.add(emoji));
		if (log) log(`[emoji-selector]: Using fallback custom emojis: ${customEmojis.size} emojis`);
	}
	return customEmojis;
}

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
 * カスタム絵文字かどうか判定
 */
export function isCustomEmoji(emojiName: string, customEmojis: Set<string>): boolean {
	return customEmojis.has(emojiName);
}

/**
 * :emoji:形式→Unicode/カスタム絵文字変換
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