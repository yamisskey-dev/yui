// navi - 人生相談サーバー連携モジュール（拡張版）
// yuiボットからnaviサーバーの全機能を活用

import { bindThis } from '@/decorators.js';
import Module from '@/module.js';
import Message from '@/message.js';
import config from '@/config.js';
import got from 'got';

// navi サーバーのレスポンス型定義
type NaviResponse = {
    response: string;
    session_id: string;
    timestamp: string;
    emotion_analysis: {
        primary_emotion: string;
        intensity: number;
        is_crisis: boolean;
        all_emotions: Record<string, number>;
    };
    advice_type: string;
    follow_up_questions: string[];
    is_crisis: boolean;
};

type NaviRequest = {
    message: string;
    user_id: string;
    user_name?: string;
    session_id?: string;
    context?: Record<string, any>;
    custom_prompt_id?: string;
    prompt_id?: string;
};

// カスタムプロンプト型定義（簡略化）
type CustomPrompt = {
    name: string;
    prompt_text: string;
    description: string;
    tags: string[];
    created_at: string;
    updated_at: string;
};

// NAVI.mdプロンプト型定義
type NaviPrompt = {
    id: string;
    title: string;
    name: string;
    description: string;
    tags: string[];
    found: boolean;
};

export default class extends Module {
    public readonly name = 'navi';
    
    private naviApiUrl: string;
    private userSessions: Map<string, string> = new Map(); // userId -> sessionId
    private userPreferences: Map<string, { promptId?: string }> = new Map(); // ユーザー設定（customPromptIdは削除）
    private persistentStorage: Map<string, any> = new Map(); // 永続化ストレージ

    @bindThis
    public install() {
        // navi サーバーのURLを設定から取得
        this.naviApiUrl = (config as any).naviApiUrl || 'http://localhost:8000';
        
        // 永続化された設定を復元
        this.loadPersistentSettings();
        
        return {
            mentionHook: this.mentionHook,
            contextHook: this.contextHook,
        };
    }

    @bindThis
    private loadPersistentSettings() {
        // NOTE: 実際の実装では、ファイルシステムやデータベースから設定を読み込む
        // ここでは簡易的にメモリ内で管理
        try {
            const savedPrefs = this.persistentStorage.get('userPreferences');
            if (savedPrefs) {
                this.userPreferences = new Map(savedPrefs);
                this.log('User preferences loaded from persistent storage');
            }
        } catch (error) {
            this.log(`Failed to load persistent settings: ${error}`);
        }
    }

    @bindThis
    private savePersistentSettings() {
        try {
            this.persistentStorage.set('userPreferences', Array.from(this.userPreferences.entries()));
            this.log('User preferences saved to persistent storage');
        } catch (error) {
            this.log(`Failed to save persistent settings: ${error}`);
        }
    }

