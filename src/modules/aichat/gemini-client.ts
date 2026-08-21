/**
 * Gemini API クライアント。
 * リクエスト送信・レスポンス解析・grounding メタデータの整形を担当する。
 */

import got from 'got';

export type GeminiParts = {
	inlineData?: {
		mimeType: string;
		data: string;
	};
	fileData?: {
		mimeType: string;
		fileUri: string;
	};
	text?: string;
}[];

export type GeminiSystemInstruction = {
	role: string;
	parts: [{ text: string }];
};

export type GeminiContents = {
	role: string;
	parts: GeminiParts;
};

export type GeminiOptions = {
	contents?: GeminiContents[];
	systemInstruction?: GeminiSystemInstruction;
	tools?: [{}];
};

export interface GeminiResponse {
	candidates?: {
		content?: {
			parts?: { text?: string }[];
		};
		groundingMetadata?: {
			groundingChunks?: {
				web?: { uri?: string; title?: string };
			}[];
			webSearchQueries?: string[];
		};
	}[];
}

// 参考サイトが多すぎる場合があるので表示数を制限
const GROUNDING_MAX_SOURCES = 3;
const REQUEST_TIMEOUT_MS = 1000 * 90;

/**
 * レスポンスから本文テキストを抽出する
 */
export function extractResponseText(res: GeminiResponse): string {
	const parts = res.candidates?.[0]?.content?.parts ?? [];
	return parts.map(part => part.text ?? '').join('');
}

/**
 * grounding メタデータ（参考サイト・検索ワード）を表示用テキストに整形する
 * @param includeSearchQueries 検索ワード行を含めるか（チャットでは含めない）
 */
export function formatGroundingMetadata(res: GeminiResponse, includeSearchQueries: boolean): string {
	const metadata = res.candidates?.[0]?.groundingMetadata;
	if (!metadata) return '';

	let result = '';

	const chunks = metadata.groundingChunks ?? [];
	chunks.slice(0, GROUNDING_MAX_SOURCES).forEach((chunk, index) => {
		if (chunk.web?.uri && chunk.web?.title) {
			result += `参考(${index + 1}): [${chunk.web.title}](${chunk.web.uri})\n`;
		}
	});

	if (includeSearchQueries) {
		const queries = metadata.webSearchQueries;
		if (Array.isArray(queries) && queries.length > 0) {
			result += '検索ワード: ' + queries.join(',') + '\n';
		}
	}

	return result;
}

export interface CallGeminiParams {
	apiUrl: string;
	apiKey: string;
	options: GeminiOptions;
	/** チャットでは検索ワードを表示しない */
	includeSearchQueries: boolean;
	log: (msg: string) => void;
}

/**
 * Gemini API を呼び出し、本文 + grounding 情報のテキストを返す。
 * 失敗時は null。
 */
export async function callGemini({ apiUrl, apiKey, options, includeSearchQueries, log }: CallGeminiParams): Promise<string | null> {
	try {
		// リクエスト詳細はログに残さない（searchParams に API キーが含まれるため）
		const res = await got
			.post(apiUrl, {
				searchParams: { key: apiKey },
				json: options,
				timeout: { request: REQUEST_TIMEOUT_MS },
			})
			.json<GeminiResponse>();

		return extractResponseText(res) + formatGroundingMetadata(res, includeSearchQueries);
	} catch (err: unknown) {
		log('Error By Call Gemini');
		if (err && typeof err === 'object' && 'response' in err) {
			const httpError = err as any;
			log(`HTTP ${httpError.response?.statusCode}: ${httpError.response?.statusMessage || httpError.message}`);
		}
		if (err instanceof Error) {
			log(`${err.name}\n${err.message}\n${err.stack}`);
		}
		return null;
	}
}
