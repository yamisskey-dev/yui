// Original code from: https://github.com/lqvp/ai
// Copyright (c) 2025 lqvp
// Licensed under MIT License

import { bindThis } from '@/decorators.js';
import Module from '@/module.js';
import Message from '@/message.js';
import config from '@/config.js';
import { User, UserDetailed } from '@/misskey/user.js';
import { UserFormatter } from '@/utils/user-formatter.js';
import serifs from '@/serifs.js';

// 定数定義
const ACTIONS = {
  FOLLOW: 'follow',
  UNFOLLOW: 'unfollow',
} as const;

const KEYWORDS = {
  FOLLOW: ['フォロー', 'フォロバ', 'follow me'],
} as const;

// Master用ユーザーコマンドの型定義
interface MasterUserCommand {
  action: typeof ACTIONS.FOLLOW | typeof ACTIONS.UNFOLLOW;
  targetUsername: string;
  targetHost?: string; // undefined for local users
}

// 1回の自動解除処理で unfollow する最大件数（API異常時の暴走アンフォロー対策）
const UNFOLLOW_BATCH_LIMIT = 10;

export default class extends Module {
  public readonly name = 'follow';

  @bindThis
  public install() {
    this.unfollowNonFollowers();
    setInterval(this.unfollowNonFollowers, 1000 * 60 * 60 * 3); // 3時間に1回

    return {
      mentionHook: this.mentionHook,
    };
  }

  @bindThis
  private isMasterUser(msg: Message): boolean {
    return msg.user?.username === config.master && msg.user?.host === null;
  }

  /**
   * マスターが強制フォローしたユーザーID一覧（自動アンフォローから保護する）
   */
  @bindThis
  private getProtectedFollowIds(): string[] {
    const data = this.getData();
    return Array.isArray(data.protectedFollowIds) ? data.protectedFollowIds : [];
  }

  @bindThis
  private setProtectedFollowIds(ids: string[]) {
    const data = this.getData();
    data.protectedFollowIds = ids;
    this.setData(data);
  }

  @bindThis
  private extractTargetMentions(
    text: string
  ): { username: string; host?: string }[] {
    const mentionPattern = /@([a-zA-Z0-9_-]+)(?:@([a-zA-Z0-9.-]+))?/g;
    const matches = [...text.matchAll(mentionPattern)];
    const aiName = this.ai.account.username;
    // `@yui@own.host` 形式でも自分自身を除外できるように自ホスト名を求めておく
    let ownHost: string | undefined;
    try {
      ownHost = new URL(config.host).host;
    } catch {
      ownHost = undefined;
    }

    return matches
      .map((match) => ({
        username: match[1],
        host: match[2] || undefined,
      }))
      .filter(
        (mention) =>
          !(mention.username === aiName && (!mention.host || mention.host === ownHost))
      );
  }

  @bindThis
  private parseMasterUserCommand(msg: Message): MasterUserCommand | null {
    if (!msg.text) return null;

    // 先頭のメンション群を除いた本文が "follow" / "unfollow" で始まる場合のみ
    // コマンドとみなす（"did you follow @alice?" のような文での誤発動を防ぐ）
    const stripped = msg.text
      .replace(/^(?:@[a-zA-Z0-9_-]+(?:@[a-zA-Z0-9.-]+)?\s*)+/, '')
      .trim()
      .toLowerCase();

    // 単語境界まで見る（"followers を見せて" のような本文での誤発動を防ぐ）
    let action: typeof ACTIONS.FOLLOW | typeof ACTIONS.UNFOLLOW | null = null;
    if (/^unfollow(\s|$)/.test(stripped)) {
      action = ACTIONS.UNFOLLOW;
    } else if (/^follow(\s|$)/.test(stripped)) {
      action = ACTIONS.FOLLOW;
    } else {
      return null;
    }

    // ターゲットユーザーを抽出
    const mentions = this.extractTargetMentions(msg.text);
    if (mentions.length === 0) return null;

    const target = mentions[0]; // 最初のメンションをターゲットとする

    return {
      action,
      targetUsername: target.username,
      targetHost: target.host,
    };
  }

  @bindThis
  private formatUserDisplay(username: string, host?: string): string {
    return `@${username}${host ? '@' + host : ''}`;
  }

  @bindThis
  private formatCommandResult(
    success: boolean,
    action: string,
    userDisplay: string
  ): string {
    if (success) {
      if (action === ACTIONS.FOLLOW) {
        return serifs.follow.success.follow(userDisplay);
      } else {
        return serifs.follow.success.unfollow(userDisplay);
      }
    } else {
      const actionText =
        action === ACTIONS.FOLLOW ? 'フォロー' : 'フォロー解除';
      return serifs.follow.error.apiFailed(userDisplay, actionText);
    }
  }

