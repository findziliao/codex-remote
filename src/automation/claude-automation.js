/**
 * Claude Code 专用自动化
 * 专门针对 Claude Code 的完全自动化解决方案
 */

const { spawn } = require('child_process');
const Logger = require('../core/logger');

class ClaudeAutomation {
    constructor() {
        this.logger = new Logger('ClaudeAutomation');
    }

    /**
     * 完全自动化发送命令到 Claude Code
     * @param {string} command - 要发送的命令
     * @param {string} sessionId - 会话ID
     * @returns {Promise<boolean>} - 是否成功
     */
    async sendCommand(command, sessionId = '') {
        try {
            this.logger.info(`Sending command to Claude Code: ${command.substring(0, 50)}...`);
            
            // 首先复制命令到剪贴板
            await this._copyToClipboard(command);
            
            // 然后执行完全自动化的粘贴和执行
            const success = await this._fullAutomation(command);
            
            if (success) {
                this.logger.info('Command sent and executed successfully');
                return true;
            } else {
                // 如果失败，尝试备选方案
                return await this._fallbackAutomation(command);
            }
            
        } catch (error) {
            this.logger.error('Claude automation failed:', error.message);
            return false;
        }
    }

    /**
     * 复制命令到剪贴板
     */
    async _copyToClipboard(command) {
        return new Promise((resolve, reject) => {
            const pbcopy = spawn('pbcopy');
            pbcopy.stdin.write(command);
            pbcopy.stdin.end();
            
            pbcopy.on('close', (code) => {
                if (code === 0) {
                    this.logger.debug('Command copied to clipboard');
                    resolve();
                } else {
                    reject(new Error('Failed to copy to clipboard'));
                }
            });
            
            pbcopy.on('error', reject);
        });
    }

    /**
     * 完全自动化方案
     */
    async _fullAutomation(command) {
        if (process.platform !== 'darwin') {
            return false;
        }

        return new Promise((resolve) => {
            const script = `
                tell application "System Events"
                    -- 定义可能的 Claude Code 应用名称
                    set claudeApps to {"Claude", "Claude Code", "Claude Desktop", "Anthropic Claude"}
                    set terminalApps to {"Terminal", "iTerm2", "iTerm", "Warp Terminal", "Warp"}
                    set codeApps to {"Visual Studio Code", "Code", "Cursor", "Sublime Text", "Atom"}
                    
                    -- 首先尝试找到 Claude Code
                    set targetApp to null
                    set appName to ""
                    
                    -- 检查 Claude 应用
                    repeat with app in claudeApps
                        try
                            if application process app exists then
                                set targetApp to application process app
                                set appName to app
                                exit repeat
                            end if
                        end try
                    end repeat
                    
                    -- 如果没找到 Claude，检查终端应用
                    if targetApp is null then
                        repeat with app in terminalApps
                            try
                                if application process app exists then
                                    set targetApp to application process app
                                    set appName to app
                                    exit repeat
                                end if
                            end try
                        end repeat
                    end if
                    
                    -- 如果还没找到，检查代码编辑器
                    if targetApp is null then
                        repeat with app in codeApps
                            try
                                if application process app exists then
                                    set targetApp to application process app
                                    set appName to app
                                    exit repeat
                                end if
                            end try
                        end repeat
                    end if
                    
                    if targetApp is not null then
                        -- 激活应用
                        set frontmost of targetApp to true
                        delay 0.8
                        
                        -- 等待应用完全激活
                        repeat while (frontmost of targetApp) is false
                            delay 0.1
                        end repeat
                        
                        -- 根据不同应用类型执行不同操作
                        if appName contains "Claude" then
                            -- Claude Code 特定操作
                            try
                                -- 尝试点击输入框
                                click (first text field of window 1)
                                delay 0.3
                            on error
                                -- 如果没有文本框，尝试按键导航
                                key code 125 -- 向下箭头
                                delay 0.2
                            end try
                            
                            -- 清空当前内容并粘贴新命令
                            keystroke "a" using command down
                            delay 0.2
                            keystroke "v" using command down
                            delay 0.5
                            
                            -- 执行命令
                            keystroke return
                            
                        else if appName contains "Terminal" or appName contains "iTerm" or appName contains "Warp" then
                            -- 终端应用操作
                            delay 0.5
                            keystroke "v" using command down
                            delay 0.3
                            keystroke return
                            
                        else
                            -- 其他应用（代码编辑器等）
                            delay 0.5
                            keystroke "v" using command down
                            delay 0.3
                            keystroke return
                        end if
                        
                        return "success:" & appName
                    else
                        return "no_app_found"
                    end if
                end tell
            `;

            const osascript = spawn('osascript', ['-e', script]);
            let output = '';
            let error = '';

            osascript.stdout.on('data', (data) => {
                output += data.toString().trim();
            });

            osascript.stderr.on('data', (data) => {
                error += data.toString();
            });

            osascript.on('close', (code) => {
                if (code === 0 && output.startsWith('success:')) {
                    const appName = output.split(':')[1];
                    this.logger.info(`Command successfully sent to ${appName}`);
                    resolve(true);
                } else {
                    this.logger.warn(`Full automation failed: ${output || error}`);
                    resolve(false);
                }
            });

            osascript.on('error', (err) => {
                this.logger.error('AppleScript execution error:', err.message);
                resolve(false);
            });
        });
    }

