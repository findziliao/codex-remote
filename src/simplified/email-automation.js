/**
 * 简化版邮件自动化
 * 专注于解决核心问题，减少复杂性
 */

const Imap = require('node-imap');
const { simpleParser } = require('mailparser');
const { spawn } = require('child_process');
const EventEmitter = require('events');
const fs = require('fs');
const path = require('path');

class SimplifiedEmailAutomation extends EventEmitter {
    constructor(config) {
        super();
        this.config = config;
        this.imap = null;
        this.isRunning = false;
        this.sessionsDir = path.join(__dirname, '../data/sessions');
        this.commandFile = path.join(__dirname, '../data/latest_command.txt');
        
        // 增加超时时间解决连接问题
        this.imapConfig = {
            user: config.imap.auth.user,
            password: config.imap.auth.pass,
            host: config.imap.host,
            port: config.imap.port,
            tls: config.imap.secure,
            connTimeout: 60000,    // 增加到60秒
            authTimeout: 30000,    // 增加到30秒
            keepalive: true,
            debug: process.env.DEBUG_IMAP === 'true'
        };
        
        this._ensureDirectories();
    }

    _ensureDirectories() {
        [this.sessionsDir, path.dirname(this.commandFile)].forEach(dir => {
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
        });
    }

    async start() {
        console.log('🚀 启动简化邮件自动化服务...');
        
        if (this.isRunning) {
            console.log('⚠️ 服务已在运行中');
            return;
        }

        try {
            await this._connectWithRetry();
            this._startListening();
            this.isRunning = true;
            console.log('✅ 邮件监听服务启动成功');
            console.log(`📧 监听邮箱: ${this.config.imap.auth.user}`);
            console.log('💡 现在可以回复 TaskPing 邮件来发送命令了');
        } catch (error) {
            console.error('❌ 启动失败:', error.message);
            throw error;
        }
    }

    async _connectWithRetry(maxRetries = 3) {
        for (let i = 0; i < maxRetries; i++) {
            try {
                console.log(`🔄 尝试连接 IMAP (${i + 1}/${maxRetries})...`);
                await this._connect();
                console.log('✅ IMAP 连接成功');
                return;
            } catch (error) {
                console.log(`❌ 连接失败 (${i + 1}/${maxRetries}): ${error.message}`);
                if (i === maxRetries - 1) throw error;
                await new Promise(resolve => setTimeout(resolve, 5000));
            }
        }
    }

    async _connect() {
        return new Promise((resolve, reject) => {
            this.imap = new Imap(this.imapConfig);

            this.imap.once('ready', () => {
                console.log('📬 IMAP 连接就绪');
                resolve();
            });

            this.imap.once('error', (error) => {
                console.error('📬 IMAP 连接错误:', error.message);
                reject(error);
            });

            this.imap.once('end', () => {
                console.log('📬 IMAP 连接结束');
                if (this.isRunning) {
                    console.log('🔄 尝试重新连接...');
                    setTimeout(() => this._connectWithRetry().catch(console.error), 10000);
                }
            });

            this.imap.connect();
        });
    }

    _startListening() {
        console.log('👂 开始监听新邮件...');
        
        // 立即检查一次
        this._checkNewEmails();
        
        // 定期检查（每30秒）
        setInterval(() => {
            if (this.isRunning) {
                this._checkNewEmails();
            }
        }, 30000);
    }

    async _checkNewEmails() {
        try {
            await this._openInbox();
            
            // 只查找最近1小时内的未读邮件
            const yesterday = new Date();
            yesterday.setHours(yesterday.getHours() - 1);
            
            const searchCriteria = [
                'UNSEEN',
                ['SINCE', yesterday]
            ];

            this.imap.search(searchCriteria, (err, results) => {
                if (err) {
                    console.error('🔍 搜索邮件失败:', err.message);
                    return;
                }

                if (results.length === 0) {
                    return; // 没有新邮件
                }

                console.log(`📧 发现 ${results.length} 封新邮件`);
                this._processEmails(results);
            });
        } catch (error) {
            console.error('📧 检查邮件失败:', error.message);
        }
    }

    _openInbox() {
        return new Promise((resolve, reject) => {
            this.imap.openBox('INBOX', false, (err, box) => {
                if (err) reject(err);
                else resolve(box);
            });
        });
    }

    _processEmails(emailUids) {
        const fetch = this.imap.fetch(emailUids, { 
            bodies: '',
            markSeen: true 
        });

        fetch.on('message', (msg, seqno) => {
            let buffer = '';

            msg.on('body', (stream) => {
                stream.on('data', (chunk) => {
                    buffer += chunk.toString('utf8');
                });

                stream.once('end', async () => {
                    try {
                        const parsed = await simpleParser(buffer);
                        await this._handleEmail(parsed, seqno);
                    } catch (error) {
                        console.error(`❌ 处理邮件 ${seqno} 失败:`, error.message);
                    }
                });
            });
        });

        fetch.once('error', (err) => {
            console.error('📧 获取邮件失败:', err.message);
        });
    }

    async _handleEmail(email, seqno) {
        console.log(`📨 处理邮件 ${seqno}: ${email.subject}`);
        
        // 简化的 TaskPing 邮件检查
        if (!this._isTaskPingReply(email)) {
            console.log(`📨 邮件 ${seqno} 不是 TaskPing 回复，跳过`);
            return;
        }

        // 提取命令内容
        const command = this._extractCommand(email);
        if (!command || command.trim().length === 0) {
            console.log(`📨 邮件 ${seqno} 没有找到有效命令`);
            return;
        }

        console.log(`🎯 提取到命令: ${command.substring(0, 100)}${command.length > 100 ? '...' : ''}`);
        
        // 执行命令
        await this._executeCommand(command, seqno);
    }

