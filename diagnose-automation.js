#!/usr/bin/env node

/**
 * 自动化功能诊断工具
 * 详细检测和诊断自动粘贴功能的问题
 */

const { spawn } = require('child_process');

class AutomationDiagnostic {
    constructor() {
        this.tests = [];
    }

    async runDiagnostic() {
        console.log('🔍 自动化功能诊断工具\n');
        
        if (process.platform !== 'darwin') {
            console.log('❌ 此诊断工具仅适用于 macOS');
            return;
        }

        // 运行所有测试
        await this.testBasicAppleScript();
        await this.testSystemEventsAccess();
        await this.testKeystrokePermission();
        await this.testApplicationDetection();
        await this.testClipboardAccess();
        await this.testDetailedPermissions();
        
        // 显示总结
        this.showSummary();
        await this.provideSolutions();
    }

    async testBasicAppleScript() {
        console.log('1. 📋 测试基本 AppleScript 执行...');
        try {
            const result = await this.runAppleScript('return "AppleScript works"');
            if (result === 'AppleScript works') {
                console.log('   ✅ 基本 AppleScript 执行正常');
                this.tests.push({ name: 'AppleScript', status: 'pass' });
            } else {
                console.log('   ❌ AppleScript 返回异常结果');
                this.tests.push({ name: 'AppleScript', status: 'fail', error: 'Unexpected result' });
            }
        } catch (error) {
            console.log('   ❌ AppleScript 执行失败:', error.message);
            this.tests.push({ name: 'AppleScript', status: 'fail', error: error.message });
        }
        console.log('');
    }

    async testSystemEventsAccess() {
        console.log('2. 🖥️ 测试 System Events 访问...');
        try {
            const script = `
                tell application "System Events"
                    return name of first application process whose frontmost is true
                end tell
            `;
            const result = await this.runAppleScript(script);
            if (result && result !== 'permission_denied') {
                console.log(`   ✅ 可以访问 System Events，当前前台应用: ${result}`);
                this.tests.push({ name: 'System Events', status: 'pass', data: result });
            } else {
                console.log('   ❌ System Events 访问被拒绝');
                this.tests.push({ name: 'System Events', status: 'fail', error: 'Access denied' });
            }
        } catch (error) {
            console.log('   ❌ System Events 访问失败:', error.message);
            this.tests.push({ name: 'System Events', status: 'fail', error: error.message });
        }
        console.log('');
    }

    async testKeystrokePermission() {
        console.log('3. ⌨️ 测试按键发送权限...');
        try {
            const script = `
                tell application "System Events"
                    try
                        keystroke "test" without key down
                        return "keystroke_success"
                    on error errorMessage
                        return "keystroke_failed: " & errorMessage
                    end try
                end tell
            `;
            const result = await this.runAppleScript(script);
            if (result === 'keystroke_success') {
                console.log('   ✅ 按键发送权限正常');
                this.tests.push({ name: 'Keystroke', status: 'pass' });
            } else {
                console.log(`   ❌ 按键发送失败: ${result}`);
                this.tests.push({ name: 'Keystroke', status: 'fail', error: result });
            }
        } catch (error) {
            console.log('   ❌ 按键测试异常:', error.message);
            this.tests.push({ name: 'Keystroke', status: 'fail', error: error.message });
        }
        console.log('');
    }

    async testApplicationDetection() {
        console.log('4. 🔍 测试应用程序检测...');
        try {
            const script = `
                tell application "System Events"
                    set appList to {"Terminal", "iTerm2", "iTerm", "Visual Studio Code", "Code", "Cursor", "Claude Code"}
                    set foundApps to {}
                    repeat with appName in appList
                        try
                            if application process appName exists then
                                set foundApps to foundApps & {appName}
                            end if
                        end try
                    end repeat
                    return foundApps as string
                end tell
            `;
            const result = await this.runAppleScript(script);
            if (result) {
                console.log(`   ✅ 检测到以下应用: ${result}`);
                this.tests.push({ name: 'App Detection', status: 'pass', data: result });
            } else {
                console.log('   ⚠️ 未检测到目标应用程序');
                this.tests.push({ name: 'App Detection', status: 'warn', error: 'No target apps found' });
            }
        } catch (error) {
            console.log('   ❌ 应用检测失败:', error.message);
            this.tests.push({ name: 'App Detection', status: 'fail', error: error.message });
        }
        console.log('');
    }

    async testClipboardAccess() {
        console.log('5. 📋 测试剪贴板访问...');
        try {
            // 测试写入剪贴板
            await this.setClipboard('test_clipboard_content');
            const content = await this.getClipboard();
            
            if (content.includes('test_clipboard_content')) {
                console.log('   ✅ 剪贴板读写正常');
                this.tests.push({ name: 'Clipboard', status: 'pass' });
            } else {
                console.log('   ❌ 剪贴板内容不匹配');
                this.tests.push({ name: 'Clipboard', status: 'fail', error: 'Content mismatch' });
            }
        } catch (error) {
            console.log('   ❌ 剪贴板访问失败:', error.message);
            this.tests.push({ name: 'Clipboard', status: 'fail', error: error.message });
        }
        console.log('');
    }

