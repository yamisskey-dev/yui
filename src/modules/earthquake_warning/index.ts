import { bindThis } from '@/decorators.js';
import Module from '@/module.js';
import axios from 'axios';

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
    CACHE_SIZE: 100,
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
        'はい！{region}の地震についての最後のお知らせです！',
        'えっと、{region}の地震について最後の情報をお伝えします！'
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
  private readonly reportCache = new Set<string>();
  private intervalId: NodeJS.Timer | null = null;

  @bindThis
  public install() {
    this.startMonitoring();
    return {};
  }

  private async startMonitoring(): Promise<void> {
    try {
      await this.syncServerTime();
      
      this.intervalId = setInterval(() => {
        this.checkEarthquake().catch(error => {
          console.error('Error during earthquake check:', error);
        });
      }, EarthquakeWarningModule.CONFIG.CHECK_INTERVAL_MS);
    } catch (error) {
      console.error('Failed to start earthquake monitoring:', error);
    }
  }

  private async syncServerTime(): Promise<void> {
    const startTime = Date.now();
    const { data } = await axios.get<EarthquakeResponse>(
      EarthquakeWarningModule.CONFIG.ENDPOINTS.LATEST,
      { timeout: 5000 }
    );
    const serverTime = this.parseTimeString(data.latest_time);
    this.timeOffset = serverTime.getTime() - startTime - 1000;
  }

  private async checkEarthquake(): Promise<void> {
    try {
      const timestamp = this.getCurrentTimestamp();
      const url = `${EarthquakeWarningModule.CONFIG.ENDPOINTS.BASE}${timestamp}.json`;
      
      const { data } = await axios.get<EarthquakeResponse>(url, { 
        timeout: 5000,
        validateStatus: status => status === 200 || status === 404
      });
      
      if (data?.result?.message === '' && !data.is_training) {
        await this.processEarthquakeData(data);
      }
      
      this.maintainCache();
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 404) return;
      throw error;
    }
  }

  private async processEarthquakeData(data: EarthquakeResponse): Promise<void> {
    if (!data?.calcintensity) return;
    
    const intensity = this.parseIntensity(data.calcintensity);
    if (intensity < EarthquakeWarningModule.CONFIG.MIN_INTENSITY) return;

    if (!this.reportCache.has(data.report_id)) {
      this.reportCache.add(data.report_id);
      await this.sendInitialWarning(data);
      return;
    }

    if (data.is_cancel) {
      await this.handleCancellation(data);
    } else if (data.is_final) {
      await this.handleFinalReport(data);
    } else {
      await this.handleUpdate(data);
    }
  }

  private async sendInitialWarning(data: EarthquakeResponse): Promise<void> {
    const intensity = this.parseIntensity(data.calcintensity);
    const message = this.formatMessage(EarthquakeWarningModule.CONFIG.MESSAGES.TEMPLATE, {
      warning: this.getRandomMessage(this.getIntensityMessages(intensity)),
      region: data.region_name,
      intensity: data.calcintensity,
      magnitude: data.magunitude,
      depth: data.depth,
      latitude: data.latitude,
      longitude: data.longitude,
      time: data.origin_time,
      alert_message: intensity >= 6 ? EarthquakeWarningModule.CONFIG.MESSAGES.ALERT_HIGH :
                    intensity >= 5 ? EarthquakeWarningModule.CONFIG.MESSAGES.ALERT_MODERATE :
                    ''
    });

    await this.postMessage(message);
  }

  private async handleCancellation(data: EarthquakeResponse): Promise<void> {
    await this.postMessage(
      this.getRandomMessage(EarthquakeWarningModule.CONFIG.MESSAGES.CANCEL)
        .replace('{region}', data.region_name)
    );
  }

  private async handleUpdate(data: EarthquakeResponse): Promise<void> {
    await this.postMessage(
      this.getRandomMessage(EarthquakeWarningModule.CONFIG.MESSAGES.UPDATE)
        .replace('{region}', data.region_name)
    );
    await this.sendInitialWarning(data);
  }

  private async handleFinalReport(data: EarthquakeResponse): Promise<void> {
    await this.postMessage(
      this.getRandomMessage(EarthquakeWarningModule.CONFIG.MESSAGES.FINAL)
        .replace('{region}', data.region_name)
    );
    await this.sendInitialWarning(data);
  }

  private getIntensityMessages(intensity: number): readonly string[] {
    if (intensity >= 7) return EarthquakeWarningModule.CONFIG.MESSAGES.INTENSITY.EXTREME;
    if (intensity >= 6) return EarthquakeWarningModule.CONFIG.MESSAGES.INTENSITY.SEVERE;
    if (intensity >= 5) return EarthquakeWarningModule.CONFIG.MESSAGES.INTENSITY.STRONG;
    if (intensity >= 4) return EarthquakeWarningModule.CONFIG.MESSAGES.INTENSITY.MODERATE;
    return EarthquakeWarningModule.CONFIG.MESSAGES.INTENSITY.LIGHT;
  }

  private parseTimeString(timeStr: string): Date {
    const [datePart, timePart] = timeStr.split(' ');
    const [year, month, day] = datePart.split('/').map(Number);
    const [hours, minutes, seconds] = timePart.split(':').map(Number);
    return new Date(year, month - 1, day, hours, minutes, seconds);
  }

  private getCurrentTimestamp(): string {
    return new Date(Date.now() + this.timeOffset)
      .toISOString()
      .replace(/[-:T]/g, '')
      .split('.')[0];
  }

  private parseIntensity(intensityStr: string): number {
    return parseInt(intensityStr.split(' ')[0], 10);
  }

  private getRandomMessage(messages: readonly string[]): string {
    return messages[Math.floor(Math.random() * messages.length)];
  }

  private maintainCache(): void {
    if (this.reportCache.size > EarthquakeWarningModule.CONFIG.CACHE_SIZE) {
      const [firstValue] = this.reportCache;
      if (firstValue) this.reportCache.delete(firstValue);
    }
  }

  private formatMessage(template: string, data: Record<string, string>): string {
    return template.replace(/{(\w+)}/g, (_, key) => data[key] || '');
  }

  private async postMessage(message: string): Promise<void> {
    try {
      await this.ai.post({ text: message });
    } catch (error) {
      console.error('Failed to post message:', error);
    }
  }
}

export default EarthquakeWarningModule;
