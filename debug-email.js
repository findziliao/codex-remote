#!/usr/bin/env node

/**
 * TaskPing 邮件调试工具
 * 用于调试邮件监听和自动化问题
 */

const Imap = require('node-imap');
const { simpleParser } = require('mailparser');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

class DebugEmailAutomation {
    constructor() {
        this.configPath = path.join(__dirname, 'config/channels.json');
        this.config = null;
        this.imap = null;
    }

    async start() {
        console.log('🔍 TaskPing 邮件调试工具启动\n');
        
        // 1. 检查配置
        console.log('📋 1. 检查配置文件...');
        if (!this.loadConfig()) {
            return;
        }
        console.log('✅ 配置文件加载成功');
        console.log(`📧 IMAP服务器: ${this.config.imap.host}:${this.config.imap.port}`);
        console.log(`👤 用户: ${this.config.imap.auth.user}`);
        console.log(`📬 通知发送到: ${this.config.to}\n`);

        // 2. 测试IMAP连接
        console.log('🔌 2. 测试IMAP连接...');
        try {
            await this.testConnection();
            console.log('✅ IMAP连接成功\n');
        } catch (error) {
            console.error('❌ IMAP连接失败:', error.message);
            return;
        }

        // 3. 检查最近邮件
        console.log('📧 3. 检查最近邮件...');
        try {
            await this.checkRecentEmails();
        } catch (error) {
            console.error('❌ 检查邮件失败:', error.message);
        }

        // 4. 开始实时监听
        console.log('\n👂 4. 开始实时监听邮件回复...');
        console.log('💌 现在可以回复TaskPing邮件来测试自动化功能');
        console.log('🔍 调试信息会实时显示\n');
        
        this.startRealTimeListening();
    }

    loadConfig() {
        try {
            const data = fs.readFileSync(this.configPath, 'utf8');
            const config = JSON.parse(data);
            
            if (!config.email?.enabled) {
                console.error('❌ 邮件功能未启用');
                console.log('💡 请运行: npm run config');
                return false;
            }

            this.config = config.email.config;
            return true;
        } catch (error) {
            console.error('❌ 配置文件读取失败:', error.message);
            console.log('💡 请运行: npm run config');
            return false;
        }
    }

    async testConnection() {
        return new Promise((resolve, reject) => {
            this.imap = new Imap({
                user: this.config.imap.auth.user,
                password: this.config.imap.auth.pass,
                host: this.config.imap.host,
                port: this.config.imap.port,
                tls: this.config.imap.secure,
                connTimeout: 30000,
                authTimeout: 15000,
                // debug: console.log  // 暂时禁用调试
            });

            this.imap.once('ready', () => {
                console.log('🔗 IMAP ready事件触发');
                resolve();
            });

            this.imap.once('error', (error) => {
                console.error('🔗 IMAP error事件:', error.message);
                reject(error);
            });

            this.imap.connect();
        });
    }

    async checkRecentEmails() {
        return new Promise((resolve, reject) => {
            this.imap.openBox('INBOX', true, (err, box) => {
                if (err) {
                    reject(err);
                    return;
                }

                console.log(`📫 收件箱状态: 总邮件 ${box.messages.total}, 未读 ${box.messages.unseen}`);

                // 查找最近1小时的所有邮件
                const since = new Date();
                since.setHours(since.getHours() - 1);
                
                console.log(`🔍 搜索 ${since.toLocaleString()} 之后的邮件...`);

                this.imap.search([['SINCE', since]], (searchErr, results) => {
                    if (searchErr) {
                        reject(searchErr);
                        return;
                    }

                    console.log(`📨 找到 ${results.length} 封最近邮件`);

                    if (results.length === 0) {
                        console.log('ℹ️ 没有找到最近的邮件');
                        resolve();
                        return;
                    }

                    // 获取最近几封邮件的详情
                    const fetch = this.imap.fetch(results.slice(-3), { 
                        bodies: 'HEADER',
                        struct: true 
                    });

                    fetch.on('message', (msg, seqno) => {
                        console.log(`\n📧 邮件 ${seqno}:`);
                        
                        msg.on('body', (stream, info) => {
                            let buffer = '';
                            stream.on('data', (chunk) => {
                                buffer += chunk.toString('utf8');
                            });
                            stream.once('end', () => {
                                const lines = buffer.split('\n');
                                const subject = lines.find(line => line.startsWith('Subject:'));
                                const from = lines.find(line => line.startsWith('From:'));
                                const date = lines.find(line => line.startsWith('Date:'));
                                
                                console.log(`  📄 ${subject || 'Subject: (未知)'}`);
                                console.log(`  👤 ${from || 'From: (未知)'}`);
                                console.log(`  📅 ${date || 'Date: (未知)'}`);
                                
                                if (subject && subject.includes('[TaskPing]')) {
                                    console.log('  🎯 这是TaskPing邮件!');
                                }
                            });
                        });
                    });

                    fetch.once('end', () => {
                        resolve();
                    });

                    fetch.once('error', (fetchErr) => {
                        reject(fetchErr);
                    });
                });
            });
        });
    }

