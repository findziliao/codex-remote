#!/usr/bin/env node

/**
 * TaskPing - Claude Code Smart Notification System
 * Main entry point for the CLI tool
 */

const Logger = require('./src/core/logger');
const Notifier = require('./src/core/notifier');
const ConfigManager = require('./src/core/config');

class TaskPingCLI {
    constructor() {
        this.logger = new Logger('CLI');
        this.config = new ConfigManager();
        this.notifier = new Notifier(this.config);
    }

    async init() {
        // Load configuration
        this.config.load();
        
        // Initialize channels
        await this.notifier.initializeChannels();
    }

    async run() {
        const args = process.argv.slice(2);
        const command = args[0];

        try {
            await this.init();

            switch (command) {
                case 'notify':
                    await this.handleNotify(args.slice(1));
                    break;
                case 'test':
                    await this.handleTest(args.slice(1));
                    break;
                case 'status':
                    await this.handleStatus(args.slice(1));
                    break;
                case 'config':
                    await this.handleConfig(args.slice(1));
                    break;
                case 'install':
                    await this.handleInstall(args.slice(1));
                    break;
                case 'relay':
                    await this.handleRelay(args.slice(1));
                    break;
                case 'edit-config':
                    await this.handleEditConfig(args.slice(1));
                    break;
                case 'setup-email':
                    await this.handleSetupEmail(args.slice(1));
                    break;
                case 'daemon':
                    await this.handleDaemon(args.slice(1));
                    break;
                case 'commands':
                    await this.handleCommands(args.slice(1));
                    break;
                case 'test-paste':
                    await this.handleTestPaste(args.slice(1));
                    break;
                case 'test-simple':
                    await this.handleTestSimple(args.slice(1));
                    break;
                case 'test-claude':
                    await this.handleTestClaude(args.slice(1));
                    break;
                case 'setup-permissions':
                    await this.handleSetupPermissions(args.slice(1));
                    break;
                case 'diagnose':
                    await this.handleDiagnose(args.slice(1));
                    break;
                case '--help':
                case '-h':
                case undefined:
                    this.showHelp();
                    break;
                default:
                    console.error(`Unknown command: ${command}`);
                    this.showHelp();
                    process.exit(1);
            }
        } catch (error) {
            this.logger.error('CLI error:', error.message);
            process.exit(1);
        }
    }

    async handleNotify(args) {
        const typeIndex = args.findIndex(arg => arg === '--type');
        
        if (typeIndex === -1 || typeIndex + 1 >= args.length) {
            console.error('Usage: taskping notify --type <completed|waiting>');
            process.exit(1);
        }

        const type = args[typeIndex + 1];
        
        if (!['completed', 'waiting'].includes(type)) {
            console.error('Invalid type. Use: completed or waiting');
            process.exit(1);
        }

        const result = await this.notifier.notify(type);
        
        if (result.success) {
            this.logger.info(`${type} notification sent successfully`);
            process.exit(0);
        } else {
            this.logger.error(`Failed to send ${type} notification`);
            process.exit(1);
        }
    }

    async handleTest(args) {
        console.log('Testing notification channels...\n');
        
        const results = await this.notifier.test();
        
        for (const [channel, result] of Object.entries(results)) {
            const status = result.success ? '✅ PASS' : '❌ FAIL';
            console.log(`${channel}: ${status}`);
            if (result.error) {
                console.log(`   Error: ${result.error}`);
            }
        }
        
        const passCount = Object.values(results).filter(r => r.success).length;
        const totalCount = Object.keys(results).length;
        
        console.log(`\nTest completed: ${passCount}/${totalCount} channels passed`);
        
        if (passCount === 0) {
            process.exit(1);
        }
    }

