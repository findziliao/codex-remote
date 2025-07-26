/**
 * Command Relay Service
 * Manages email listening and command execution for Claude Code
 */

const EventEmitter = require('events');
const EmailListener = require('./email-listener');
const ClaudeCommandBridge = require('./claude-command-bridge');
const ClipboardAutomation = require('../automation/clipboard-automation');
const SimpleAutomation = require('../automation/simple-automation');
const ClaudeAutomation = require('../automation/claude-automation');
const Logger = require('../core/logger');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

class CommandRelayService extends EventEmitter {
    constructor(config) {
        super();
        this.logger = new Logger('CommandRelay');
        this.config = config;
        this.emailListener = null;
        this.commandBridge = new ClaudeCommandBridge();
        this.clipboardAutomation = new ClipboardAutomation();
        this.simpleAutomation = new SimpleAutomation();
        this.claudeAutomation = new ClaudeAutomation();
        this.isRunning = false;
        this.commandQueue = [];
        this.processingQueue = false;
        this.stateFile = path.join(__dirname, '../data/relay-state.json');
        
        this._ensureDirectories();
        this._loadState();
    }

    _ensureDirectories() {
        const dataDir = path.join(__dirname, '../data');
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
        }
    }

    _loadState() {
        try {
            if (fs.existsSync(this.stateFile)) {
                const state = JSON.parse(fs.readFileSync(this.stateFile, 'utf8'));
                this.commandQueue = state.commandQueue || [];
                this.logger.debug(`Loaded ${this.commandQueue.length} queued commands`);
            }
        } catch (error) {
            this.logger.warn('Failed to load relay state:', error.message);
            this.commandQueue = [];
        }
    }

    _saveState() {
        try {
            const state = {
                commandQueue: this.commandQueue,
                lastSaved: new Date().toISOString()
            };
            fs.writeFileSync(this.stateFile, JSON.stringify(state, null, 2));
        } catch (error) {
            this.logger.error('Failed to save relay state:', error.message);
        }
    }

    async start() {
        if (this.isRunning) {
            this.logger.warn('Command relay service already running');
            return;
        }

        try {
            // 验证邮件配置
            if (!this.config.imap) {
                throw new Error('IMAP configuration required for command relay');
            }

            // 启动邮件监听器
            this.emailListener = new EmailListener(this.config);
            
            // 监听命令事件
            this.emailListener.on('command', (commandData) => {
                this._queueCommand(commandData);
            });

            // 启动邮件监听
            await this.emailListener.start();
            
            // 启动命令处理
            this._startCommandProcessor();
            
            this.isRunning = true;
            this.logger.info('Command relay service started successfully');
            
            // 发送启动通知
            this.emit('started');
            
        } catch (error) {
            this.logger.error('Failed to start command relay service:', error.message);
            throw error;
        }
    }

    async stop() {
        if (!this.isRunning) {
            return;
        }

        this.isRunning = false;

        // 停止邮件监听器
        if (this.emailListener) {
            await this.emailListener.stop();
            this.emailListener = null;
        }

        // 保存状态
        this._saveState();

        this.logger.info('Command relay service stopped');
        this.emit('stopped');
    }

    _queueCommand(commandData) {
        const queueItem = {
            id: this._generateId(),
            ...commandData,
            queuedAt: new Date().toISOString(),
            status: 'queued',
            retries: 0,
            maxRetries: 3
        };

        this.commandQueue.push(queueItem);
        this._saveState();
        
        this.logger.info(`Command queued:`, {
            id: queueItem.id,
            sessionId: queueItem.sessionId,
            command: queueItem.command.substring(0, 50) + '...'
        });

        this.emit('commandQueued', queueItem);
    }

    _startCommandProcessor() {
        // 立即处理队列
        this._processCommandQueue();
        
        // 定期处理队列
        setInterval(() => {
            if (this.isRunning) {
                this._processCommandQueue();
            }
        }, 5000); // 每5秒检查一次
    }

    async _processCommandQueue() {
        if (this.processingQueue || this.commandQueue.length === 0) {
            return;
        }

        this.processingQueue = true;

        try {
            const pendingCommands = this.commandQueue.filter(cmd => cmd.status === 'queued');
            
            for (const command of pendingCommands) {
                try {
                    await this._executeCommand(command);
                } catch (error) {
                    this.logger.error(`Failed to execute command ${command.id}:`, error.message);
                    this._handleCommandError(command, error);
                }
            }
        } finally {
            this.processingQueue = false;
        }
    }

    async _executeCommand(commandItem) {
        this.logger.info(`Executing command ${commandItem.id}:`, {
            sessionId: commandItem.sessionId,
            command: commandItem.command.substring(0, 100)
        });

        commandItem.status = 'executing';
        commandItem.executedAt = new Date().toISOString();

        try {
            // 检查Claude Code进程是否运行
            const claudeProcess = await this._findClaudeCodeProcess();
            
            if (!claudeProcess || !claudeProcess.available) {
                throw new Error('Claude Code not available');
            }

            // 执行命令 - 使用多种方式尝试
            const success = await this._sendCommandToClaudeCode(commandItem.command, claudeProcess, commandItem.sessionId);
            
            if (success) {
                commandItem.status = 'completed';
                commandItem.completedAt = new Date().toISOString();
                
                // 更新会话命令计数
                if (this.emailListener) {
                    await this.emailListener.updateSessionCommandCount(commandItem.sessionId);
                }
                
                this.logger.info(`Command ${commandItem.id} executed successfully`);
                this.emit('commandExecuted', commandItem);
            } else {
                throw new Error('Failed to send command to Claude Code');
            }

        } catch (error) {
            commandItem.status = 'failed';
            commandItem.error = error.message;
            commandItem.failedAt = new Date().toISOString();
            
            this.logger.error(`Command ${commandItem.id} failed:`, error.message);
            this.emit('commandFailed', commandItem, error);
            
            throw error;
        } finally {
            this._saveState();
        }
    }

    async _findClaudeCodeProcess() {
        return new Promise((resolve) => {
            // 查找Claude Code相关进程
            const ps = spawn('ps', ['aux']);
            let output = '';

            ps.stdout.on('data', (data) => {
                output += data.toString();
            });

            ps.on('close', (code) => {
                const lines = output.split('\n');
                const claudeProcesses = lines.filter(line => 
                    (line.includes('claude') || 
                     line.includes('anthropic') ||
                     line.includes('Claude') ||
                     line.includes('node') && line.includes('claude')) && 
                    !line.includes('grep') &&
                    !line.includes('taskping') &&
                    !line.includes('ps aux')
                );

                if (claudeProcesses.length > 0) {
                    // 解析进程ID
                    const processLine = claudeProcesses[0];
                    const parts = processLine.trim().split(/\s+/);
                    const pid = parseInt(parts[1]);
                    
                    this.logger.debug('Found Claude Code process:', processLine);
                    resolve({
                        pid,
                        command: processLine
                    });
                } else {
                    // 如果没找到进程，假设 Claude Code 可以通过桌面自动化访问
                    this.logger.debug('No Claude Code process found, will try desktop automation');
                    resolve({ pid: null, available: true });
                }
            });

            ps.on('error', (error) => {
                this.logger.error('Error finding Claude Code process:', error.message);
                // 即使出错，也尝试桌面自动化
                resolve({ pid: null, available: true });
            });
        });
    }

    async _sendCommandToClaudeCode(command, claudeProcess, sessionId) {
        return new Promise(async (resolve) => {
            try {
                // 方法1: Claude Code 专用自动化 (最直接和可靠)
                this.logger.info('Attempting to send command via Claude automation...');
                const claudeSuccess = await this.claudeAutomation.sendCommand(command, sessionId);
                
                if (claudeSuccess) {
                    this.logger.info('Command sent and executed successfully via Claude automation');
                    resolve(true);
                    return;
                }
                
                // 方法2: 剪贴板自动化 (需要权限)
                if (this.clipboardAutomation.isSupported()) {
                    this.logger.info('Attempting to send command via clipboard automation...');
                    const clipboardSuccess = await this.clipboardAutomation.sendCommand(command);
                    
                    if (clipboardSuccess) {
                        this.logger.info('Command sent successfully via clipboard automation');
                        resolve(true);
                        return;
                    }
                    this.logger.warn('Clipboard automation failed, trying other methods...');
                }
                
                // 方法3: 简单自动化方案 (包含多种备选方案)
                this.logger.info('Attempting to send command via simple automation...');
                const simpleSuccess = await this.simpleAutomation.sendCommand(command, sessionId);
                
                if (simpleSuccess) {
                    this.logger.info('Command sent successfully via simple automation');
                    resolve(true);
                    return;
                }
                
                // 方法4: 使用命令桥接器 (文件方式)
                this.logger.info('Attempting to send command via bridge...');
                const bridgeSuccess = await this.commandBridge.sendCommand(command, sessionId);
                
                if (bridgeSuccess) {
                    this.logger.info('Command sent successfully via bridge');
                    resolve(true);
                    return;
                }
                
                // 方法5: 发送通知作为最后备选
                this.logger.info('Using notification as final fallback...');
                this._sendCommandViaNotification(command)
                    .then((success) => {
                        this.logger.info('Command notification sent as fallback');
                        resolve(success);
                    })
                    .catch(() => resolve(false));
                
            } catch (error) {
                this.logger.error('Error sending command to Claude Code:', error.message);
                resolve(false);
            }
        });
    }

    async _sendCommandViaMacOS(command) {
        return new Promise((resolve, reject) => {
            // 使用AppleScript自动化输入到活动窗口
            const escapedCommand = command.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/'/g, "\\'");
            const script = `
                tell application "System Events"
                    -- 获取当前活动应用
                    set activeApp to name of first application process whose frontmost is true
                    
                    -- 尝试找到 Claude Code、Terminal 或其他开发工具
                    set targetApps to {"Claude Code", "Terminal", "iTerm2", "iTerm", "Visual Studio Code", "Code"}
                    set foundApp to null
                    
                    repeat with appName in targetApps
                        try
                            if application process appName exists then
                                set foundApp to application process appName
                                exit repeat
                            end if
                        end try
                    end repeat
                    
                    if foundApp is not null then
                        -- 切换到目标应用
                        set frontmost of foundApp to true
                        delay 1
                        
                        -- 发送命令
                        keystroke "${escapedCommand}"
                        delay 0.3
                        keystroke return
                        
                        return "success"
                    else
                        -- 如果没找到特定应用，尝试当前活动窗口
                        keystroke "${escapedCommand}"
                        delay 0.3
                        keystroke return
                        return "fallback"
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
                if (code === 0 && (output === 'success' || output === 'fallback')) {
                    this.logger.debug(`Command sent via macOS automation (${output})`);
                    resolve(true);
                } else {
                    this.logger.warn('AppleScript failed:', { code, output, error });
                    reject(new Error(`macOS automation failed: ${error || output}`));
                }
            });

            osascript.on('error', (error) => {
                reject(error);
            });
        });
    }

    async _sendCommandViaNotification(command) {
        // 作为备选方案，发送桌面通知提醒用户
        return new Promise((resolve) => {
            try {
                const commandPreview = command.length > 50 ? command.substring(0, 50) + '...' : command;
                
                if (process.platform === 'darwin') {
                    // macOS 通知，包含更多信息
                    const script = `
                        display notification "命令: ${commandPreview.replace(/"/g, '\\"')}" with title "TaskPing - 邮件命令" subtitle "点击Terminal或Claude Code窗口，然后粘贴命令" sound name "default"
                    `;
                    const notification = spawn('osascript', ['-e', script]);
                    
                    notification.on('close', () => {
                        this.logger.info('macOS notification sent to user');
                        resolve(true);
                    });
                    
                    notification.on('error', () => {
                        resolve(false);
                    });
                } else {
                    // Linux 通知
                    const notification = spawn('notify-send', [
                        'TaskPing - 邮件命令',
                        `命令: ${commandPreview}`
                    ]);
                    
                    notification.on('close', () => {
                        this.logger.info('Linux notification sent to user');
                        resolve(true);
                    });

                    notification.on('error', () => {
                        resolve(false);
                    });
                }

            } catch (error) {
                this.logger.warn('Failed to send notification:', error.message);
                resolve(false);
            }
        });
    }

    _handleCommandError(commandItem, error) {
        commandItem.retries = (commandItem.retries || 0) + 1;
        
        if (commandItem.retries < commandItem.maxRetries) {
            // 重试
            commandItem.status = 'queued';
            commandItem.retryAt = new Date(Date.now() + (commandItem.retries * 60000)).toISOString(); // 延迟重试
            this.logger.info(`Command ${commandItem.id} will be retried (attempt ${commandItem.retries + 1})`);
        } else {
            // 达到最大重试次数
            commandItem.status = 'failed';
            this.logger.error(`Command ${commandItem.id} failed after ${commandItem.retries} retries`);
        }
        
        this._saveState();
    }

    _generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    getStatus() {
        return {
            isRunning: this.isRunning,
            queueLength: this.commandQueue.length,
            processing: this.processingQueue,
            emailListener: this.emailListener ? {
                connected: this.emailListener.isConnected,
                listening: this.emailListener.isListening
            } : null,
            recentCommands: this.commandQueue.slice(-5).map(cmd => ({
                id: cmd.id,
                status: cmd.status,
                queuedAt: cmd.queuedAt,
                command: cmd.command.substring(0, 50) + '...'
            }))
        };
    }

    // 手动清理已完成的命令
    cleanupCompletedCommands() {
        const beforeCount = this.commandQueue.length;
        this.commandQueue = this.commandQueue.filter(cmd => 
            cmd.status !== 'completed' || 
            new Date(cmd.completedAt) > new Date(Date.now() - 24 * 60 * 60 * 1000) // 保留24小时内的记录
        );
        
        const removedCount = beforeCount - this.commandQueue.length;
        if (removedCount > 0) {
            this.logger.info(`Cleaned up ${removedCount} completed commands`);
            this._saveState();
        }
    }
}

module.exports = CommandRelayService;