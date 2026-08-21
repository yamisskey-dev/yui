import {
	processEmojis,
	selectEmoji,
	selectContextualEmoji,
	setEmojiCache,
	getCustomEmojiNames,
} from './emoji-selector.js';

describe('processEmojis', () => {
	const customEmojis = new Set(['niko', 'ablob_sadrain', 'blob-dance']);

	test('存在するカスタム絵文字はそのまま残す', () => {
		expect(processEmojis('こんにちは :niko:', customEmojis)).toBe('こんにちは :niko:');
	});

	test('Unicode 変換できる shortcode は変換する', () => {
		expect(processEmojis('嬉しい :smile:', customEmojis)).toBe('嬉しい 😄');
	});

	test('存在しない絵文字 shortcode は除去する', () => {
		expect(processEmojis('これは :notexist_emoji: です', customEmojis)).toBe('これは  です');
	});

	test('時刻表記などコロンを含む普通の文は壊さない', () => {
		expect(processEmojis('12:00 と 13:00 に会いましょう', customEmojis)).toBe('12:00 と 13:00 に会いましょう');
	});

	test('秒まで含む時刻表記（連続コロン）も壊さない', () => {
		expect(processEmojis('記録は 12:00:30 でした', customEmojis)).toBe('記録は 12:00:30 でした');
	});

	test('ハイフン入りのカスタム絵文字名も残す', () => {
		expect(processEmojis(':blob-dance:', customEmojis)).toBe(':blob-dance:');
	});

	test('リモート絵文字形式 :name@host: はローカルに存在すれば残す', () => {
		expect(processEmojis(':niko@example.com:', customEmojis)).toBe(':niko@example.com:');
	});
});

describe('selectEmoji', () => {
	afterEach(() => {
		setEmojiCache([]);
	});

	test('キャッシュが空のときはフォールバックの :niko: を返す', () => {
		setEmojiCache([]);
		expect(selectEmoji('greeting')).toBe(':niko:');
	});

	test('キャッシュにカテゴリ候補があればその中から返す', () => {
		setEmojiCache([{ name: 'niko' }, { name: 'blobsmile' }, { name: '09neko' }]);
		const result = selectEmoji('happy');
		expect([':niko:', ':blobsmile:']).toContain(result);
	});

	test('カテゴリ候補が1つも存在しないときは汎用絵文字にフォールバックする', () => {
		setEmojiCache([{ name: 'wara' }, { name: 'unrelated_emoji' }]);
		expect(selectEmoji('cold')).toBe(':wara:');
	});
});

describe('selectContextualEmoji', () => {
	test('文脈キーワードからカテゴリを引く（キャッシュ空でもフォールバックを返す）', () => {
		setEmojiCache([]);
		expect(typeof selectContextualEmoji('おはようございます')).toBe('string');
	});
});

describe('getCustomEmojiNames', () => {
	test('キャッシュ投入後は名前の Set を返す', () => {
		setEmojiCache([{ name: 'foo' }, { name: 'bar' }]);
		const names = getCustomEmojiNames();
		expect(names.has('foo')).toBe(true);
		expect(names.has('bar')).toBe(true);
		setEmojiCache([]);
	});
});
