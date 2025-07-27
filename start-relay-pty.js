#!/usr/bin/env node

/**
 * TaskPing PTY Relay 启动脚本
 * 启动基于 node-pty 的邮件命令中继服务
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// 检查环境配置
function checkConfig() {
    const envPath = path.join(__dirname, '.env');
    
    if (!fs.existsSync(envPath)) {
        console.error('❌ 错误: 未找到 .env 配置文件');
        console.log('\n请先复制 .env.example 到 .env 并配置您的邮件信息:');
        console.log('  cp .env.example .env');
        console.log('  然后编辑 .env 文件填入您的邮件配置\n');
        process.exit(1);
    }
    
    // 加载环境变量
    require('dotenv').config();
    
    // 检查必需的配置
    const required = ['IMAP_HOST', 'IMAP_USER', 'IMAP_PASS'];
    const missing = required.filter(key => !process.env[key]);
    
    if (missing.length > 0) {
        console.error('❌ 错误: 缺少必需的环境变量:');
        missing.forEach(key => console.log(`  - ${key}`));
        console.log('\n请编辑 .env 文件并填入所有必需的配置\n');
        process.exit(1);
    }
    
    console.log('✅ 配置检查通过');
    console.log(`📧 IMAP服务器: ${process.env.IMAP_HOST}`);
    console.log(`👤 邮件账号: ${process.env.IMAP_USER}`);
    console.log(`🔒 白名单发件人: ${process.env.ALLOWED_SENDERS || '(未设置，将接受所有邮件)'}`);
    console.log(`💾 会话存储路径: ${process.env.SESSION_MAP_PATH || '(使用默认路径)'}`);
    console.log('');
}

// 创建会话示例
function createExampleSession() {
    const sessionMapPath = process.env.SESSION_MAP_PATH || path.join(__dirname, 'src/data/session-map.json');
    const sessionDir = path.dirname(sessionMapPath);
    
    // 确保目录存在
    if (!fs.existsSync(sessionDir)) {
        fs.mkdirSync(sessionDir, { recursive: true });
    }
    
    // 如果会话文件不存在，创建一个示例
    if (!fs.existsSync(sessionMapPath)) {
        const exampleToken = 'TEST123';
        const exampleSession = {
            [exampleToken]: {
                type: 'pty',
                createdAt: Math.floor(Date.now() / 1000),
                expiresAt: Math.floor((Date.now() + 24 * 60 * 60 * 1000) / 1000), // 24小时后过期
                cwd: process.cwd(),
                description: '测试会话 - 发送邮件时主题包含 [TaskPing #TEST123]'
            }
        };
        
        fs.writeFileSync(sessionMapPath, JSON.stringify(exampleSession, null, 2));
        console.log(`📝 已创建示例会话文件: ${sessionMapPath}`);
        console.log(`🔑 测试Token: ${exampleToken}`);
        console.log('   发送测试邮件时，主题中包含: [TaskPing #TEST123]');
        console.log('');
    }
}

// PID文件路径
const PID_FILE = path.join(__dirname, 'relay-pty.pid');

// 检查是否已有实例在运行
function checkSingleInstance() {
    if (fs.existsSync(PID_FILE)) {
        try {
            const oldPid = parseInt(fs.readFileSync(PID_FILE, 'utf8'));
            // 检查进程是否真的在运行
            process.kill(oldPid, 0);
            // 如果没有抛出错误，说明进程还在运行
            console.error('❌ 错误: relay-pty 服务已经在运行中 (PID: ' + oldPid + ')');
            console.log('\n如果您确定服务没有运行，可以删除 PID 文件:');
            console.log('  rm ' + PID_FILE);
            console.log('\n或停止现有服务:');
            console.log('  kill ' + oldPid);
            process.exit(1);
        } catch (err) {
            // 进程不存在，删除旧的 PID 文件
            fs.unlinkSync(PID_FILE);
        }
    }
    
    // 写入当前进程的 PID
    fs.writeFileSync(PID_FILE, process.pid.toString());
}

// 清理 PID 文件
function cleanupPidFile() {
    if (fs.existsSync(PID_FILE)) {
        fs.unlinkSync(PID_FILE);
    }
}

// 启动服务
function startService() {
    // 检查单实例
    checkSingleInstance();
    
    console.log('🚀 正在启动 TaskPing PTY Relay 服务...\n');
    
    const relayPath = path.join(__dirname, 'src/relay/relay-pty.js');
    
    // 使用 node 直接运行，这样可以看到完整的日志输出
    const relay = spawn('node', [relayPath], {
        stdio: 'inherit',
        env: {
            ...process.env,
            INJECTION_MODE: 'pty'
        }
    });
    
    // 处理退出
    process.on('SIGINT', () => {
        console.log('\n⏹️  正在停止服务...');
        relay.kill('SIGINT');
        cleanupPidFile();
        process.exit(0);
    });
    
    process.on('exit', cleanupPidFile);
    process.on('SIGTERM', cleanupPidFile);
    
    relay.on('error', (error) => {
        console.error('❌ 启动失败:', error.message);
        cleanupPidFile();
        process.exit(1);
    });
    
    relay.on('exit', (code, signal) => {
        cleanupPidFile();
        if (signal) {
            console.log(`\n服务已停止 (信号: ${signal})`);
        } else if (code !== 0) {
            console.error(`\n服务异常退出 (代码: ${code})`);
            process.exit(code);
        }
    });
}

// 显示使用说明
function showInstructions() {
    console.log('📖 使用说明:');
    console.log('1. 在 Claude Code 中执行任务时，会发送包含 Token 的提醒邮件');
    console.log('2. 回复该邮件，内容为要执行的命令');
    console.log('3. 支持的命令格式:');
    console.log('   - 直接输入命令文本');
    console.log('   - 使用 CMD: 前缀，如 "CMD: 继续"');
    console.log('   - 使用代码块包裹，如:');
    console.log('     ```');
    console.log('     你的命令');
    console.log('     ```');
    console.log('4. 系统会自动提取命令并注入到对应的 Claude Code 会话中');
    console.log('\n⌨️  按 Ctrl+C 停止服务\n');
    console.log('━'.repeat(60) + '\n');
}

// 主函数
function main() {
    console.log('╔══════════════════════════════════════════════════════════╗');
    console.log('║             TaskPing PTY Relay Service                    ║');
    console.log('║      邮件命令中继服务 - 基于 node-pty 的 PTY 模式          ║');
    console.log('╚══════════════════════════════════════════════════════════╝\n');
    
    // 检查配置
    checkConfig();
    
    // 创建示例会话
    createExampleSession();
    
    // 显示使用说明
    showInstructions();
    
    // 启动服务
    startService();
}

// 运行
main();