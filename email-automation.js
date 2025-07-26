#!/usr/bin/env node

/**
 * TaskPing 邮件自动化
 * 监听邮件回复并自动输入到Claude Code
 */

const Imap = require('node-imap');
const { simpleParser } = require('mailparser');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

class EmailAutomation {
    constructor() {
        this.configPath = path.join(__dirname, 'config/channels.json');
        this.imap = null;
        this.isRunning = false;
        this.config = null;
    }

    async start() {
        console.log('🚀 TaskPing 邮件自动化启动中...\n');
        
        // 加载配置
        if (!this.loadConfig()) {
            console.log('❌ 请先配置邮件: npm run config');
            process.exit(1);
        }

        console.log(`📧 监听邮箱: ${this.config.imap.auth.user}`);
        console.log(`📬 发送通知到: ${this.config.to}\n`);

        try {
            await this.connectToEmail();
            this.startListening();
            
            console.log('✅ 邮件监听启动成功');
            console.log('💌 现在可以回复TaskPing邮件来发送命令到Claude Code');
            console.log('按 Ctrl+C 停止服务\n');

            this.setupGracefulShutdown();
            process.stdin.resume();

        } catch (error) {
            console.error('❌ 启动失败:', error.message);
            process.exit(1);
        }
    }

    loadConfig() {
        try {
            const data = fs.readFileSync(this.configPath, 'utf8');
            const config = JSON.parse(data);
            
            if (!config.email?.enabled) {
                console.log('❌ 邮件功能未启用');
                return false;
            }

            this.config = config.email.config;
            return true;
        } catch (error) {
            console.log('❌ 配置文件读取失败');
            return false;
        }
    }

    async connectToEmail() {
        return new Promise((resolve, reject) => {
            this.imap = new Imap({
                user: this.config.imap.auth.user,
                password: this.config.imap.auth.pass,
                host: this.config.imap.host,
                port: this.config.imap.port,
                tls: this.config.imap.secure,
                connTimeout: 60000,
                authTimeout: 30000,
                keepalive: true
            });

            this.imap.once('ready', () => {
                console.log('📬 IMAP连接成功');
                resolve();
            });

            this.imap.once('error', reject);
            this.imap.once('end', () => {
                if (this.isRunning) {
                    console.log('🔄 连接断开，尝试重连...');
                    setTimeout(() => this.connectToEmail().catch(console.error), 5000);
                }
            });

            this.imap.connect();
        });
    }

    startListening() {
        this.isRunning = true;
        console.log('👂 开始监听新邮件...');
        
        // 每15秒检查一次新邮件
        setInterval(() => {
            if (this.isRunning) {
                this.checkNewEmails();
            }
        }, 15000);
        
        // 立即检查一次
        this.checkNewEmails();
    }

    async checkNewEmails() {
        try {
            await this.openInbox();
            
            // 查找最近1小时内的未读邮件
            const since = new Date();
            since.setHours(since.getHours() - 1);
            
            this.imap.search([['UNSEEN'], ['SINCE', since]], (err, results) => {
                if (err) {
                    console.error('搜索邮件失败:', err.message);
                    return;
                }

                if (results.length > 0) {
                    console.log(`📧 发现 ${results.length} 封新邮件`);
                    this.processEmails(results);
                }
            });
        } catch (error) {
            console.error('检查邮件失败:', error.message);
        }
    }

    openInbox() {
        return new Promise((resolve, reject) => {
            this.imap.openBox('INBOX', false, (err, box) => {
                if (err) reject(err);
                else resolve(box);
            });
        });
    }

    processEmails(emailUids) {
        const fetch = this.imap.fetch(emailUids, { 
            bodies: '',
            markSeen: true 
        });

        fetch.on('message', (msg) => {
            let buffer = '';

            msg.on('body', (stream) => {
                stream.on('data', (chunk) => {
                    buffer += chunk.toString('utf8');
                });

                stream.once('end', async () => {
                    try {
                        const parsed = await simpleParser(buffer);
                        await this.handleEmailReply(parsed);
                    } catch (error) {
                        console.error('处理邮件失败:', error.message);
                    }
                });
            });
        });
    }

    async handleEmailReply(email) {
        // 检查是否是TaskPing回复
        if (!this.isTaskPingReply(email)) {
            return;
        }

        // 提取命令
        const command = this.extractCommand(email);
        if (!command) {
            console.log('邮件中未找到有效命令');
            return;
        }

        console.log(`🎯 收到命令: ${command.substring(0, 100)}${command.length > 100 ? '...' : ''}`);
        
        // 执行命令到Claude Code
        await this.sendToClaudeCode(command);
    }

