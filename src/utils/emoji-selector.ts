import emojilist from './emojilist.json' with { type: 'json' };

// Misskeyカスタム絵文字の型定義
export interface MisskeyEmoji {
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

// API取得に失敗しても最低限通したいカスタム絵文字
const basicCustomEmojis = [
	'blobsmile', 'blobsob', 'ablob_sadrain', '09neko', 'blobcatno',
	'blobcatyes', 'blobcatthink', 'blobcatcry', 'blobcatangry',
	'blobcatlove', 'blobcatwink', 'blobcatblush', 'blobcatpunch',
	'blobcatfearful', 'blobcatworried', 'blobcatcold_sweat',
	'blobcatsweat', 'blobcatneutral_face', 'blobcatexpressionless'
];

// インスタンスのカスタム絵文字キャッシュ（initEmojiCache で投入・更新される）
let cachedEmojis: MisskeyEmoji[] = [];
let cachedNames: Set<string> = new Set(basicCustomEmojis);

/**
 * キャッシュを差し替える（initEmojiCache とテストから使用）
 */
export function setEmojiCache(emojis: MisskeyEmoji[]): void {
	cachedEmojis = emojis;
	cachedNames = new Set(basicCustomEmojis);
	for (const emoji of emojis) {
		if (emoji.name) cachedNames.add(emoji.name);
	}
}

/**
 * インスタンスのカスタム絵文字一覧を ai.api('emojis') で取得してキャッシュする。
 * 起動時に呼び、以後は定期的に呼び直して更新する。失敗してもキャッシュは維持される。
 */
export async function initEmojiCache(
	aiApi: (endpoint: string, params: any) => Promise<any>,
	log?: (msg: string) => void
): Promise<void> {
	try {
		const response = await aiApi('emojis', {}) as { emojis?: MisskeyEmoji[] };
		if (response && Array.isArray(response.emojis)) {
			setEmojiCache(response.emojis);
			if (log) log(`[emoji-selector]: ${response.emojis.length}件のカスタム絵文字をキャッシュしました`);
		} else {
			throw new Error('Invalid emoji data format');
		}
	} catch (error) {
		if (log) log(`[emoji-selector]: 絵文字取得に失敗しました（既存キャッシュ ${cachedEmojis.length} 件を維持）: ${error}`);
	}
}

/**
 * キャッシュ済みのカスタム絵文字一覧を返す
 */
export function getCachedEmojis(): MisskeyEmoji[] {
	return cachedEmojis;
}

/**
 * キャッシュ済みのカスタム絵文字名の Set を返す（basicCustomEmojis を常に含む）
 */
export function getCustomEmojiNames(): Set<string> {
	return cachedNames;
}

/**
 * 指定された用途に適した絵文字を選択
 */
export function selectEmoji(category: keyof typeof emojiMapping): string {
	const candidates = emojiMapping[category] || emojiMapping.default;

	// 候補の中から実際に存在する絵文字をフィルタ
	const availableEmojis = candidates.filter(name =>
		cachedEmojis.some(emoji => emoji.name === name)
	);

	if (availableEmojis.length === 0) {
		// 候補が存在しない場合は、存在する絵文字からランダム選択
		const fallbackEmojis = cachedEmojis.filter(emoji =>
			['niko', 'blobsmile', 'wara', 'kaw_pinkheart'].includes(emoji.name)
		);

		if (fallbackEmojis.length > 0) {
			const randomEmoji = fallbackEmojis[Math.floor(Math.random() * fallbackEmojis.length)];
			return `:${randomEmoji.name}:`;
		}

		// 最後の手段
		return ':niko:';
	}

	// 候補からランダム選択
	const selectedName = availableEmojis[Math.floor(Math.random() * availableEmojis.length)];
	return `:${selectedName}:`;
}

/**
 * 文脈に応じて自動で絵文字を選択
 */
export function selectContextualEmoji(context: string): string {
	const lowerContext = context.toLowerCase();

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

	return selectEmoji('default');
}

/**
 * 絵文字リストをGemini等のAIに渡すためのJSON形式で取得
 */
export function getEmojiListForAI(): string {
	// マッピングに載っている絵文字のうち実際に存在するもののみ
	const existingEmojis = cachedEmojis.filter(emoji =>
		Object.values(emojiMapping).flat().includes(emoji.name)
	);

	const aiFriendlyList = existingEmojis.map(emoji => ({
		name: emoji.name,
		shortcode: `:${emoji.name}:`,
		category: emoji.category || 'general',
		aliases: emoji.aliases || []
	}));

	return JSON.stringify(aiFriendlyList, null, 2);
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
 *
 * shortcode 形状（英数字と _+- のみ、任意で @host）に一致したトークンだけを対象にする。
 * 「12:00 と 13:00」のようなコロンを含む普通の文は変更しない。
 * @param text 入力テキスト
 * @param customEmojis カスタム絵文字名の集合（省略時はキャッシュを使用）
 * @returns 絵文字変換済みテキスト
 */
export function processEmojis(text: string, customEmojis: Set<string> = cachedNames): string {
	return text.replace(/:([a-zA-Z0-9_+-]+)(?:@[a-zA-Z0-9_.-]+)?:/g, (match, name) => {
		// 数字のみのトークンは「12:00:30」のような時刻表記の一部である可能性が高いため触らない
		if (/^[0-9]+$/.test(name)) return match;
		// Misskey APIで取得できたカスタム絵文字名は必ず通す
		if (customEmojis.has(name)) return match;
		// Unicode変換できるものは変換
		if (emojiMap[name]) return emojiMap[name];
		// 実在しない絵文字（AIのハルシネーション等）は除去
		return '';
	});
}
