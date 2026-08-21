export type Config = {
	host: string;
	serverName?: string;
	i: string;
	master?: string;
	wsUrl: string;
	apiUrl: string;
	notingEnabled: boolean;
	keywordEnabled: boolean;
	chartEnabled: boolean;
	reversiEnabled: boolean;
	serverMonitoring: boolean;
	checkEmojisEnabled?: boolean;
	checkEmojisAtOnce?: boolean;
	prompt?: string;
	aichatRandomTalkEnabled?: boolean;
	aichatRandomTalkProbability?: number;
	aichatRandomTalkIntervalMinutes?: number;
	aichatGroundingWithGoogleSearchAlwaysEnabled?: boolean;
	geminiApiKey?: string;
	geminiModel?: string;
	geminiPostMode?: string;
	autoNotePrompt?: string;
	autoNoteIntervalMinutes?: number;
	geminiAutoNoteProbability?: number;
	autoNoteDisableNightPosting?: boolean;
	followAllowedHosts?: string[];
	followExcludeInstances?: string[];
	mecab?: string;
	mecabDic?: string;
	memoryDir?: string;
};

const BOOLEAN_KEYS = [
	'notingEnabled',
	'keywordEnabled',
	'chartEnabled',
	'reversiEnabled',
	'serverMonitoring',
	'checkEmojisEnabled',
	'checkEmojisAtOnce',
	'aichatRandomTalkEnabled',
	'aichatGroundingWithGoogleSearchAlwaysEnabled',
	'autoNoteDisableNightPosting',
] as const;

const NUMBER_KEYS = [
	'aichatRandomTalkProbability',
	'aichatRandomTalkIntervalMinutes',
	'autoNoteIntervalMinutes',
	'geminiAutoNoteProbability',
] as const;

function parseBooleanValue(key: string, value: unknown): boolean {
	if (typeof value === 'boolean') return value;
	if (value === 'true') return true;
	if (value === 'false') return false;
	throw new Error(`config.${key} は boolean か "true"/"false" で指定してください（現在値: ${JSON.stringify(value)}）`);
}

function parseNumberValue(key: string, value: unknown): number {
	const num = typeof value === 'number' ? value : Number.parseFloat(String(value));
	if (Number.isNaN(num)) {
		throw new Error(`config.${key} は数値で指定してください（現在値: ${JSON.stringify(value)}）`);
	}
	return num;
}

/**
 * config.json の値を正規化する。
 * 旧形式（"true"/"false" や数値の文字列表記）も受け付けて boolean/number に揃える。
 */
export function normalizeConfig(raw: Record<string, unknown>): Config {
	const conf: Record<string, unknown> = { ...raw };

	for (const key of BOOLEAN_KEYS) {
		if (conf[key] !== undefined) conf[key] = parseBooleanValue(key, conf[key]);
	}
	for (const key of NUMBER_KEYS) {
		if (conf[key] !== undefined) conf[key] = parseNumberValue(key, conf[key]);
	}

	const host = String(conf.host);
	conf.wsUrl = host.replace('http', 'ws');
	conf.apiUrl = host + '/api';

	return conf as Config;
}