    @bindThis
    private async mentionHook(msg: Message) {
        if (msg.text == null) return false;

        // 自分自身の投稿には反応しない
        if (msg.userId === this.ai.account.id) {
            return false;
        }

        // 管理コマンドの処理
        if (await this.handleManagementCommands(msg)) {
            return true;
        }

        // プロファイル設定コマンドの処理
        if (await this.handleProfileCommands(msg)) {
            return true;
        }

        // スラッシュコマンドの判定
        const naviCommands = [
            'navi '
        ];

        const isNaviCommand = naviCommands.some(cmd =>
            msg.text?.toLowerCase().startsWith(cmd.toLowerCase())
        );

        if (!isNaviCommand) {
            return false;
        }

        this.log('Navi counseling request detected');

        try {
            // コマンドプレフィックスを除去してメッセージを抽出
            let cleanMessage = msg.text;
            if (cleanMessage.toLowerCase().startsWith('navi ')) {
                cleanMessage = cleanMessage.substring(5).trim();
            }

            if (cleanMessage.length === 0) {
                msg.reply('人生相談をご利用いただきありがとうございます。どのようなことでお悩みでしょうか？お気軽にお話しください。');
                return true;
            }

            // navi サーバーにリクエスト送信
            const response = await this.sendToNaviServer(cleanMessage, msg.userId, msg.user.name);
            
            if (response) {
                // クライシス状況の場合は特別な対応
                if (response.is_crisis) {
                    const crisisMessage = `${response.response}\n\n⚠️ **緊急時相談窓口**\n📞 いのちの電話: 0570-783-556\n📞 こころの健康相談統一ダイヤル: 0570-064-556\n\nあなたは一人ではありません。`;
                    
                    msg.reply(crisisMessage);
                } else {
                    // 通常のカウンセリング応答
                    let replyText = response.response;
                    
                    // フォローアップ質問の表示を削除（ユーザーエクスペリエンス向上）
                    // より自然な会話体験のため、追加質問は表示しない
                    
                    // 感情分析結果の表示は削除（ユーザーエクスペリエンス向上）
                    // デバッグが必要な場合はサーバーログを確認
                    
                    msg.reply(replyText);
                }

                // セッションIDを記録
                this.userSessions.set(msg.userId, response.session_id);
                
                return true;
            } else {
                msg.reply('申し訳ありません。現在人生相談サービスが利用できません。時間を置いてもう一度お試しください。');
                return false;
            }

        } catch (error) {
            this.log(`Navi service error: ${error}`);
            
            // エラーの詳細分析
            let errorMessage = '人生相談サービスでエラーが発生しました。';
            let troubleshooting = '';
            
            if (error instanceof Error) {
                if (error.message.includes('ECONNREFUSED') || error.message.includes('fetch failed')) {
                    errorMessage = '❌ naviサーバーに接続できませんでした。';
                    troubleshooting = '\n\n🔧 **トラブルシューティング:**\n' +
                        '• `navi status` でサーバー状況を確認\n' +
                        '• naviサーバーが起動していることを確認\n' +
                        '• ネットワーク接続を確認';
                } else if (error.message.includes('timeout')) {
                    errorMessage = '⏱️ サーバーからの応答がタイムアウトしました。';
                    troubleshooting = '\n\n💡 **解決方法:**\n' +
                        '• しばらく時間を置いてから再度お試しください\n' +
                        '• 複雑な相談内容の場合は、短く分けてみてください';
                } else if (error.message.includes('500')) {
                    errorMessage = '🔧 サーバー内部でエラーが発生しました。';
                    troubleshooting = '\n\n📞 **サポート:**\n' +
                        '• 問題が続く場合は管理者にお知らせください\n' +
                        '• エラー時刻: ' + new Date().toLocaleString('ja-JP');
                }
            }
            
            msg.reply(errorMessage + troubleshooting + '\n\nお手数をおかけして申し訳ございません。');
            return false;
        }
    }

    @bindThis
    private async contextHook(key: any, msg: Message) {
        if (msg.text == null) return false;

        // 継続中のセッションがあるかチェック
        const sessionId = this.userSessions.get(msg.userId);
        if (!sessionId) {
            return false;
        }

        // セッション終了コマンド（navi 終了 のみ）
        if (msg.includes(['navi 終了'])) {
            this.userSessions.delete(msg.userId);
            this.unsubscribeReply(key);
            msg.reply('人生相談を終了しました。また何かあればいつでもお声がけください。お疲れ様でした。');
            return true;
        }

        // 継続的な会話として処理
        try {
            const response = await this.sendToNaviServer(msg.text, msg.userId, msg.user.name, sessionId);
            
            if (response) {
                this.unsubscribeReply(key);
                
                if (response.is_crisis) {
                    const crisisMessage = `${response.response}\n\n⚠️ **緊急時相談窓口**\n📞 いのちの電話: 0570-783-556\n📞 こころの健康相談統一ダイヤル: 0570-064-556`;
                    msg.reply(crisisMessage);
                } else {
                    let replyText = response.response;
                    
                    // フォローアップ質問の表示を削除（継続会話でも不要）
                    
                    msg.reply(replyText);
                }

                // 新しい会話として継続
                this.subscribeReply(response.session_id, false, msg.userId);
                this.setTimeoutWithPersistence(1000 * 60 * 30, { // 30分でタイムアウト
                    id: response.session_id,
                    userId: msg.userId,
                    isNaviSession: true
                });

                return { reaction: 'like' };
            }

        } catch (error) {
            this.log(`Navi context error: ${error}`);
            msg.reply('申し訳ありません。人生相談の継続中にエラーが発生しました。');
            this.unsubscribeReply(key);
            return false;
        }

        return false;
    }

