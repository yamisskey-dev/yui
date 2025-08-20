import { User } from '@/misskey/user.js';

export class UserFormatter {
  public static formatUserForLog(user: User): string {
    if (user.host) {
      return `@${user.username}@${user.host}(${user.id})`;
    }
    return `@${user.username}(${user.id})`;
  }
}