    /**
     * 备选自动化方案 - 更强制性的方法
     */
    async _fallbackAutomation(command) {
        if (process.platform !== 'darwin') {
            return false;
        }

        return new Promise((resolve) => {
            // 更强制性的方案，直接输入文本
            const escapedCommand = command
                .replace(/\\/g, '\\\\')
                .replace(/"/g, '\\"')
                .replace(/'/g, "\\'")
                .replace(/\n/g, '\\n');

            const script = `
                tell application "System Events"
                    -- 获取当前前台应用
                    set frontApp to first application process whose frontmost is true
                    set appName to name of frontApp
                    
                    -- 等待一下确保应用响应
                    delay 1
                    
                    -- 直接输入命令文本（不依赖剪贴板）
                    try
                        -- 先清空可能的现有内容
                        keystroke "a" using command down
                        delay 0.2
                        
                        -- 输入命令
                        keystroke "${escapedCommand}"
                        delay 0.5
                        
                        -- 执行
                        keystroke return
                        
                        return "typed_success:" & appName
                    on error errorMsg
                        -- 如果直接输入失败，尝试粘贴
                        try
                            keystroke "v" using command down
                            delay 0.3
                            keystroke return
                            return "paste_success:" & appName
                        on error
                            return "failed:" & errorMsg
                        end try
                    end try
                end tell
            `;

            const osascript = spawn('osascript', ['-e', script]);
            let output = '';

            osascript.stdout.on('data', (data) => {
                output += data.toString().trim();
            });

            osascript.on('close', (code) => {
                if (code === 0 && (output.includes('success'))) {
                    this.logger.info(`Fallback automation succeeded: ${output}`);
                    resolve(true);
                } else {
                    this.logger.error(`Fallback automation failed: ${output}`);
                    resolve(false);
                }
            });

            osascript.on('error', () => {
                resolve(false);
            });
        });
    }

    /**
     * 专门激活 Claude Code 应用
     */
    async activateClaudeCode() {
        if (process.platform !== 'darwin') {
            return false;
        }

        return new Promise((resolve) => {
            const script = `
                tell application "System Events"
                    set claudeApps to {"Claude", "Claude Code", "Claude Desktop", "Anthropic Claude"}
                    
                    repeat with appName in claudeApps
                        try
                            if application process appName exists then
                                set frontmost of application process appName to true
                                return "activated:" & appName
                            end if
                        end try
                    end repeat
                    
                    return "not_found"
                end tell
            `;

            const osascript = spawn('osascript', ['-e', script]);
            let output = '';

            osascript.stdout.on('data', (data) => {
                output += data.toString().trim();
            });

            osascript.on('close', (code) => {
                if (code === 0 && output.startsWith('activated:')) {
                    this.logger.info('Claude Code activated successfully');
                    resolve(true);
                } else {
                    this.logger.warn('Could not activate Claude Code');
                    resolve(false);
                }
            });

            osascript.on('error', () => resolve(false));
        });
    }

    /**
     * 检查系统权限并尝试请求
     */
    async requestPermissions() {
        if (process.platform !== 'darwin') {
            return false;
        }

        try {
            // 尝试一个简单的操作来触发权限请求
            const script = `
                tell application "System Events"
                    try
                        set frontApp to name of first application process whose frontmost is true
                        return "permission_granted"
                    on error
                        return "permission_denied"
                    end try
                end tell
            `;

            const result = await this._runAppleScript(script);
            return result === 'permission_granted';
        } catch (error) {
            this.logger.error('Permission check failed:', error.message);
            return false;
        }
    }

    async _runAppleScript(script) {
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

    /**
     * 获取状态信息
     */
    getStatus() {
        return {
            platform: process.platform,
            supported: process.platform === 'darwin',
            name: 'Claude Code Automation'
        };
    }
}

module.exports = ClaudeAutomation;