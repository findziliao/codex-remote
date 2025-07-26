/**
 * Email Listener
 * Monitors IMAP inbox for replies and extracts commands
 */

const Imap = require('node-imap');
const { simpleParser } = require('mailparser');
const EventEmitter = require('events');
const Logger = require('../core/logger');
const fs = require('fs');
const path = require('path');

class EmailListener extends EventEmitter {
    constructor(config) {
        super();
        this.logger = new Logger('EmailListener');
        this.config = config;
        this.imap = null;
        this.isConnected = false;
        this.isListening = false;
        this.sessionsDir = path.join(__dirname, '../data/sessions');
        this.checkInterval = (config.template?.checkInterval || 30) * 1000; // 转换为毫秒
        this.lastCheckTime = new Date();
        
        this._ensureDirectories();
    }

    _ensureDirectories() {
        if (!fs.existsSync(this.sessionsDir)) {
            fs.mkdirSync(this.sessionsDir, { recursive: true });
        }
    }

    async start() {
        if (this.isListening) {
            this.logger.warn('Email listener already running');
            return;
        }

        try {
            await this._connect();
            this._startListening();
            this.isListening = true;
            this.logger.info('Email listener started successfully');
        } catch (error) {
            this.logger.error('Failed to start email listener:', error.message);
            throw error;
        }
    }

    async stop() {
        if (!this.isListening) {
            return;
        }

        this.isListening = false;
        
        if (this.imap) {
            this.imap.end();
            this.imap = null;
        }
        
        this.isConnected = false;
        this.logger.info('Email listener stopped');
    }

    async _connect() {
        return new Promise((resolve, reject) => {
            this.imap = new Imap({
                user: this.config.imap.auth.user,
                password: this.config.imap.auth.pass,
                host: this.config.imap.host,
                port: this.config.imap.port,
                tls: this.config.imap.secure,
                connTimeout: 10000,
                authTimeout: 5000,
                keepalive: true
            });

            this.imap.once('ready', () => {
                this.isConnected = true;
                this.logger.debug('IMAP connection established');
                resolve();
            });

            this.imap.once('error', (error) => {
                this.logger.error('IMAP connection error:', error.message);
                reject(error);
            });

            this.imap.once('end', () => {
                this.isConnected = false;
                this.logger.debug('IMAP connection ended');
            });

            this.imap.connect();
        });
    }

    _startListening() {
        // 定期检查新邮件
        this._checkNewMails();
        setInterval(() => {
            if (this.isListening && this.isConnected) {
                this._checkNewMails();
            }
        }, this.checkInterval);
    }

    async _checkNewMails() {
        try {
            await this._openInbox();
            await this._searchAndProcessMails();
        } catch (error) {
            this.logger.error('Error checking emails:', error.message);
            
            // 如果连接断开，尝试重连
            if (!this.isConnected) {
                this.logger.info('Attempting to reconnect...');
                try {
                    await this._connect();
                } catch (reconnectError) {
                    this.logger.error('Reconnection failed:', reconnectError.message);
                }
            }
        }
    }

    async _openInbox() {
        return new Promise((resolve, reject) => {
            this.imap.openBox('INBOX', false, (error, box) => {
                if (error) {
                    reject(error);
                } else {
                    resolve(box);
                }
            });
        });
    }

    async _searchAndProcessMails() {
        return new Promise((resolve, reject) => {
            // 搜索最近的未读邮件
            const searchCriteria = [
                'UNSEEN',
                ['SINCE', this.lastCheckTime]
            ];

            this.imap.search(searchCriteria, (searchError, results) => {
                if (searchError) {
                    reject(searchError);
                    return;
                }

                if (results.length === 0) {
                    resolve();
                    return;
                }

                this.logger.debug(`Found ${results.length} new emails`);

                const fetch = this.imap.fetch(results, { 
                    bodies: '',
                    markSeen: true 
                });

                fetch.on('message', (msg, seqno) => {
                    this._processMessage(msg, seqno);
                });

                fetch.once('error', (fetchError) => {
                    this.logger.error('Fetch error:', fetchError.message);
                    reject(fetchError);
                });

                fetch.once('end', () => {
                    this.lastCheckTime = new Date();
                    resolve();
                });
            });
        });
    }

    _processMessage(msg, seqno) {
        let buffer = '';

        msg.on('body', (stream, info) => {
            stream.on('data', (chunk) => {
                buffer += chunk.toString('utf8');
            });

            stream.once('end', async () => {
                try {
                    const parsed = await simpleParser(buffer);
                    await this._handleParsedEmail(parsed, seqno);
                } catch (parseError) {
                    this.logger.error('Email parsing error:', parseError.message);
                }
            });
        });

        msg.once('attributes', (attrs) => {
            this.logger.debug(`Processing email ${seqno}:`, {
                date: attrs.date,
                flags: attrs.flags
            });
        });

        msg.once('end', () => {
            this.logger.debug(`Finished processing email ${seqno}`);
        });
    }