    @bindThis
    private async handleManagementCommands(msg: Message): Promise<boolean> {
        if (!msg.text) return false;

        const text = msg.text.toLowerCase().trim();

        // プロンプト管理コマンド
    if (text.startsWith('navi /prompt')) {
            return await this.handlePromptCommands(msg);
        }

        // カスタムプロンプト管理コマンド
    if (text.startsWith('navi /custom')) {
            return await this.handleCustomPromptCommands(msg);
        }

        // セッション管理コマンド
    if (text.startsWith('navi /session')) {
            return await this.handleSessionCommands(msg);
        }

        // ヘルプ表示
    if (text === 'navi /help') {
            return await this.showHelp(msg);
        }

        // ステータス確認
    if (text === 'navi /status') {
            return await this.showStatus(msg);
        }

        // バージョン情報
    if (text === 'navi /version') {
            return await this.showVersion(msg);
        }

        // クイックアクセスコマンド
        if (text === 'navi') {
            return await this.showQuickStart(msg);
        }

        return false;
    }

    @bindThis
    private async handlePromptCommands(msg: Message): Promise<boolean> {
        const text = msg.text!.toLowerCase();

        try {
            if (text.includes('/prompt list') || text.includes('prompt list') || text.includes('一覧')) {
                // NAVI.mdプロンプト一覧を表示
                const prompts = await this.listNaviPrompts();
                if (prompts.length > 0) {
                    let response = '🎭 **利用可能なプロンプト:**\n\n';
                    prompts.forEach((prompt, index) => {
                        response += `${index + 1}. **${prompt.name}** (ID: \`${prompt.id}\`)\n`;
                        response += `   ${prompt.description}\n\n`;
                    });
                    response += '使用方法: `navi /prompt set <ID>`';
                    msg.reply(response);
                } else {
                    msg.reply('利用可能なプロンプトが見つかりませんでした。');
                }
                return true;
            }

            const setMatch = text.match(/(?:\/prompt set|prompt set)\s+(\w+)/);
            if (setMatch) {
                const promptId = setMatch[1];
                const userPref = this.userPreferences.get(msg.userId) || {};
                userPref.promptId = promptId;
                this.userPreferences.set(msg.userId, userPref);
                this.savePersistentSettings(); // 設定を永続化
                msg.reply(`✅ プロンプトを「${promptId}」に設定しました。次回の相談から適用されます。`);
                return true;
            }

            if (text.includes('/prompt reset') || text.includes('prompt reset') || text.includes('リセット')) {
                const userPref = this.userPreferences.get(msg.userId) || {};
                userPref.promptId = undefined;
                this.userPreferences.set(msg.userId, userPref);
                this.savePersistentSettings(); // 設定を永続化
                msg.reply('✅ プロンプト設定をリセットしました。デフォルトプロンプトを使用します。');
                return true;
            }

        } catch (error) {
            this.log(`Prompt command error: ${error}`);
            msg.reply('プロンプト管理でエラーが発生しました。');
        }

        return false;
    }

