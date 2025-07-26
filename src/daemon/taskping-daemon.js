#!/usr/bin/env node

/**
 * TaskPing Daemon Service
 * 后台守护进程，用于监听邮件和处理远程命令
 */

const fs = require('fs');
const path = require('path');
const { spawn, exec } = require('child_process');
const Logger = require('../core/logger');
const ConfigManager = require('../core/config');

class TaskPingDaemon {
    constructor() {
        this.logger = new Logger('Daemon');
        this.config = new ConfigManager();
        this.pidFile = path.join(__dirname, '../data/taskping.pid');
        this.logFile = path.join(__dirname, '../data/daemon.log');
        this.relayService = null;
        this.isRunning = false;
        
        // 确保数据目录存在
        const dataDir = path.dirname(this.pidFile);
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
        }
    }

    async start(detached = true) {
        try {
            // 检查是否已经运行
            if (this.isAlreadyRunning()) {
                console.log('❌ TaskPing daemon 已经在运行中');
                console.log('💡 使用 "taskping daemon stop" 停止现有服务');
                process.exit(1);
            }

            if (detached) {
                // 以守护进程模式启动
                await this.startDetached();
            } else {
                // 直接在当前进程运行
                await this.startForeground();
            }
        } catch (error) {
            this.logger.error('Failed to start daemon:', error);
            throw error;
        }
    }

    async startDetached() {
        console.log('🚀 启动 TaskPing 守护进程...');

        // 创建子进程
        const child = spawn(process.execPath, [__filename, '--foreground'], {
            detached: true,
            stdio: ['ignore', 'pipe', 'pipe']
        });

        // 重定向日志
        const logStream = fs.createWriteStream(this.logFile, { flags: 'a' });
        child.stdout.pipe(logStream);
        child.stderr.pipe(logStream);

        // 保存 PID
        fs.writeFileSync(this.pidFile, child.pid.toString());

        // 分离子进程
        child.unref();

        console.log(`✅ TaskPing 守护进程已启动 (PID: ${child.pid})`);
        console.log(`📝 日志文件: ${this.logFile}`);
        console.log('💡 使用 "taskping daemon status" 查看状态');
        console.log('💡 使用 "taskping daemon stop" 停止服务');
    }

    async startForeground() {
        console.log('🚀 TaskPing 守护进程启动中...');
        
        this.isRunning = true;
        process.title = 'taskping-daemon';

        // 加载配置
        this.config.load();
        
        // 初始化邮件中继服务
        const emailConfig = this.config.getChannel('email');
        if (!emailConfig || !emailConfig.enabled) {
            this.logger.warn('Email channel not configured or disabled');
            return;
        }

        const CommandRelayService = require('../relay/command-relay');
        this.relayService = new CommandRelayService(emailConfig.config);

        // 设置事件监听
        this.setupEventHandlers();

        // 启动服务
        await this.relayService.start();
        this.logger.info('Email relay service started');

        // 保持进程运行
        this.keepAlive();
    }

    setupEventHandlers() {
        // 优雅关闭
        const gracefulShutdown = async (signal) => {
            this.logger.info(`Received ${signal}, shutting down gracefully...`);
            this.isRunning = false;
            
            if (this.relayService) {
                await this.relayService.stop();
            }
            
            // 删除 PID 文件
            if (fs.existsSync(this.pidFile)) {
                fs.unlinkSync(this.pidFile);
            }
            
            process.exit(0);
        };

        process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
        process.on('SIGINT', () => gracefulShutdown('SIGINT'));
        process.on('SIGHUP', () => {
            this.logger.info('Received SIGHUP, reloading configuration...');
            this.config.load();
        });

        // 中继服务事件
        if (this.relayService) {
            this.relayService.on('started', () => {
                this.logger.info('Command relay service started');
            });

            this.relayService.on('commandQueued', (command) => {
                this.logger.info(`Command queued: ${command.id}`);
            });

            this.relayService.on('commandExecuted', (command) => {
                this.logger.info(`Command executed: ${command.id}`);
            });

            this.relayService.on('commandFailed', (command, error) => {
                this.logger.error(`Command failed: ${command.id} - ${error.message}`);
            });
        }

        // 未捕获异常处理
        process.on('uncaughtException', (error) => {
            this.logger.error('Uncaught exception:', error);
            process.exit(1);
        });

        process.on('unhandledRejection', (reason, promise) => {
            this.logger.error('Unhandled rejection at:', promise, 'reason:', reason);
            process.exit(1);
        });
    }

    keepAlive() {
        // 保持进程运行
        const heartbeat = setInterval(() => {
            if (!this.isRunning) {
                clearInterval(heartbeat);
                return;
            }
            this.logger.debug('Heartbeat');
        }, 60000); // 每分钟输出一次心跳日志
    }

    async stop() {
        if (!this.isAlreadyRunning()) {
            console.log('❌ TaskPing daemon 没有运行');
            return;
        }

        try {
            const pid = this.getPid();
            console.log(`🛑 正在停止 TaskPing 守护进程 (PID: ${pid})...`);
            
            // 发送 SIGTERM 信号
            process.kill(pid, 'SIGTERM');
            
            // 等待进程结束
            await this.waitForStop(pid);
            
            console.log('✅ TaskPing 守护进程已停止');
        } catch (error) {
            console.error('❌ 停止守护进程失败:', error.message);
            
            // 强制删除 PID 文件
            if (fs.existsSync(this.pidFile)) {
                fs.unlinkSync(this.pidFile);
                console.log('🧹 已清理 PID 文件');
            }
        }
    }

    async restart() {
        console.log('🔄 重启 TaskPing 守护进程...');
        await this.stop();
        await new Promise(resolve => setTimeout(resolve, 2000)); // 等待2秒
        await this.start();
    }

    getStatus() {
        const isRunning = this.isAlreadyRunning();
        const pid = isRunning ? this.getPid() : null;
        
        return {
            running: isRunning,
            pid: pid,
            pidFile: this.pidFile,
            logFile: this.logFile,
            uptime: isRunning ? this.getUptime(pid) : null
        };
    }

    showStatus() {
        const status = this.getStatus();
        
        console.log('📊 TaskPing 守护进程状态\n');
        
        if (status.running) {
            console.log('✅ 状态: 运行中');
            console.log(`🆔 PID: ${status.pid}`);
            console.log(`⏱️ 运行时间: ${status.uptime || '未知'}`);
        } else {
            console.log('❌ 状态: 未运行');
        }
        
        console.log(`📝 日志文件: ${status.logFile}`);
        console.log(`📁 PID 文件: ${status.pidFile}`);
        
        // 显示最近的日志
        if (fs.existsSync(status.logFile)) {
            console.log('\n📋 最近日志:');
            try {
                const logs = fs.readFileSync(status.logFile, 'utf8');
                const lines = logs.split('\n').filter(line => line.trim()).slice(-5);
                lines.forEach(line => console.log(`  ${line}`));
            } catch (error) {
                console.log('  无法读取日志文件');
            }
        }
    }

    isAlreadyRunning() {
        if (!fs.existsSync(this.pidFile)) {
            return false;
        }

        try {
            const pid = parseInt(fs.readFileSync(this.pidFile, 'utf8'));
            // 检查进程是否仍在运行
            process.kill(pid, 0);
            return true;
        } catch (error) {
            // 进程不存在，删除过时的 PID 文件
            fs.unlinkSync(this.pidFile);
            return false;
        }
    }

    getPid() {
        if (!fs.existsSync(this.pidFile)) {
            return null;
        }
        return parseInt(fs.readFileSync(this.pidFile, 'utf8'));
    }

    async waitForStop(pid, timeout = 10000) {
        const startTime = Date.now();
        
        while (Date.now() - startTime < timeout) {
            try {
                process.kill(pid, 0);
                await new Promise(resolve => setTimeout(resolve, 100));
            } catch (error) {
                // 进程已停止
                return;
            }
        }
        
        // 超时，强制结束
        throw new Error('进程停止超时，可能需要手动结束');
    }

    getUptime(pid) {
        try {
            // 在 macOS 和 Linux 上获取进程启动时间
            const { execSync } = require('child_process');
            const result = execSync(`ps -o lstart= -p ${pid}`, { encoding: 'utf8' });
            const startTime = new Date(result.trim());
            const uptime = Date.now() - startTime.getTime();
            
            const hours = Math.floor(uptime / (1000 * 60 * 60));
            const minutes = Math.floor((uptime % (1000 * 60 * 60)) / (1000 * 60));
            
            return `${hours}h ${minutes}m`;
        } catch (error) {
            return '未知';
        }
    }
}

// 命令行接口
if (require.main === module) {
    const daemon = new TaskPingDaemon();
    const command = process.argv[2];

    (async () => {
        try {
            switch (command) {
                case 'start':
                    await daemon.start(true);
                    break;
                case '--foreground':
                    await daemon.start(false);
                    break;
                case 'stop':
                    await daemon.stop();
                    break;
                case 'restart':
                    await daemon.restart();
                    break;
                case 'status':
                    daemon.showStatus();
                    break;
                default:
                    console.log('Usage: taskping-daemon <start|stop|restart|status>');
                    process.exit(1);
            }
        } catch (error) {
            console.error('Error:', error.message);
            process.exit(1);
        }
    })();
}

module.exports = TaskPingDaemon;