  @bindThis
  private async lookupUser(
    username: string,
    host?: string
  ): Promise<UserDetailed | null> {
    try {
      // ローカルユーザーの場合
      if (!host) {
        const user = await this.ai.api('users/show', {
          username: username,
        }) as UserDetailed;
        return user;
      }

      // リモートユーザーの場合
      const user = await this.ai.api('users/show', {
        username: username,
        host: host,
      }) as UserDetailed;
      return user;
    } catch (error) {
      this.log(
        `Failed to lookup user @${username}${host ? '@' + host : ''}: ${error}`
      );
      return null;
    }
  }

  @bindThis
  private async followUserByMaster(targetUser: UserDetailed): Promise<boolean> {
    try {
      this.log(
        `Attempting to follow user: ${UserFormatter.formatUserForLog(
          targetUser
        )} (ID: ${targetUser.id})`
      );

      // 既にフォロー中かチェック
      if (targetUser.isFollowing) {
        this.log(
          `User ${UserFormatter.formatUserForLog(
            targetUser
          )} is already being followed`
        );
      }

      await this.ai.api('following/create', {
        userId: targetUser.id,
      });
      // マスターの意思によるフォローは自動アンフォロー対象から保護する
      const protectedIds = this.getProtectedFollowIds();
      if (!protectedIds.includes(targetUser.id)) {
        this.setProtectedFollowIds([...protectedIds, targetUser.id]);
      }
      this.log(
        `Master forced follow: ${UserFormatter.formatUserForLog(targetUser)}`
      );
      return true;
    } catch (error) {
      this.log(`Failed to follow user by master: ${error}`);
      if (error instanceof Error) {
        this.log(`Error details: ${error.message}`);
      }
      return false;
    }
  }

  @bindThis
  private async unfollowUserByMaster(
    targetUser: UserDetailed
  ): Promise<boolean> {
    try {
      this.log(
        `Attempting to unfollow user: ${UserFormatter.formatUserForLog(
          targetUser
        )} (ID: ${targetUser.id})`
      );

      // フォローしているかチェック
      if (!targetUser.isFollowing) {
        this.log(
          `User ${UserFormatter.formatUserForLog(
            targetUser
          )} is not being followed`
        );
      }

      await this.ai.api('following/delete', {
        userId: targetUser.id,
      });
      this.setProtectedFollowIds(
        this.getProtectedFollowIds().filter((id) => id !== targetUser.id)
      );
      this.log(
        `Master forced unfollow: ${UserFormatter.formatUserForLog(targetUser)}`
      );
      return true;
    } catch (error) {
      this.log(`Failed to unfollow user by master: ${error}`);
      if (error instanceof Error) {
        this.log(`Error details: ${error.message}`);
      }
      return false;
    }
  }

  @bindThis
  private async executeUserCommand(
    command: MasterUserCommand,
    msg: Message
  ): Promise<boolean> {
    // ユーザー検索
    const targetUser = await this.lookupUser(
      command.targetUsername,
      command.targetHost
    );
    if (!targetUser) {
      const userDisplay = this.formatUserDisplay(
        command.targetUsername,
        command.targetHost
      );
      await msg.reply(serifs.follow.error.userNotFound(userDisplay));
      return false;
    }

    // アクション実行
    let success = false;

    if (command.action === ACTIONS.FOLLOW) {
      success = await this.followUserByMaster(targetUser);
    } else {
      success = await this.unfollowUserByMaster(targetUser);
    }

    // 結果通知
    const userDisplay = this.formatUserDisplay(
      command.targetUsername,
      command.targetHost
    );
    const resultMessage = this.formatCommandResult(
      success,
      command.action,
      userDisplay
    );
    await msg.reply(resultMessage);

    return success;
  }

  @bindThis
  private async mentionHook(msg: Message) {
    const allowedHosts = config.followAllowedHosts || [];
    const followExcludeInstances = config.followExcludeInstances || [];

    // Master用コマンド処理
    if (this.isMasterUser(msg)) {
      const command = this.parseMasterUserCommand(msg);
      if (command) {
        this.log(
          `Master command detected: ${command.action} @${
            command.targetUsername
          }${command.targetHost ? '@' + command.targetHost : ''}`
        );
        await this.executeUserCommand(command, msg);
        return { reaction: 'like' };
      }
    }

    // 既存の一般ユーザー向けフォロー処理
    if (
      msg.text &&
      KEYWORDS.FOLLOW.some((keyword) => msg.text.includes(keyword))
    ) {
      // ユーザーの詳細情報を取得
      let detailedUser: UserDetailed;
      try {
        detailedUser = (await this.ai.api('users/show', {
          userId: msg.userId,
        })) as UserDetailed;
      } catch (error) {
        console.error('Failed to fetch user details:', error);
        return false;
      }

      // console.log('User host:', detailedUser.host);
      // console.log('User following status:', detailedUser.isFollowing);

      if (
        !detailedUser.isFollowing &&
        (detailedUser.host == null ||
          detailedUser.host === '' ||
          this.shouldFollowUser(
            detailedUser.host,
            allowedHosts,
            followExcludeInstances
          ))
      ) {
        try {
          await this.ai.api('following/create', {
            userId: msg.userId,
          });
          return {
            reaction: msg.friend.love >= 0 ? 'like' : null,
          };
        } catch (error) {
          console.error('Failed to follow user:', error);
          return false;
        }
      } else if (!detailedUser.isFollowing) {
        await msg.reply(serifs.follow.error.permissionDenied);
        return {
          reaction: msg.friend.love >= 0 ? 'hmm' : null,
        };
      }
    } else {
      return false;
    }
    return false;
  }

