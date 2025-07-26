#!/usr/bin/env node

/**
 * TaskPing 简化启动脚本
 * 专注解决核心问题，减少复杂性
 */

const fs = require('fs');
const path = require('path');
const SimplifiedEmailAutomation = require('./src/simplified/email-automation');

class SimpleTaskPing {
    constructor() {
        this.configPath = path.join(__dirname, 'config/channels.json');
        this.automation = null;
    }

    async start() {
        console.log('🚀 TaskPing 简化版启动中...\n');
        
        try {
            // 加载配置
            const config = this.loadConfig();
            if (!config) {
                console.log('❌ 配置加载失败，请先配置邮件');
                console.log('💡 运行: npm run config');
                process.exit(1);
            }

            // 验证配置
            if (!this.validateConfig(config)) {
                console.log('❌ 邮件配置不完整，请重新配置');
                console.log('💡 运行: npm run config');
                process.exit(1);
            }

            console.log('✅ 配置验证通过');
            console.log(`📧 邮箱: ${config.email.config.imap.auth.user}`);
            console.log(`📬 通知发送到: ${config.email.config.to}\n`);

            // 启动简化的邮件自动化
            this.automation = new SimplifiedEmailAutomation(config.email.config);
            
            // 设置事件监听
            this.automation.on('commandExecuted', (data) => {
                console.log(`\n🎉 成功处理邮件命令 (邮件 ${data.emailSeq})`);
                console.log('💡 命令已复制到剪贴板，请在 Claude Code 中粘贴');
            });

            this.automation.on('commandFailed', (data) => {
                console.log(`\n❌ 处理命令失败 (邮件 ${data.emailSeq}): ${data.error.message}`);
            });

            // 启动服务
            await this.automation.start();
            
            console.log('\n🎯 TaskPing 简化版运行中...');
            console.log('💌 现在你可以回复 TaskPing 邮件来发送命令了');
            console.log('📋 命令会自动复制到剪贴板，你只需要在 Claude Code 中粘贴');
            console.log('\n按 Ctrl+C 停止服务\n');

            // 处理优雅关闭
            process.on('SIGINT', async () => {
                console.log('\n🛑 正在停止 TaskPing...');
                if (this.automation) {
                    await this.automation.stop();
                }
                console.log('✅ 服务已停止');
                process.exit(0);
            });

            // 保持进程运行
            process.stdin.resume();

        } catch (error) {
            console.error('❌ 启动失败:', error.message);
            process.exit(1);
        }
    }

    loadConfig() {
        try {
            if (!fs.existsSync(this.configPath)) {
                console.log('❌ 配置文件不存在');
                return null;
            }

            const data = fs.readFileSync(this.configPath, 'utf8');
            return JSON.parse(data);
        } catch (error) {
            console.error('❌ 配置文件读取失败:', error.message);
            return null;
        }
    }

    validateConfig(config) {
        if (!config.email || !config.email.enabled) {
            console.log('❌ 邮件功能未启用');
            return false;
        }

        const emailConfig = config.email.config;
        
        // 检查必需字段
        const required = [
            'smtp.host',
            'smtp.auth.user', 
            'smtp.auth.pass',
            'imap.host',
            'imap.auth.user',
            'imap.auth.pass',
            'to'
        ];

        for (const field of required) {
            if (!this.getNestedValue(emailConfig, field)) {
                console.log(`❌ 缺少必需配置: ${field}`);
                return false;
            }
        }

        return true;
    }

    getNestedValue(obj, path) {
        return path.split('.').reduce((current, key) => {
            return current && current[key] !== undefined ? current[key] : undefined;
        }, obj);
    }

    async status() {
        if (!this.automation) {
            console.log('❌ 服务未运行');
            return;
        }

        const status = this.automation.getStatus();
        console.log('📊 TaskPing 简化版状态:');
        console.log(`  运行状态: ${status.running ? '✅ 运行中' : '❌ 已停止'}`);
        console.log(`  IMAP 连接: ${status.connected ? '✅ 已连接' : '❌ 未连接'}`);
        console.log(`  命令文件: ${status.commandFile}`);
        console.log(`  最新命令: ${status.lastCommandExists ? '✅ 有' : '❌ 无'}`);
    }

    showHelp() {
        console.log(`
🚀 TaskPing 简化版

用法: node simple-start.js [命令]

命令:
  start     启动邮件监听服务 (默认)
  status    显示服务状态
  help      显示帮助信息

配置:
  npm run config    交互式配置邮件

特点:
  • 🎯 专注核心功能，减少复杂性
  • 📧 稳定的邮件监听和解析
  • 📋 自动复制命令到剪贴板
  • 🔔 友好的通知提醒
  • 🛡️ 降级方案，减少权限依赖

使用流程:
  1. 配置邮箱: npm run config
  2. 启动服务: node simple-start.js
  3. 回复 TaskPing 邮件发送命令
  4. 在 Claude Code 中粘贴命令 (Cmd+V)
        `);
    }
}

// 处理命令行参数
const args = process.argv.slice(2);
const command = args[0] || 'start';

const taskping = new SimpleTaskPing();

switch (command) {
    case 'start':
        taskping.start();
        break;
    case 'status':
        taskping.status();
        break;
    case 'help':
    case '--help':
    case '-h':
        taskping.showHelp();
        break;
    default:
        console.log(`未知命令: ${command}`);
        taskping.showHelp();
        process.exit(1);
}