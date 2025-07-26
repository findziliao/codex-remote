/**
 * Clipboard Automation
 * 通过剪贴板和键盘自动化来发送命令到Claude Code
 */

const { spawn } = require('child_process');
const Logger = require('../core/logger');

class ClipboardAutomation {
    constructor() {
        this.logger = new Logger('ClipboardAutomation');
    }

    /**
     * 发送命令到Claude Code（通过剪贴板）
     * @param {string} command - 要发送的命令
     * @returns {Promise<boolean>} - 是否成功
     */
    async sendCommand(command) {
        try {
            // 第一步：将命令复制到剪贴板
            await this._copyToClipboard(command);
            
            // 第二步：激活Claude Code并粘贴
            const success = await this._activateAndPaste();
            
            if (success) {
                this.logger.info('Command sent successfully via clipboard automation');
                return true;
            } else {
                this.logger.warn('Failed to activate Claude Code, trying fallback');
                // 尝试通用方案
                return await this._sendToActiveWindow(command);
            }
            
        } catch (error) {
            this.logger.error('Clipboard automation failed:', error.message);
            return false;
        }
    }

    /**
     * 将文本复制到剪贴板
     */
    async _copyToClipboard(text) {
        return new Promise((resolve, reject) => {
            if (process.platform === 'darwin') {
                // macOS
                const pbcopy = spawn('pbcopy');
                pbcopy.stdin.write(text);
                pbcopy.stdin.end();
                
                pbcopy.on('close', (code) => {
                    if (code === 0) {
                        this.logger.debug('Text copied to clipboard');
                        resolve();
                    } else {
                        reject(new Error('Failed to copy to clipboard'));
                    }
                });
                
                pbcopy.on('error', reject);
            } else if (process.platform === 'linux') {
                // Linux (需要 xclip 或 xsel)
                const xclip = spawn('xclip', ['-selection', 'clipboard']);
                xclip.stdin.write(text);
                xclip.stdin.end();
                
                xclip.on('close', (code) => {
                    if (code === 0) {
                        resolve();
                    } else {
                        // 尝试 xsel
                        const xsel = spawn('xsel', ['--clipboard', '--input']);
                        xsel.stdin.write(text);
                        xsel.stdin.end();
                        
                        xsel.on('close', (code) => {
                            if (code === 0) {
                                resolve();
                            } else {
                                reject(new Error('Failed to copy to clipboard (xclip/xsel not available)'));
                            }
                        });
                    }
                });
            } else {
                reject(new Error('Clipboard automation not supported on this platform'));
            }
        });
    }

    /**
     * 激活Claude Code并粘贴命令
     */
    async _activateAndPaste() {
        if (process.platform !== 'darwin') {
            return false;
        }

        return new Promise((resolve) => {
            const script = `
                tell application "System Events"
                    -- 尝试找到 Claude Code 相关的应用
                    set targetApps to {"Claude Code", "Terminal", "iTerm2", "iTerm", "Visual Studio Code", "Code", "Cursor"}
                    set foundApp to null
                    set appName to ""
                    
                    repeat with currentApp in targetApps
                        try
                            if application process currentApp exists then
                                set foundApp to application process currentApp
                                set appName to currentApp
                                exit repeat
                            end if
                        end try
                    end repeat
                    
                    if foundApp is not null then
                        -- 激活应用
                        set frontmost of foundApp to true
                        delay 0.5
                        
                        -- 尝试找到输入框并点击
                        try
                            -- 对于一些应用，可能需要点击特定的输入区域
                            if appName is "Claude Code" then
                                -- Claude Code 特定的处理
                                key code 125 -- 向下箭头，确保光标在输入框
                                delay 0.2
                            end if
                            
                            -- 粘贴内容
                            keystroke "v" using command down
                            delay 0.3
                            
                            -- 发送命令（回车）
                            keystroke return
                            
                            return "success"
                        on error errorMessage
                            return "paste_failed: " & errorMessage
                        end try
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
                if (code === 0 && output === 'success') {
                    this.logger.debug('Successfully activated app and pasted command');
                    resolve(true);
                } else {
                    this.logger.warn('AppleScript execution result:', { code, output, error });
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
     * 发送到当前活动窗口（通用方案）
     */
    async _sendToActiveWindow(command) {
        if (process.platform !== 'darwin') {
            return false;
        }

        return new Promise((resolve) => {
            const script = `
                tell application "System Events"
                    -- 获取当前活动应用
                    set activeApp to name of first application process whose frontmost is true
                    
                    -- 粘贴命令到当前活动窗口
                    keystroke "v" using command down
                    delay 0.3
                    keystroke return
                    
                    return "sent_to_" & activeApp
                end tell
            `;

            const osascript = spawn('osascript', ['-e', script]);
            let output = '';

            osascript.stdout.on('data', (data) => {
                output += data.toString().trim();
            });

            osascript.on('close', (code) => {
                if (code === 0) {
                    this.logger.debug('Command sent to active window:', output);
                    resolve(true);
                } else {
                    resolve(false);
                }
            });

            osascript.on('error', () => {
                resolve(false);
            });
        });
    }

    /**
     * 检查是否支持剪贴板自动化
     */
    isSupported() {
        return process.platform === 'darwin' || process.platform === 'linux';
    }

    /**
     * 获取当前剪贴板内容（用于测试）
     */
    async getClipboardContent() {
        if (process.platform === 'darwin') {
            return new Promise((resolve, reject) => {
                const pbpaste = spawn('pbpaste');
                let content = '';

                pbpaste.stdout.on('data', (data) => {
                    content += data.toString();
                });

                pbpaste.on('close', (code) => {
                    if (code === 0) {
                        resolve(content);
                    } else {
                        reject(new Error('Failed to read clipboard'));
                    }
                });
            });
        }
        return null;
    }
}

module.exports = ClipboardAutomation;