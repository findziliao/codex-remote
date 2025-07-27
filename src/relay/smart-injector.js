#!/usr/bin/env node

/**
 * 智能命令注入器 - 多种方式确保命令能够到达Claude Code
 */

const { exec, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

class SmartInjector {
    constructor(logger) {
        this.log = logger || console;
        this.tempDir = path.join(__dirname, '../temp');
        this.ensureTempDir();
    }
    
    ensureTempDir() {
        if (!fs.existsSync(this.tempDir)) {
            fs.mkdirSync(this.tempDir, { recursive: true });
        }
    }
    
    async injectCommand(token, command) {
        this.log.info(`🎯 智能注入命令: ${command.slice(0, 50)}...`);
        
        const methods = [
            this.tryAppleScriptInjection.bind(this),
            this.tryFileDropInjection.bind(this),
            this.tryClipboardWithPersistentNotification.bind(this),
            this.tryUrgentClipboard.bind(this)
        ];
        
        for (let i = 0; i < methods.length; i++) {
            const methodName = ['AppleScript自动注入', '文件拖拽注入', '持久通知注入', '紧急剪贴板'][i];
            
            try {
                this.log.info(`🔄 尝试方法 ${i + 1}: ${methodName}`);
                const result = await methods[i](token, command);
                
                if (result.success) {
                    this.log.info(`✅ ${methodName}成功: ${result.message}`);
                    return true;
                } else {
                    this.log.warn(`⚠️ ${methodName}失败: ${result.error}`);
                }
            } catch (error) {
                this.log.error(`❌ ${methodName}异常: ${error.message}`);
            }
        }
        
        this.log.error('🚨 所有注入方法都失败了');
        return false;
    }
    
    // 方法1: AppleScript自动注入
    async tryAppleScriptInjection(token, command) {
        return new Promise((resolve) => {
            // 先复制到剪贴板
            this.copyToClipboard(command).then(() => {
                const script = `
                tell application "System Events"
                    set targetApps to {"Claude", "Claude Code", "Terminal", "iTerm2", "iTerm"}
                    set targetApp to null
                    
                    repeat with appName in targetApps
                        try
                            if application process appName exists then
                                set targetApp to application process appName
                                exit repeat
                            end if
                        end try
                    end repeat
                    
                    if targetApp is not null then
                        set frontmost of targetApp to true
                        delay 0.5
                        keystroke "v" using command down
                        delay 0.3
                        keystroke return
                        return "success"
                    else
                        return "no_target"
                    end if
                end tell
                `;
                
                exec(`osascript -e '${script}'`, (error, stdout) => {
                    if (error) {
                        if (error.message.includes('1002') || error.message.includes('不允许')) {
                            resolve({ success: false, error: 'permission_denied' });
                        } else {
                            resolve({ success: false, error: error.message });
                        }
                    } else {
                        const result = stdout.trim();
                        if (result === 'success') {
                            resolve({ success: true, message: '自动粘贴成功' });
                        } else {
                            resolve({ success: false, error: result });
                        }
                    }
                });
            });
        });
    }
    
    // 方法2: 文件拖拽注入
    async tryFileDropInjection(token, command) {
        return new Promise((resolve) => {
            try {
                // 创建临时命令文件
                const fileName = `taskping-command-${token}.txt`;
                const filePath = path.join(this.tempDir, fileName);
                
                fs.writeFileSync(filePath, command);
                
                // 复制文件路径到剪贴板
                this.copyToClipboard(filePath).then(() => {
                    // 发送通知指导用户
                    const notificationScript = `
                        display notification "💡 命令文件已创建并复制路径到剪贴板！\\n1. 在Finder中按Cmd+G并粘贴路径\\n2. 将文件拖拽到Claude Code窗口" with title "TaskPing 文件注入" subtitle "拖拽文件: ${fileName}" sound name "Glass"
                    `;
                    
                    exec(`osascript -e '${notificationScript}'`, () => {
                        // 尝试自动打开Finder到目标目录
                        exec(`open "${this.tempDir}"`, () => {
                            resolve({ success: true, message: '文件已创建，通知已发送' });
                        });
                    });
                });
                
            } catch (error) {
                resolve({ success: false, error: error.message });
            }
        });
    }
    
    // 方法3: 持久通知注入
    async tryClipboardWithPersistentNotification(token, command) {
        return new Promise((resolve) => {
            this.copyToClipboard(command).then(() => {
                // 发送多次通知确保用户看到
                const notifications = [
                    { delay: 0, sound: 'Basso', message: '🚨 邮件命令已复制！请立即粘贴到Claude Code (Cmd+V)' },
                    { delay: 3000, sound: 'Ping', message: '⏰ 提醒：命令仍在剪贴板中，请粘贴执行' },
                    { delay: 8000, sound: 'Purr', message: '💡 最后提醒：在Claude Code中按Cmd+V粘贴命令' }
                ];
                
                let completedNotifications = 0;
                
                notifications.forEach((notif, index) => {
                    setTimeout(() => {
                        const script = `
                            display notification "${notif.message}" with title "TaskPing 持久提醒 ${index + 1}/3" subtitle "${command.slice(0, 30)}..." sound name "${notif.sound}"
                        `;
                        
                        exec(`osascript -e '${script}'`, () => {
                            completedNotifications++;
                            if (completedNotifications === notifications.length) {
                                resolve({ success: true, message: '持久通知序列完成' });
                            }
                        });
                    }, notif.delay);
                });
                
            }).catch((error) => {
                resolve({ success: false, error: error.message });
            });
        });
    }
    
    // 方法4: 紧急剪贴板（最后手段）
    async tryUrgentClipboard(token, command) {
        return new Promise((resolve) => {
            this.copyToClipboard(command).then(() => {
                // 创建桌面快捷文件
                const desktopPath = path.join(require('os').homedir(), 'Desktop');
                const shortcutContent = `#!/bin/bash
echo "TaskPing命令: ${command}"
echo "已复制到剪贴板，请在Claude Code中按Cmd+V粘贴"
echo "${command}" | pbcopy
echo "✅ 命令已刷新到剪贴板"
`;
                
                const shortcutPath = path.join(desktopPath, `TaskPing-${token}.command`);
                
                try {
                    fs.writeFileSync(shortcutPath, shortcutContent);
                    fs.chmodSync(shortcutPath, '755'); // 可执行权限
                    
                    const script = `
                        display notification "🆘 紧急模式：桌面已创建快捷文件 TaskPing-${token}.command\\n双击可重新复制命令到剪贴板" with title "TaskPing 紧急模式" subtitle "命令: ${command.slice(0, 20)}..." sound name "Sosumi"
                    `;
                    
                    exec(`osascript -e '${script}'`, () => {
                        resolve({ success: true, message: '紧急模式：桌面快捷文件已创建' });
                    });
                    
                } catch (error) {
                    resolve({ success: false, error: error.message });
                }
                
            }).catch((error) => {
                resolve({ success: false, error: error.message });
            });
        });
    }
    
    // 辅助方法：复制到剪贴板
    async copyToClipboard(text) {
        return new Promise((resolve, reject) => {
            const pbcopy = spawn('pbcopy');
            pbcopy.stdin.write(text);
            pbcopy.stdin.end();
            
            pbcopy.on('close', (code) => {
                if (code === 0) {
                    resolve();
                } else {
                    reject(new Error(`pbcopy failed with code ${code}`));
                }
            });
        });
    }
    
    // 清理临时文件
    cleanup() {
        try {
            if (fs.existsSync(this.tempDir)) {
                const files = fs.readdirSync(this.tempDir);
                const now = Date.now();
                
                files.forEach(file => {
                    const filePath = path.join(this.tempDir, file);
                    const stats = fs.statSync(filePath);
                    const age = now - stats.mtime.getTime();
                    
                    // 删除超过1小时的临时文件
                    if (age > 60 * 60 * 1000) {
                        fs.unlinkSync(filePath);
                    }
                });
            }
        } catch (error) {
            this.log.warn(`清理临时文件失败: ${error.message}`);
        }
    }
}

module.exports = SmartInjector;