#!/usr/bin/env node

/**
 * 剪贴板自动化测试工具
 * 用于测试邮件回复命令的自动粘贴功能
 */

const ClipboardAutomation = require('./src/automation/clipboard-automation');

async function testClipboardAutomation() {
    console.log('🧪 剪贴板自动化测试\n');
    
    const automation = new ClipboardAutomation();
    
    if (!automation.isSupported()) {
        console.log('❌ 当前平台不支持剪贴板自动化');
        process.exit(1);
    }
    
    console.log('✅ 剪贴板自动化支持检查通过');
    
    // 测试命令
    const testCommand = 'echo "这是一个来自邮件回复的测试命令"';
    
    console.log(`📝 测试命令: ${testCommand}`);
    console.log('\n⚠️  请确保：');
    console.log('   1. Claude Code 或 Terminal 窗口已打开');
    console.log('   2. 输入框处于活动状态');
    console.log('   3. 准备好在 5 秒后接收自动输入');
    
    // 等待用户准备
    console.log('\n⏳ 5 秒后开始测试...');
    for (let i = 5; i > 0; i--) {
        process.stdout.write(`   ${i}... `);
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
    console.log('\n');
    
    try {
        console.log('🚀 发送测试命令...');
        const success = await automation.sendCommand(testCommand);
        
        if (success) {
            console.log('✅ 测试成功！命令应该已经自动粘贴到 Claude Code 中');
            console.log('💡 如果没有看到命令，请检查：');
            console.log('   - Claude Code 窗口是否在前台');
            console.log('   - 输入框是否处于焦点状态');
            console.log('   - 系统是否允许自动化权限');
        } else {
            console.log('❌ 测试失败：命令发送不成功');
            console.log('💡 请尝试：');
            console.log('   - 给予应用自动化权限（系统偏好设置 > 安全性与隐私 > 隐私 > 辅助功能）');
            console.log('   - 确保 Claude Code 或 Terminal 正在运行');
        }
    } catch (error) {
        console.error('❌ 测试过程中发生错误:', error.message);
    }
    
    // 显示剪贴板内容验证
    try {
        const clipboardContent = await automation.getClipboardContent();
        if (clipboardContent) {
            console.log(`\n📋 当前剪贴板内容: "${clipboardContent.trim()}"`);
        }
    } catch (error) {
        console.log('📋 无法读取剪贴板内容');
    }
}

// 处理命令行参数
const args = process.argv.slice(2);

if (args.includes('--help') || args.includes('-h')) {
    console.log(`
剪贴板自动化测试工具

用法: node test-clipboard.js [选项]

选项:
  -h, --help     显示帮助信息

这个工具用于测试 TaskPing 的邮件回复自动化功能。
它会模拟邮件回复的过程，将测试命令自动粘贴到 Claude Code 中。

确保在运行测试前：
1. 打开 Claude Code 或 Terminal
2. 点击输入框使其获得焦点
3. 给予应用必要的自动化权限
    `);
    process.exit(0);
}

// 运行测试
testClipboardAutomation().catch(console.error);