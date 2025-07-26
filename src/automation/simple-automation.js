/**
 * 简单自动化方案
 * 使用更简单的方式来处理邮件回复命令
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const Logger = require('../core/logger');

class SimpleAutomation {
    constructor() {
        this.logger = new Logger('SimpleAutomation');
        this.commandFile = path.join(__dirname, '../data/current_command.txt');
        this.notificationSent = false;
    }

    /**
     * 发送命令 - 使用多种简单方式
     * @param {string} command - 要发送的命令
     * @param {string} sessionId - 会话ID
     * @returns {Promise<boolean>} - 是否成功
     */
    async sendCommand(command, sessionId = '') {
        try {
            // 方法1: 保存到文件，用户可以手动复制
            await this._saveCommandToFile(command, sessionId);
            
            // 方法2: 复制到剪贴板
            const clipboardSuccess = await this._copyToClipboard(command);
            
            // 方法3: 发送富通知（包含命令内容）
            const notificationSuccess = await this._sendRichNotification(command, sessionId);
            
            // 方法4: 尝试简单的自动化（不依赖复杂权限）
            const autoSuccess = await this._trySimpleAutomation(command);
            
            if (clipboardSuccess || notificationSuccess || autoSuccess) {
                this.logger.info('Command sent successfully via simple automation');
                return true;
            } else {
                this.logger.warn('All simple automation methods failed');
                return false;
            }
            
        } catch (error) {
            this.logger.error('Simple automation failed:', error.message);
            return false;
        }
    }

    /**
     * 保存命令到文件
     */
    async _saveCommandToFile(command, sessionId) {
        try {
            const timestamp = new Date().toLocaleString('zh-CN');
            const content = `# TaskPing 邮件回复命令
# 时间: ${timestamp}
# 会话ID: ${sessionId}
# 
# 请复制下面的命令到 Claude Code 中执行:

${command}

# ===============================
# 执行完成后可以删除此文件
`;
            
            fs.writeFileSync(this.commandFile, content, 'utf8');
            this.logger.info(`Command saved to file: ${this.commandFile}`);
            return true;
        } catch (error) {
            this.logger.error('Failed to save command to file:', error.message);
            return false;
        }
    }

    /**
     * 复制到剪贴板
     */
    async _copyToClipboard(command) {
        try {
            if (process.platform === 'darwin') {
                const pbcopy = spawn('pbcopy');
                pbcopy.stdin.write(command);
                pbcopy.stdin.end();
                
                return new Promise((resolve) => {
                    pbcopy.on('close', (code) => {
                        if (code === 0) {
                            this.logger.info('Command copied to clipboard');
                            resolve(true);
                        } else {
                            resolve(false);
                        }
                    });
                    
                    pbcopy.on('error', () => resolve(false));
                });
            }
            return false;
        } catch (error) {
            this.logger.error('Failed to copy to clipboard:', error.message);
            return false;
        }
    }

    /**
     * 发送富通知
     */
    async _sendRichNotification(command, sessionId) {
        try {
            if (process.platform === 'darwin') {
                const shortCommand = command.length > 50 ? command.substring(0, 50) + '...' : command;
                
                // 创建详细的通知
                const script = `
                    set commandText to "${command.replace(/"/g, '\\"').replace(/\n/g, '\\n')}"
                    
                    display notification "命令已复制到剪贴板，请粘贴到 Claude Code 中" with title "TaskPing - 新邮件命令" subtitle "${shortCommand.replace(/"/g, '\\"')}" sound name "default"
                    
                    -- 同时显示对话框（可选，用户可以取消）
                    try
                        set userChoice to display dialog "收到新的邮件命令:" & return & return & commandText buttons {"打开命令文件", "取消", "已粘贴"} default button "已粘贴" with title "TaskPing 邮件中继" giving up after 10
                        
                        if button returned of userChoice is "打开命令文件" then
                            do shell script "open -t '${this.commandFile}'"
                        end if
                    end try
                `;
                
                const osascript = spawn('osascript', ['-e', script]);
                
                return new Promise((resolve) => {
                    osascript.on('close', (code) => {
                        if (code === 0) {
                            this.logger.info('Rich notification sent successfully');
                            resolve(true);
                        } else {
                            this.logger.warn('Rich notification failed, trying simple notification');
                            this._sendSimpleNotification(command);
                            resolve(true); // 即使失败也算成功，因为有备选方案
                        }
                    });
                    
                    osascript.on('error', () => {
                        this._sendSimpleNotification(command);
                        resolve(true);
                    });
                });
            }
            return false;
        } catch (error) {
            this.logger.error('Failed to send rich notification:', error.message);
            return false;
        }
    }

    /**
     * 发送简单通知
     */
    async _sendSimpleNotification(command) {
        try {
            const shortCommand = command.length > 50 ? command.substring(0, 50) + '...' : command;
            const script = `display notification "命令: ${shortCommand.replace(/"/g, '\\"')}" with title "TaskPing - 邮件命令" sound name "default"`;
            
            const osascript = spawn('osascript', ['-e', script]);
            osascript.on('close', () => {
                this.logger.info('Simple notification sent');
            });
        } catch (error) {
            this.logger.warn('Simple notification also failed:', error.message);
        }
    }

    /**
     * 尝试简单自动化（无需复杂权限）
     */
    async _trySimpleAutomation(command) {
        try {
            if (process.platform === 'darwin') {
                // 只尝试最基本的操作，不强制要求权限
                const script = `
                    try
                        tell application "System Events"
                            -- 尝试获取前台应用
                            set frontApp to name of first application process whose frontmost is true
                            
                            -- 如果是终端或代码编辑器，尝试粘贴
                            if frontApp contains "Terminal" or frontApp contains "iTerm" or frontApp contains "Code" or frontApp contains "Claude" then
                                keystroke "v" using command down
                                delay 0.2
                                keystroke return
                                return "success"
                            else
                                return "not_target_app"
                            end if
                        end tell
                    on error
                        return "no_permission"
                    end try
                `;
                
                const osascript = spawn('osascript', ['-e', script]);
                let output = '';
                
                osascript.stdout.on('data', (data) => {
                    output += data.toString().trim();
                });
                
                return new Promise((resolve) => {
                    osascript.on('close', (code) => {
                        if (code === 0 && output === 'success') {
                            this.logger.info('Simple automation succeeded');
                            resolve(true);
                        } else {
                            this.logger.debug(`Simple automation result: ${output}`);
                            resolve(false);
                        }
                    });
                    
                    osascript.on('error', () => resolve(false));
                });
            }
            return false;
        } catch (error) {
            this.logger.error('Simple automation error:', error.message);
            return false;
        }
    }

    /**
     * 打开命令文件
     */
    async openCommandFile() {
        try {
            if (fs.existsSync(this.commandFile)) {
                if (process.platform === 'darwin') {
                    spawn('open', ['-t', this.commandFile]);
                    this.logger.info('Command file opened');
                    return true;
                }
            }
            return false;
        } catch (error) {
            this.logger.error('Failed to open command file:', error.message);
            return false;
        }
    }

    /**
     * 清理命令文件
     */
    cleanupCommandFile() {
        try {
            if (fs.existsSync(this.commandFile)) {
                fs.unlinkSync(this.commandFile);
                this.logger.info('Command file cleaned up');
            }
        } catch (error) {
            this.logger.error('Failed to cleanup command file:', error.message);
        }
    }

    /**
     * 获取状态
     */
    getStatus() {
        return {
            supported: process.platform === 'darwin',
            commandFile: this.commandFile,
            commandFileExists: fs.existsSync(this.commandFile),
            lastCommand: this._getLastCommand()
        };
    }

    _getLastCommand() {
        try {
            if (fs.existsSync(this.commandFile)) {
                const content = fs.readFileSync(this.commandFile, 'utf8');
                const lines = content.split('\n');
                const commandLines = lines.filter(line => 
                    !line.startsWith('#') && 
                    !line.startsWith('=') && 
                    line.trim().length > 0
                );
                return commandLines.join('\n').trim();
            }
        } catch (error) {
            this.logger.error('Failed to get last command:', error.message);
        }
        return null;
    }
}

module.exports = SimpleAutomation;