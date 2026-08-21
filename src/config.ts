import rawConfig from '../config.json' with { type: 'json' };
import { normalizeConfig, type Config } from './utils/normalize-config.js';

const config: Config = normalizeConfig(rawConfig);

export default config;
