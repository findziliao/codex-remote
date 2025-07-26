#!/usr/bin/env node

/**
 * TaskPing 邮件检查器
 * 更强大的邮件搜索和内容提取工具
 */

const Imap = require('node-imap');
const { simpleParser } = require('mailparser');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

class EmailChecker {
    constructor() {
        this.configPath = path.join(__dirname, 'config/channels.json');
        this.config = null;
        this.imap = null;
    }

    async start() {
        console.log('🔍 TaskPing 强化邮件检查器启动\n');
        
        // 加载配置
        if (!this.loadConfig()) {
            console.log('❌ 请先配置邮件: npm run config');
            process.exit(1);
        }

        console.log(`📧 邮箱: ${this.config.imap.auth.user}`);
        console.log(`📬 通知发送到: ${this.config.to}\n`);

        try {
            await this.connectToEmail();
            await this.comprehensiveEmailCheck();
            await this.startContinuousMonitoring();
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
                console.log('✅ IMAP连接成功');
                resolve();
            });

            this.imap.once('error', reject);
            this.imap.connect();
        });
    }

    async comprehensiveEmailCheck() {
        console.log('\n🔍 开始全面邮件检查...\n');
        
        await this.openInbox();

        // 1. 检查最近24小时所有邮件（不仅是未读）
        console.log('📅 1. 检查最近24小时所有邮件...');
        await this.searchEmails('24h', false);

        // 2. 检查最近1小时未读邮件
        console.log('\n📧 2. 检查最近1小时未读邮件...');
        await this.searchEmails('1h', true);

        // 3. 检查主题包含特定关键词的邮件
        console.log('\n🎯 3. 检查TaskPing相关邮件...');
        await this.searchBySubject();

        // 4. 检查来自特定发件人的邮件
        console.log('\n👤 4. 检查来自目标邮箱的邮件...');
        await this.searchByFrom();
    }

    async openInbox() {
        return new Promise((resolve, reject) => {
            this.imap.openBox('INBOX', false, (err, box) => {
                if (err) {
                    reject(err);
                    return;
                }
                console.log(`📫 收件箱: 总计${box.messages.total}封邮件`);
                resolve(box);
            });
        });
    }

    async searchEmails(timeRange, unseenOnly = false) {
        return new Promise((resolve) => {
            const since = new Date();
            if (timeRange === '1h') {
                since.setHours(since.getHours() - 1);
            } else if (timeRange === '24h') {
                since.setDate(since.getDate() - 1);
            }

            let searchCriteria = [['SINCE', since]];
            if (unseenOnly) {
                searchCriteria.push(['UNSEEN']);
            }

            console.log(`🔍 搜索条件: ${timeRange}, ${unseenOnly ? '仅未读' : '全部'}`);

            this.imap.search(searchCriteria, (err, results) => {
                if (err) {
                    console.error('❌ 搜索失败:', err.message);
                    resolve();
                    return;
                }

                console.log(`📨 找到 ${results.length} 封邮件`);
                
                if (results.length > 0) {
                    this.analyzeEmails(results.slice(-5)); // 只分析最新5封
                }
                resolve();
            });
        });
    }

    async searchBySubject() {
        return new Promise((resolve) => {
            // 搜索主题包含Re:或TaskPing的邮件
            this.imap.search([['OR', ['SUBJECT', 'Re:'], ['SUBJECT', 'TaskPing']]], (err, results) => {
                if (err) {
                    console.error('❌ 主题搜索失败:', err.message);
                    resolve();
                    return;
                }

                console.log(`📨 找到 ${results.length} 封相关邮件`);
                
                if (results.length > 0) {
                    this.analyzeEmails(results.slice(-3)); // 只分析最新3封
                }
                resolve();
            });
        });
    }

    async searchByFrom() {
        return new Promise((resolve) => {
            // 搜索来自目标邮箱的邮件
            const targetEmail = this.config.to;
            
            this.imap.search([['FROM', targetEmail]], (err, results) => {
                if (err) {
                    console.error('❌ 发件人搜索失败:', err.message);
                    resolve();
                    return;
                }

                console.log(`📨 找到来自 ${targetEmail} 的 ${results.length} 封邮件`);
                
                if (results.length > 0) {
                    this.analyzeEmails(results.slice(-3)); // 只分析最新3封
                }
                resolve();
            });
        });
    }

    analyzeEmails(emailUids) {
        const fetch = this.imap.fetch(emailUids, { 
            bodies: '',
            markSeen: false // 不标记为已读
        });

        fetch.on('message', (msg, seqno) => {
            console.log(`\n📧 分析邮件 ${seqno}:`);
            let buffer = '';

            msg.on('body', (stream) => {
                stream.on('data', (chunk) => {
                    buffer += chunk.toString('utf8');
                });

                stream.once('end', async () => {
                    try {
                        const parsed = await simpleParser(buffer);
                        await this.processEmailContent(parsed, seqno);
                    } catch (error) {
                        console.error(`❌ 解析邮件 ${seqno} 失败:`, error.message);
                    }
                });
            });
        });
    }

    async processEmailContent(email, seqno) {
        console.log(`  📄 主题: ${email.subject || '(无主题)'}`);
        console.log(`  👤 发件人: ${email.from?.text || '(未知)'}`);
        console.log(`  📅 时间: ${email.date || '(未知)'}`);

        // 判断是否是潜在的回复邮件
        const isPotentialReply = this.isPotentialReply(email);
        console.log(`  🎯 潜在回复: ${isPotentialReply ? '是' : '否'}`);

        if (isPotentialReply) {
            const command = this.extractCommand(email);
            console.log(`  💬 邮件内容长度: ${(email.text || '').length} 字符`);
            console.log(`  📝 提取的内容:\n"${command.substring(0, 200)}${command.length > 200 ? '...' : ''}"`);
            
            if (command && command.trim().length > 0) {
                console.log(`\n🎉 发现有效命令! (邮件 ${seqno})`);
                await this.handleCommand(command, seqno);
            }
        }
    }

    isPotentialReply(email) {
        const subject = email.subject || '';
        const from = email.from?.text || '';
        const targetEmail = this.config.to;
        
        // 检查多种条件
        return (
            subject.includes('[TaskPing]') ||
            subject.match(/^(Re:|RE:|回复:)/i) ||
            from.includes(targetEmail) ||
            (email.text && email.text.length > 10) // 有实际内容
        );
    }

    extractCommand(email) {
        let text = email.text || '';
        const lines = text.split('\n');
        const commandLines = [];
        
        for (const line of lines) {
            // 停止处理当遇到原始邮件标记
            if (line.includes('-----Original Message-----') ||
                line.includes('--- Original Message ---') ||
                (line.includes('在') && line.includes('写道:')) ||
                (line.includes('On') && line.includes('wrote:')) ||
                line.match(/^>\s*/) ||
                line.includes('会话ID:') ||
                line.includes('TaskPing <') ||
                line.match(/\d{4}年\d{1,2}月\d{1,2}日/)) {
                break;
            }
            
            // 跳过签名和空行
            if (line.includes('--') || 
                line.includes('Sent from') ||
                line.includes('发自我的') ||
                line.trim() === '') {
                continue;
            }
            
            commandLines.push(line);
        }
        
        return commandLines.join('\n').trim();
    }

    async handleCommand(command, seqno) {
        console.log(`\n🚀 处理命令 (来自邮件 ${seqno}):`);
        console.log(`📝 命令内容: "${command}"`);

        try {
            // 复制到剪贴板
            await this.copyToClipboard(command);
            console.log('✅ 命令已复制到剪贴板');
            
            // 发送通知
            await this.sendNotification(command);
            console.log('✅ 通知已发送');
            
            console.log('\n🎯 请在Claude Code中粘贴命令 (Cmd+V)');
            
        } catch (error) {
            console.error('❌ 处理命令失败:', error.message);
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

    async sendNotification(command) {
        const shortCommand = command.length > 50 ? command.substring(0, 50) + '...' : command;
        
        const script = `
            display notification "邮件命令已复制到剪贴板，请在Claude Code中粘贴" with title "TaskPing" subtitle "${shortCommand.replace(/"/g, '\\"')}" sound name "Glass"
        `;
        
        spawn('osascript', ['-e', script]);
    }

    async startContinuousMonitoring() {
        console.log('\n👂 开始持续监控新邮件...');
        console.log('💌 现在可以回复邮件测试功能');
        console.log('🔍 每30秒检查一次新邮件\n');

        setInterval(async () => {
            try {
                console.log('🔄 检查新邮件...');
                await this.searchEmails('1h', false); // 搜索所有邮件，不只是未读
            } catch (error) {
                console.error('❌ 监控检查失败:', error.message);
            }
        }, 30000); // 每30秒检查一次

        // 设置优雅关闭
        process.on('SIGINT', () => {
            console.log('\n🛑 停止邮件监控...');
            if (this.imap) {
                this.imap.end();
            }
            console.log('✅ 服务已停止');
            process.exit(0);
        });

        process.stdin.resume();
    }
}

// 启动检查器
const checker = new EmailChecker();
checker.start().catch(console.error);