    @bindThis
    private async handleCustomPromptCommands(msg: Message): Promise<boolean> {
        const text = msg.text!;

        try {
            if (text.toLowerCase().includes('delete') || text.includes('削除')) {
                try {
                    await this.deleteCustomPrompt(msg.userId);
                    msg.reply('✅ カスタムプロンプトを削除しました。次回からデフォルトプロンプトを使用します。');
                } catch (error) {
                    this.log(`[ERROR] Custom prompt deletion failed: ${error}`);
                    msg.reply('❌ カスタムプロンプトの削除に失敗しました。');
                }
                return true;
            }

            // カスタムプロンプト作成コマンド
            const createMatch = text.match(/(?:\/custom create|custom create)\s+(.+)/);
            if (createMatch || text.toLowerCase().includes('create')) {
                if (createMatch) {
                    const fullPromptText = createMatch[1].trim();
                    
                    // ダブルクォートで囲まれている場合は除去
                    const promptText = fullPromptText.startsWith('"') && fullPromptText.endsWith('"')
                        ? fullPromptText.slice(1, -1)
                        : fullPromptText;
                    
                    this.log(`[DEBUG] Custom prompt create:
                        - Full text: ${text}
                        - Extracted prompt: ${promptText}
                        - Length: ${promptText.length}`);
                    
                    if (promptText.length === 0) {
                        msg.reply('❌ プロンプトの内容を入力してください。\n例: `navi /custom create あなたは優しい先生です。丁寧に教えてください。`');
                        return true;
                    }
                    
                    // プロンプトの最初の部分から自動で名前を生成
                    const autoName = promptText.substring(0, 20) + (promptText.length > 20 ? '...' : '');
                    
                    try {
                        await this.createCustomPrompt(msg.userId, autoName, promptText, 'カスタムプロンプト', ['custom']);
                        
                        // 現在のプロンプトが設定されたか確認
                        const currentPrompt = await this.getCustomPrompt(msg.userId);
                        const hasPrompt = currentPrompt && currentPrompt.has_custom_prompt;
                        
                        msg.reply(`✅ カスタムプロンプト「${autoName}」を${hasPrompt ? '更新' : '作成'}しました！\n\n✨ **次回の相談から自動的に適用されます**\n\n📝 プロンプト内容 (${promptText.length}文字):\n${promptText.length > 100 ? promptText.substring(0, 100) + '...' : promptText}\n\n削除: \`navi /custom delete\``);
                    } catch (error) {
                        this.log(`[ERROR] Custom prompt creation failed: ${error}`);
                        msg.reply('❌ カスタムプロンプトの作成に失敗しました。');
                    }
                } else {
                    // 使用方法を表示
                    const createHelp = `📝 **カスタムプロンプト管理:**\n\n` +
                        `**作成・更新:**\n` +
                        `\`navi /custom create プロンプト内容\`\n\n` +
                        `**削除:**\n` +
                        `\`navi /custom delete\`\n\n` +
                        `**例:**\n` +
                        `\`navi /custom create あなたは優しい先生です。分からないことがあったら丁寧に教えてください。\`\n\n` +
                        `✨ カスタムプロンプトは1つのみ保存され、作成後すぐに自動適用されます。`;
                    msg.reply(createHelp);
                }
                return true;
            }

        } catch (error) {
            this.log(`Custom prompt command error: ${error}`);
            msg.reply('カスタムプロンプト管理でエラーが発生しました。');
        }

        return false;
    }

