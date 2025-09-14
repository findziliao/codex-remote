/**
 * Feishu Notification Channel
 * Sends notifications via Feishu Bot API with command support
 */

const NotificationChannel = require('../base/channel');
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');
const TmuxMonitor = require('../../utils/tmux-monitor');
const { execSync } = require('child_process');

class FeishuChannel extends NotificationChannel {
    constructor(config = {}) {
        super('feishu', config);
        this.sessionsDir = path.join(__dirname, '../../data/sessions');
        this.tmuxMonitor = new TmuxMonitor();
        this.apiBaseUrl = 'https://open.feishu.cn';
        this.accessToken = null;
        this.tokenExpiry = null;
        
        this._ensureDirectories();
        this._validateConfig();
    }

    _ensureDirectories() {
        if (!fs.existsSync(this.sessionsDir)) {
            fs.mkdirSync(this.sessionsDir, { recursive: true });
        }
    }

    _validateConfig() {
        if (!this.config.appId) {
            this.logger.warn('Feishu App ID not found');
            return false;
        }
        if (!this.config.appSecret) {
            this.logger.warn('Feishu App Secret not found');
            return false;
        }
        if (!this.config.userId && !this.config.groupId) {
            this.logger.warn('Feishu User ID or Group ID must be configured');
            return false;
        }
        return true;
    }

    /**
     * Get Feishu tenant access token
     * @returns {Promise<string>} Access token
     */
    async _getAccessToken() {
        // Check if current token is still valid
        if (this.accessToken && this.tokenExpiry && Date.now() < this.tokenExpiry) {
            return this.accessToken;
        }

        try {
            const response = await axios.post(`${this.apiBaseUrl}/open-apis/auth/v3/tenant_access_token/internal`, {
                app_id: this.config.appId,
                app_secret: this.config.appSecret
            }, {
                headers: {
                    'Content-Type': 'application/json; charset=utf-8'
                }
            });

            if (response.data.code === 0) {
                this.accessToken = response.data.tenant_access_token;
                // Token expires in 2 hours, set expiry 1 hour early for safety
                this.tokenExpiry = Date.now() + (response.data.expire - 3600) * 1000;
                this.logger.debug('Successfully obtained Feishu access token');
                return this.accessToken;
            } else {
                throw new Error(`Feishu API error: ${response.data.msg}`);
            }
        } catch (error) {
            this.logger.error('Failed to get Feishu access token:', error.message);
            throw error;
        }
    }

    /**
     * Send message via Feishu API
     * @param {string} receiveId - User ID or Group ID
     * @param {string} receiveType - 'user' or 'group'
     * @param {Object} message - Message content
     * @returns {Promise<boolean>} Success status
     */
    async _sendMessage(receiveId, receiveType, message) {
        try {
            const token = await this._getAccessToken();
            
            // Use open_id instead of user_id for better compatibility
            const idType = receiveType === 'user' ? 'open_id' : 'chat_id';
            
            let requestBody;
            if (message.msg_type === 'text') {
                // For text messages, content should be a JSON string: {"text": "message content"}
                const textContent = typeof message.content === 'string' ? message.content : message.content.text || '';
                requestBody = {
                    receive_id: receiveId,
                    content: JSON.stringify({ text: textContent }),
                    msg_type: 'text'
                };
            } else if (message.msg_type === 'interactive') {
                // For interactive messages, content should be a JSON string of the card
                requestBody = {
                    receive_id: receiveId,
                    content: JSON.stringify(message.card),
                    msg_type: 'interactive'
                };
            } else {
                // For other message types, content should be a JSON string
                requestBody = {
                    receive_id: receiveId,
                    content: typeof message.content === 'string' ? message.content : JSON.stringify(message.content),
                    msg_type: message.msg_type || 'text'
                };
            }
            
            const response = await axios.post(`${this.apiBaseUrl}/open-apis/im/v1/messages?receive_id_type=${idType}`, requestBody, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json; charset=utf-8'
                }
            });

