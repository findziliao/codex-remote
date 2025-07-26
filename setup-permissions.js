#!/usr/bin/env node

/**
 * macOS 权限设置助手
 * 帮助用户设置必要的系统权限
 */

const { spawn } = require('child_process');

class PermissionSetup {
    constructor() {
        this.requiredPermissions = [
            'Accessibility',
            'Automation'
        ];
    }

    async checkAndSetup() {
        console.log('🔒 macOS 权限设置助手\n');
        
        if (process.platform !== 'darwin') {
            console.log('ℹ️ 此工具仅适用于 macOS 系统');
            return;
        }

        console.log('TaskPing 需要以下权限才能自动粘贴邮件回复到 Claude Code：\n');
        
        console.log('1. 🖱️ 辅助功能权限 (Accessibility)');
        console.log('   - 允许控制其他应用程序');
        console.log('   - 自动输入和点击');
        
        console.log('\n2. 🤖 自动化权限 (Automation)');
        console.log('   - 允许发送 Apple Events');
        console.log('   - 控制应用程序行为\n');

        // 检查当前权限状态
        await this.checkCurrentPermissions();
        
        console.log('📋 设置步骤：\n');
        
        console.log('步骤 1: 打开系统偏好设置');
        console.log('   → 苹果菜单 > 系统偏好设置 > 安全性与隐私 > 隐私\n');
        
        console.log('步骤 2: 设置辅助功能权限');
        console.log('   → 点击左侧 "辅助功能"');
        console.log('   → 点击锁图标并输入密码');
        console.log('   → 添加以下应用：');
        console.log('     • Terminal (如果你在 Terminal 中运行 TaskPing)');
        console.log('     • iTerm2 (如果使用 iTerm2)');
        console.log('     • Visual Studio Code (如果在 VS Code 中运行)');
        console.log('     • 或者你当前使用的终端应用\n');
        
        console.log('步骤 3: 设置自动化权限');
        console.log('   → 点击左侧 "自动化"');
        console.log('   → 在你的终端应用下勾选：');
        console.log('     • System Events');
        console.log('     • Claude Code (如果有的话)');
        console.log('     • Terminal\n');

        console.log('🚀 快速打开系统偏好设置？');
        const readline = require('readline');
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });

        const answer = await this.question(rl, '是否现在打开系统偏好设置？(y/n): ');
        
        if (answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes') {
            await this.openSystemPreferences();
        }
        
        rl.close();
        
        console.log('\n✅ 设置完成后，重新运行以下命令测试：');
        console.log('   node taskping.js test-paste\n');
    }

    async checkCurrentPermissions() {
        console.log('🔍 检查当前权限状态...\n');
        
        try {
            // 测试基本的 AppleScript 执行
            const result = await this.runAppleScript('tell application "System Events" to return name of first process');
            if (result) {
                console.log('✅ 基本 AppleScript 权限：正常');
            }
        } catch (error) {
            console.log('❌ 基本 AppleScript 权限：需要设置');
        }

        try {
            // 测试辅助功能权限
            const result = await this.runAppleScript(`
                tell application "System Events"
                    try
                        return name of first application process whose frontmost is true
                    on error
                        return "permission_denied"
                    end try
                end tell
            `);
            
            if (result && result !== 'permission_denied') {
                console.log('✅ 辅助功能权限：已授权');
            } else {
                console.log('❌ 辅助功能权限：需要授权');
            }
        } catch (error) {
            console.log('❌ 辅助功能权限：需要授权');
        }
        
        console.log('');
    }

    async runAppleScript(script) {
        return new Promise((resolve, reject) => {
            const osascript = spawn('osascript', ['-e', script]);
            let output = '';
            let error = '';

            osascript.stdout.on('data', (data) => {
                output += data.toString();
            });

            osascript.stderr.on('data', (data) => {
                error += data.toString();
            });

            osascript.on('close', (code) => {
                if (code === 0) {
                    resolve(output.trim());
                } else {
                    reject(new Error(error || 'AppleScript execution failed'));
                }
            });
        });
    }

    async openSystemPreferences() {
        try {
            console.log('\n🔧 正在打开系统偏好设置...');
            
            // 直接打开安全性与隐私 > 隐私 > 辅助功能
            const script = `
                tell application "System Preferences"
                    activate
                    set current pane to pane "com.apple.preference.security"
                    delay 1
                    tell application "System Events"
                        tell window 1 of application process "System Preferences"
                            click tab "Privacy"
                            delay 0.5
                            tell outline 1 of scroll area 1
                                select row "Accessibility"
                            end tell
                        end tell
                    end tell
                end tell
            `;
            
            await this.runAppleScript(script);
            console.log('✅ 已打开辅助功能设置页面');
            
        } catch (error) {
            console.log('⚠️ 无法自动打开，请手动打开系统偏好设置');
            console.log('💡 你也可以运行：open "x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility"');
        }
    }

    question(rl, prompt) {
        return new Promise(resolve => {
            rl.question(prompt, resolve);
        });
    }
}

// 运行权限设置助手
if (require.main === module) {
    const setup = new PermissionSetup();
    setup.checkAndSetup().catch(console.error);
}

module.exports = PermissionSetup;