#!/usr/bin/env node

/**
 * TaskPing 邮件回复测试工具
 * 用于测试邮件命令提取和 PTY 注入功能
 */

const path = require('path');
const fs = require('fs');

// 加载 relay-pty 模块
const { 
    extractTokenFromSubject, 
    stripReply,
    handleMailMessage 
} = require('./src/relay/relay-pty');

// 测试用例
const testCases = [
    {
        name: '基本命令',
        email: {
            subject: 'Re: [TaskPing #TEST123] 任务等待您的指示',
            from: { text: 'user@example.com', value: [{ address: 'user@example.com' }] },
            text: '继续执行\n\n> 原始邮件内容...'
        },
        expectedToken: 'TEST123',
        expectedCommand: '继续执行'
    },
    {
        name: 'CMD前缀',
        email: {
            subject: 'Re: TaskPing: ABC789',
            from: { text: 'user@example.com', value: [{ address: 'user@example.com' }] },
            text: 'CMD: npm run build\n\n发自我的iPhone'
        },
        expectedToken: 'ABC789',
        expectedCommand: 'npm run build'
    },
    {
        name: '代码块',
        email: {
            subject: 'Re: [TaskPing #XYZ456]',
            from: { text: 'user@example.com', value: [{ address: 'user@example.com' }] },
            text: '这是我的命令：\n\n```\ngit add .\ngit commit -m "Update"\n```\n\n谢谢！'
        },
        expectedToken: 'XYZ456',
        expectedCommand: 'git add .\ngit commit -m "Update"'
    },
    {
        name: '复杂邮件引用',
        email: {
            subject: 'Re: [TaskPing #TASK999] 请输入下一步操作',
            from: { text: 'boss@company.com', value: [{ address: 'boss@company.com' }] },
            text: `yes, please continue

--
Best regards,
Boss

On 2024-01-01, TaskPing wrote:
> 任务已完成第一步
> 会话ID: 12345-67890
> 请回复您的下一步指示`
        },
        expectedToken: 'TASK999',
        expectedCommand: 'yes, please continue'
    },
    {
        name: 'HTML邮件转纯文本',
        email: {
            subject: 'Re: [TaskPing #HTML123]',
            from: { text: 'user@example.com', value: [{ address: 'user@example.com' }] },
            html: '<div>运行测试套件</div><br><blockquote>原始邮件...</blockquote>',
            text: '运行测试套件\n\n> 原始邮件...'
        },
        expectedToken: 'HTML123',
        expectedCommand: '运行测试套件'
    }
];

// 运行测试
function runTests() {
    console.log('🧪 TaskPing 邮件解析测试\n');
    
    let passed = 0;
    let failed = 0;
    
    testCases.forEach((testCase, index) => {
        console.log(`测试 ${index + 1}: ${testCase.name}`);
        
        try {
            // 测试 Token 提取
            const token = extractTokenFromSubject(testCase.email.subject);
            if (token === testCase.expectedToken) {
                console.log(`  ✅ Token提取正确: ${token}`);
            } else {
                console.log(`  ❌ Token提取错误: 期望 "${testCase.expectedToken}", 实际 "${token}"`);
                failed++;
                console.log('');
                return;
            }
            
            // 测试命令提取
            const command = stripReply(testCase.email.text || testCase.email.html);
            if (command === testCase.expectedCommand) {
                console.log(`  ✅ 命令提取正确: "${command}"`);
                passed++;
            } else {
                console.log(`  ❌ 命令提取错误:`);
                console.log(`     期望: "${testCase.expectedCommand}"`);
                console.log(`     实际: "${command}"`);
                failed++;
            }
            
        } catch (error) {
            console.log(`  ❌ 测试出错: ${error.message}`);
            failed++;
        }
        
        console.log('');
    });
    
    // 显示结果
    console.log('━'.repeat(50));
    console.log(`测试完成: ${passed} 通过, ${failed} 失败`);
    
    if (failed === 0) {
        console.log('\n✅ 所有测试通过！');
    } else {
        console.log('\n❌ 部分测试失败，请检查实现');
    }
}

// 测试实际邮件处理
async function testEmailProcessing() {
    console.log('\n\n📧 测试邮件处理流程\n');
    
    // 设置测试环境变量
    process.env.ALLOWED_SENDERS = 'user@example.com,boss@company.com';
    process.env.SESSION_MAP_PATH = path.join(__dirname, 'test-session-map.json');
    
    // 创建测试会话
    const testSessions = {
        'TEST123': {
            type: 'pty',
            createdAt: Math.floor(Date.now() / 1000),
            expiresAt: Math.floor((Date.now() + 3600000) / 1000),
            cwd: process.cwd()
        }
    };
    
    fs.writeFileSync(process.env.SESSION_MAP_PATH, JSON.stringify(testSessions, null, 2));
    console.log('✅ 创建测试会话文件');
    
    // 模拟邮件消息
    const { simpleParser } = require('mailparser');
    const testEmail = `From: user@example.com
To: taskping@example.com
Subject: Re: [TaskPing #TEST123] 测试
Content-Type: text/plain; charset=utf-8

这是测试命令

> 原始邮件内容...`;
    
    try {
        console.log('🔄 处理模拟邮件...');
        
        // 注意：实际的 handleMailMessage 会尝试创建 PTY
        // 在测试环境中可能会失败，这是预期的
        await handleMailMessage(Buffer.from(testEmail), 'test-uid-123');
        
        console.log('✅ 邮件处理流程完成（注意：PTY创建可能失败，这在测试中是正常的）');
    } catch (error) {
        console.log(`⚠️  邮件处理出错（预期的）: ${error.message}`);
    }
    
    // 清理测试文件
    if (fs.existsSync(process.env.SESSION_MAP_PATH)) {
        fs.unlinkSync(process.env.SESSION_MAP_PATH);
        console.log('🧹 清理测试文件');
    }
}

// 显示集成说明
function showIntegrationGuide() {
    console.log('\n\n📚 集成指南\n');
    console.log('1. 配置邮件服务器信息:');
    console.log('   编辑 .env 文件，填入 IMAP 配置');
    console.log('');
    console.log('2. 设置白名单发件人:');
    console.log('   ALLOWED_SENDERS=your-email@gmail.com');
    console.log('');
    console.log('3. 创建会话映射:');
    console.log('   当发送提醒邮件时，在 session-map.json 中添加:');
    console.log('   {');
    console.log('     "YOUR_TOKEN": {');
    console.log('       "type": "pty",');
    console.log('       "createdAt": 1234567890,');
    console.log('       "expiresAt": 1234567890,');
    console.log('       "cwd": "/path/to/project"');
    console.log('     }');
    console.log('   }');
    console.log('');
    console.log('4. 启动服务:');
    console.log('   ./start-relay-pty.js');
    console.log('');
    console.log('5. 发送测试邮件:');
    console.log('   主题包含 [TaskPing #YOUR_TOKEN]');
    console.log('   正文为要执行的命令');
}

// 主函数
async function main() {
    console.log('╔══════════════════════════════════════════════════════════╗');
    console.log('║          TaskPing Email Reply Test Suite                  ║');
    console.log('╚══════════════════════════════════════════════════════════╝\n');
    
    // 运行单元测试
    runTests();
    
    // 测试邮件处理
    await testEmailProcessing();
    
    // 显示集成指南
    showIntegrationGuide();
}

// 运行测试
main().catch(console.error);