    startRealTimeListening() {
        // 重新连接用于监听
        this.imap.end();
        
        setTimeout(() => {
            this.connectForListening();
        }, 1000);
    }

    async connectForListening() {
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
            console.log('✅ 监听连接建立');
            this.openInboxForListening();
        });

        this.imap.once('error', (error) => {
            console.error('❌ 监听连接错误:', error.message);
        });

        this.imap.once('end', () => {
            console.log('🔄 连接断开，尝试重连...');
            setTimeout(() => this.connectForListening(), 5000);
        });

        this.imap.connect();
    }

    openInboxForListening() {
        this.imap.openBox('INBOX', false, (err, box) => {
            if (err) {
                console.error('❌ 打开收件箱失败:', err.message);
                return;
            }

            console.log('📬 收件箱已打开，开始监听新邮件...');

            // 设置定期检查
            setInterval(() => {
                this.checkNewEmails();
            }, 10000); // 每10秒检查一次

            // 立即检查一次
            this.checkNewEmails();
        });
    }

    checkNewEmails() {
        const since = new Date();
        since.setMinutes(since.getMinutes() - 5); // 检查最近5分钟的邮件

        this.imap.search([['UNSEEN'], ['SINCE', since]], (err, results) => {
            if (err) {
                console.error('🔍 搜索新邮件失败:', err.message);
                return;
            }

            if (results.length > 0) {
                console.log(`\n🚨 发现 ${results.length} 封新邮件!`);
                this.processNewEmails(results);
            }
        });
    }

    processNewEmails(emailUids) {
        const fetch = this.imap.fetch(emailUids, { 
            bodies: '',
            markSeen: true 
        });

        fetch.on('message', (msg, seqno) => {
            console.log(`\n📨 处理新邮件 ${seqno}:`);
            let buffer = '';

            msg.on('body', (stream) => {
                stream.on('data', (chunk) => {
                    buffer += chunk.toString('utf8');
                });

                stream.once('end', async () => {
                    try {
                        const parsed = await simpleParser(buffer);
                        await this.analyzeEmail(parsed, seqno);
                    } catch (error) {
                        console.error(`❌ 解析邮件 ${seqno} 失败:`, error.message);
                    }
                });
            });
        });
    }

    async analyzeEmail(email, seqno) {
        console.log(`📧 邮件 ${seqno} 分析:`);
        console.log(`  📄 主题: ${email.subject || '(无主题)'}`);
        console.log(`  👤 发件人: ${email.from?.text || '(未知)'}`);
        console.log(`  📅 时间: ${email.date || '(未知)'}`);

        // 检查是否是TaskPing回复
        const isTaskPingReply = this.isTaskPingReply(email);
        console.log(`  🎯 TaskPing回复: ${isTaskPingReply ? '是' : '否'}`);

        if (!isTaskPingReply) {
            console.log(`  ⏭️ 跳过非TaskPing邮件`);
            return;
        }

        // 提取命令
        const command = this.extractCommand(email);
        console.log(`  💬 邮件内容长度: ${(email.text || '').length} 字符`);
        console.log(`  🎯 提取的命令: "${command || '(无)'}"`);

        if (!command || command.trim().length === 0) {
            console.log(`  ⚠️ 未找到有效命令`);
            return;
        }

        console.log(`\n🚀 准备执行命令...`);
        await this.executeCommand(command, seqno);
    }

    isTaskPingReply(email) {
        const subject = email.subject || '';
        return subject.includes('[TaskPing]') || 
               subject.match(/^(Re:|RE:|回复:)/i);
    }

    extractCommand(email) {
        let text = email.text || '';
        console.log(`  📝 原始邮件文本:\n${text.substring(0, 200)}${text.length > 200 ? '...' : ''}`);
        
        const lines = text.split('\n');
        const commandLines = [];
        
        for (const line of lines) {
            if (line.includes('-----Original Message-----') ||
                line.includes('--- Original Message ---') ||
                line.includes('在') && line.includes('写道:') ||
                line.includes('On') && line.includes('wrote:') ||
                line.match(/^>\s*/) ||
                line.includes('会话ID:')) {
                console.log(`  ✂️ 在此行停止解析: ${line.substring(0, 50)}`);
                break;
            }
            
            if (line.includes('--') || 
                line.includes('Sent from') ||
                line.includes('发自我的')) {
                console.log(`  ✂️ 跳过签名行: ${line.substring(0, 50)}`);
                break;
            }
            
            commandLines.push(line);
        }
        
        const extractedCommand = commandLines.join('\n').trim();
        console.log(`  🎯 清理后的命令:\n"${extractedCommand}"`);
        return extractedCommand;
    }

    async executeCommand(command, seqno) {
        console.log(`🤖 执行命令 (来自邮件 ${seqno}):`);
        console.log(`📝 命令内容: "${command}"`);

        try {
            // 1. 复制到剪贴板
            console.log(`📋 1. 复制到剪贴板...`);
            const clipboardSuccess = await this.copyToClipboard(command);
            console.log(`📋 剪贴板: ${clipboardSuccess ? '✅ 成功' : '❌ 失败'}`);

            // 2. 尝试自动化
            console.log(`🤖 2. 尝试自动输入...`);
            const automationSuccess = await this.attemptAutomation(command);
            console.log(`🤖 自动化: ${automationSuccess ? '✅ 成功' : '❌ 失败'}`);

            // 3. 发送通知
            console.log(`🔔 3. 发送通知...`);
            const notificationSuccess = await this.sendNotification(command);
            console.log(`🔔 通知: ${notificationSuccess ? '✅ 成功' : '❌ 失败'}`);

            if (automationSuccess) {
                console.log(`\n🎉 邮件命令已自动执行到Claude Code!`);
            } else {
                console.log(`\n⚠️ 自动化失败，但命令已复制到剪贴板`);
                console.log(`💡 请手动在Claude Code中粘贴 (Cmd+V)`);
            }

        } catch (error) {
            console.error(`❌ 执行命令失败:`, error.message);
        }
    }

    async copyToClipboard(command) {
        return new Promise((resolve) => {
            const pbcopy = spawn('pbcopy');
            pbcopy.stdin.write(command);
            pbcopy.stdin.end();
            
            pbcopy.on('close', (code) => {
                resolve(code === 0);
            });
            
            pbcopy.on('error', () => resolve(false));
        });
    }

    async attemptAutomation(command) {
        return new Promise((resolve) => {
            const escapedCommand = command
                .replace(/\\/g, '\\\\')
                .replace(/"/g, '\\"')
                .replace(/'/g, "\\'");

            const script = `
                tell application "System Events"
                    set claudeApps to {"Claude", "Claude Code", "Claude Desktop"}
                    set devApps to {"Terminal", "iTerm2", "iTerm", "Visual Studio Code", "Code"}
                    set targetApp to null
                    set appName to ""
                    
                    -- 查找Claude应用
                    repeat with app in claudeApps
                        try
                            if application process app exists then
                                set targetApp to application process app
                                set appName to app
                                exit repeat
                            end if
                        end try
                    end repeat
                    
                    -- 如果没找到Claude，查找开发工具
                    if targetApp is null then
                        repeat with app in devApps
                            try
                                if application process app exists then
                                    set targetApp to application process app
                                    set appName to app
                                    exit repeat
                                end if
                            end try
                        end repeat
                    end if
                    
                    if targetApp is not null then
                        set frontmost of targetApp to true
                        delay 1
                        
                        keystroke "a" using command down
                        delay 0.3
                        keystroke "${escapedCommand}"
                        delay 0.5
                        keystroke return
                        
                        return "success:" & appName
                    else
                        return "no_app"
                    end if
                end tell
            `;

            console.log(`🍎 执行AppleScript自动化...`);

            const osascript = spawn('osascript', ['-e', script]);
            let output = '';

            osascript.stdout.on('data', (data) => {
                output += data.toString().trim();
            });

            osascript.on('close', (code) => {
                console.log(`🍎 AppleScript结果: 退出码=${code}, 输出="${output}"`);
                const success = code === 0 && output.startsWith('success:');
                if (success) {
                    const appName = output.split(':')[1];
                    console.log(`🍎 成功输入到应用: ${appName}`);
                }
                resolve(success);
            });

            osascript.on('error', (error) => {
                console.log(`🍎 AppleScript错误: ${error.message}`);
                resolve(false);
            });
        });
    }

    async sendNotification(command) {
        const shortCommand = command.length > 50 ? command.substring(0, 50) + '...' : command;
        
        const script = `
            display notification "邮件命令: ${shortCommand.replace(/"/g, '\\"')}" with title "TaskPing Debug" sound name "default"
        `;
        
        const osascript = spawn('osascript', ['-e', script]);
        
        return new Promise((resolve) => {
            osascript.on('close', (code) => resolve(code === 0));
            osascript.on('error', () => resolve(false));
        });
    }
}

// 启动调试工具
const debugTool = new DebugEmailAutomation();
debugTool.start().catch(console.error);