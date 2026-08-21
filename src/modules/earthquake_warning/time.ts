const JST_OFFSET_MS = 9 * 60 * 60 * 1000;

/**
 * kmoni の latest_time（"yyyy/MM/dd HH:mm:ss"、JST）を epoch に変換する。
 * ホストのタイムゾーンに依存しないよう UTC として解釈してから JST 分を差し引く。
 */
export function parseJstTimeString(timeStr: string): Date {
	const [datePart, timePart] = timeStr.split(' ');
	const [year, month, day] = datePart.split('/').map(Number);
	const [hours, minutes, seconds] = timePart.split(':').map(Number);
	return new Date(Date.UTC(year, month - 1, day, hours, minutes, seconds) - JST_OFFSET_MS);
}

/**
 * epoch ミリ秒を kmoni の URL 用タイムスタンプ（JST の yyyyMMddHHmmss）に変換する。
 * ホストのタイムゾーンに依存しない。
 */
export function toKmoniTimestamp(epochMs: number): string {
	return new Date(epochMs + JST_OFFSET_MS)
		.toISOString()
		.replace(/[-:T]/g, '')
		.split('.')[0];
}