    async handleStatus(args) {
        const status = this.notifier.getStatus();
        
        console.log('TaskPing Status\n');
        console.log('Configuration:');
        console.log(`  Enabled: ${status.enabled ? 'Yes' : 'No'}`);
        console.log(`  Language: ${status.config.language}`);
        console.log(`  Sounds: ${status.config.sound.completed} / ${status.config.sound.waiting}`);
        
        console.log('\nChannels:');
        
        // 显示所有可用的渠道，包括未启用的
        const allChannels = this.config._channels || {};
        const activeChannels = status.channels || {};
        
        // 合并所有渠道信息
        const channelNames = new Set([
            ...Object.keys(allChannels),
            ...Object.keys(activeChannels)
        ]);
        
        for (const name of channelNames) {
            const channelConfig = allChannels[name] || {};
            const channelStatus = activeChannels[name];
            
            let enabled, configured, relay;
            
            if (channelStatus) {
                // 活跃渠道，使用实际状态
                enabled = channelStatus.enabled ? '✅' : '❌';
                configured = channelStatus.configured ? '✅' : '❌';
                relay = channelStatus.supportsRelay ? '✅' : '❌';
            } else {
                // 非活跃渠道，使用配置状态
                enabled = channelConfig.enabled ? '✅' : '❌';
                configured = this._isChannelConfigured(name, channelConfig) ? '✅' : '❌';
                relay = this._supportsRelay(name) ? '✅' : '❌';
            }
            
            console.log(`  ${name}:`);
            console.log(`    Enabled: ${enabled}`);
            console.log(`    Configured: ${configured}`);
            console.log(`    Supports Relay: ${relay}`);
        }
    }

    _isChannelConfigured(name, config) {
        switch (name) {
            case 'desktop':
                return true; // 桌面通知不需要特殊配置
            case 'email':
                return config.config && 
                       config.config.smtp && 
                       config.config.smtp.host && 
                       config.config.smtp.auth && 
                       config.config.smtp.auth.user &&
                       config.config.to;
            default:
                return false;
        }
    }

    _supportsRelay(name) {
        switch (name) {
            case 'email':
                return true;
            case 'desktop':
            default:
                return false;
        }
    }

    async handleConfig(args) {
        // Launch the configuration tool
        const ConfigTool = require('./src/tools/config-manager');
        const configTool = new ConfigTool(this.config);
        await configTool.run(args);
    }

    async handleInstall(args) {
        // Launch the installer
        const Installer = require('./src/tools/installer');
        const installer = new Installer(this.config);
        await installer.run(args);
    }

    async handleRelay(args) {
        const subcommand = args[0];
        
        switch (subcommand) {
            case 'start':
                await this.startRelay(args.slice(1));
                break;
            case 'stop':
                await this.stopRelay(args.slice(1));
                break;
            case 'status':
                await this.relayStatus(args.slice(1));
                break;
            case 'cleanup':
                await this.cleanupRelay(args.slice(1));
                break;
            default:
                console.error('Usage: taskping relay <start|stop|status|cleanup>');
                console.log('');
                console.log('Commands:');
                console.log('  start    启动邮件命令中继服务');
                console.log('  stop     停止邮件命令中继服务');
                console.log('  status   查看中继服务状态');
                console.log('  cleanup  清理已完成的命令历史');
                process.exit(1);
        }
    }

    async startRelay(args) {
        try {
            const CommandRelayService = require('./src/relay/command-relay');
            const emailConfig = this.config.getChannel('email');
            
            if (!emailConfig || !emailConfig.enabled) {
                console.error('❌ 邮件渠道未配置或未启用');
                console.log('请先运行: taskping config');
                process.exit(1);
            }

            console.log('🚀 启动邮件命令中继服务...');
            
            const relayService = new CommandRelayService(emailConfig.config);
            
            // 监听事件
            relayService.on('started', () => {
                console.log('✅ 命令中继服务已启动');
                console.log('📧 正在监听邮件回复...');
                console.log('💡 现在您可以通过回复邮件来远程执行Claude Code命令');
                console.log('');
                console.log('按 Ctrl+C 停止服务');
            });

            relayService.on('commandQueued', (command) => {
                console.log(`📨 收到新命令: ${command.command.substring(0, 50)}...`);
            });

            relayService.on('commandExecuted', (command) => {
                console.log(`✅ 命令执行成功: ${command.id}`);
            });

            relayService.on('commandFailed', (command, error) => {
                console.log(`❌ 命令执行失败: ${command.id} - ${error.message}`);
            });

            // 处理优雅关闭
            process.on('SIGINT', async () => {
                console.log('\n🛑 正在停止命令中继服务...');
                await relayService.stop();
                console.log('✅ 服务已停止');
                process.exit(0);
            });

            // 启动服务
            await relayService.start();
            
            // 保持进程运行
            process.stdin.resume();
            
        } catch (error) {
            console.error('❌ 启动中继服务失败:', error.message);
            process.exit(1);
        }
    }

