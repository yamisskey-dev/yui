type Config = {
  host: string;
  serverName?: string;
  i: string;
  master?: string;
  wsUrl: string;
  apiUrl: string;
  notingEnabled: string;
  keywordEnabled: string;
  chartEnabled: string;
  reversiEnabled: string;
  serverMonitoring: string;
  checkEmojisEnabled?: string;
  checkEmojisAtOnce?: string;
  prompt?: string;
  aichatRandomTalkEnabled?: string;
  aichatRandomTalkProbability?: string;
  aichatRandomTalkIntervalMinutes?: string;
  aichatGroundingWithGoogleSearchAlwaysEnabled?: string;
  geminiApiKey?: string;
  geminiModel?: string;
  geminiPostMode?: string;
  autoNotePrompt?: string;
  autoNoteIntervalMinutes?: string;
  geminiAutoNoteProbability?: string;
  autoNoteDisableNightPosting?: string;
  mecab?: string;
  mecabDic?: string;
  memoryDir?: string;
};

import config from '../config.json' with { type: 'json' };

(config as any).wsUrl = config.host.replace('http', 'ws');
(config as any).apiUrl = config.host + '/api';

export default config as Config;