    isTaskPingReply(email) {
        const subject = email.subject || '';
        return subject.includes('[TaskPing]') || 
               subject.match(/^(Re:|RE:|回复:)/i);
    }

    extractCommand(email) {
        let text = email.text || '';
        const lines = text.split('\n');
        const commandLines = [];
        
        for (const line of lines) {
            // 停止处理当遇到原始邮件标记
            if (line.includes('-----Original Message-----') ||
                line.includes('--- Original Message ---') ||
                line.includes('在') && line.includes('写道:') ||
                line.includes('On') && line.includes('wrote:') ||
                line.match(/^>\s*/) ||
                line.includes('会话ID:')) {
                break;
            }
            
            // 跳过签名
            if (line.includes('--') || 
                line.includes('Sent from') ||
                line.includes('发自我的')) {
                break;
            }
            
            commandLines.push(line);
        }
        
        return commandLines.join('\n').trim();
    }

    async sendToClaudeCode(command) {
        console.log('🤖 正在发送命令到Claude Code...');
        
        try {
            // 方法1: 复制到剪贴板
            await this.copyToClipboard(command);
            
            // 方法2: 强制自动化输入
            const success = await this.forceAutomation(command);
            
            if (success) {
                console.log('✅ 命令已自动输入到Claude Code');
            } else {
                console.log('⚠️ 自动输入失败，命令已复制到剪贴板');
                console.log('💡 请手动在Claude Code中粘贴 (Cmd+V)');
                
                // 发送通知提醒
                await this.sendNotification(command);
            }
        } catch (error) {
            console.error('❌ 发送命令失败:', error.message);
        }
    }

    async copyToClipboard(command) {
        return new Promise((resolve, reject) => {
            const pbcopy = spawn('pbcopy');
            pbcopy.stdin.write(command);
            pbcopy.stdin.end();
            
            pbcopy.on('close', (code) => {
                if (code === 0) {
                    resolve();
                } else {
                    reject(new Error('剪贴板复制失败'));
                }
            });
        });
    }

    async forceAutomation(command) {
        return new Promise((resolve) => {
            // 转义命令中的特殊字符
            const escapedCommand = command
                .replace(/\\/g, '\\\\')
                .replace(/"/g, '\\"')
                .replace(/'/g, "\\'");

            const script = `
                tell application "System Events"
                    -- 查找Claude Code相关应用
                    set claudeApps to {"Claude", "Claude Code", "Claude Desktop", "Anthropic Claude"}
                    set targetApp to null
                    
                    repeat with appName in claudeApps
                        try
                            if application process appName exists then
                                set targetApp to application process appName
                                exit repeat
                            end if
                        end try
                    end repeat
                    
                    -- 如果没找到Claude，查找开发工具
                    if targetApp is null then
                        set devApps to {"Terminal", "iTerm2", "iTerm", "Visual Studio Code", "Code", "Cursor"}
                        repeat with appName in devApps
                            try
                                if application process appName exists then
                                    set targetApp to application process appName
                                    exit repeat
                                end if
                            end try
                        end repeat
                    end if
                    
                    if targetApp is not null then
                        -- 激活应用
                        set frontmost of targetApp to true
                        delay 1
                        
                        -- 确保窗口激活
                        repeat 10 times
                            if frontmost of targetApp then exit repeat
                            delay 0.1
                        end repeat
                        
                        -- 清空并输入命令
                        keystroke "a" using command down
                        delay 0.3
                        keystroke "${escapedCommand}"
                        delay 0.5
                        keystroke return
                        
                        return "success"
                    else
                        return "no_app"
                    end if
                end tell
            `;

            const osascript = spawn('osascript', ['-e', script]);
            let output = '';

            osascript.stdout.on('data', (data) => {
                output += data.toString().trim();
            });

            osascript.on('close', (code) => {
                const success = code === 0 && output === 'success';
                resolve(success);
            });

            osascript.on('error', () => resolve(false));
        });
    }

    async sendNotification(command) {
        const shortCommand = command.length > 50 ? command.substring(0, 50) + '...' : command;
        
        const script = `
            display notification "邮件命令已准备好，请在Claude Code中粘贴执行" with title "TaskPing" subtitle "${shortCommand.replace(/"/g, '\\"')}" sound name "default"
        `;
        
        spawn('osascript', ['-e', script]);
    }

    setupGracefulShutdown() {
        process.on('SIGINT', () => {
            console.log('\n🛑 正在停止邮件监听...');
            this.isRunning = false;
            if (this.imap) {
                this.imap.end();
            }
            console.log('✅ 服务已停止');
            process.exit(0);
        });
    }
}

// 启动服务
const automation = new EmailAutomation();
automation.start().catch(console.error);