    @bindThis
    private async handleSessionCommands(msg: Message): Promise<boolean> {
        const text = msg.text!.toLowerCase();

        try {
            if (text.includes('status') || text.includes('状況')) {
                const status = await this.getSessionStatus(msg.userId);
                if (status) {
                    const response = `📊 **セッション状況:**\n\n` +
                        `セッションID: \`${status.session_id}\`\n` +
                        `会話数: ${status.conversation_count}回\n` +
                        `最終更新: ${new Date(status.last_interaction).toLocaleString('ja-JP')}\n` +
                        `主な感情: ${status.primary_emotions.join(', ')}`;
                    msg.reply(response);
                } else {
                    msg.reply('アクティブなセッションがありません。');
                }
                return true;
            }

            if (text.includes('summary') || text.includes('サマリー')) {
                const summary = await this.getUserSummary(msg.userId);
                if (summary && summary.total_conversations > 0) {
                    const response = `📈 **相談履歴サマリー:**\n\n` +
                        `総会話数: ${summary.total_conversations}回\n` +
                        `平均重要度: ${summary.average_importance}/10\n` +
                        `主な課題: ${summary.most_common_issue}\n` +
                        `注意が必要: ${summary.needs_attention ? 'はい' : 'いいえ'}\n` +
                        `最終相談: ${summary.last_interaction ? new Date(summary.last_interaction).toLocaleString('ja-JP') : 'なし'}`;
                    msg.reply(response);
                } else {
                    msg.reply('相談履歴がありません。');
                }
                return true;
            }

            if (text.includes('end') || text.includes('終了')) {
                const sessionId = this.userSessions.get(msg.userId);
                if (sessionId) {
                    this.userSessions.delete(msg.userId);
                    msg.reply('✅ セッションを終了しました。お疲れ様でした。');
                } else {
                    msg.reply('アクティブなセッションがありません。');
                }
                return true;
            }

        } catch (error) {
            this.log(`Session command error: ${error}`);
            msg.reply('セッション管理でエラーが発生しました。');
        }

        return false;
    }

    @bindThis
    private async showHelp(msg: Message): Promise<boolean> {
        const help = `🤖 **Navi 人生相談ボット - ヘルプ**\n\n` +
            `**📝 基本的な相談方法:**\n` +
            `• \`navi <相談内容>\` - 人生相談を開始\n` +
            `• \`navi 終了\` - 相談を終了\n\n` +
            `**🎭 プロンプト管理:**\n` +
            `• \`navi /prompt list\` - 利用可能なプロンプト一覧\n` +
            `• \`navi /prompt set <ID>\` - プロンプトを設定\n` +
            `• \`navi /prompt reset\` - プロンプト設定をリセット\n\n` +
            `**📝 カスタムプロンプト:**\n` +
            `• \`navi /custom create\` - カスタムプロンプト作成・更新（自動適用）\n` +
            `• \`navi /custom delete\` - カスタムプロンプト削除\n\n` +
            `**📊 セッション管理:**\n` +
            `• \`navi /session status\` - 現在のセッション状況\n` +
            `• \`navi /session summary\` - 相談履歴サマリー\n` +
            `• \`navi /session end\` - セッションを強制終了\n\n` +
            `**👤 プロファイル管理:**\n` +
            `• \`navi /profile show\` - プロファイル表示\n` +
            `• \`navi /profile setup\` - 初期設定開始\n` +
            `• \`navi /profile setname <名前>\` - 名前設定\n` +
            `• \`navi /profile setjob <職業>\` - 職業設定\n` +
            `• \`navi /profile setpersonality <性格>\` - 性格設定\n\n` +
            `**⚙️ その他のコマンド:**\n` +
            `• \`navi /help\` - このヘルプを表示\n` +
            `• \`navi /status\` - サーバー状況確認\n` +
            `• \`navi /version\` - バージョン情報\n\n` +
            `**💡 使用例:**\n` +
            `navi 仕事でストレスを感じています\n` +
            `navi /prompt list\n` +
            `navi /profile setname 田中太郎`;

        msg.reply(help);
        return true;
    }

    @bindThis
    private async listNaviPrompts(): Promise<NaviPrompt[]> {
        try {
            const response = await got.get(`${this.naviApiUrl}/prompts`).json() as { message: string, prompts: NaviPrompt[] };
            return response.prompts || [];
        } catch (error) {
            this.log(`Failed to list navi prompts: ${error}`);
            return [];
        }
    }

