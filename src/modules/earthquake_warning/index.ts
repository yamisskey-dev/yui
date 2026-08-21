import { bindThis } from '@/decorators.js';
import config from '@/config.js';
import Module from '@/module.js';
import axios, { AxiosInstance } from 'axios';
import { parseJstTimeString, toKmoniTimestamp } from './time.js';

class CircuitBreaker {
	private failures: number = 0;
	private lastFailureTime: number = 0;
	private isOpen: boolean = false;

	constructor(
		private maxFailures: number = 5,
		private resetTimeoutMs: number = 60000 // 1 minute
	) { }

	public async execute<T>(operation: () => Promise<T>): Promise<T> {
		if (this.isOpen) {
			if (Date.now() - this.lastFailureTime >= this.resetTimeoutMs) {
				this.reset();
			} else {
				throw new Error('Circuit breaker is open');
			}
		}

		try {
			const result = await operation();
			this.reset();
			return result;
		} catch (error) {
			this.failures++;
			this.lastFailureTime = Date.now();

			if (this.failures >= this.maxFailures) {
				this.isOpen = true;
				console.warn(`Circuit breaker opened after ${this.failures} failures`);
			}

			throw error;
		}
	}

	private reset(): void {
		this.failures = 0;
		this.isOpen = false;
	}
}

interface EarthquakeResponse {
	result: { message: string };
	is_training: boolean;
	is_cancel: boolean;
	is_final: boolean;
	report_id: string;
	region_name: string;
	calcintensity: string;
	magunitude: string;
	depth: string;
	latitude: string;
	longitude: string;
	origin_time: string;
	latest_time: string;
	formattedTime?: string;
}

interface CacheEntry {
	reportId: string;
	isFinal: boolean;
	lastUpdate: number;
	lastIntensity?: string;
	lastDepth?: string;
	lastMagnitude?: string;
	pendingFinal?: boolean;
}

class EarthquakeWarningModule extends Module {
	public readonly name = 'earthquake_warning';

	private static readonly CONFIG = {
		ENDPOINTS: {
			LATEST: 'http://www.kmoni.bosai.go.jp/webservice/server/pros/latest.json',
			BASE: 'http://www.kmoni.bosai.go.jp/webservice/hypo/eew/'
		},
		MIN_INTENSITY: 3,
		CHECK_INTERVAL_MS: 1000,
		TIME_SYNC_INTERVAL_MS: 600000, // 10分ごとにサーバー時刻を再同期
		CACHE_SIZE: 100,
		CACHE_EXPIRY_MS: 300000, // 5分
		REQUEST_TIMEOUT_MS: 10000, // 10秒
		UPDATE_MIN_INTERVAL_MS: 10000, // 同一報の更新はこの間隔以内なら間引く
		SIGNIFICANT_DEPTH_DELTA_KM: 10,
		SIGNIFICANT_MAGNITUDE_DELTA: 0.1,
		FINAL_REPORT_DELAY_MS: 5000,
		SEND_DELAY_MS: 1000,
		MESSAGES: {
			INTENSITY: {
				LIGHT: [
					'あっ！揺れを感知しました！',
					'えっと、地震かもしれません！',
					'わぁ、小さな揺れを観測！'
				],
				MODERATE: [
					'みなさん！地震が来ています！',
					'あっ、結構揺れてきました！',
					'地震に注意してくださいっ！'
				],
				STRONG: [
					'か、かなり大きな地震です！気をつけて！',
					'みんな！大きく揺れるかも！',
					'お、大きな地震が来ています！'
				],
				SEVERE: [
					'とっても大きな地震です！気をつけて！',
					'す、すごく揺れます！安全な場所に逃げて！',
					'だ、大変！大きな地震が来てます！'
				],
				EXTREME: [
					'すごく大きな地震です！！みんな気をつけて！！',
					'とても危険な地震です！安全を確保して！！'
				]
			},
			CANCEL: [
				'あっ、ごめんなさい！{region}の揺れは誤報でした…！',
				'えっと、{region}の地震速報は間違いでした！ごめんね！'
			],
			UPDATE: [
				'はい！{region}の地震について新しい情報です！',
				'えっと、{region}の地震の情報が更新されました！'
			],
			FINAL: [
				'はい！{region}の地震についての最後のお知らせをお伝えしました！',
				'えっと、これで{region}の地震について全ての情報をお伝えしました！',
			],
			TEMPLATE: `{warning}
えっと、地震速報をお伝えします！
{region}で震度{intensity}の揺れを観測しました！
マグニチュードは{magnitude}で、震源の深さは{depth}くらいです！
震源地は北緯{latitude}度、東経{longitude}度あたりみたい！
発生時刻は{time}でした！
{alert_message}`,
			ALERT_HIGH: '※とっても強い揺れが来るかもしれません！今すぐ安全な場所に避難してください！',
			ALERT_MODERATE: '※強い揺れに気をつけてくださいね！'
		}
	} as const;

