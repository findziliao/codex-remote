#!/usr/bin/env node

/**
 * tmux命令注入器 - 无人值守远程控制解决方案
 */

const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

class TmuxInjector {
    constructor(logger, sessionName = null) {
        this.log = logger || console;
        this.sessionName = sessionName || 'claude-taskping';
        this.logFile = path.join(__dirname, '../logs/tmux-injection.log');
        this.ensureLogDir();
    }
    
    ensureLogDir() {
        const logDir = path.dirname(this.logFile);
        if (!fs.existsSync(logDir)) {
            fs.mkdirSync(logDir, { recursive: true });
        }
    }
    
    // 检查tmux是否安装
    async checkTmuxAvailable() {
        return new Promise((resolve) => {
            exec('which tmux', (error) => {
                resolve(!error);
            });
        });
    }
    
    // 检查Claude tmux会话是否存在
    async checkClaudeSession() {
        return new Promise((resolve) => {
            exec(`tmux has-session -t ${this.sessionName} 2>/dev/null`, (error) => {
                resolve(!error);
            });
        });
    }
    
    // 创建Claude tmux会话
    async createClaudeSession() {
        return new Promise((resolve) => {
            // 使用clauderun命令启动Claude（不预填充任何命令）
            const command = `tmux new-session -d -s ${this.sessionName} -c "${process.cwd()}" clauderun`;
            
            this.log.info(`Creating tmux session with clauderun command: ${command}`);
            
            exec(command, (error, stdout, stderr) => {
                if (error) {
                    this.log.warn(`Failed to create tmux session with clauderun: ${error.message}`);
                    // 如果clauderun失败，尝试使用完整路径命令
                    this.log.info('Fallback to full path command...');
                    const fallbackCommand = `tmux new-session -d -s ${this.sessionName} -c "${process.cwd()}" /Users/jessytsui/.nvm/versions/node/v18.17.0/bin/claude --dangerously-skip-permissions`;
                    
                    exec(fallbackCommand, (fallbackError) => {
                        if (fallbackError) {
                            this.log.error(`Failed to create tmux session with fallback: ${fallbackError.message}`);
                            resolve({ success: false, error: fallbackError.message });
                        } else {
                            this.log.info('Tmux Claude session created successfully (full path)');
                            setTimeout(() => {
                                resolve({ success: true });
                            }, 3000);
                        }
                    });
                } else {
                    this.log.info('Tmux Claude session created successfully (clauderun)');
                    // 等待Claude初始化
                    setTimeout(() => {
                        resolve({ success: true });
                    }, 3000);
                }
            });
        });
    }
    
    // 向tmux会话注入命令（智能处理Claude确认）
    async injectCommand(command) {
        return new Promise(async (resolve) => {
            try {
                // 1. 清空输入框
                const clearCommand = `tmux send-keys -t ${this.sessionName} C-u`;
                
                // 2. 发送命令
                const escapedCommand = command.replace(/'/g, "'\"'\"'");
                const sendCommand = `tmux send-keys -t ${this.sessionName} '${escapedCommand}'`;
                
                // 3. 发送回车
                const enterCommand = `tmux send-keys -t ${this.sessionName} C-m`;
                
                this.log.info(`Injecting command via tmux: ${command}`);
                this.log.info(`Step 1 - Clear: ${clearCommand}`);
                this.log.info(`Step 2 - Send: ${sendCommand}`);
                this.log.info(`Step 3 - Enter: ${enterCommand}`);
                
                // 执行三个步骤
                exec(clearCommand, (clearError) => {
                    if (clearError) {
                        this.log.error(`Failed to clear input: ${clearError.message}`);
                        resolve({ success: false, error: clearError.message });
                        return;
                    }
                    
                    // 短暂等待
                    setTimeout(() => {
                        exec(sendCommand, (sendError) => {
                            if (sendError) {
                                this.log.error(`Failed to send command: ${sendError.message}`);
                                resolve({ success: false, error: sendError.message });
                                return;
                            }
                            
                            // 短暂等待
                            setTimeout(() => {
                                exec(enterCommand, async (enterError) => {
                                    if (enterError) {
                                        this.log.error(`Failed to send enter: ${enterError.message}`);
                                        resolve({ success: false, error: enterError.message });
                                        return;
                                    }
                                    
                                    this.log.info('Command sent successfully in 3 steps');
                                    
                                    // 短暂等待命令发送
                                    await new Promise(r => setTimeout(r, 1000));
                                    
                                    // 检查命令是否已在Claude中显示
                                    const capture = await this.getCaptureOutput();
                                    if (capture.success) {
                                        this.log.info(`Claude state after injection: ${capture.output.slice(-200).replace(/\n/g, ' ')}`);
                                    }
                                    
                                    // 等待并检查是否需要确认
                                    await this.handleConfirmations();
                                    
                                    // 记录注入日志
                                    this.logInjection(command);
                                    
                                    resolve({ success: true });
                                });
                            }, 200);
                        });
                    }, 200);
                });
                
            } catch (error) {
                resolve({ success: false, error: error.message });
            }
        });
    }
    