    @bindThis
    private async handleProfileCommands(msg: Message): Promise<boolean> {
        if (!msg.text) return false;

        const text = msg.text.toLowerCase().trim();

        if (text.startsWith('navi /profile') || text.startsWith('navi profile') || text.startsWith('navi プロファイル')) {
            try {
                if (text.includes('/profile show') || text.includes('profile show') || text.includes('表示')) {
                    return await this.showUserProfile(msg);
                }

                if (text.includes('/profile setname') || text.includes('profile setname')) {
                    const nameMatch = text.match(/(?:\/profile setname|profile setname)\s+(.+)/);
                    if (nameMatch) {
                        await this.setProfileField(msg.userId, 'name', nameMatch[1].trim());
                        msg.reply(`✅ お名前を「${nameMatch[1].trim()}」に設定しました。`);
                        return true;
                    }
                }

                if (text.includes('/profile setjob') || text.includes('profile setjob')) {
                    const jobMatch = text.match(/(?:\/profile setjob|profile setjob)\s+(.+)/);
                    if (jobMatch) {
                        await this.setProfileField(msg.userId, 'occupation', jobMatch[1].trim());
                        msg.reply(`✅ 職業を「${jobMatch[1].trim()}」に設定しました。`);
                        return true;
                    }
                }

                if (text.includes('/profile setpersonality') || text.includes('profile setpersonality')) {
                    const personalityMatch = text.match(/(?:\/profile setpersonality|profile setpersonality)\s+(.+)/);
                    if (personalityMatch) {
                        await this.setProfileField(msg.userId, 'personality', personalityMatch[1].trim());
                        msg.reply(`✅ 性格を「${personalityMatch[1].trim()}」に設定しました。`);
                        return true;
                    }
                }

                if (text.includes('/profile setup')) {
                    return await this.startProfileSetup(msg);
                }

            } catch (error) {
                this.log(`Profile command error: ${error}`);
                msg.reply('プロファイル管理でエラーが発生しました。');
            }

            return true;
        }

        return false;
    }

    @bindThis
    private async showUserProfile(msg: Message): Promise<boolean> {
        try {
            const response = await got.get(`${this.naviApiUrl}/profile`, {
                searchParams: { user_id: msg.userId }
            }).json() as any;

            let profileText = '👤 **あなたのプロファイル:**\n\n';
            profileText += `お名前: ${response.name || '未設定'}\n`;
            profileText += `職業・状況: ${response.occupation || '未設定'}\n`;
            profileText += `希望する性格: ${response.personality || '未設定'}\n`;
            
            if (response.characteristics && response.characteristics.length > 0) {
                profileText += `特徴: ${response.characteristics.join(', ')}\n`;
            }
            
            if (response.additional_info) {
                profileText += `追加情報: ${response.additional_info}\n`;
            }
            
            profileText += '\n設定変更: `navi /profile setup`';
            
            msg.reply(profileText);
            return true;

        } catch (error: any) {
            if (error?.response?.statusCode === 404) {
                msg.reply('プロファイルが設定されていません。`navi /profile setup` で初期設定を開始してください。');
            } else {
                this.log(`Profile fetch error: ${error}`);
                msg.reply('プロファイル取得でエラーが発生しました。時間を置いてもう一度お試しください。');
            }
            return true;
        }
    }

    @bindThis
    private async setProfileField(userId: string, field: string, value: string): Promise<void> {
        const requestBody: any = {};
        requestBody[field] = value;

        await got.post(`${this.naviApiUrl}/profile`, {
            searchParams: { user_id: userId },
            json: requestBody
        });
    }

    @bindThis
    private async startProfileSetup(msg: Message): Promise<boolean> {
        const setupText = `🛠️ **プロファイル初期設定**\n\n` +
            `ChatGPT形式の個人設定で、あなたに最適化された人生相談を受けられます。\n\n` +
            `**設定項目:**\n` +
            `• \`navi /profile setname <あなたの名前>\`\n` +
            `• \`navi /profile setjob <職業や状況>\`\n` +
            `• \`navi /profile setpersonality <希望する性格>\`\n\n` +
            `**性格の例:**\n` +
            `聞き役、励まし、率直、機知に富む、Z世代、前向きな考え方 など\n\n` +
            `設定後は自動的にあなたに合わせたカウンセリング対応になります！`;

        msg.reply(setupText);
        return true;
    }