    async stopRelay(args) {
        console.log('💡 命令中继服务通常通过 Ctrl+C 停止');
        console.log('如果服务仍在运行，请找到对应的进程并手动终止');
    }

    async relayStatus(args) {
        try {
            const fs = require('fs');
            const path = require('path');
            const stateFile = path.join(__dirname, 'src/data/relay-state.json');
            
            console.log('📊 命令中继服务状态\n');
            
            // 检查邮件配置
            const emailConfig = this.config.getChannel('email');
            if (!emailConfig || !emailConfig.enabled) {
                console.log('❌ 邮件渠道未配置');
                return;
            }
            
            console.log('✅ 邮件配置已启用');
            console.log(`📧 SMTP: ${emailConfig.config.smtp.host}:${emailConfig.config.smtp.port}`);
            console.log(`📥 IMAP: ${emailConfig.config.imap.host}:${emailConfig.config.imap.port}`);
            console.log(`📬 收件人: ${emailConfig.config.to}`);
            
            // 检查中继状态
            if (fs.existsSync(stateFile)) {
                const state = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
                console.log(`\n📋 命令队列: ${state.commandQueue?.length || 0} 个命令`);
                
                if (state.commandQueue && state.commandQueue.length > 0) {
                    console.log('\n最近的命令:');
                    state.commandQueue.slice(-5).forEach(cmd => {
                        const status = cmd.status === 'completed' ? '✅' : 
                                     cmd.status === 'failed' ? '❌' : 
                                     cmd.status === 'executing' ? '⏳' : '⏸️';
                        console.log(`  ${status} ${cmd.id}: ${cmd.command.substring(0, 50)}...`);
                    });
                }
            } else {
                console.log('\n📋 无命令历史记录');
            }
            
        } catch (error) {
            console.error('❌ 获取状态失败:', error.message);
        }
    }

    async cleanupRelay(args) {
        try {
            const fs = require('fs');
            const path = require('path');
            const stateFile = path.join(__dirname, 'src/data/relay-state.json');
            
            if (!fs.existsSync(stateFile)) {
                console.log('📋 无需清理，没有找到命令历史');
                return;
            }
            
            const state = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
            const beforeCount = state.commandQueue?.length || 0;
            
            // 清理已完成的命令 (保留24小时内的)
            const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
            state.commandQueue = (state.commandQueue || []).filter(cmd => 
                cmd.status !== 'completed' || 
                new Date(cmd.completedAt || cmd.queuedAt) > cutoff
            );
            
            const afterCount = state.commandQueue.length;
            const removedCount = beforeCount - afterCount;
            
            fs.writeFileSync(stateFile, JSON.stringify(state, null, 2));
            
            console.log(`🧹 清理完成: 移除了 ${removedCount} 个已完成的命令`);
            console.log(`📋 剩余 ${afterCount} 个命令在队列中`);
            
        } catch (error) {
            console.error('❌ 清理失败:', error.message);
        }
    }

