// yamii - 人生相談サーバー連携モジュール（拡張版）
// yuiボットからyamiiサーバーの全機能を活用

import { bindThis } from '@/decorators.js';
import Module from '@/module.js';
import Message from '@/message.js';
import config from '@/config.js';
import got from 'got';

// yamii サーバーのレスポンス型定義
type YamiiResponse = {
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

type YamiiRequest = {
    message: string;
    user_id: string;
    user_name?: string;
    session_id?: string;
    context?: Record<string, any>;
    custom_prompt_id?: string;
    prompt_id?: string;
};

export default class extends Module {
    public readonly name = 'yamii';

    private yamiiApiUrl: string;
    private userSessions: Map<string, string> = new Map(); // userId -> sessionId
    private userPreferences: Map<string, { promptId?: string }> = new Map(); // ユーザー設定（customPromptIdは削除）
    private persistentStorage: Map<string, any> = new Map(); // 永続化ストレージ

    @bindThis
    public install() {
        // yamii サーバーのURLを設定から取得
        this.yamiiApiUrl = (config as any).yamiiApiUrl || 'http://localhost:8000';
        
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

        // プロファイル設定コマンドの処理（簡素化版）
        if (await this.handleProfileCommands(msg)) {
            return true;
        }
        
        // カスタムプロンプト管理コマンド
        if (msg.text.toLowerCase().trim().startsWith('yamii /custom')) {
            return await this.handleCustomPromptCommands(msg);
        }

        // スラッシュコマンドの判定
        const yamiiCommands = [
            'yamii '
        ];

        const isYamiiCommand = yamiiCommands.some(cmd =>
            msg.text?.toLowerCase().startsWith(cmd.toLowerCase())
        );

        if (!isYamiiCommand) {
            return false;
        }

        this.log('Yamii counseling request detected');

        try {
            // コマンドプレフィックスを除去してメッセージを抽出
            let cleanMessage = msg.text;
            if (cleanMessage.toLowerCase().startsWith('yamii ')) {
                cleanMessage = cleanMessage.substring(6).trim();
            }

            if (cleanMessage.length === 0) {
                msg.reply('人生相談をご利用いただきありがとうございます。どのようなことでお悩みでしょうか？お気軽にお話しください。');
                return true;
            }

            // yamii サーバーにリクエスト送信
            const response = await this.sendToYamiiServer(cleanMessage, msg.userId, msg.user.name);
            
            if (response) {
                // クライシス状況の場合は特別な対応
                if (response.is_crisis) {
                    const crisisMessage = `${response.response}\n\n⚠️ **緊急時相談窓口**\n📞 いのちの電話: 0570-783-556\n📞 こころの健康相談統一ダイヤル: 0570-064-556\n\nあなたは一人ではありません。`;
                    
                    msg.reply(crisisMessage);
                } else {
                    // 通常のカウンセリング応答
                    let replyText = response.response;
                    
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
            this.log(`Yamii service error: ${error}`);

            // エラーの詳細分析
            let errorMessage = '人生相談サービスでエラーが発生しました。';
            let troubleshooting = '';

            if (error instanceof Error) {
                if (error.message.includes('ECONNREFUSED') || error.message.includes('fetch failed')) {
                    errorMessage = '❌ yamiiサーバーに接続できませんでした。';
                    troubleshooting = '\n\n🔧 **トラブルシューティング:**\n' +
                        '• `yamii status` でサーバー状況を確認\n' +
                        '• yamiiサーバーが起動していることを確認\n' +
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

        // セッション終了コマンド（yamii 終了 のみ）
        if (msg.includes(['yamii 終了'])) {
            this.userSessions.delete(msg.userId);
            this.unsubscribeReply(key);
            msg.reply('人生相談を終了しました。また何かあればいつでもお声がけください。お疲れ様でした。');
            return true;
        }

        // 継続的な会話として処理
        try {
            const response = await this.sendToYamiiServer(msg.text, msg.userId, msg.user.name, sessionId);
            
            if (response) {
                this.unsubscribeReply(key);
                
                if (response.is_crisis) {
                    const crisisMessage = `${response.response}\n\n⚠️ **緊急時相談窓口**\n📞 いのちの電話: 0570-783-556\n📞 こころの健康相談統一ダイヤル: 0570-064-556`;
                    msg.reply(crisisMessage);
                } else {
                    let replyText = response.response;
                    
                    msg.reply(replyText);
                }

                // 新しい会話として継続
                this.subscribeReply(response.session_id, false, msg.userId);
                this.setTimeoutWithPersistence(1000 * 60 * 30, { // 30分でタイムアウト
                    id: response.session_id,
                    userId: msg.userId,
                    isYamiiSession: true
                });

                return { reaction: 'like' };
            }

        } catch (error) {
            this.log(`Yamii context error: ${error}`);
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

        // ヘルプ表示
        if (text === 'yamii /help') {
            return await this.showHelp(msg);
        }

        // ステータス確認（バージョン情報も含む）
        if (text === 'yamii /status') {
            return await this.showStatus(msg);
        }

        // クイックアクセスコマンド（ショートカット）
        if (text === 'yamii') {
            const quickHelp = `🚀 **Yamii クイックスタート**\n\n` +
                `**今すぐ相談:**\n` +
                `• \`yamii <相談内容>\` - 人生相談を開始\n\n` +
                `**コマンド:**\n` +
                `• \`yamii /help\` - 詳細ヘルプ\n` +
                `• \`yamii /status\` - システム状況\n` +
                `• \`yamii /custom set <プロンプト>\` - カスタムプロンプト\n` +
                `• \`yamii /profile set <情報>\` - プロファイル設定`;
            msg.reply(quickHelp);
            return true;
        }

        return false;
    }

    @bindThis
    private async handleCustomPromptCommands(msg: Message): Promise<boolean> {
        const text = msg.text!;

        try {
            if (text.toLowerCase().includes('show') || text.includes('表示')) {
                try {
                    const currentPrompt = await this.getCustomPrompt(msg.userId);
                    if (currentPrompt && currentPrompt.has_custom_prompt && currentPrompt.prompt) {
                        const prompt = currentPrompt.prompt;
                        msg.reply(`📝 **現在のカスタムプロンプト:**\n\n${prompt.prompt_text}\n\n削除: \`yamii /custom delete\``);
                    } else {
                        msg.reply('📝 **カスタムプロンプト:**\n\n現在設定されているカスタムプロンプトはありません。\n\n作成: `yamii /custom set <プロンプト内容>`');
                    }
                } catch (error) {
                    this.log(`[ERROR] Custom prompt show failed: ${error}`);
                    msg.reply('❌ カスタムプロンプトの取得に失敗しました。');
                }
                return true;
            }
            
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

            // カスタムプロンプト設定コマンド
            const setMatch = text.match(/(?:\/custom set|custom set)\s+(.+)/);
            if (setMatch || text.toLowerCase().includes('set')) {
                if (setMatch) {
                    const fullPromptText = setMatch[1].trim();
                    
                    // ダブルクォートで囲まれている場合は除去
                    const promptText = fullPromptText.startsWith('"') && fullPromptText.endsWith('"')
                        ? fullPromptText.slice(1, -1)
                        : fullPromptText;
                    
                    this.log(`[DEBUG] Custom prompt create:
                        - Full text: ${text}
                        - Extracted prompt: ${promptText}
                        - Length: ${promptText.length}`);
                    
                    if (promptText.length === 0) {
                        msg.reply('❌ プロンプトの内容を入力してください。\n例: `yamii /custom set あなたは優しい先生です。丁寧に教えてください。`');
                        return true;
                    }
                    
                    // プロンプトの最初の部分から自動で名前を生成
                    const autoName = promptText.substring(0, 20) + (promptText.length > 20 ? '...' : '');
                    
                    try {
                        await this.createCustomPrompt(msg.userId, promptText);
                        
                        // 現在のプロンプトが設定されたか確認
                        const currentPrompt = await this.getCustomPrompt(msg.userId);
                        const hasPrompt = currentPrompt && currentPrompt.has_custom_prompt;
                        
                        msg.reply(`✅ カスタムプロンプト「${autoName}」を${hasPrompt ? '更新' : '作成'}しました！\n\n✨ **次回の相談から自動的に適用されます**\n\n📝 プロンプト内容 (${promptText.length}文字):\n${promptText.length > 100 ? promptText.substring(0, 100) + '...' : promptText}\n\n削除: \`yamii /custom delete\``);
                    } catch (error) {
                        this.log(`[ERROR] Custom prompt creation failed: ${error}`);
                        msg.reply('❌ カスタムプロンプトの作成に失敗しました。');
                    }
                } else {
                    // 使用方法を表示
                    const createHelp = `📝 **カスタムプロンプト管理:**\n\n` +
                        `**作成・更新:**\n` +
                        `\`yamii /custom set プロンプト内容\`\n\n` +
                        `**削除:**\n` +
                        `\`yamii /custom delete\`\n\n` +
                        `**例:**\n` +
                        `\`yamii /custom set あなたは優しい先生です。分からないことがあったら丁寧に教えてください。\`\n\n` +
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
    private async showHelp(msg: Message): Promise<boolean> {
        const help = `👁️‍🗨️ **YAMII 人生相談AI - ヘルプ**\n\n` +
            `**📝 基本的な相談方法:**\n` +
            `• \`yamii <相談内容>\` - 人生相談を開始\n` +
            `• \`yamii 終了\` - 相談を終了\n\n` +
            `**📝 カスタムプロンプト:**\n` +
            `• \`yamii /custom set <プロンプト内容>\` - カスタムプロンプト設定\n` +
            `• \`yamii /custom show\` - カスタムプロンプト表示\n` +
            `• \`yamii /custom delete\` - カスタムプロンプト削除\n\n` +
            `**👤 プロファイル管理:**\n` +
            `• \`yamii /profile set <プロファイル情報>\` - プロファイル設定\n` +
            `• \`yamii /profile show\` - プロファイル表示\n` +
            `• \`yamii /profile delete\` - プロファイル削除\n\n` +
            `**⚙️ その他のコマンド:**\n` +
            `• \`yamii /help\` - このヘルプを表示\n` +
            `• \`yamii /status\` - サーバー状況・バージョン確認`;

        msg.reply(help);
        return true;
    }


    @bindThis
    private async handleProfileCommands(msg: Message): Promise<boolean> {
        if (!msg.text) return false;

        const text = msg.text.toLowerCase().trim();

        if (text.startsWith('yamii /profile') || text.startsWith('yamii profile') || text.startsWith('yamii プロファイル')) {
            try {
                if (text.includes('/profile show') || text.includes('profile show') || text.includes('表示')) {
                    return await this.showUserProfile(msg);
                }

                if (text.includes('/profile set') || text.includes('profile set')) {
                    const setMatch = text.match(/(?:\/profile set|profile set)\s+(.+)/);
                    if (setMatch) {
                        const profileInfo = setMatch[1].trim();
                        // 全ての情報を profile_text に統合して保存
                        await this.setProfileField(msg.userId, 'profile_text', profileInfo);
                        msg.reply(`✅ プロファイルを設定しました。\n\n📝 **設定内容 (${profileInfo.length}文字):**\n${profileInfo.length > 100 ? profileInfo.substring(0, 100) + '...' : profileInfo}\n\n💡 この情報はAIが常に覚えておき、相談時により適切なアドバイスを提供するために使用されます。`);
                        return true;
                    }
                }

                if (text.includes('/profile delete') || text.includes('profile delete')) {
                    try {
                        await this.deleteUserProfile(msg.userId);
                        msg.reply('✅ プロファイルを削除しました。次回からはデフォルト設定で人生相談を行います。');
                        return true;
                    } catch (error: any) {
                        if (error?.response?.statusCode === 404) {
                            msg.reply('❌ 削除するプロファイルが見つかりませんでした。');
                        } else {
                            this.log(`Profile deletion error: ${error}`);
                            msg.reply('❌ プロファイル削除でエラーが発生しました。');
                        }
                        return true;
                    }
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
            const response = await got.get(`${this.yamiiApiUrl}/profile`, {
                searchParams: { user_id: msg.userId }
            }).json() as any;

            let profileText = '👤 **あなたのプロファイル:**\n\n';
            
            if (response.profile_text) {
                profileText += `${response.profile_text}\n`;
            } else {
                profileText += 'プロファイルが設定されていません。\n';
            }
            
            profileText += '\n⚙️ **設定変更:**\n';
            profileText += '設定: `yamii /profile set <プロファイル情報>`\n';
            profileText += '削除: `yamii /profile delete`';
            
            msg.reply(profileText);
            return true;

        } catch (error: any) {
            if (error?.response?.statusCode === 404) {
                msg.reply('プロファイルが設定されていません。`yamii /profile set <プロファイル情報>` でプロファイルを設定してください。\\n\\n例: `yamii /profile set 山田太郎、無職です。趣味は読書と散歩です。`');
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

        await got.post(`${this.yamiiApiUrl}/profile`, {
            searchParams: { user_id: userId },
            json: requestBody
        });
    }

    @bindThis
    private async getCustomPrompt(userId: string): Promise<any> {
        try {
            const response = await got.get(`${this.yamiiApiUrl}/custom-prompts`, {
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
        await got.delete(`${this.yamiiApiUrl}/custom-prompts`, {
            searchParams: { user_id: userId }
        });
    }

    @bindThis
    private async createCustomPrompt(userId: string, promptText: string): Promise<void> {
        const requestBody = {
            prompt_text: promptText
        };

        await got.post(`${this.yamiiApiUrl}/custom-prompts`, {
            searchParams: { user_id: userId },
            json: requestBody
        });
    }

    @bindThis
    private async deleteUserProfile(userId: string): Promise<void> {
        await got.delete(`${this.yamiiApiUrl}/profile`, {
            searchParams: { user_id: userId }
        });
    }

    @bindThis
    private async sendToYamiiServer(message: string, userId: string, userName?: string, sessionId?: string): Promise<YamiiResponse | null> {
        try {
            // ユーザー設定を取得
            const userPref = this.userPreferences.get(userId);

            const requestBody: YamiiRequest = {
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

            this.log(`Sending request to yamii server: ${this.yamiiApiUrl}/counseling`);

            const response = await got.post(`${this.yamiiApiUrl}/counseling`, {
                json: requestBody,
                timeout: {
                    request: 30000 // 30秒タイムアウト
                },
                retry: {
                    limit: 2,
                    methods: ['POST']
                }
            }).json<YamiiResponse>();

            this.log(`Yamii server response received: emotion=${response.emotion_analysis.primary_emotion}, type=${response.advice_type}`);

            return response;

        } catch (error: any) {
            this.log(`Failed to communicate with yamii server: ${error?.message || error}`);
            
            // サーバーエラーの詳細ログ
            if (error?.response?.statusCode) {
                this.log(`HTTP Status: ${error.response.statusCode}`);
                this.log(`Response body: ${error.response.body}`);
            }

            return null;
        }
    }

    @bindThis
    private async showStatus(msg: Message): Promise<boolean> {
        try {
            // yamiiサーバーのヘルスチェック
            const healthResponse = await got.get(`${this.yamiiApiUrl}/health`).json() as any;

            const statusText = `🔍 **Yamii システム状況・バージョン情報:**\n\n` +
                `**サーバー状況:**\n` +
                `• ステータス: ${healthResponse.status === 'healthy' ? '✅ 正常' : '❌ 異常'}\n` +
                `• サーバーURL: ${this.yamiiApiUrl}\n` +
                `• 最終確認: ${new Date(healthResponse.timestamp).toLocaleString('ja-JP')}\n\n` +
                `**バージョン・機能情報:**\n` +
                `• Yamiiモジュール: 2.0.0\n` +
                `• 最終更新: 2025年8月27日\n` +
                `• 対応機能: 基本相談・カスタムプロンプト・プロファイル・感情分析・クライシス検出\n` +
                `• AI エンジン: Gemini 2.0 Flash`;

            msg.reply(statusText);
            return true;

        } catch (error) {
            this.log(`Status check failed: ${error}`);
            msg.reply('❌ ステータス確認でエラーが発生しました。yamiiサーバーが起動していることを確認してください。');
            return true;
        }
    }
}