    _isTaskPingReply(email) {
        const subject = email.subject || '';
        
        // 检查是否是 TaskPing 相关邮件
        return subject.includes('[TaskPing]') || 
               subject.match(/^(Re:|RE:|回复:)/i);
    }

    _extractCommand(email) {
        let text = email.text || '';
        
        // 清理邮件内容 - 移除引用和签名
        const lines = text.split('\n');
        const cleanLines = [];
        
        for (const line of lines) {
            // 停止条件：遇到原始邮件标记
            if (line.includes('-----Original Message-----') ||
                line.includes('--- Original Message ---') ||
                line.includes('在') && line.includes('写道:') ||
                line.includes('On') && line.includes('wrote:') ||
                line.match(/^>\s*/) ||
                line.includes('会话ID:') ||
                line.includes('Session ID:')) {
                break;
            }
            
            // 跳过签名
            if (line.includes('--') || 
                line.includes('Sent from') ||
                line.includes('发自我的')) {
                break;
            }
            
            cleanLines.push(line);
        }
        
        return cleanLines.join('\n').trim();
    }

    async _executeCommand(command, emailSeq) {
        try {
            console.log(`🚀 执行命令 (来自邮件 ${emailSeq})`);
            
            // 保存最新命令到文件
            await this._saveCommand(command, emailSeq);
            
            // 复制到剪贴板
            const clipboardSuccess = await this._copyToClipboard(command);
            
            // 发送通知
            const notificationSuccess = await this._sendNotification(command);
            
            // 尝试简单的自动粘贴
            const pasteSuccess = await this._attemptSimplePaste();
            
            console.log('📊 执行结果:');
            console.log(`  📄 文件保存: ${await this._saveCommand(command, emailSeq) ? '✅' : '❌'}`);
            console.log(`  📋 剪贴板: ${clipboardSuccess ? '✅' : '❌'}`);
            console.log(`  🔔 通知: ${notificationSuccess ? '✅' : '❌'}`);
            console.log(`  🤖 自动粘贴: ${pasteSuccess ? '✅' : '❌'}`);
            
            this.emit('commandExecuted', {
                command,
                emailSeq,
                success: clipboardSuccess || notificationSuccess
            });
            
        } catch (error) {
            console.error('❌ 命令执行失败:', error.message);
            this.emit('commandFailed', { command, emailSeq, error });
        }
    }

    async _saveCommand(command, emailSeq) {
        try {
            const content = `# TaskPing 邮件命令 (邮件 ${emailSeq})
# 时间: ${new Date().toLocaleString('zh-CN')}
# 
# 命令内容:
${command}

# ==============================
# 说明: 这个命令来自邮件回复
# 使用: 复制上面的命令到 Claude Code 中执行
`;
            fs.writeFileSync(this.commandFile, content, 'utf8');
            return true;
        } catch (error) {
            console.error('保存命令文件失败:', error.message);
            return false;
        }
    }

    async _copyToClipboard(command) {
        try {
            const pbcopy = spawn('pbcopy');
            pbcopy.stdin.write(command);
            pbcopy.stdin.end();
            
            return new Promise((resolve) => {
                pbcopy.on('close', (code) => resolve(code === 0));
                pbcopy.on('error', () => resolve(false));
            });
        } catch (error) {
            return false;
        }
    }

    async _sendNotification(command) {
        try {
            const shortCommand = command.length > 60 ? command.substring(0, 60) + '...' : command;
            
            const script = `
                display notification "新邮件命令已复制到剪贴板！请到 Claude Code 中粘贴执行" with title "TaskPing" subtitle "命令: ${shortCommand.replace(/"/g, '\\"')}" sound name "default"
            `;
            
            const osascript = spawn('osascript', ['-e', script]);
            
            return new Promise((resolve) => {
                osascript.on('close', (code) => resolve(code === 0));
                osascript.on('error', () => resolve(false));
            });
        } catch (error) {
            return false;
        }
    }

    async _attemptSimplePaste() {
        try {
            // 只在明确是开发环境的应用时尝试自动粘贴
            const script = `
                tell application "System Events"
                    try
                        set frontApp to name of first application process whose frontmost is true
                        
                        -- 只在特定应用中尝试自动粘贴
                        if frontApp contains "Claude" or frontApp contains "Terminal" or frontApp contains "iTerm" then
                            delay 0.5
                            keystroke "v" using command down
                            delay 0.2
                            keystroke return
                            return "success"
                        else
                            return "skip"
                        end if
                    on error
                        return "failed"
                    end try
                end tell
            `;
            
            const osascript = spawn('osascript', ['-e', script]);
            let output = '';
            
            osascript.stdout.on('data', (data) => {
                output += data.toString().trim();
            });
            
            return new Promise((resolve) => {
                osascript.on('close', (code) => {
                    resolve(code === 0 && output === 'success');
                });
                osascript.on('error', () => resolve(false));
            });
        } catch (error) {
            return false;
        }
    }

    async stop() {
        console.log('🛑 停止邮件监听服务...');
        this.isRunning = false;
        
        if (this.imap) {
            this.imap.end();
            this.imap = null;
        }
        
        console.log('✅ 服务已停止');
    }

    getStatus() {
        return {
            running: this.isRunning,
            connected: this.imap && this.imap.state === 'authenticated',
            commandFile: this.commandFile,
            lastCommandExists: fs.existsSync(this.commandFile)
        };
    }
}

module.exports = SimplifiedEmailAutomation;