            if (response.data.code === 0) {
                this.logger.debug('Message sent successfully via Feishu');
                return true;
            } else {
                this.logger.error('Feishu API error:', response.data.msg);
                this.logger.error('Feishu API error details:', JSON.stringify(response.data, null, 2));
                return false;
            }
        } catch (error) {
            this.logger.error('Failed to send Feishu message:', error.message);
            if (error.response) {
                this.logger.error('Error response status:', error.response.status);
                this.logger.error('Error response data:', error.response.data);
                this.logger.error('Error response headers:', error.response.headers);
            }
            if (error.request) {
                this.logger.error('Error request config:', error.request);
            }
            return false;
        }
    }

    /**
     * Generate session token for command relay
     * @returns {string} Session token
     */
    _generateSessionToken() {
        return Math.random().toString(36).substring(2, 10).toUpperCase();
    }

    /**
     * Save session information
     * @param {string} token - Session token
     * @param {Object} sessionData - Session data
     */
    _saveSession(token, sessionData) {
        const sessionFile = path.join(this.sessionsDir, `feishu_${token}.json`);
        const sessionInfo = {
            token,
            timestamp: Date.now(),
            expiresAt: Date.now() + (24 * 60 * 60 * 1000), // 24 hours
            channel: 'feishu',
            receiveId: sessionData.receiveId,
            receiveType: sessionData.receiveType,
            conversationContext: sessionData.conversationContext || null
        };

        fs.writeFileSync(sessionFile, JSON.stringify(sessionInfo, null, 2));
        this.logger.debug(`Session saved: ${token}`);
    }

    /**
     * Extract content from the last ● symbol line to the end
     * @param {string} response - Full Claude response
     * @returns {string} Content from last ● symbol line to end
     */
    _extractFromLastBullet(response) {
        if (!response) return '';
        
        // 按行分割文本
        const lines = response.split('\n');
        const bulletLineIndices = [];
        
        // 收集所有以●符号开头的行号位置
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            if (line.startsWith('●')) {
                bulletLineIndices.push(i);
            }
        }
        
        if (bulletLineIndices.length === 0) {
            return response; // 如果没有●符号开头的行，返回完整内容
        }
        
        // 获取最后一个●符号开头的行号
        const lastBulletLineIndex = bulletLineIndices[bulletLineIndices.length - 1];
        
        // 返回从该行开始一直到结尾的所有内容
        const resultLines = lines.slice(lastBulletLineIndex);
        return resultLines.join('\n');
    }

    /**
     * Format notification message for Feishu
     * @param {Object} notification - Notification object
     * @returns {Object} Formatted message
     */
    _formatMessage(notification) {
        const token = this._generateSessionToken();
        
        // Save session for command relay
        const sessionInfo = {
            receiveId: this.config.userId || this.config.groupId,
            receiveType: this.config.userId ? 'user' : 'group',
            conversationContext: {
                session: 'claude-session',
                timestamp: Date.now()
            }
        };
        this._saveSession(token, sessionInfo);

        const emoji = notification.type === 'completed' ? '✅' : '⏳';
        const title = notification.title || 'Claude Code Remote';
        const project = notification.project || '';
        const timestamp = new Date().toLocaleString('zh-CN');

        // 提取Claude回复的关键信息（最多3句话）
        let claudeSummary = '';
        if (notification.metadata && notification.metadata.claudeResponse) {
            const response = notification.metadata.claudeResponse;
            // 移除特殊符号和代码块
            const cleanResponse = response.replace(/```[\s\S]*?```/g, '').replace(/`([^`]+)`/g, '$1');
            // 按句子分割
            const sentences = cleanResponse.split(/[.!?。！？]/).filter(s => s.trim().length > 0);
            // 取前3个句子
            claudeSummary = sentences.slice(0, 3).join('。') + (sentences.length > 3 ? '...' : '');
        }

        // 构建简洁的消息内容
        const textContent = `${emoji} ${title}

📁 ${project || 'N/A'} | ⏰ ${timestamp}

${claudeSummary || notification.message || '任务已完成'}`;

        // 创建交互式卡片消息
        return {
            msg_type: 'interactive',
            card: {
                config: {
                    wide_screen_mode: true
                },
                elements: [
                    {
                        tag: 'div',
                        text: {
                            content: `${emoji} ${title}`,
                            tag: 'lark_md'
                        }
                    },
                    {
                        tag: 'hr'
                    },
                    {
                        tag: 'div',
                        text: {
                            content: `📁 ${project || 'N/A'} | ⏰ ${timestamp}`,
                            tag: 'lark_md'
                        }
                    },
                    {
                        tag: 'hr'
                    },
                    {
                        tag: 'div',
                        text: {
                            content: claudeSummary || notification.message || '任务已完成',
                            tag: 'lark_md'
                        }
                    },
                    {
                        tag: 'hr'
                    },
                    {
                        tag: 'div',
                        text: {
                            content: '**💡 发送自定义指令**',
                            tag: 'lark_md'
                        }
                    },
                    {
                        tag: 'form',
                        elements: [
                            {
                                tag: 'input',
                                element_id: 'command_input',
                                margin: '0px 0px 8px 0px',
                                placeholder: {
                                    tag: 'plain_text',
                                    content: '请输入您的指令...'
                                },
                                default_value: '',
                                width: 'default',
                                label: {
                                    tag: 'plain_text',
                                    content: '指令：'
                                },
                                name: 'command_input'
                            },
                            {
                                tag: 'column_set',
                                flex_mode: 'none',
                                background_style: 'default',
                                horizontal_spacing: 'default',
                                columns: [
                                    {
                                        tag: 'column',
                                        width: 'auto',
                                        vertical_align: 'top',
                                        elements: [
                                            {
                                                tag: 'button',
                                                text: {
                                                    tag: 'plain_text',
                                                    content: '发送指令'
                                                },
                                                type: 'primary',
                                                action_type: 'form_submit',
                                                name: 'submit_button',
                                                value: {
                                                    cmd: '/cmd',
                                                    token: token
                                                }
                                            }
                                        ]
                                    },
                                    {
                                        tag: 'column',
                                        width: 'auto',
                                        vertical_align: 'top',
                                        elements: [
                                            {
                                                tag: 'button',
                                                text: {
                                                    tag: 'plain_text',
                                                    content: '清除'
                                                },
                                                type: 'default',
                                                action_type: 'form_reset',
                                                name: 'reset_button'
                                            }
                                        ]
                                    }
                                ],
                                margin: '0px'
                            }
                        ],
                        name: 'command_form'
                    }
                ]
            }
        };
    }

    /**
     * Implementation-specific send logic
     * @param {Object} notification - Notification object
     * @returns {Promise<boolean>} Success status
     */
    async _sendImpl(notification) {
        try {
            const message = this._formatMessage(notification);
            const receiveId = this.config.userId || this.config.groupId;
            const receiveType = this.config.userId ? 'user' : 'group';

            return await this._sendMessage(receiveId, receiveType, message);
        } catch (error) {
            this.logger.error('Failed to send Feishu notification:', error);
            return false;
        }
    }

    /**
     * Check if the channel supports command relay
     * @returns {boolean} Support status
     */
    supportsRelay() {
        return true;
    }

    /**
     * Validate incoming request
     * @param {Object} data - Request data
     * @returns {boolean} Validation status
     */
    _validateRequest(data) {
        // Validate whitelist if configured
        if (this.config.whitelist && this.config.whitelist.length > 0) {
            const senderId = data.sender?.sender_id?.user_id || data.sender?.sender_id?.open_id;
            if (!senderId || !this.config.whitelist.includes(senderId)) {
                this.logger.warn('Unauthorized sender:', senderId);
                return false;
            }
        }

        return true;
    }

    /**
     * Parse command from message
     * @param {string} text - Message text
     * @returns {Object|null} Parsed command
     */
    _parseCommand(text) {
        // Support formats: /cmd TOKEN command or Token <TOKEN> command
        const cmdMatch = text.match(/\/cmd\s+([A-Z0-9]{8})\s+(.+)/i);
        const tokenMatch = text.match(/Token\s+([A-Z0-9]{8})\s+(.+)/i);
        
        if (cmdMatch) {
            return {
                token: cmdMatch[1],
                command: cmdMatch[2].trim()
            };
        }
        
        if (tokenMatch) {
            return {
                token: tokenMatch[1],
                command: tokenMatch[2].trim()
            };
        }

        return null;
    }

    /**
     * Load session information
     * @param {string} token - Session token
     * @returns {Object|null} Session data
     */
    _loadSession(token) {
        const sessionFile = path.join(this.sessionsDir, `feishu_${token}.json`);
        
        if (!fs.existsSync(sessionFile)) {
            return null;
        }

        try {
            const sessionData = JSON.parse(fs.readFileSync(sessionFile, 'utf8'));
            
            // Check if session is expired
            if (Date.now() > sessionData.expiresAt) {
                fs.unlinkSync(sessionFile);
                return null;
            }

            return sessionData;
        } catch (error) {
            this.logger.error('Failed to load session:', error.message);
            return null;
        }
    }

    /**
     * Handle incoming command from Feishu
     * @param {string} command - Command to execute
     * @param {Object} context - Command context
     * @returns {Promise<boolean>} Success status
     */
    async handleCommand(command, context = {}) {
        if (!this.supportsRelay()) {
            return false;
        }

        try {
            const parsed = this._parseCommand(command);
            if (!parsed) {
                this.logger.warn('Invalid command format:', command);
                return false;
            }

            const session = this._loadSession(parsed.token);
            if (!session) {
                this.logger.warn('Invalid or expired session token:', parsed.token);
                return false;
            }

            // Use ControllerInjector to execute command
            const ControllerInjector = require('../../utils/controller-injector');
            const injector = new ControllerInjector();

            const sessionName = session.conversationContext?.session || 'claude-session';
            const result = await injector.injectCommand(parsed.command, sessionName);

            if (result) {
                this.logger.info('Command executed successfully via Feishu');
                return true;
            } else {
                this.logger.error('Command execution failed');
                return false;
            }
        } catch (error) {
            this.logger.error('Error handling Feishu command:', error.message);
            return false;
        }
    }

    /**
     * Get channel status
     * @returns {Object} Status information
     */
    getStatus() {
        return {
            name: this.name,
            enabled: this.enabled,
            configured: this.validateConfig(),
            supportsRelay: this.supportsRelay(),
            hasValidToken: this.accessToken && this.tokenExpiry > Date.now(),
            userId: this.config.userId ? 'configured' : 'not configured',
            groupId: this.config.groupId ? 'configured' : 'not configured'
        };
    }

    /**
     * Validate channel configuration
     * @returns {boolean} Validation status
     */
    validateConfig() {
        return this._validateConfig();
    }
}

module.exports = FeishuChannel;