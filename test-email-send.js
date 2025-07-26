#!/usr/bin/env node

/**
 * 测试邮件发送功能
 * 验证 SMTP 配置是否正确
 */

const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function testEmailSend() {
    console.log('📧 测试邮件发送功能\n');
    
    // 检查配置
    if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
        console.error('❌ 缺少 SMTP 配置，请检查 .env 文件');
        process.exit(1);
    }
    
    // 创建测试会话
    const testToken = 'TEST' + Date.now().toString(36).toUpperCase();
    const sessionMapPath = process.env.SESSION_MAP_PATH || path.join(__dirname, 'src/data/session-map.json');
    
    // 确保目录存在
    const dir = path.dirname(sessionMapPath);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
    
    // 创建会话
    const sessions = fs.existsSync(sessionMapPath) 
        ? JSON.parse(fs.readFileSync(sessionMapPath, 'utf8'))
        : {};
        
    sessions[testToken] = {
        type: 'pty',
        createdAt: Math.floor(Date.now() / 1000),
        expiresAt: Math.floor((Date.now() + 3600000) / 1000), // 1小时后过期
        cwd: process.cwd(),
        description: '测试会话'
    };
    
    fs.writeFileSync(sessionMapPath, JSON.stringify(sessions, null, 2));
    console.log(`✅ 创建测试会话: ${testToken}\n`);
    
    // 创建邮件传输器
    const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || '465'),
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS
        }
    });
    
    // 准备邮件内容
    const mailOptions = {
        from: `${process.env.EMAIL_FROM_NAME || 'TaskPing'} <${process.env.EMAIL_FROM || process.env.SMTP_USER}>`,
        to: process.env.EMAIL_TO || 'jiaxicui446@gmail.com',
        subject: `[TaskPing #${testToken}] 测试邮件 - 等待您的指令`,
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #333;">🔔 TaskPing 测试通知</h2>
                
                <p>这是一封测试邮件，用于验证邮件配置是否正确。</p>
                
                <div style="background: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
                    <p><strong>会话信息：</strong></p>
                    <p>Token: <code>${testToken}</code></p>
                    <p>创建时间: ${new Date().toLocaleString('zh-CN')}</p>
                    <p>过期时间: ${new Date(Date.now() + 3600000).toLocaleString('zh-CN')}</p>
                </div>
                
                <div style="background: #e8f4f8; padding: 15px; border-radius: 5px; margin: 20px 0;">
                    <p><strong>📝 测试指令：</strong></p>
                    <p>请回复以下任意命令来测试：</p>
                    <ul>
                        <li>直接回复: <code>echo "Hello from email"</code></li>
                        <li>使用CMD前缀: <code>CMD: pwd</code></li>
                        <li>使用代码块:
                            <pre style="background: white; padding: 10px; border-radius: 3px;">
\`\`\`
ls -la
\`\`\`
                            </pre>
                        </li>
                    </ul>
                </div>
                
                <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
                
                <p style="color: #666; font-size: 12px;">
                    会话ID: ${testToken}<br>
                    发送自: ${process.env.SMTP_USER}<br>
                    发送到: ${process.env.EMAIL_TO || 'jiaxicui446@gmail.com'}
                </p>
            </div>
        `,
        text: `TaskPing 测试通知\n\n` +
              `这是一封测试邮件，用于验证邮件配置是否正确。\n\n` +
              `会话Token: ${testToken}\n` +
              `创建时间: ${new Date().toLocaleString('zh-CN')}\n\n` +
              `请回复任意命令来测试，例如: echo "Hello from email"\n\n` +
              `会话ID: ${testToken}`,
        headers: {
            'X-TaskPing-Session-ID': testToken,
            'X-TaskPing-Type': 'test'
        }
    };
    
    // 发送邮件
    try {
        console.log('🚀 正在发送测试邮件...');
        console.log(`   发件人: ${mailOptions.from}`);
        console.log(`   收件人: ${mailOptions.to}`);
        console.log(`   主题: ${mailOptions.subject}\n`);
        
        const info = await transporter.sendMail(mailOptions);
        
        console.log('✅ 邮件发送成功！');
        console.log(`   Message ID: ${info.messageId}`);
        console.log(`   Response: ${info.response}\n`);
        
        console.log('📋 下一步操作:');
        console.log('1. 检查收件箱是否收到邮件');
        console.log('2. 确保 Gmail 已配置应用专用密码');
        console.log('3. 启动邮件监听服务: npm run relay:pty');
        console.log('4. 回复邮件测试命令注入功能');
        console.log(`\n💡 回复时主题保持: [TaskPing #${testToken}]`);
        
    } catch (error) {
        console.error('❌ 邮件发送失败:', error.message);
        
        if (error.code === 'EAUTH') {
            console.log('\n可能的原因:');
            console.log('1. SMTP 密码错误');
            console.log('2. 邮箱未开启 SMTP 服务');
            console.log('3. 需要使用应用专用密码而非账号密码');
        }
        
        if (error.code === 'ECONNECTION') {
            console.log('\n可能的原因:');
            console.log('1. SMTP 服务器地址或端口错误');
            console.log('2. 网络连接问题');
            console.log('3. 防火墙阻止了连接');
        }
        
        process.exit(1);
    }
}

// 主函数
async function main() {
    console.log('╔══════════════════════════════════════════════════════════╗');
    console.log('║            TaskPing Email Send Test                       ║');
    console.log('╚══════════════════════════════════════════════════════════╝\n');
    
    await testEmailSend();
}

// 运行
main().catch(console.error);