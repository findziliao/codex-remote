#!/usr/bin/env node

/**
 * TaskPing 无人值守远程控制设置助手
 */

const { exec, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

class RemoteControlSetup {
    constructor(sessionName = null) {
        this.sessionName = sessionName || 'claude-taskping';
        this.taskpingHome = this.findTaskPingHome();
    }
    
    findTaskPingHome() {
        // If TASKPING_HOME environment variable is set, use it
        if (process.env.TASKPING_HOME) {
            return process.env.TASKPING_HOME;
        }
        
        // If running from the TaskPing directory, use current directory
        if (fs.existsSync(path.join(__dirname, 'package.json'))) {
            const packagePath = path.join(__dirname, 'package.json');
            try {
                const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
                if (packageJson.name && packageJson.name.includes('taskping')) {
                    return __dirname;
                }
            } catch (e) {
                // Continue searching
            }
        }
        
        // Search for TaskPing in common locations
        const commonPaths = [
            path.join(process.env.HOME, 'dev', 'TaskPing'),
            path.join(process.env.HOME, 'Projects', 'TaskPing'),
            path.join(process.env.HOME, 'taskping'),
            __dirname // fallback to current script directory
        ];
        
        for (const searchPath of commonPaths) {
            if (fs.existsSync(searchPath) && fs.existsSync(path.join(searchPath, 'package.json'))) {
                try {
                    const packageJson = JSON.parse(fs.readFileSync(path.join(searchPath, 'package.json'), 'utf8'));
                    if (packageJson.name && packageJson.name.toLowerCase().includes('taskping')) {
                        return searchPath;
                    }
                } catch (e) {
                    // Continue searching
                }
            }
        }
        
        // If not found, use current directory as fallback
        return __dirname;
    }
    
    async setup() {
        console.log('🚀 TaskPing 无人值守远程控制设置\n');
        console.log('🎯 目标: 人在外面用手机→家中电脑Claude Code自动执行命令\n');
        
        try {
            // 1. 检查tmux
            await this.checkAndInstallTmux();
            
            // 2. 检查Claude CLI
            await this.checkClaudeCLI();
            
            // 3. 设置Claude tmux会话
            await this.setupClaudeSession();
            
            // 4. 会话创建完成
            console.log('\n4️⃣ 会话创建完成');
            
            // 5. 提供使用指南
            this.showUsageGuide();
            
        } catch (error) {
            console.error('❌ 设置过程中发生错误:', error.message);
        }
    }
    
    async checkAndInstallTmux() {
        console.log('1️⃣ 检查tmux安装状态...');
        
        return new Promise((resolve) => {
            exec('which tmux', (error, stdout) => {
                if (error) {
                    console.log('❌ tmux未安装');
                    console.log('📦 正在安装tmux...');
                    
                    exec('brew install tmux', (installError, installStdout, installStderr) => {
                        if (installError) {
                            console.log('❌ tmux安装失败，请手动安装:');
                            console.log('   brew install tmux');
                            console.log('   或从 https://github.com/tmux/tmux 下载');
                        } else {
                            console.log('✅ tmux安装成功');
                        }
                        resolve();
                    });
                } else {
                    console.log(`✅ tmux已安装: ${stdout.trim()}`);
                    resolve();
                }
            });
        });
    }
    
    async checkClaudeCLI() {
        console.log('\n2️⃣ 检查Claude CLI状态...');
        
        return new Promise((resolve) => {
            exec('which claude', (error, stdout) => {
                if (error) {
                    console.log('❌ Claude CLI未找到');
                    console.log('📦 请安装Claude CLI:');
                    console.log('   npm install -g @anthropic-ai/claude-code');
                } else {
                    console.log(`✅ Claude CLI已安装: ${stdout.trim()}`);
                    
                    // 检查版本
                    exec('claude --version', (versionError, versionStdout) => {
                        if (!versionError) {
                            console.log(`📋 版本: ${versionStdout.trim()}`);
                        }
                    });
                }
                resolve();
            });
        });
    }
    
    async setupClaudeSession() {
        console.log('\n3️⃣ 设置Claude tmux会话...');
        
        return new Promise((resolve) => {
            // 检查是否已有会话
            exec(`tmux has-session -t ${this.sessionName} 2>/dev/null`, (checkError) => {
                if (!checkError) {
                    console.log('⚠️ Claude tmux会话已存在');
                    console.log('🔄 是否重新创建会话？ (会杀死现有会话)');
                    
                    // 简单起见，直接重建
                    this.killAndCreateSession(resolve);
                } else {
                    this.createNewSession(resolve);
                }
            });
        });
    }
    
    killAndCreateSession(resolve) {
        exec(`tmux kill-session -t ${this.sessionName} 2>/dev/null`, () => {
            setTimeout(() => {
                this.createNewSession(resolve);
            }, 1000);
        });
    }
    
    createNewSession(resolve) {
        // 使用TaskPing主目录作为工作目录
        const workingDir = this.taskpingHome;
        const command = `tmux new-session -d -s ${this.sessionName} -c "${workingDir}" clauderun`;
        
        console.log(`🚀 创建Claude tmux会话: ${this.sessionName}`);
        console.log(`📁 工作目录: ${workingDir}`);
        console.log(`💡 使用便捷命令: clauderun (等同于 claude --dangerously-skip-permissions)`);
        
        exec(command, (error, stdout, stderr) => {
            if (error) {
                console.log(`❌ 会话创建失败: ${error.message}`);
                if (stderr) {
                    console.log(`错误详情: ${stderr}`);
                }
                // 如果clauderun失败，尝试使用完整路径命令
                console.log('🔄 尝试使用完整路径命令...');
                const fallbackCommand = `tmux new-session -d -s ${this.sessionName} -c "${workingDir}" /Users/jessytsui/.nvm/versions/node/v18.17.0/bin/claude --dangerously-skip-permissions`;
                exec(fallbackCommand, (fallbackError) => {
                    if (fallbackError) {
                        console.log(`❌ 完整路径命令也失败: ${fallbackError.message}`);
                    } else {
                        console.log('✅ Claude tmux会话创建成功 (使用完整路径)');
                        console.log(`📺 查看会话: tmux attach -t ${this.sessionName}`);
                        console.log(`🔚 退出会话: Ctrl+B, D (不会关闭Claude)`);
                    }
                    resolve();
                });
            } else {
                console.log('✅ Claude tmux会话创建成功');
                console.log(`📺 查看会话: tmux attach -t ${this.sessionName}`);
                console.log(`🔚 退出会话: Ctrl+B, D (不会关闭Claude)`);
                resolve();
            }
        });
    }
    
    async testRemoteInjection() {
        console.log('\n💡 会话已就绪，可以开始使用');
        console.log('📋 Claude Code正在等待您的指令');
        console.log('🔧 如需测试注入功能，请使用单独的测试脚本');
        return Promise.resolve();
    }
    
    showUsageGuide() {
        console.log('\n🎉 设置完成！无人值守远程控制已就绪\n');
        
        console.log('🎯 新功能: clauderun 便捷命令');
        console.log('   现在可以使用 clauderun 代替 claude --dangerously-skip-permissions');
        console.log('   更清晰的Claude Code启动方式\n');
        
        console.log('📋 使用流程:');
        console.log('1. 🏠 在家启动邮件监听: npm run relay:pty');
        console.log('2. 🚪 出门时Claude继续在tmux中运行');
        console.log('3. 📱 手机收到TaskPing邮件通知');
        console.log('4. 💬 手机回复邮件输入命令');
        console.log('5. 🤖 家中Claude自动接收并执行命令');
        console.log('6. 🔄 循环上述过程，完全无人值守\n');
        
        console.log('🔧 管理命令:');
        console.log(`   查看Claude会话: tmux attach -t ${this.sessionName}`);
        console.log(`   退出会话(不关闭): Ctrl+B, D`);
        console.log(`   杀死会话: tmux kill-session -t ${this.sessionName}`);
        console.log(`   查看所有会话: tmux list-sessions\n`);
        
        console.log('🎛️ 多会话支持:');
        console.log('   创建自定义会话: node claude-control.js --session my-project');
        console.log('   创建多个会话: node claude-control.js --session frontend');
        console.log('                    node claude-control.js --session backend');
        console.log('   邮件回复会自动路由到对应的会话\n');
        
        console.log('📱 邮件测试:');
        console.log('   Token将包含会话信息，自动路由到正确的tmux会话');
        console.log('   收件邮箱: jiaxicui446@gmail.com');
        console.log('   回复邮件输入: echo "远程控制测试"\n');
        
        console.log('🚨 重要提醒:');
        console.log('- Claude会话在tmux中持续运行，断网重连也不会中断');
        console.log('- 邮件监听服务需要保持运行状态');
        console.log('- 家中电脑需要保持开机和网络连接');
        console.log('- 手机可以从任何地方发送邮件命令');
        console.log('- 支持同时运行多个不同项目的Claude会话\n');
        
        console.log('✅ 现在你可以实现真正的无人值守远程控制了！🎯');
    }
    
    // 快速重建会话的方法
    async quickRestart() {
        console.log('🔄 快速重启Claude会话...');
        
        return new Promise((resolve) => {
            this.killAndCreateSession(() => {
                console.log('✅ Claude会话已重启');
                resolve();
            });
        });
    }
}

// 命令行参数处理
if (require.main === module) {
    const args = process.argv.slice(2);
    
    // 解析会话名称参数
    let sessionName = null;
    const sessionIndex = args.indexOf('--session');
    if (sessionIndex !== -1 && args[sessionIndex + 1]) {
        sessionName = args[sessionIndex + 1];
    }
    
    const setup = new RemoteControlSetup(sessionName);
    
    if (sessionName) {
        console.log(`🎛️ 使用自定义会话名称: ${sessionName}`);
    }
    
    if (args.includes('--restart')) {
        setup.quickRestart();
    } else {
        setup.setup();
    }
}

module.exports = RemoteControlSetup;