    @bindThis
    private async getCustomPrompt(userId: string): Promise<any> {
        try {
            const response = await got.get(`${this.naviApiUrl}/custom-prompts`, {
                searchParams: { user_id: userId }
            }).json() as any;
            return response;
        } catch (error: any) {
            if (error?.response?.statusCode === 404) {
                return { has_custom_prompt: false, prompt: null }; // プロンプトなし
            }
            this.log(`Failed to get custom prompt: ${error}`);
            return { has_custom_prompt: false, prompt: null };
        }
    }

    @bindThis
    private async deleteCustomPrompt(userId: string): Promise<void> {
        await got.delete(`${this.naviApiUrl}/custom-prompts`, {
            searchParams: { user_id: userId }
        });
    }

    @bindThis
    private async createCustomPrompt(userId: string, name: string, promptText: string, description: string = '', tags: string[] = []): Promise<void> {
        const requestBody = {
            name,
            prompt_text: promptText,
            description,
            tags
        };

        await got.post(`${this.naviApiUrl}/custom-prompts`, {
            searchParams: { user_id: userId },
            json: requestBody
        });
    }

    @bindThis
    private async sendToNaviServer(message: string, userId: string, userName?: string, sessionId?: string): Promise<NaviResponse | null> {
        try {
            // ユーザー設定を取得
            const userPref = this.userPreferences.get(userId);
            
            const requestBody: NaviRequest = {
                message: message,
                user_id: userId,
                user_name: userName,
                session_id: sessionId,
                context: {
                    platform: 'misskey',
                    bot_name: 'yui'
                }
            };

            // プロンプト設定を適用（カスタムプロンプトは自動適用されるためcustom_prompt_idは送信不要）
            if (userPref?.promptId) {
                requestBody.prompt_id = userPref.promptId;
            }

            this.log(`Sending request to navi server: ${this.naviApiUrl}/counseling`);

            const response = await got.post(`${this.naviApiUrl}/counseling`, {
                json: requestBody,
                timeout: {
                    request: 30000 // 30秒タイムアウト
                },
                retry: {
                    limit: 2,
                    methods: ['POST']
                }
            }).json<NaviResponse>();

            this.log(`Navi server response received: emotion=${response.emotion_analysis.primary_emotion}, type=${response.advice_type}`);

            return response;

        } catch (error: any) {
            this.log(`Failed to communicate with navi server: ${error?.message || error}`);
            
            // サーバーエラーの詳細ログ
            if (error?.response?.statusCode) {
                this.log(`HTTP Status: ${error.response.statusCode}`);
                this.log(`Response body: ${error.response.body}`);
            }

            return null;
        }
    }

    @bindThis
    private async timeoutCallback(data: any) {
        if (data.isNaviSession) {
            this.log('Navi session timeout');
            
            if (data.userId) {
                this.userSessions.delete(data.userId);
                
                // タイムアウト通知（オプション）
                if ((config as any).naviTimeoutNotification) {
                    this.ai.sendMessage(data.userId, {
                        text: '人生相談のセッションがタイムアウトしました。また何かあればいつでもお声がけください。'
                    });
                }
            }
        }
    }

    @bindThis
    public async getSessionStatus(userId: string): Promise<any> {
        const sessionId = this.userSessions.get(userId);
        if (!sessionId) {
            return null;
        }

        try {
            const response = await got.get(`${this.naviApiUrl}/session/${sessionId}/status`).json();
            return response;
        } catch (error) {
            this.log(`Failed to get session status: ${error}`);
            return null;
        }
    }

