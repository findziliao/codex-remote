#!/usr/bin/env node

/**
 * 更新邮件配置
 * 从 .env 文件读取邮件配置并更新到 channels.json
 */

const fs = require('fs');
const path = require('path');
require('dotenv').config();

function updateEmailConfig() {
    console.log('📧 正在更新邮件配置...\n');
    
    // 验证必需的环境变量
    const required = ['SMTP_HOST', 'SMTP_USER', 'SMTP_PASS', 'EMAIL_TO'];
    const missing = required.filter(key => !process.env[key]);
    
    if (missing.length > 0) {
        console.error('❌ 缺少必需的环境变量:');
        missing.forEach(key => console.log(`  - ${key}`));
        console.log('\n请检查 .env 文件配置');
        process.exit(1);
    }
    
    // 构建邮件配置
    const emailConfig = {
        email: {
            type: 'email',
            enabled: true,
            config: {
                smtp: {
                    host: process.env.SMTP_HOST,
                    port: parseInt(process.env.SMTP_PORT || '465'),
                    secure: process.env.SMTP_SECURE === 'true',
                    auth: {
                        user: process.env.SMTP_USER,
                        pass: process.env.SMTP_PASS
                    }
                },
                imap: {
                    host: process.env.IMAP_HOST,
                    port: parseInt(process.env.IMAP_PORT || '993'),
                    secure: process.env.IMAP_SECURE === 'true',
                    auth: {
                        user: process.env.IMAP_USER,
                        pass: process.env.IMAP_PASS
                    }
                },
                from: `${process.env.EMAIL_FROM_NAME || 'TaskPing'} <${process.env.EMAIL_FROM || process.env.SMTP_USER}>`,
                to: process.env.EMAIL_TO,
                template: {
                    checkInterval: parseInt(process.env.CHECK_INTERVAL || '30')
                }
            }
        }
    };
    
    // 读取现有的 channels.json
    const channelsPath = path.join(__dirname, 'config/channels.json');
    let channels = {};
    
    if (fs.existsSync(channelsPath)) {
        try {
            channels = JSON.parse(fs.readFileSync(channelsPath, 'utf8'));
        } catch (error) {
            console.warn('⚠️  无法读取现有配置，将创建新配置');
        }
    }
    
    // 更新邮件通道配置
    channels.email = emailConfig.email;
    
    // 写入配置文件
    try {
        fs.writeFileSync(channelsPath, JSON.stringify(channels, null, 2));
        console.log('✅ 邮件配置已更新到 config/channels.json');
        
        // 显示配置信息
        console.log('\n📋 当前配置:');
        console.log(`  发件服务器: ${process.env.SMTP_HOST}`);
        console.log(`  发件邮箱: ${process.env.SMTP_USER}`);
        console.log(`  收件邮箱: ${process.env.EMAIL_TO}`);
        
        if (process.env.IMAP_USER) {
            console.log(`  监听邮箱: ${process.env.IMAP_USER}`);
            console.log(`  IMAP服务器: ${process.env.IMAP_HOST}`);
        } else {
            console.log('\n⚠️  注意: IMAP 未配置，邮件回复功能需要配置 Gmail 的 IMAP 信息');
            console.log('  请在 .env 文件中设置 IMAP_PASS（Gmail应用专用密码）');
        }
        
        console.log('\n💡 提示:');
        console.log('  1. Gmail 需要使用应用专用密码');
        console.log('     访问 https://myaccount.google.com/apppasswords 生成');
        console.log('  2. 测试邮件发送: npm test');
        console.log('  3. 启动邮件监听: npm run relay:pty');
        
    } catch (error) {
        console.error('❌ 更新配置失败:', error.message);
        process.exit(1);
    }
}

// 显示 Gmail 配置指南
function showGmailGuide() {
    console.log('\n📖 Gmail 配置指南:');
    console.log('1. 登录 Gmail 账号');
    console.log('2. 访问 https://myaccount.google.com/security');
    console.log('3. 开启"两步验证"（如果未开启）');
    console.log('4. 访问 https://myaccount.google.com/apppasswords');
    console.log('5. 选择应用"邮件"，设备"其他"');
    console.log('6. 输入名称"TaskPing"');
    console.log('7. 生成16位应用专用密码');
    console.log('8. 将密码复制到 .env 文件的 IMAP_PASS');
    console.log('\n注意: 应用专用密码只显示一次，请妥善保存');
}

// 主函数
function main() {
    console.log('╔══════════════════════════════════════════════════════════╗');
    console.log('║              TaskPing Email Configuration                 ║');
    console.log('╚══════════════════════════════════════════════════════════╝\n');
    
    // 检查 .env 文件
    if (!fs.existsSync('.env')) {
        console.error('❌ 未找到 .env 文件');
        console.log('请先复制 .env.example 到 .env 并配置');
        process.exit(1);
    }
    
    // 更新配置
    updateEmailConfig();
    
    // 如果 IMAP 未配置，显示 Gmail 指南
    if (!process.env.IMAP_PASS || process.env.IMAP_PASS === 'your-gmail-app-password') {
        showGmailGuide();
    }
}

// 运行
main();