    async handleEditConfig(args) {
        const { spawn } = require('child_process');
        const path = require('path');
        
        const configType = args[0];
        
        if (!configType) {
            console.log('可用的配置文件:');
            console.log('  user      - 用户个人配置 (config/user.json)');
            console.log('  channels  - 通知渠道配置 (config/channels.json)');
            console.log('  default   - 默认配置模板 (config/default.json)');
            console.log('');
            console.log('使用方法: taskping edit-config <配置类型>');
            console.log('例如: taskping edit-config channels');
            return;
        }

        const configFiles = {
            'user': path.join(__dirname, 'config/user.json'),
            'channels': path.join(__dirname, 'config/channels.json'),
            'default': path.join(__dirname, 'config/default.json')
        };

        const configFile = configFiles[configType];
        if (!configFile) {
            console.error('❌ 无效的配置类型:', configType);
            console.log('可用类型: user, channels, default');
            return;
        }

        // 检查文件是否存在
        const fs = require('fs');
        if (!fs.existsSync(configFile)) {
            console.error('❌ 配置文件不存在:', configFile);
            return;
        }

        console.log(`📝 正在打开配置文件: ${configFile}`);
        console.log('💡 编辑完成后保存并关闭编辑器即可生效');
        console.log('');

        // 确定使用的编辑器
        const editor = process.env.EDITOR || process.env.VISUAL || this._getDefaultEditor();
        
        try {
            const editorProcess = spawn(editor, [configFile], {
                stdio: 'inherit'
            });

            editorProcess.on('close', (code) => {
                if (code === 0) {
                    console.log('✅ 配置文件已保存');
                    console.log('💡 运行 "taskping status" 查看更新后的配置');
                } else {
                    console.log('❌ 编辑器异常退出');
                }
            });

            editorProcess.on('error', (error) => {
                console.error('❌ 无法启动编辑器:', error.message);
                console.log('');
                console.log('💡 你可以手动编辑配置文件:');
                console.log(`   ${configFile}`);
            });

        } catch (error) {
            console.error('❌ 启动编辑器失败:', error.message);
            console.log('');
            console.log('💡 你可以手动编辑配置文件:');
            console.log(`   ${configFile}`);
        }
    }

    _getDefaultEditor() {
        // 根据平台确定默认编辑器
        if (process.platform === 'win32') {
            return 'notepad';
        } else if (process.platform === 'darwin') {
            return 'nano'; // 在macOS上使用nano，因为大多数用户都有
        } else {
            return 'nano'; // Linux默认使用nano
        }
    }