    // 自动处理Claude的确认对话框
    async handleConfirmations() {
        const maxAttempts = 8;
        let attempts = 0;
        
        while (attempts < maxAttempts) {
            attempts++;
            
            // 等待Claude处理
            await new Promise(resolve => setTimeout(resolve, 1500));
            
            // 获取当前屏幕内容
            const capture = await this.getCaptureOutput();
            
            if (!capture.success) {
                break;
            }
            
            const output = capture.output;
            this.log.info(`Confirmation check ${attempts}: ${output.slice(-200).replace(/\n/g, ' ')}`);
            
            // 检查是否有多选项确认对话框（优先处理）
            if (output.includes('Do you want to proceed?') && 
                (output.includes('1. Yes') || output.includes('2. Yes, and don\'t ask again'))) {
                
                this.log.info(`Detected multi-option confirmation, selecting option 2 (attempt ${attempts})`);
                
                // 选择"2. Yes, and don't ask again"以避免未来的确认对话框
                await new Promise((resolve) => {
                    exec(`tmux send-keys -t ${this.sessionName} '2'`, (error) => {
                        if (error) {
                            this.log.warn('Failed to send option 2');
                        } else {
                            this.log.info('Auto-confirmation sent (option 2)');
                            // 发送Enter键
                            setTimeout(() => {
                                exec(`tmux send-keys -t ${this.sessionName} 'Enter'`, (enterError) => {
                                    if (enterError) {
                                        this.log.warn('Failed to send Enter after option 2');
                                    } else {
                                        this.log.info('Enter sent after option 2 - no future dialogs');
                                    }
                                    resolve();
                                });
                            }, 300);
                        }
                    });
                });
                
                // 等待确认生效
                await new Promise(resolve => setTimeout(resolve, 2000));
                continue;
            }
            
            // 检查是否有单选项确认
            if (output.includes('❯ 1. Yes') || output.includes('▷ 1. Yes')) {
                this.log.info(`Detected single option confirmation, selecting option 1 (attempt ${attempts})`);
                
                await new Promise((resolve) => {
                    exec(`tmux send-keys -t ${this.sessionName} '1'`, (error) => {
                        if (error) {
                            this.log.warn('Failed to send option 1');
                        } else {
                            this.log.info('Auto-confirmation sent (option 1)');
                            // 发送Enter键
                            setTimeout(() => {
                                exec(`tmux send-keys -t ${this.sessionName} 'Enter'`, (enterError) => {
                                    if (enterError) {
                                        this.log.warn('Failed to send Enter after option 1');
                                    } else {
                                        this.log.info('Enter sent after option 1');
                                    }
                                    resolve();
                                });
                            }, 300);
                        }
                    });
                });
                
                continue;
            }
            
            // 检查是否有简单的Y/N确认
            if (output.includes('(y/n)') || output.includes('[Y/n]') || output.includes('[y/N]')) {
                this.log.info(`Detected y/n prompt, sending 'y' (attempt ${attempts})`);
                
                await new Promise((resolve) => {
                    exec(`tmux send-keys -t ${this.sessionName} 'y'`, (error) => {
                        if (error) {
                            this.log.warn('Failed to send y');
                        } else {
                            this.log.info('Auto-confirmation sent (y)');
                            // 发送Enter键
                            setTimeout(() => {
                                exec(`tmux send-keys -t ${this.sessionName} 'Enter'`, (enterError) => {
                                    if (enterError) {
                                        this.log.warn('Failed to send Enter after y');
                                    } else {
                                        this.log.info('Enter sent after y');
                                    }
                                    resolve();
                                });
                            }, 300);
                        }
                    });
                });
                
                continue;
            }
            
            // 检查是否有按Enter继续的提示
            if (output.includes('Press Enter to continue') || 
                output.includes('Enter to confirm') || 
                output.includes('Press Enter')) {
                this.log.info(`Detected Enter prompt, sending Enter (attempt ${attempts})`);
                
                await new Promise((resolve) => {
                    exec(`tmux send-keys -t ${this.sessionName} 'Enter'`, (error) => {
                        if (error) {
                            this.log.warn('Failed to send Enter');
                        } else {
                            this.log.info('Auto-Enter sent');
                        }
                        resolve();
                    });
                });
                
                continue;
            }
            
            // 检查是否命令正在执行
            if (output.includes('Clauding…') || 
                output.includes('Waiting…') || 
                output.includes('Processing…') ||
                output.includes('Working…')) {
                this.log.info('Command appears to be executing, waiting...');
                continue;
            }
            
            // 检查是否有新的空输入框（表示完成）
            if ((output.includes('│ >') || output.includes('> ')) && 
                !output.includes('Do you want to proceed?') &&
                !output.includes('1. Yes') &&
                !output.includes('(y/n)')) {
                this.log.info('New input prompt detected, command likely completed');
                break;
            }
            
            // 检查是否有错误信息
            if (output.includes('Error:') || output.includes('error:') || output.includes('failed')) {
                this.log.warn('Detected error in output, stopping confirmation attempts');
                break;
            }
            
            // 如果什么都没检测到，等待更长时间再检查
            if (attempts < maxAttempts) {
                this.log.info('No confirmation prompts detected, waiting longer...');
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
        }
        
        this.log.info(`Confirmation handling completed after ${attempts} attempts`);
        
        // 最终状态检查
        const finalCapture = await this.getCaptureOutput();
        if (finalCapture.success) {
            this.log.info(`Final state: ${finalCapture.output.slice(-100).replace(/\n/g, ' ')}`);
        }
    }
    
    // 获取tmux会话输出
    async getCaptureOutput() {
        return new Promise((resolve) => {
            const command = `tmux capture-pane -t ${this.sessionName} -p`;
            
            exec(command, (error, stdout, stderr) => {
                if (error) {
                    resolve({ success: false, error: error.message });
                } else {
                    resolve({ success: true, output: stdout });
                }
            });
        });
    }
    
    // 重启Claude会话
    async restartClaudeSession() {
        return new Promise(async (resolve) => {
            this.log.info('Restarting Claude tmux session...');
            
            // 杀死现有会话
            exec(`tmux kill-session -t ${this.sessionName} 2>/dev/null`, async () => {
                // 等待一下
                await new Promise(r => setTimeout(r, 1000));
                
                // 创建新会话
                const result = await this.createClaudeSession();
                resolve(result);
            });
        });
    }
    
    // 完整的命令注入流程
    async injectCommandFull(token, command) {
        try {
            this.log.info(`🎯 开始tmux命令注入 (Token: ${token})`);
            
            // 1. 检查tmux是否可用
            const tmuxAvailable = await this.checkTmuxAvailable();
            if (!tmuxAvailable) {
                return { success: false, error: 'tmux_not_installed', message: '需要安装tmux: brew install tmux' };
            }
            
            // 2. 检查Claude会话是否存在
            const sessionExists = await this.checkClaudeSession();
            
            if (!sessionExists) {
                this.log.warn('Claude tmux session not found, creating new session...');
                const createResult = await this.createClaudeSession();
                
                if (!createResult.success) {
                    return { success: false, error: 'session_creation_failed', message: createResult.error };
                }
            }
            
            // 3. 注入命令
            const injectResult = await this.injectCommand(command);
            
            if (injectResult.success) {
                // 4. 发送成功通知
                await this.sendSuccessNotification(command);
                
                return { 
                    success: true, 
                    message: '命令已成功注入到Claude tmux会话',
                    session: this.sessionName 
                };
            } else {
                return { 
                    success: false, 
                    error: 'injection_failed', 
                    message: injectResult.error 
                };
            }
            
        } catch (error) {
            this.log.error(`Tmux injection error: ${error.message}`);
            return { success: false, error: 'unexpected_error', message: error.message };
        }
    }
    
    // 发送成功通知
    async sendSuccessNotification(command) {
        const shortCommand = command.length > 30 ? command.substring(0, 30) + '...' : command;
        const notificationScript = `
            display notification "🎉 命令已自动注入到Claude！无需手动操作" with title "TaskPing 远程控制成功" subtitle "${shortCommand.replace(/"/g, '\\"')}" sound name "Glass"
        `;
        
        exec(`osascript -e '${notificationScript}'`, (error) => {
            if (error) {
                this.log.warn('Failed to send success notification');
            } else {
                this.log.info('Success notification sent');
            }
        });
    }
    
    // 记录注入日志
    logInjection(command) {
        const logEntry = {
            timestamp: new Date().toISOString(),
            command: command,
            session: this.sessionName,
            pid: process.pid
        };
        
        const logLine = JSON.stringify(logEntry) + '\n';
        
        try {
            fs.appendFileSync(this.logFile, logLine);
        } catch (error) {
            this.log.warn(`Failed to write injection log: ${error.message}`);
        }
    }
    
    // 获取会话状态信息
    async getSessionInfo() {
        return new Promise((resolve) => {
            const command = `tmux list-sessions | grep ${this.sessionName}`;
            
            exec(command, (error, stdout, stderr) => {
                if (error) {
                    resolve({ exists: false });
                } else {
                    const sessionInfo = stdout.trim();
                    resolve({ 
                        exists: true, 
                        info: sessionInfo,
                        name: this.sessionName
                    });
                }
            });
        });
    }
}

module.exports = TmuxInjector;