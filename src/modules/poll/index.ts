import { bindThis } from '@/decorators.js';
import Message from '@/message.js';
import Module from '@/module.js';
import serifs from '@/serifs.js';
import { genItem } from '@/vocabulary.js';
import config from '@/config.js';
import type { Note } from '@/misskey/note.js';

export default class extends Module {
	public readonly name = 'poll';

	@bindThis
	public install() {
		setInterval(() => {
			if (Math.random() < 0.1) {
				this.post();
			}
		}, 1000 * 60 * 60);

		return {
			mentionHook: this.mentionHook,
			timeoutCallback: this.timeoutCallback,
		};
	}

	@bindThis
	private async post() {
		const duration = 1000 * 60 * 15;

		const polls = serifs.poll.themes;

		const poll = polls[Math.floor(Math.random() * polls.length)];

		const choices = [
			genItem(),
			genItem(),
			genItem(),
			genItem(),
		];

		const note = await this.ai.post({
			text: poll[1],
			poll: {
				choices,
				expiredAfter: duration,
				multiple: false,
			}
		});

		// タイマーセット
		this.setTimeoutWithPersistence(duration + 3000, {
			title: poll[0],
			noteId: note.id,
		});
	}

	@bindThis
	private async mentionHook(msg: Message) {
		if (!msg.or(['/poll']) || msg.user.username !== config.master) {
			return false;
		} else {
			this.log('Manualy poll requested');
		}

		this.post();

		return true;
	}

	@bindThis
	private async timeoutCallback({ title, noteId }) {
		const note: Note = await this.ai.api('notes/show', { noteId }) as any;

		const choices = note.poll!.choices;

		let mostVotedChoice;

		for (const choice of choices) {
			if (mostVotedChoice == null) {
				mostVotedChoice = choice;
				continue;
			}

			if (choice.votes > mostVotedChoice.votes) {
				mostVotedChoice = choice;
			}
		}

		const mostVotedChoices = choices.filter(choice => choice.votes === mostVotedChoice.votes);

		if (mostVotedChoice.votes === 0) {
			this.ai.post({
				text: serifs.poll.noVotes,
				renoteId: noteId,
			});
		} else if (mostVotedChoices.length === 1) {
			this.ai.post({
				cw: serifs.poll.resultCw(title),
				text: serifs.poll.result(title, mostVotedChoice.votes, mostVotedChoice.text),
				renoteId: noteId,
			});
		} else {
			const choices = mostVotedChoices.map(choice => `「${choice.text}」`).join('と');
			this.ai.post({
				cw: serifs.poll.resultCw(title),
				text: serifs.poll.resultTie(title, mostVotedChoice.votes, choices),
				renoteId: noteId,
			});
		}
	}
}
