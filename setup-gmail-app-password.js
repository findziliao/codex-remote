#!/usr/bin/env node

/**
 * Gmail 应用专用密码设置指南
 * 帮助用户配置 Gmail 的应用专用密码
 */

const fs = require('fs');
const readline = require('readline');

function displayInstructions() {
    console.log('╔═══════════════════════════════════════════════════════════════╗');
    console.log('║              Gmail 应用专用密码配置指南                        ║');
    console.log('╚═══════════════════════════════════════════════════════════════╝\n');
    
    console.log('📋 配置步骤:\n');
    
    console.log('1️⃣  登录 Gmail 账号');
    console.log('   🌐 访问: https://myaccount.google.com/');
    console.log('   👤 使用您的账号: jiaxicui446@gmail.com\n');
    
    console.log('2️⃣  开启两步验证（如果未开启）');
    console.log('   🌐 访问: https://myaccount.google.com/security');
    console.log('   🔐 找到"两步验证"并开启');
    console.log('   📱 可以使用手机短信或认证器应用\n');
    
    console.log('3️⃣  生成应用专用密码');
    console.log('   🌐 访问: https://myaccount.google.com/apppasswords');
    console.log('   📧 选择应用: "邮件"');
    console.log('   💻 选择设备: "其他（自定义名称）"');
    console.log('   ✏️  输入名称: "TaskPing Email Relay"');
    console.log('   🔑 点击"生成"');
    console.log('   📋 复制 16 位密码（格式类似：abcd efgh ijkl mnop）\n');
    
    console.log('4️⃣  启用 IMAP（如果未启用）');
    console.log('   🌐 访问: https://mail.google.com/mail/u/0/#settings/fwdandpop');
    console.log('   📩 找到"IMAP 访问"');
    console.log('   ✅ 选择"启用 IMAP"');
    console.log('   💾 保存更改\n');
    
    console.log('⚠️  重要提示:');
    console.log('   • 应用专用密码只显示一次，请妥善保存');
    console.log('   • 不要使用您的 Google 账号密码');
    console.log('   • 密码格式是 16 位，包含空格（请保留空格）');
    console.log('   • 如果忘记密码，需要删除后重新生成\n');
}

async function promptForPassword() {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });
    
    return new Promise((resolve) => {
        console.log('📝 请输入您生成的应用专用密码:');
        console.log('   (格式: abcd efgh ijkl mnop)');
        rl.question('密码: ', (password) => {
            rl.close();
            resolve(password.trim());
        });
    });
}

function validatePassword(password) {
    // Gmail 应用专用密码格式：16位字符，可能包含空格
    const cleanPassword = password.replace(/\s/g, '');
    
    if (cleanPassword.length !== 16) {
        return {
            valid: false,
            message: '密码长度应为16位字符'
        };
    }
    
    if (!/^[a-zA-Z0-9]+$/.test(cleanPassword)) {
        return {
            valid: false,
            message: '密码只能包含字母和数字'
        };
    }
    
    return {
        valid: true,
        cleanPassword
    };
}

function updateEnvFile(password) {
    const envPath = '.env';
    
    if (!fs.existsSync(envPath)) {
        console.error('❌ 未找到 .env 文件');
        return false;
    }
    
    try {
        let content = fs.readFileSync(envPath, 'utf8');
        
        // 替换 IMAP_PASS 行
        const updated = content.replace(
            /IMAP_PASS=.*/,
            `IMAP_PASS=${password}`
        );
        
        fs.writeFileSync(envPath, updated);
        return true;
    } catch (error) {
        console.error('❌ 更新 .env 文件失败:', error.message);
        return false;
    }
}

async function testConnection(password) {
    console.log('\n🔍 测试 Gmail IMAP 连接...');
    
    // 临时设置环境变量
    process.env.IMAP_PASS = password;
    
    try {
        // 动态导入 ImapFlow
        const { ImapFlow } = require('imapflow');
        
        const client = new ImapFlow({
            host: 'imap.gmail.com',
            port: 993,
            secure: true,
            auth: { 
                user: 'jiaxicui446@gmail.com', 
                pass: password 
            },
            logger: false
        });
        
        await client.connect();
        console.log('✅ Gmail IMAP 连接成功！');
        
        const status = await client.status('INBOX', { messages: true, unseen: true });
        console.log(`📧 收件箱状态: ${status.messages} 封邮件，${status.unseen} 封未读`);
        
        await client.logout();
        return true;
        
    } catch (error) {
        console.error('❌ 连接失败:', error.message);
        
        if (error.code === 'EAUTH') {
            console.log('\n可能的原因:');
            console.log('• 应用专用密码错误');
            console.log('• 两步验证未开启');
            console.log('• IMAP 未启用');
        }
        
        return false;
    }
}

async function main() {
    displayInstructions();
    
    console.log('═'.repeat(65));
    console.log('现在开始配置应用专用密码\n');
    
    // 检查是否已经完成网页配置
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });
    
    const ready = await new Promise((resolve) => {
        rl.question('已完成上述步骤并获得应用专用密码？(y/n): ', (answer) => {
            rl.close();
            resolve(answer.toLowerCase() === 'y');
        });
    });
    
    if (!ready) {
        console.log('\n请先完成上述配置步骤，然后重新运行此脚本');
        return;
    }
    
    // 获取密码
    const password = await promptForPassword();
    
    if (!password) {
        console.log('❌ 未输入密码');
        return;
    }
    
    // 验证密码格式
    const validation = validatePassword(password);
    if (!validation.valid) {
        console.log(`❌ 密码格式错误: ${validation.message}`);
        return;
    }
    
    const cleanPassword = validation.cleanPassword;
    console.log('✅ 密码格式正确');
    
    // 测试连接
    const connected = await testConnection(cleanPassword);
    
    if (!connected) {
        console.log('\n请检查配置后重试');
        return;
    }
    
    // 更新 .env 文件
    const updated = updateEnvFile(cleanPassword);
    
    if (updated) {
        console.log('\n✅ 配置已保存到 .env 文件');
        console.log('\n🚀 下一步操作:');
        console.log('   1. 运行: npm run email:config');
        console.log('   2. 运行: npm run email:test');
        console.log('   3. 运行: npm run relay:pty');
        console.log('\n🎉 Gmail 应用专用密码配置完成！');
    } else {
        console.log('\n❌ 保存配置失败，请手动编辑 .env 文件');
        console.log(`   IMAP_PASS=${cleanPassword}`);
    }
}

// 运行
main().catch(console.error);