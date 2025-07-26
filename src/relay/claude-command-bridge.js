/**
 * Claude Command Bridge
 * 通过文件系统与Claude Code进行通信的桥接器
 */

const fs = require('fs');
const path = require('path');
const Logger = require('../core/logger');

class ClaudeCommandBridge {
    constructor() {
        this.logger = new Logger('CommandBridge');
        this.commandsDir = path.join(__dirname, '../data/commands');
        this.responseDir = path.join(__dirname, '../data/responses');
        
        this._ensureDirectories();
    }

    _ensureDirectories() {
        [this.commandsDir, this.responseDir].forEach(dir => {
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
        });
    }

    /**
     * 发送命令给Claude Code
     * @param {string} command - 要执行的命令
     * @param {string} sessionId - 会话ID
     * @returns {Promise<boolean>} - 是否成功
     */
    async sendCommand(command, sessionId) {
        try {
            const timestamp = Date.now();
            const commandId = `${sessionId}_${timestamp}`;
            
            // 创建命令文件
            const commandFile = path.join(this.commandsDir, `${commandId}.json`);
            const commandData = {
                id: commandId,
                sessionId,
                command,
                timestamp: new Date().toISOString(),
                status: 'pending',
                source: 'email'
            };
            
            fs.writeFileSync(commandFile, JSON.stringify(commandData, null, 2));
            
            // 创建通知文件 (Claude Code可以监控这个文件变化)
            const notificationFile = path.join(this.commandsDir, '.new_command');
            fs.writeFileSync(notificationFile, commandId);
            
            this.logger.info(`Command sent via file bridge: ${commandId}`);
            
            // 尝试使用系统通知
            await this._sendSystemNotification(command, commandId);
            
            return true;
            
        } catch (error) {
            this.logger.error('Failed to send command via bridge:', error.message);
            return false;
        }
    }

    async _sendSystemNotification(command, commandId) {
        try {
            const title = 'TaskPing - 新邮件命令';
            const body = `命令: ${command.length > 50 ? command.substring(0, 50) + '...' : command}\n\n点击查看详情或在Claude Code中输入命令`;
            
            if (process.platform === 'darwin') {
                // macOS 通知
                const script = `
                    display notification "${body.replace(/"/g, '\\"')}" with title "${title}" sound name "default"
                `;
                const { spawn } = require('child_process');
                spawn('osascript', ['-e', script]);
            } else if (process.platform === 'linux') {
                // Linux 通知
                const { spawn } = require('child_process');
                spawn('notify-send', [title, body]);
            }
            
            this.logger.debug('System notification sent');
        } catch (error) {
            this.logger.warn('Failed to send system notification:', error.message);
        }
    }

    /**
     * 获取待处理的命令
     * @returns {Array} 命令列表
     */
    getPendingCommands() {
        try {
            const files = fs.readdirSync(this.commandsDir)
                .filter(file => file.endsWith('.json'))
                .sort();
            
            const commands = [];
            for (const file of files) {
                try {
                    const commandData = JSON.parse(
                        fs.readFileSync(path.join(this.commandsDir, file), 'utf8')
                    );
                    if (commandData.status === 'pending') {
                        commands.push(commandData);
                    }
                } catch (error) {
                    this.logger.warn(`Failed to parse command file ${file}:`, error.message);
                }
            }
            
            return commands;
        } catch (error) {
            this.logger.error('Failed to get pending commands:', error.message);
            return [];
        }
    }

    /**
     * 标记命令为已处理
     * @param {string} commandId - 命令ID
     * @param {string} status - 状态 (completed/failed)
     * @param {string} response - 响应内容
     */
    markCommandProcessed(commandId, status = 'completed', response = '') {
        try {
            const commandFile = path.join(this.commandsDir, `${commandId}.json`);
            
            if (fs.existsSync(commandFile)) {
                const commandData = JSON.parse(fs.readFileSync(commandFile, 'utf8'));
                commandData.status = status;
                commandData.processedAt = new Date().toISOString();
                commandData.response = response;
                
                // 保存到响应目录
                const responseFile = path.join(this.responseDir, `${commandId}.json`);
                fs.writeFileSync(responseFile, JSON.stringify(commandData, null, 2));
                
                // 删除原命令文件
                fs.unlinkSync(commandFile);
                
                this.logger.info(`Command ${commandId} marked as ${status}`);
            }
        } catch (error) {
            this.logger.error(`Failed to mark command ${commandId} as processed:`, error.message);
        }
    }

    /**
     * 清理旧的命令和响应文件
     * @param {number} maxAge - 最大保留时间(小时)
     */
    cleanup(maxAge = 24) {
        const cutoff = Date.now() - (maxAge * 60 * 60 * 1000);
        let cleaned = 0;
        
        [this.commandsDir, this.responseDir].forEach(dir => {
            try {
                const files = fs.readdirSync(dir).filter(file => file.endsWith('.json'));
                
                for (const file of files) {
                    const filePath = path.join(dir, file);
                    const stats = fs.statSync(filePath);
                    
                    if (stats.mtime.getTime() < cutoff) {
                        fs.unlinkSync(filePath);
                        cleaned++;
                    }
                }
            } catch (error) {
                this.logger.warn(`Failed to cleanup directory ${dir}:`, error.message);
            }
        });
        
        if (cleaned > 0) {
            this.logger.info(`Cleaned up ${cleaned} old command files`);
        }
    }

    /**
     * 获取桥接器状态
     */
    getStatus() {
        try {
            const pendingCommands = this.getPendingCommands();
            const responseFiles = fs.readdirSync(this.responseDir).filter(f => f.endsWith('.json'));
            
            return {
                pendingCommands: pendingCommands.length,
                processedCommands: responseFiles.length,
                commandsDir: this.commandsDir,
                responseDir: this.responseDir,
                recentCommands: pendingCommands.slice(-5).map(cmd => ({
                    id: cmd.id,
                    command: cmd.command.substring(0, 50) + '...',
                    timestamp: cmd.timestamp
                }))
            };
        } catch (error) {
            this.logger.error('Failed to get bridge status:', error.message);
            return {
                pendingCommands: 0,
                processedCommands: 0,
                error: error.message
            };
        }
    }
}

module.exports = ClaudeCommandBridge;