	private timeOffset = 0;
	private readonly reportCache = new Map<string, CacheEntry>();
	private readonly finalReportTimers = new Map<string, NodeJS.Timeout>();
	private intervalId?: NodeJS.Timeout;
	private checking = false;
	private readonly circuitBreaker = new CircuitBreaker();
	private lastErrorNotificationTime = 0;
	// スロットリングは「報（report_id）× 種別」ごとに管理する
	// （グローバル1本だと、別の地震の初報が直前の更新に握り潰される）
	private readonly lastMessageTimes = new Map<string, number>();
	private readonly ERROR_NOTIFICATION_INTERVAL = 600000; // 10分
	private readonly MESSAGE_THROTTLE_INTERVALS = {
		DEFAULT: 60000,     // 通常の更新: 1分
		INITIAL: 30000,     // 初期通知: 30秒
		CANCEL: 10000,      // キャンセル通知: 10秒
		FINAL: 10000        // 最終報告: 10秒
	} as const;

	// ポーリング用の専用インスタンス
	// （グローバル axios に retry を仕込むと他モジュールの通信にも波及するため。
	//   1秒間隔のポーリング自体が実質リトライなので retry は付けない）
	private readonly http: AxiosInstance = axios.create({
		timeout: EarthquakeWarningModule.CONFIG.REQUEST_TIMEOUT_MS,
	});

	@bindThis
	public install() {
		if (!config.earthquakeWarningEnabled) return {};

		this.startMonitoring();
		return {};
	}

	private async startMonitoring(): Promise<void> {
		try {
			await this.syncServerTime();
			setInterval(() => {
				this.syncServerTime().catch(error => {
					this.log('Failed to re-sync server time: ' + error);
				});
			}, EarthquakeWarningModule.CONFIG.TIME_SYNC_INTERVAL_MS);

			this.intervalId = setInterval(() => {
				// 前回のリクエストが終わるまで次を発行しない（遅延時のパイルアップ防止）
				if (this.checking) return;
				this.checking = true;
				this.checkEarthquake()
					.catch(error => {
						this.handleError('Error during earthquake check:', error);
					})
					.finally(() => {
						this.checking = false;
					});
			}, EarthquakeWarningModule.CONFIG.CHECK_INTERVAL_MS);
		} catch (error) {
			this.handleError('Failed to start earthquake monitoring:', error);
		}
	}

	private handleError(message: string, error: any): void {
		console.error(message, error);

		const currentTime = Date.now();
		if (currentTime - this.lastErrorNotificationTime >= this.ERROR_NOTIFICATION_INTERVAL) {
			// 取得障害は公開ノートではなく master への DM で通知する
			this.notifyMaster(`地震情報の取得に失敗しています: ${message} ${error}`);
			this.lastErrorNotificationTime = currentTime;
		}
	}

	private async syncServerTime(): Promise<void> {
		try {
			const startTime = Date.now();
			const { data } = await this.http.get<EarthquakeResponse>(
				EarthquakeWarningModule.CONFIG.ENDPOINTS.LATEST
			);
			const serverTime = parseJstTimeString(data.latest_time);
			this.timeOffset = serverTime.getTime() - startTime - 1000;
		} catch (error) {
			console.error('Failed to sync server time:', error);
			this.timeOffset = 0;
		}
	}