  /**
   * リモートユーザーをフォローすべきかどうかを判定する
   * @param host ユーザーのホスト
   * @param allowedHosts 許可されたホストのリスト
   * @param excludedHosts 除外されたホストのリスト
   * @returns フォローすべき場合はtrue、そうでない場合はfalse
   */
  private shouldFollowUser(
    host: string,
    allowedHosts: string[],
    excludedHosts: string[]
  ): boolean {
    // followAllowedHostsが存在する場合、followExcludeInstancesを無視する
    if (allowedHosts.length > 0) {
      return this.matchHost(host, allowedHosts);
    }
    // followAllowedHostsが存在しない場合、followExcludeInstancesを適用する
    return !this.matchHost(host, excludedHosts);
  }

  /**
   * ホストがパターンリストに一致するかどうかを判定する（`*` プレフィックスでワイルドカード）
   */
  private matchHost(host: string, patterns: string[]): boolean {
    for (const pattern of patterns) {
      if (pattern.startsWith('*')) {
        const domain = pattern.slice(1);
        if (host.endsWith(domain)) {
          return true;
        }
      } else if (host === pattern) {
        return true;
      }
    }
    return false;
  }

  @bindThis
  private async unfollowNonFollowers() {
    this.log('Unfollowing non-followers...');

    try {
      const following = await this.fetchAllUsers('users/following');
      this.log(`Fetched ${following.length} following users`);

      const followers = await this.fetchAllUsers('users/followers');
      this.log(`Fetched ${followers.length} followers`);

      // サニティチェック: フォロー中は存在するのにフォロワーが1人も取れない場合、
      // API 応答の異常（形式変化・障害）の可能性が高いので全解除せずに中断する
      if (following.length > 0 && followers.length === 0) {
        this.log(
          'Aborting unfollow: followers list is empty while following list is not. Possibly an API issue.'
        );
        return;
      }

      const followerIds = new Set(followers.map((u) => u.id));
      const protectedIds = new Set(this.getProtectedFollowIds());

      const usersToUnfollow = following.filter((u) => {
        if (protectedIds.has(u.id)) return false; // マスター強制フォローは保護
        return !followerIds.has(u.id);
      });
      this.log(
        `Found ${usersToUnfollow.length} users to unfollow: ${usersToUnfollow
          .map((u) => UserFormatter.formatUserForLog(u))
          .join(', ')}`
      );

      if (usersToUnfollow.length === 0) {
        this.log('No users to unfollow.');
        return;
      }

      // 1回の実行での解除件数を制限する（残りは次回実行で処理される）
      const batch = usersToUnfollow.slice(0, UNFOLLOW_BATCH_LIMIT);
      if (batch.length < usersToUnfollow.length) {
        this.log(
          `Unfollow batch limited to ${batch.length}/${usersToUnfollow.length} users.`
        );
      }

      for (const user of batch) {
        try {
          await this.ai.api('following/delete', { userId: user.id });
          this.log(`Unfollowed ${UserFormatter.formatUserForLog(user)}`);
        } catch (error) {
          console.error(`Failed to unfollow @${user.username}:`, error);
        }
      }

      this.log('Unfollowing process finished.');
    } catch (error) {
      console.error('Failed to unfollow non-followers:', error);
    }
  }

  private async fetchAllUsers(
    endpoint: 'users/following' | 'users/followers'
  ): Promise<User[]> {
    let allUsers: User[] = [];
    let untilId: string | undefined = undefined;

    while (true) {
      const responseItems = await this.ai.api(endpoint, {
        userId: this.ai.account.id,
        limit: 100,
        untilId: untilId,
      }) as Array<{ id: string; followee?: User; follower?: User }>;

      if (!responseItems || responseItems.length === 0) {
        break;
      }

      let extractedUsers: User[];
      if (endpoint === 'users/following') {
        extractedUsers = responseItems
          .map((item) => (item as { followee: User }).followee)
          .filter((user) => user && user.id);
      } else {
        // users/followers
        extractedUsers = responseItems
          .map((item) => (item as { follower: User }).follower)
          .filter((user) => user && user.id);
      }
      // 要素はあるのに1件も抽出できない場合はレスポンス形式が想定外。
      // 黙って空リストを返すと呼び出し元が「フォロワー0」と誤認して
      // 全員アンフォローしかねないため、明示的に失敗させる
      if (extractedUsers.length === 0) {
        throw new Error(`Unexpected response shape from ${endpoint}`);
      }
      allUsers = allUsers.concat(extractedUsers);

      if (responseItems.length < 100) {
        // Optimization: if less than limit, no more pages
        break;
      }
      untilId = responseItems[responseItems.length - 1].id;
    }

    return allUsers;
  }
}