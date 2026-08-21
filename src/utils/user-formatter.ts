import { User } from '@/misskey/user.js';

/**
 * ログ表示用にユーザーを @username[@host](id) 形式へ整形する
 */
export function formatUserForLog(user: User): string {
	if (user.host) {
		return `@${user.username}@${user.host}(${user.id})`;
	}
	return `@${user.username}(${user.id})`;
}