	private async checkEarthquake(): Promise<void> {
		try {
			await this.circuitBreaker.execute(async () => {
				const timestamp = toKmoniTimestamp(Date.now() + this.timeOffset);
				const url = `${EarthquakeWarningModule.CONFIG.ENDPOINTS.BASE}${timestamp}.json`;

				const { data } = await this.http.get<EarthquakeResponse>(url, {
					validateStatus: status => status === 200 || status === 404
				});

				if (data?.result?.message === '' && !data.is_training) {
					await this.processEarthquakeData(data);
				}
			});

			this.maintainCache();
		} catch (error) {
			if (axios.isAxiosError(error) && (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT')) {
				console.warn('Request timeout:', error.message);
				return;
			}
			throw error;
		}
	}

	private async processEarthquakeData(data: EarthquakeResponse): Promise<void> {
		if (!data?.calcintensity) return;

		const intensity = this.parseIntensity(data.calcintensity);
		// 「不明」等で NaN になった場合は投稿しない
		if (Number.isNaN(intensity)) return;
		if (intensity < EarthquakeWarningModule.CONFIG.MIN_INTENSITY) return;

		const cached = this.reportCache.get(data.report_id);
		const currentTime = Date.now();

		// キャンセル報は最優先で処理する（未知の報のキャンセルを「速報」として投稿しない）
		if (data.is_cancel) {
			const pendingTimer = this.finalReportTimers.get(data.report_id);
			if (pendingTimer) {
				clearTimeout(pendingTimer);
				this.finalReportTimers.delete(data.report_id);
			}
			if (cached) {
				await this.handleCancellation(data);
				this.reportCache.delete(data.report_id);
			}
			return;
		}

		// 最終報告済みの場合はスキップ
		if (cached?.isFinal) return;

		// キャッシュがない場合は新規エントリとして処理
		if (!cached) {
			this.reportCache.set(data.report_id, {
				reportId: data.report_id,
				isFinal: data.is_final,
				lastUpdate: currentTime,
				lastIntensity: data.calcintensity,
				lastDepth: data.depth,
				lastMagnitude: data.magunitude
			});
			await this.sendInitialWarning(data);
			return;
		}

		// 更新間隔チェック（短時間の更新はスキップ）
		// 最終報は間引くと以後の配信が来ない場合に取りこぼすため対象外にする
		if (!data.is_final && currentTime - cached.lastUpdate < EarthquakeWarningModule.CONFIG.UPDATE_MIN_INTERVAL_MS) return;

		// データの重要な変更があるかチェック
		const hasSignificantChanges =
			data.calcintensity !== cached.lastIntensity ||
			Math.abs(parseFloat(data.depth) - parseFloat(cached.lastDepth || "0")) > EarthquakeWarningModule.CONFIG.SIGNIFICANT_DEPTH_DELTA_KM ||
			Math.abs(parseFloat(data.magunitude) - parseFloat(cached.lastMagnitude || "0")) > EarthquakeWarningModule.CONFIG.SIGNIFICANT_MAGNITUDE_DELTA;

		if (data.is_final) {
			// 最終報告の処理
			if (!cached.pendingFinal) {
				cached.pendingFinal = true;
				this.reportCache.set(data.report_id, cached);

				// 最終報告前に最新データを送信（重要な変更がある場合のみ）
				if (hasSignificantChanges) {
					await this.handleUpdate(data);
				}

				// 少し待ってから最終報告を送信（キャンセル報が来たらタイマーごと破棄される）
				const timer = setTimeout(() => {
					this.finalReportTimers.delete(data.report_id);
					const current = this.reportCache.get(data.report_id);
					if (!current) return; // キャンセル・失効で破棄済み
					this.handleFinalReport(data)
						.then(() => {
							this.reportCache.set(data.report_id, {
								...current,
								isFinal: true,
								lastUpdate: Date.now()
							});
						})
						.catch(error => this.handleError('Error during final report:', error));
				}, EarthquakeWarningModule.CONFIG.FINAL_REPORT_DELAY_MS);
				this.finalReportTimers.set(data.report_id, timer);
			}
		} else if (hasSignificantChanges) {
			// 重要な変更がある場合のみ更新情報を送信
			await this.handleUpdate(data);
			this.reportCache.set(data.report_id, {
				...cached,
				lastUpdate: currentTime,
				lastIntensity: data.calcintensity,
				lastDepth: data.depth,
				lastMagnitude: data.magunitude
			});
		}
	}

	private async handleUpdate(data: EarthquakeResponse): Promise<void> {
		const updateMessage = this.getRandomMessage(EarthquakeWarningModule.CONFIG.MESSAGES.UPDATE)
			.replace('{region}', data.region_name);
		await this.sendWarningWithDelay(updateMessage, data, 'DEFAULT');
	}

	private async handleCancellation(data: EarthquakeResponse): Promise<void> {
		await this.postMessage(
			this.getRandomMessage(EarthquakeWarningModule.CONFIG.MESSAGES.CANCEL)
				.replace('{region}', data.region_name),
			'CANCEL',
			data.report_id
		);
	}

	private async handleFinalReport(data: EarthquakeResponse): Promise<void> {
		const finalMessage = this.getRandomMessage(EarthquakeWarningModule.CONFIG.MESSAGES.FINAL)
			.replace('{region}', data.region_name);
		await this.sendWarningWithDelay(finalMessage, data, 'FINAL');
	}

	private async sendInitialWarning(data: EarthquakeResponse): Promise<void> {
		const message = this.createWarningMessage(data);
		await this.postMessage(message, 'INITIAL', data.report_id);
	}

	private async sendWarningWithDelay(
		prefixMessage: string,
		data: EarthquakeResponse,
		type: keyof typeof this.MESSAGE_THROTTLE_INTERVALS
	): Promise<void> {
		await new Promise(resolve => setTimeout(resolve, EarthquakeWarningModule.CONFIG.SEND_DELAY_MS));

		const message = type === 'FINAL'
			? prefixMessage
			: `${prefixMessage}\n${this.createWarningMessage(data)}`;

		await this.postMessage(message, type, data.report_id);
	}

	private async postMessage(
		message: string,
		type: keyof typeof this.MESSAGE_THROTTLE_INTERVALS = 'DEFAULT',
		reportId?: string
	): Promise<void> {
		const currentTime = Date.now();
		const throttleInterval = this.MESSAGE_THROTTLE_INTERVALS[type];
		const throttleKey = `${reportId ?? 'global'}:${type}`;
		const lastTime = this.lastMessageTimes.get(throttleKey) ?? 0;

		if (currentTime - lastTime < throttleInterval) {
			console.log(`Skipping ${type} message due to throttling:`, message);
			return;
		}

		try {
			await this.ai.post({ text: message });
			this.lastMessageTimes.set(throttleKey, currentTime);
		} catch (error) {
			console.error('Failed to post message:', error);
		}
	}

	private createWarningMessage(data: EarthquakeResponse): string {
		const intensity = this.parseIntensity(data.calcintensity);
		return this.formatMessage(EarthquakeWarningModule.CONFIG.MESSAGES.TEMPLATE, {
			warning: this.getRandomMessage(this.getIntensityMessages(intensity)),
			region: data.region_name,
			intensity: data.calcintensity,
			magnitude: data.magunitude,
			depth: data.depth,
			latitude: data.latitude,
			longitude: data.longitude,
			time: this.formatTime(data.origin_time),
			alert_message: intensity >= 6 ? EarthquakeWarningModule.CONFIG.MESSAGES.ALERT_HIGH :
				intensity >= 5 ? EarthquakeWarningModule.CONFIG.MESSAGES.ALERT_MODERATE :
					''
		});
	}

	private getIntensityMessages(intensity: number): readonly string[] {
		if (intensity >= 7) return EarthquakeWarningModule.CONFIG.MESSAGES.INTENSITY.EXTREME;
		if (intensity >= 6) return EarthquakeWarningModule.CONFIG.MESSAGES.INTENSITY.SEVERE;
		if (intensity >= 5) return EarthquakeWarningModule.CONFIG.MESSAGES.INTENSITY.STRONG;
		if (intensity >= 4) return EarthquakeWarningModule.CONFIG.MESSAGES.INTENSITY.MODERATE;
		return EarthquakeWarningModule.CONFIG.MESSAGES.INTENSITY.LIGHT;
	}

	private parseIntensity(intensityStr: string): number {
		return parseInt(intensityStr.split(' ')[0], 10);
	}

	private getRandomMessage(messages: readonly string[]): string {
		return messages[Math.floor(Math.random() * messages.length)];
	}

	private formatMessage(template: string, data: Record<string, string>): string {
		return template.replace(/{(\w+)}/g, (_, key) => data[key] || '');
	}

	private formatTime(timeStr: string): string {
		const year = timeStr.slice(0, 4);
		const month = parseInt(timeStr.slice(4, 6), 10);
		const day = parseInt(timeStr.slice(6, 8), 10);
		const hour = parseInt(timeStr.slice(8, 10), 10);
		const minute = parseInt(timeStr.slice(10, 12), 10);
		const second = parseInt(timeStr.slice(12, 14), 10);

		return `${year}年${month}月${day}日 ${hour}時${minute}分${second}秒`;
	}

	private maintainCache(): void {
		const currentTime = Date.now();
		for (const [reportId, entry] of this.reportCache.entries()) {
			if (currentTime - entry.lastUpdate > EarthquakeWarningModule.CONFIG.CACHE_EXPIRY_MS) {
				this.reportCache.delete(reportId);
			}
		}

		if (this.reportCache.size > EarthquakeWarningModule.CONFIG.CACHE_SIZE) {
			const oldestEntry = Array.from(this.reportCache.entries())
				.sort(([, a], [, b]) => a.lastUpdate - b.lastUpdate)[0];
			if (oldestEntry) {
				this.reportCache.delete(oldestEntry[0]);
			}
		}
	}
}

export default EarthquakeWarningModule;