    @bindThis
    public async getUserSummary(userId: string): Promise<any> {
        try {
            const response = await got.get(`${this.naviApiUrl}/users/${userId}/summary`).json();
            return response;
        } catch (error) {
            this.log(`Failed to get user summary: ${error}`);
            return null;
        }
    }

    @bindThis
    private async showStatus(msg: Message): Promise<boolean> {
        try {
            // naviサーバーのヘルスチェック
            const healthResponse = await got.get(`${this.naviApiUrl}/health`).json() as any;
            
            // 現在のセッション状況
            const sessionId = this.userSessions.get(msg.userId);
            const activeSessionsCount = this.userSessions.size;
            
            // ユーザーの設定状況
            const userPref = this.userPreferences.get(msg.userId);
            
            const statusText = `🔍 **Navi システム状況:**\n\n` +
                `**サーバー状況:**\n` +
                `• ステータス: ${healthResponse.status === 'healthy' ? '✅ 正常' : '❌ 異常'}\n` +
                `• サーバーURL: ${this.naviApiUrl}\n` +
                `• 最終確認: ${new Date(healthResponse.timestamp).toLocaleString('ja-JP')}\n\n` +
                `**あなたのセッション:**\n` +
                `• アクティブセッション: ${sessionId ? '✅ あり' : '❌ なし'}\n` +
                `• セッションID: ${sessionId || '未設定'}\n\n` +
                `**全体の状況:**\n` +
                `• アクティブユーザー数: ${activeSessionsCount}人\n\n` +
                `**あなたの設定:**\n` +
                `• 設定プロンプト: ${userPref?.promptId || 'なし'}\n` +
                `• プロンプトタイプ: ${userPref?.promptId ? 'NAVI.md' : 'デフォルト（カスタムがあれば自動適用）'}`;
            
            msg.reply(statusText);
            return true;
            
        } catch (error) {
            this.log(`Status check failed: ${error}`);
            msg.reply('❌ ステータス確認でエラーが発生しました。naviサーバーが起動していることを確認してください。');
            return true;
        }
    }

    @bindThis
    private async showVersion(msg: Message): Promise<boolean> {
        const versionInfo = `📋 **Navi バージョン情報:**\n\n` +
            `**Naviモジュール:**\n` +
            `• バージョン: 2.0.0\n` +
            `• 機能: 拡張スラッシュコマンド対応\n` +
            `• 最終更新: 2025年8月25日\n\n` +
            `**対応機能:**\n` +
            `• ✅ 基本人生相談\n` +
            `• ✅ カスタムプロンプト\n` +
            `• ✅ NAVI.mdプロンプト\n` +
            `• ✅ ユーザープロファイル\n` +
            `• ✅ セッション管理\n` +
            `• ✅ 感情分析\n` +
            `• ✅ クライシス検出\n` +
            `• ✅ フォローアップ質問\n\n` +
            `**API接続:**\n` +
            `• サーバー: ${this.naviApiUrl}\n` +
            `• プロトコル: HTTP REST API\n` +
            `• AI エンジン: Gemini 2.0 Flash`;
        
        msg.reply(versionInfo);
        return true;
    }

    @bindThis
    private async showQuickStart(msg: Message): Promise<boolean> {
        const quickStart = `🚀 **Navi クイックスタート**\n\n` +
            `**今すぐ相談を始める:**\n` +
            '`navi <相談内容>`\n\n' +
            `**主なコマンド:**\n` +
            '• `navi /help` - ヘルプ表示\n' +
            '• `navi /status` - サーバー状況確認\n' +
            '• `navi /prompt list` - プロンプト一覧\n' +
            '• `navi /profile show` - プロファイル表示\n\n' +
            `**初回設定推奨:**\n` +
            '1. `navi /profile setup` でプロファイル設定\n' +
            '2. `navi /prompt list` でお気に入りのキャラクターを選択\n' +
            '3. `navi こんにちは` で動作確認\n\n' +
            '詳細は `navi /help` をご確認ください。';
        
        msg.reply(quickStart);
        return true;
    }
}