    async _handleParsedEmail(email, seqno) {
        try {
            // 检查是否是回复邮件
            if (!this._isReplyEmail(email)) {
                this.logger.debug(`Email ${seqno} is not a TaskPing reply`);
                return;
            }

            // 提取会话ID
            const sessionId = this._extractSessionId(email);
            if (!sessionId) {
                this.logger.warn(`No session ID found in email ${seqno}`);
                return;
            }

            // 验证会话
            const session = await this._validateSession(sessionId);
            if (!session) {
                this.logger.warn(`Invalid session ID in email ${seqno}: ${sessionId}`);
                return;
            }

            // 提取命令
            const command = this._extractCommand(email);
            if (!command) {
                this.logger.warn(`No command found in email ${seqno}`);
                return;
            }

            // 安全检查
            if (!this._isCommandSafe(command)) {
                this.logger.warn(`Unsafe command in email ${seqno}: ${command}`);
                return;
            }

            // 发出命令事件
            this.emit('command', {
                sessionId,
                command: command.trim(),
                email: {
                    from: email.from?.text,
                    subject: email.subject,
                    date: email.date
                },
                session
            });

            this.logger.info(`Command extracted from email ${seqno}:`, {
                sessionId,
                command: command.substring(0, 100) + (command.length > 100 ? '...' : ''),
                from: email.from?.text
            });

        } catch (error) {
            this.logger.error(`Error handling email ${seqno}:`, error.message);
        }
    }

    _isReplyEmail(email) {
        // 检查主题是否包含 TaskPing 标识
        const subject = email.subject || '';
        if (!subject.includes('[TaskPing]')) {
            return false;
        }

        // 检查是否是回复 (Re: 或 RE:)
        const isReply = /^(Re:|RE:|回复:)/i.test(subject);
        if (isReply) {
            return true;
        }

        // 检查邮件头中是否有会话ID
        const sessionId = this._extractSessionId(email);
        return !!sessionId;
    }

    _extractSessionId(email) {
        // 从邮件头中提取
        const headers = email.headers;
        if (headers && headers.get('x-taskping-session-id')) {
            return headers.get('x-taskping-session-id');
        }

        // 从邮件正文中提取 (作为备用方案)
        const text = email.text || '';
        const sessionMatch = text.match(/会话ID:\s*([a-f0-9-]{36})/i);
        if (sessionMatch) {
            return sessionMatch[1];
        }

        // 从引用的邮件中提取
        const html = email.html || '';
        const htmlSessionMatch = html.match(/会话ID:\s*<code>([a-f0-9-]{36})<\/code>/i);
        if (htmlSessionMatch) {
            return htmlSessionMatch[1];
        }

        return null;
    }

    async _validateSession(sessionId) {
        const sessionFile = path.join(this.sessionsDir, `${sessionId}.json`);
        
        if (!fs.existsSync(sessionFile)) {
            return null;
        }

        try {
            const sessionData = JSON.parse(fs.readFileSync(sessionFile, 'utf8'));
            
            // 检查会话是否过期
            const now = new Date();
            const expires = new Date(sessionData.expires);
            
            if (now > expires) {
                this.logger.debug(`Session ${sessionId} has expired`);
                // 删除过期会话
                fs.unlinkSync(sessionFile);
                return null;
            }

            // 检查命令数量限制
            if (sessionData.commandCount >= sessionData.maxCommands) {
                this.logger.debug(`Session ${sessionId} has reached command limit`);
                return null;
            }

            return sessionData;
        } catch (error) {
            this.logger.error(`Error reading session ${sessionId}:`, error.message);
            return null;
        }
    }

    _extractCommand(email) {
        let text = email.text || '';
        
        // 移除邮件签名和引用内容
        text = this._cleanEmailContent(text);
        
        // 移除空行和多余的空白字符
        text = text.replace(/\n\s*\n/g, '\n').trim();
        
        return text;
    }

    _cleanEmailContent(text) {
        // 移除常见的邮件引用标记
        const lines = text.split('\n');
        const cleanLines = [];
        let foundOriginalMessage = false;
        
        for (const line of lines) {
            // 检查是否到达原始邮件开始
            if (line.includes('-----Original Message-----') ||
                line.includes('--- Original Message ---') ||
                line.includes('在') && line.includes('写道:') ||
                line.includes('On') && line.includes('wrote:') ||
                line.match(/^>\s*/) ||  // 引用标记
                line.includes('会话ID:')) {
                foundOriginalMessage = true;
                break;
            }
            
            // 跳过常见的邮件签名
            if (line.includes('--') || 
                line.includes('Sent from') ||
                line.includes('发自我的')) {
                break;
            }
            
            cleanLines.push(line);
        }
        
        return cleanLines.join('\n').trim();
    }

    _isCommandSafe(command) {
        // 基本安全检查
        if (command.length > 1000) {
            return false;
        }

        // 危险命令黑名单
        const dangerousPatterns = [
            /rm\s+-rf/i,
            /sudo\s+/i,
            /chmod\s+777/i,
            />\s*\/dev\/null/i,
            /curl.*\|\s*sh/i,
            /wget.*\|\s*sh/i,
            /eval\s*\(/i,
            /exec\s*\(/i
        ];

        for (const pattern of dangerousPatterns) {
            if (pattern.test(command)) {
                return false;
            }
        }

        return true;
    }

    async updateSessionCommandCount(sessionId) {
        const sessionFile = path.join(this.sessionsDir, `${sessionId}.json`);
        
        if (fs.existsSync(sessionFile)) {
            try {
                const sessionData = JSON.parse(fs.readFileSync(sessionFile, 'utf8'));
                sessionData.commandCount = (sessionData.commandCount || 0) + 1;
                sessionData.lastCommand = new Date().toISOString();
                
                fs.writeFileSync(sessionFile, JSON.stringify(sessionData, null, 2));
                this.logger.debug(`Updated command count for session ${sessionId}: ${sessionData.commandCount}`);
            } catch (error) {
                this.logger.error(`Error updating session ${sessionId}:`, error.message);
            }
        }
    }
}

module.exports = EmailListener;