    async handleSetupEmail(args) {
        const readline = require('readline');
        const fs = require('fs');
        const path = require('path');

        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });

        const question = (prompt) => {
            return new Promise((resolve) => {
                rl.question(prompt, resolve);
            });
        };

        try {
            console.log('🚀 TaskPing 邮件快速配置向导\n');

            // 选择邮箱提供商
            console.log('请选择您的邮箱提供商:');
            console.log('1. Gmail');
            console.log('2. QQ邮箱');
            console.log('3. 163邮箱');
            console.log('4. Outlook/Hotmail');
            console.log('5. 自定义');

            const providerChoice = await question('\n请选择 (1-5): ');
            
            let smtpHost, smtpPort, imapHost, imapPort, secure;
            
            switch (providerChoice) {
                case '1':
                    smtpHost = 'smtp.gmail.com';
                    smtpPort = 587;
                    imapHost = 'imap.gmail.com';
                    imapPort = 993;
                    secure = false;
                    console.log('\n📧 Gmail 配置');
                    console.log('💡 需要先启用两步验证并生成应用密码');
                    break;
                case '2':
                    smtpHost = 'smtp.qq.com';
                    smtpPort = 587;
                    imapHost = 'imap.qq.com';
                    imapPort = 993;
                    secure = false;
                    console.log('\n📧 QQ邮箱配置');
                    break;
                case '3':
                    smtpHost = 'smtp.163.com';
                    smtpPort = 587;
                    imapHost = 'imap.163.com';
                    imapPort = 993;
                    secure = false;
                    console.log('\n📧 163邮箱配置');
                    break;
                case '4':
                    smtpHost = 'smtp.live.com';
                    smtpPort = 587;
                    imapHost = 'imap-mail.outlook.com';
                    imapPort = 993;
                    secure = false;
                    console.log('\n📧 Outlook 配置');
                    break;
                case '5':
                    console.log('\n📧 自定义配置');
                    smtpHost = await question('SMTP 主机: ');
                    smtpPort = parseInt(await question('SMTP 端口 (默认587): ') || '587');
                    imapHost = await question('IMAP 主机: ');
                    imapPort = parseInt(await question('IMAP 端口 (默认993): ') || '993');
                    const secureInput = await question('使用 SSL/TLS? (y/n): ');
                    secure = secureInput.toLowerCase() === 'y';
                    break;
                default:
                    console.log('❌ 无效选择');
                    rl.close();
                    return;
            }

            // 获取邮箱账户信息
            console.log('\n📝 请输入邮箱账户信息:');
            const email = await question('邮箱地址: ');
            const password = await question('密码/应用密码: ');
            
            // 构建配置
            const emailConfig = {
                type: "email",
                enabled: true,
                config: {
                    smtp: {
                        host: smtpHost,
                        port: smtpPort,
                        secure: secure,
                        auth: {
                            user: email,
                            pass: password
                        }
                    },
                    imap: {
                        host: imapHost,
                        port: imapPort,
                        secure: true,
                        auth: {
                            user: email,
                            pass: password
                        }
                    },
                    from: `TaskPing <${email}>`,
                    to: email,
                    template: {
                        checkInterval: 30
                    }
                }
            };

            // 读取现有配置
            const channelsFile = path.join(__dirname, 'config/channels.json');
            let channels = {};
            
            if (fs.existsSync(channelsFile)) {
                channels = JSON.parse(fs.readFileSync(channelsFile, 'utf8'));
            }

            // 更新邮件配置
            channels.email = emailConfig;

            // 保存配置
            fs.writeFileSync(channelsFile, JSON.stringify(channels, null, 2));

            console.log('\n✅ 邮件配置已保存！');
            console.log('\n🧪 现在可以测试邮件功能:');
            console.log('  taskping test');
            console.log('\n🚀 启动命令中继服务:');
            console.log('  taskping relay start');

            // 询问是否立即测试
            const testNow = await question('\n立即测试邮件发送? (y/n): ');
            if (testNow.toLowerCase() === 'y') {
                rl.close();
                
                // 重新加载配置并测试
                await this.init();
                await this.handleTest([]);
            } else {
                rl.close();
            }

        } catch (error) {
            console.error('❌ 配置失败:', error.message);
            rl.close();
        }
    }

    async handleDaemon(args) {
        const TaskPingDaemon = require('./src/daemon/taskping-daemon');
        const daemon = new TaskPingDaemon();
        
        const command = args[0];
        
        switch (command) {
            case 'start':
                await daemon.start();
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
                console.log('Usage: taskping daemon <start|stop|restart|status>');
                console.log('');
                console.log('Commands:');
                console.log('  start    启动后台守护进程');
                console.log('  stop     停止后台守护进程');
                console.log('  restart  重启后台守护进程');
                console.log('  status   查看守护进程状态');
                break;
        }
    }

    async handleCommands(args) {
        const ClaudeCommandBridge = require('./src/relay/claude-command-bridge');
        const bridge = new ClaudeCommandBridge();
        
        const command = args[0];
        
        switch (command) {
            case 'list':
                const pending = bridge.getPendingCommands();
                console.log(`📋 待处理命令: ${pending.length} 个\n`);
                if (pending.length > 0) {
                    pending.forEach((cmd, index) => {
                        console.log(`${index + 1}. ${cmd.id}`);
                        console.log(`   命令: ${cmd.command}`);
                        console.log(`   时间: ${cmd.timestamp}`);
                        console.log(`   会话: ${cmd.sessionId}`);
                        console.log('');
                    });
                }
                break;
                
            case 'status':
                const status = bridge.getStatus();
                console.log('📊 命令桥接器状态\n');
                console.log(`待处理命令: ${status.pendingCommands}`);
                console.log(`已处理命令: ${status.processedCommands}`);
                console.log(`命令目录: ${status.commandsDir}`);
                console.log(`响应目录: ${status.responseDir}`);
                if (status.recentCommands.length > 0) {
                    console.log('\n最近命令:');
                    status.recentCommands.forEach(cmd => {
                        console.log(`  • ${cmd.command} (${cmd.timestamp})`);
                    });
                }
                break;
                
            case 'cleanup':
                bridge.cleanup();
                console.log('🧹 已清理旧的命令文件');
                break;
                
            case 'clear':
                const pending2 = bridge.getPendingCommands();
                for (const cmd of pending2) {
                    bridge.markCommandProcessed(cmd.id, 'cancelled', 'Manually cancelled');
                }
                console.log(`🗑️ 已清除 ${pending2.length} 个待处理命令`);
                break;
                
            default:
                console.log('Usage: taskping commands <list|status|cleanup|clear>');
                console.log('');
                console.log('Commands:');
                console.log('  list     显示待处理的邮件命令');
                console.log('  status   显示命令桥接器状态');
                console.log('  cleanup  清理旧的命令文件');
                console.log('  clear    清除所有待处理命令');
                break;
        }
    }

    async handleTestPaste(args) {
        const ClipboardAutomation = require('./src/automation/clipboard-automation');
        const automation = new ClipboardAutomation();
        
        const testCommand = args.join(' ') || 'echo "测试邮件回复自动粘贴功能"';
        
        console.log('🧪 测试自动粘贴功能');
        console.log(`📝 测试命令: ${testCommand}`);
        console.log('\n⚠️  请确保 Claude Code 或 Terminal 窗口已打开并处于活动状态');
        console.log('⏳ 3 秒后自动发送命令...\n');
        
        // 倒计时
        for (let i = 3; i > 0; i--) {
            process.stdout.write(`${i}... `);
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        console.log('\n');
        
        try {
            const success = await automation.sendCommand(testCommand);
            if (success) {
                console.log('✅ 命令已自动粘贴！');
                console.log('💡 如果没有看到效果，请检查应用权限和窗口状态');
            } else {
                console.log('❌ 自动粘贴失败');
                console.log('💡 请确保给予自动化权限并打开目标应用');
            }
        } catch (error) {
            console.error('❌ 测试失败:', error.message);
        }
    }

    async handleSetupPermissions(args) {
        const PermissionSetup = require('./setup-permissions');
        const setup = new PermissionSetup();
        await setup.checkAndSetup();
    }

    async handleTestSimple(args) {
        const SimpleAutomation = require('./src/automation/simple-automation');
        const automation = new SimpleAutomation();
        
        const testCommand = args.join(' ') || 'echo "测试简单自动化功能"';
        
        console.log('🧪 测试简单自动化功能');
        console.log(`📝 测试命令: ${testCommand}`);
        console.log('\n这个测试会：');
        console.log('1. 📋 将命令复制到剪贴板');
        console.log('2. 📄 保存命令到文件');
        console.log('3. 🔔 发送通知（包含对话框）');
        console.log('4. 🤖 尝试自动粘贴（如果有权限）');
        console.log('\n⏳ 开始测试...\n');
        
        try {
            const success = await automation.sendCommand(testCommand, 'test-session');
            if (success) {
                console.log('✅ 测试成功！');
                console.log('\n📋 下一步操作：');
                console.log('1. 检查是否收到了通知');
                console.log('2. 检查命令是否已复制到剪贴板');
                console.log('3. 如果看到对话框，可以选择打开命令文件');
                console.log('4. 手动粘贴到 Claude Code 中（如果没有自动粘贴）');
                
                const status = automation.getStatus();
                console.log(`\n📄 命令文件: ${status.commandFile}`);
                if (status.commandFileExists) {
                    console.log('💡 可以运行 "open -t ' + status.commandFile + '" 查看命令文件');
                }
            } else {
                console.log('❌ 测试失败');
            }
        } catch (error) {
            console.error('❌ 测试过程中发生错误:', error.message);
        }
    }

    async handleTestClaude(args) {
        const ClaudeAutomation = require('./src/automation/claude-automation');
        const automation = new ClaudeAutomation();
        
        const testCommand = args.join(' ') || 'echo "这是一个自动化测试命令，来自邮件回复"';
        
        console.log('🤖 测试 Claude Code 专用自动化');
        console.log(`📝 测试命令: ${testCommand}`);
        console.log('\n⚠️  请确保：');
        console.log('   1. Claude Code 应用已打开');
        console.log('   2. 或者 Terminal/iTerm2 等终端应用已打开');
        console.log('   3. 已经给予必要的辅助功能权限');
        console.log('\n⏳ 5 秒后开始完全自动化测试...\n');
        
        // 倒计时
        for (let i = 5; i > 0; i--) {
            process.stdout.write(`${i}... `);
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        console.log('\n🚀 开始自动化...\n');
        
        try {
            // 检查权限
            const hasPermission = await automation.requestPermissions();
            if (!hasPermission) {
                console.log('⚠️ 权限检查失败，但仍会尝试执行...');
            }
            
            // 执行完全自动化
            const success = await automation.sendCommand(testCommand, 'test-session');
            
            if (success) {
                console.log('✅ 完全自动化测试成功！');
                console.log('💡 命令应该已经自动输入到 Claude Code 并开始执行');
                console.log('🔍 请检查 Claude Code 窗口是否收到了命令');
            } else {
                console.log('❌ 自动化测试失败');
                console.log('💡 可能的原因：');
                console.log('   • 没有找到 Claude Code 或终端应用');
                console.log('   • 权限不足');
                console.log('   • 应用没有响应');
                console.log('\n🔧 建议：');
                console.log('   1. 运行 "taskping setup-permissions" 检查权限');
                console.log('   2. 确保 Claude Code 在前台运行');
                console.log('   3. 尝试先手动在 Claude Code 中点击输入框');
            }
        } catch (error) {
            console.error('❌ 测试过程中发生错误:', error.message);
        }
    }

    async handleDiagnose(args) {
        const AutomationDiagnostic = require('./diagnose-automation');
        const diagnostic = new AutomationDiagnostic();
        await diagnostic.runDiagnostic();
    }

    showHelp() {
        console.log(`
TaskPing - Claude Code Smart Notification System

Usage: taskping <command> [options]

Commands:
  notify --type <type>    Send a notification (completed|waiting)
  test                    Test all notification channels
  status                  Show system status
  config                  Launch configuration manager
  setup-email             Quick email setup wizard
  edit-config <type>      Edit configuration files directly
  install                 Install and configure Claude Code hooks
  relay <subcommand>      Manage email command relay service
  daemon <subcommand>     Manage background daemon service
  commands <subcommand>   Manage email commands and bridge
  test-paste [command]    Test automatic paste functionality
  test-simple [command]   Test simple automation (recommended)
  test-claude [command]   Test Claude Code full automation
  setup-permissions       Setup macOS permissions for automation
  diagnose                Diagnose automation issues
  
Options:
  -h, --help             Show this help message

Relay Subcommands:
  relay start            Start email command relay service
  relay stop             Stop email command relay service  
  relay status           Show relay service status
  relay cleanup          Clean up completed command history

Daemon Subcommands:
  daemon start           Start background daemon service
  daemon stop            Stop background daemon service
  daemon restart         Restart background daemon service
  daemon status          Show daemon service status

Commands Subcommands:
  commands list          Show pending email commands
  commands status        Show command bridge status
  commands cleanup       Clean up old command files
  commands clear         Clear all pending commands

Examples:
  taskping notify --type completed
  taskping test
  taskping setup-email             # 快速配置邮件 (推荐)
  taskping edit-config channels    # 直接编辑配置文件
  taskping config                  # 交互式配置
  taskping install
  taskping daemon start              # 启动后台服务 (推荐)
  taskping daemon status             # 查看服务状态  
  taskping test-claude               # 测试完全自动化 (推荐)
  taskping commands list             # 查看待处理的邮件命令
  taskping relay start               # 前台运行 (需要保持窗口)

For more information, visit: https://github.com/TaskPing/TaskPing
        `);
    }
}

// Run CLI if this file is executed directly
if (require.main === module) {
    const cli = new TaskPingCLI();
    cli.run().catch(error => {
        console.error('Fatal error:', error.message);
        process.exit(1);
    });
}

module.exports = TaskPingCLI;