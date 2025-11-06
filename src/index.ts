// AiOS bootstrapper

import process from 'node:process';
import chalk from 'chalk';
import got from 'got';
import promiseRetry from 'promise-retry';

import 唯 from './ai.js';
import config from './config.js';
import _log from './utils/log.js';
import pkg from '../package.json' with { type: 'json' };

import CoreModule from './modules/core/index.js';
import TalkModule from './modules/talk/index.js';
import BirthdayModule from './modules/birthday/index.js';
import ReversiModule from './modules/reversi/index.js';
import PingModule from './modules/ping/index.js';
import EmojiModule from './modules/emoji/index.js';
// import EmojiReactModule from './modules/emoji-react/index.js';
import FortuneModule from './modules/fortune/index.js';
import GuessingGameModule from './modules/guessing-game/index.js';
import KazutoriModule from './modules/kazutori/index.js';
// import KeywordModule from './modules/keyword/index.js';
import WelcomeModule from './modules/welcome/index.js';
import TimerModule from './modules/timer/index.js';
import DiceModule from './modules/dice/index.js';
import ServerModule from './modules/server/index.js';
import FollowModule from './modules/follow/index.js';
import ValentineModule from './modules/valentine/index.js';
// import MazeModule from './modules/maze/index.js';
// import ChartModule from './modules/chart/index.js';
import SleepReportModule from './modules/sleep-report/index.js';
import NotingModule from './modules/noting/index.js';
// import PollModule from './modules/poll/index.js';
import ReminderModule from './modules/reminder/index.js';
import CheckCustomEmojisModule from './modules/check-custom-emojis/index.js';
// import EarthQuakeWarningModule from './modules/earthquake_warning/index.js';
import AiChatModule from './modules/aichat/index.js';
import YamiiModule from './modules/yamii/index.js';

console.log('   __    ____  _____  ___ ');
console.log('  /__\\  (_  _)(  _  )/ __)');
console.log(' /(__)\\  _)(_  )(_)( \\__ \\');
console.log('(__)(__)(____)(_____)(___/\n');

function log(msg: string): void {
	_log(`[Boot]: ${msg}`);
}

log(chalk.bold(`Ai v${pkg.version}`));

process.on('uncaughtException', err => {
	try {
		console.error(`Uncaught exception: ${err.message}`);
		console.dir(err, { colors: true, depth: 2 });
	} catch { }
});

promiseRetry(retry => {
	log(`Account fetching... ${chalk.gray(config.host)}`);

	// アカウントをフェッチ
	return got.post(`${config.apiUrl}/i`, {
		json: {
			i: config.i
		}
	}).json().catch(retry);
}, {
	retries: 3
}).then(async account => {
	const acct = `@${(account as any).username}`;
	log(chalk.green(`Account fetched successfully: ${chalk.underline(acct)}`));

	log('Starting AiOS...');

	// 唯起動
	new 唯(account as any, [
		new CoreModule(),
		new YamiiModule(),
		new AiChatModule(),
		new ReminderModule(),
		new TalkModule(),
		new CheckCustomEmojisModule(),
		new EmojiModule(),
		// new EmojiReactModule(), // TODO: (TECH_TASKS TASK-007) Evaluate and re-enable if emoji-react is implemented
		new FortuneModule(),
		new GuessingGameModule(),
		new KazutoriModule(),
		new ReversiModule(),
		new TimerModule(),
		new DiceModule(),
		new PingModule(),
		new WelcomeModule(),
		new ServerModule(),
		new FollowModule(),
		new BirthdayModule(),
		new ValentineModule(),
		// new KeywordModule(), // TODO: (TECH_TASKS TASK-004) Implement keyword learning module or remove docs reference
		// new MazeModule(),
		// new ChartModule(), // TODO: (TECH_TASKS TASK-005) Chart integration is documented but commented out in src/index.ts
		new SleepReportModule(),
		new NotingModule(),
		// new PollModule(), // TODO: Consider enabling once poll module stabilized
		// new EarthQuakeWarningModule(), // TODO: Earthquake warning doc exists but module is commented out; sync status
	]);
}).catch(e => {
	log(chalk.red('Failed to fetch the account'));
});
