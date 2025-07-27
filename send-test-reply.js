/**
 * 发送测试邮件回复到relay服务
 */

const nodemailer = require('nodemailer');
require('dotenv').config();

async function sendTestReply() {
    console.log('📧 发送测试邮件回复...\n');
    
    // 创建测试用的SMTP传输器（使用Gmail）
    const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: 'jiaxicui446@gmail.com',
            pass: process.env.GMAIL_APP_PASSWORD || 'your-app-password'
        }
    });
    
    // 使用最新的token
    const testToken = 'V5UPZ1UE'; // 来自session-map.json的最新token
    
    const mailOptions = {
        from: 'jiaxicui446@gmail.com',
        to: 'noreply@pandalla.ai',
        subject: `Re: [TaskPing #${testToken}] Claude Code 任务完成 - TaskPing`,
        text: '请解释一下量子计算的基本原理',
        replyTo: 'jiaxicui446@gmail.com'
    };
    
    try {
        const info = await transporter.sendMail(mailOptions);
        console.log('✅ 测试邮件发送成功!');
        console.log(`📧 Message ID: ${info.messageId}`);
        console.log(`📋 Token: ${testToken}`);
        console.log(`💬 Command: ${mailOptions.text}`);
        console.log('\n🔍 现在监控relay服务日志...');
        
        // 等待几秒让邮件被处理
        setTimeout(() => {
            console.log('\n📋 请检查relay-debug.log文件查看处理日志');
        }, 5000);
        
    } catch (error) {
        console.error('❌ 邮件发送失败:', error.message);
    }
}

sendTestReply().catch(console.error);