    async testDetailedPermissions() {
        console.log('6. 🔐 详细权限检查...');
        
        try {
            // 检查当前运行的进程
            const whoami = await this.runCommand('whoami');
            console.log(`   👤 当前用户: ${whoami}`);
            
            // 检查终端应用
            const terminal = process.env.TERM_PROGRAM || 'Unknown';
            console.log(`   💻 终端程序: ${terminal}`);
            
            // 检查是否在 IDE 中运行
            const isInIDE = process.env.VSCODE_PID || process.env.CURSOR_SESSION_ID || process.env.JB_IDE_PID;
            if (isInIDE) {
                console.log('   🔧 检测到在 IDE 中运行');
            }
            
            // 尝试获取更详细的权限信息
            const script = `
                tell application "System Events"
                    try
                        set frontApp to name of first application process whose frontmost is true
                        set allApps to name of every application process
                        return "Front: " & frontApp & ", All: " & (count of allApps)
                    on error errorMsg
                        return "Error: " & errorMsg
                    end try
                end tell
            `;
            
            const permResult = await this.runAppleScript(script);
            console.log(`   📊 权限测试结果: ${permResult}`);
            
            this.tests.push({ 
                name: 'Detailed Permissions', 
                status: 'info', 
                data: { user: whoami, terminal, result: permResult }
            });
            
        } catch (error) {
            console.log('   ❌ 详细检查失败:', error.message);
            this.tests.push({ name: 'Detailed Permissions', status: 'fail', error: error.message });
        }
        console.log('');
    }

    showSummary() {
        console.log('📊 诊断结果总结:\n');
        
        const passed = this.tests.filter(t => t.status === 'pass').length;
        const failed = this.tests.filter(t => t.status === 'fail').length;
        const warned = this.tests.filter(t => t.status === 'warn').length;
        
        this.tests.forEach(test => {
            const icon = test.status === 'pass' ? '✅' : 
                        test.status === 'fail' ? '❌' : 
                        test.status === 'warn' ? '⚠️' : 'ℹ️';
            console.log(`${icon} ${test.name}`);
            if (test.error) {
                console.log(`   错误: ${test.error}`);
            }
            if (test.data) {
                console.log(`   数据: ${test.data}`);
            }
        });
        
        console.log(`\n📈 总计: ${passed} 通过, ${failed} 失败, ${warned} 警告\n`);
    }

    async provideSolutions() {
        const keystrokeTest = this.tests.find(t => t.name === 'Keystroke');
        const systemEventsTest = this.tests.find(t => t.name === 'System Events');
        
        console.log('💡 解决方案建议:\n');
        
        if (keystrokeTest && keystrokeTest.status === 'fail') {
            console.log('🔧 按键发送问题解决方案:');
            console.log('   1. 打开 系统偏好设置 > 安全性与隐私 > 隐私 > 辅助功能');
            console.log('   2. 移除并重新添加你的终端应用 (Terminal/iTerm2/VS Code)');
            console.log('   3. 确保勾选框已被选中');
            console.log('   4. 重启终端应用');
            console.log('');
        }
        
        if (systemEventsTest && systemEventsTest.status === 'fail') {
            console.log('🔧 System Events 访问问题解决方案:');
            console.log('   1. 检查 系统偏好设置 > 安全性与隐私 > 隐私 > 自动化');
            console.log('   2. 确保你的终端应用下勾选了 "System Events"');
            console.log('   3. 如果没有看到你的应用，先运行一次自动化脚本触发权限请求');
            console.log('');
        }
        
        console.log('🚀 额外建议:');
        console.log('   • 尝试完全退出并重启终端应用');
        console.log('   • 在 Terminal 中运行而不是在 IDE 集成终端中');
        console.log('   • 检查是否有安全软件阻止自动化');
        console.log('   • 尝试在不同的终端应用中运行测试');
        
        const readline = require('readline');
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });

        const answer = await this.question(rl, '\n是否尝试一个简单的修复测试？(y/n): ');
        
        if (answer.toLowerCase() === 'y') {
            await this.runSimpleFixTest();
        }
        
        rl.close();
    }

    async runSimpleFixTest() {
        console.log('\n🔨 运行简单修复测试...');
        
        try {
            // 尝试最基本的自动化
            const script = `
                display dialog "TaskPing 自动化测试" with title "权限测试" buttons {"确定"} default button 1 giving up after 3
            `;
            
            await this.runAppleScript(script);
            console.log('✅ 基本对话框测试成功');
            
        } catch (error) {
            console.log('❌ 基本测试失败:', error.message);
        }
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
                    reject(new Error(error || `Exit code: ${code}`));
                }
            });
        });
    }

    async runCommand(command) {
        return new Promise((resolve, reject) => {
            const proc = spawn('sh', ['-c', command]);
            let output = '';

            proc.stdout.on('data', (data) => {
                output += data.toString();
            });

            proc.on('close', (code) => {
                if (code === 0) {
                    resolve(output.trim());
                } else {
                    reject(new Error(`Command failed with exit code ${code}`));
                }
            });
        });
    }

    async setClipboard(text) {
        return new Promise((resolve, reject) => {
            const pbcopy = spawn('pbcopy');
            pbcopy.stdin.write(text);
            pbcopy.stdin.end();
            
            pbcopy.on('close', (code) => {
                if (code === 0) {
                    resolve();
                } else {
                    reject(new Error('Failed to set clipboard'));
                }
            });
        });
    }

    async getClipboard() {
        return new Promise((resolve, reject) => {
            const pbpaste = spawn('pbpaste');
            let output = '';

            pbpaste.stdout.on('data', (data) => {
                output += data.toString();
            });

            pbpaste.on('close', (code) => {
                if (code === 0) {
                    resolve(output);
                } else {
                    reject(new Error('Failed to get clipboard'));
                }
            });
        });
    }

    question(rl, prompt) {
        return new Promise(resolve => {
            rl.question(prompt, resolve);
        });
    }
}

// 运行诊断
if (require.main === module) {
    const diagnostic = new AutomationDiagnostic();
    diagnostic.runDiagnostic().catch(console.error);
}

module.exports = AutomationDiagnostic;