/**
 * TaskPing Installer
 * Handles installation and configuration of Claude Code hooks
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const readline = require('readline');
const Logger = require('../core/logger');

class Installer {
    constructor(configManager) {
        this.config = configManager;
        this.logger = new Logger('Installer');
        this.projectDir = path.join(__dirname, '../..');
        this.claudeConfigDir = this.getClaudeConfigDir();
        
        this.rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });
    }

    getClaudeConfigDir() {
        const homeDir = os.homedir();
        
        // Common Claude Code configuration paths
        const possiblePaths = [
            path.join(homeDir, '.claude'),
            path.join(homeDir, '.config', 'claude'),
            path.join(homeDir, 'Library', 'Application Support', 'Claude'),
            path.join(homeDir, 'AppData', 'Roaming', 'Claude')
        ];

        for (const configPath of possiblePaths) {
            if (fs.existsSync(configPath)) {
                return configPath;
            }
        }

        // Default fallback
        return path.join(homeDir, '.claude');
    }

    async question(prompt) {
        return new Promise((resolve) => {
            this.rl.question(prompt, resolve);
        });
    }

    async run(args = []) {
        console.log('=== TaskPing Claude Code 安装器 ===\n');

        // Check dependencies
        if (!this.checkDependencies()) {
            console.log('\n请先安装必要的依赖');
            this.rl.close();
            return;
        }

        console.log(`\nClaude Code 配置目录: ${this.claudeConfigDir}`);
        
        const proceed = await this.question('\n继续安装? (y/n): ');
        if (proceed.toLowerCase() !== 'y' && proceed.toLowerCase() !== 'yes') {
            console.log('安装已取消');
            this.rl.close();
            return;
        }

        // Install hooks
        const hookSuccess = await this.installHooks();
        if (!hookSuccess) {
            this.rl.close();
            return;
        }

        // Initialize configuration
        await this.initializeConfig();

        // Test installation
        const testChoice = await this.question('\n测试安装? (y/n): ');
        if (testChoice.toLowerCase() === 'y' || testChoice.toLowerCase() === 'yes') {
            await this.testInstallation();
        }

        this.displayUsage();
        this.rl.close();
    }

    checkDependencies() {
        console.log('检查依赖...');
        
        // Check Node.js
        try {
            const nodeVersion = process.version;
            console.log(`✅ Node.js ${nodeVersion}`);
        } catch (error) {
            console.log('❌ Node.js 未安装');
            return false;
        }

        // Check platform-specific notification tools
        const platform = process.platform;
        switch (platform) {
            case 'darwin':
                console.log('✅ macOS 通知支持');
                break;
            case 'linux':
                console.log('ℹ️  Linux 系统，请确保安装 libnotify-bin');
                break;
            case 'win32':
                console.log('✅ Windows 通知支持');
                break;
            default:
                console.log(`⚠️  平台 ${platform} 可能不完全支持`);
        }

        return true;
    }

    createHooksConfig() {
        const taskpingPath = path.join(this.projectDir, 'taskping.js');
        
        return {
            hooks: {
                Stop: [
                    {
                        matcher: "*",
                        hooks: [
                            {
                                type: "command",
                                command: `node "${taskpingPath}" notify --type completed`,
                                timeout: 5
                            }
                        ]
                    }
                ],
                SubagentStop: [
                    {
                        matcher: "*",
                        hooks: [
                            {
                                type: "command", 
                                command: `node "${taskpingPath}" notify --type waiting`,
                                timeout: 5
                            }
                        ]
                    }
                ]
            }
        };
    }

    async installHooks() {
        console.log('\n安装 Claude Code hooks...');
        
        // Create config directory if it doesn't exist
        if (!fs.existsSync(this.claudeConfigDir)) {
            fs.mkdirSync(this.claudeConfigDir, { recursive: true });
            console.log(`✅ 创建配置目录: ${this.claudeConfigDir}`);
        }

        const settingsPath = path.join(this.claudeConfigDir, 'settings.json');
        let settings = {};

        // Load existing settings
        if (fs.existsSync(settingsPath)) {
            try {
                const content = fs.readFileSync(settingsPath, 'utf8');
                settings = JSON.parse(content);
                console.log('✅ 读取现有 Claude Code 设置');
            } catch (error) {
                console.log('⚠️  无法解析现有设置，将创建新的配置');
            }
        }

        // Create or update hooks configuration
        const hooksConfig = this.createHooksConfig();
        
        // Merge with existing settings
        settings.hooks = {
            ...settings.hooks,
            ...hooksConfig.hooks
        };

        // Save updated settings
        try {
            fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
            console.log(`✅ Claude Code hooks 已安装到: ${settingsPath}`);
            return true;
        } catch (error) {
            console.error(`❌ 安装失败: ${error.message}`);
            return false;
        }
    }

    async initializeConfig() {
        console.log('\n初始化配置...');
        
        // Load and save default configuration
        this.config.load();
        this.config.save();
        
        console.log('✅ 配置文件已初始化');
    }

    async testInstallation() {
        console.log('\n测试安装...');
        
        try {
            const TaskPingCLI = require('../../taskping');
            const cli = new TaskPingCLI();
            await cli.init();
            
            console.log('测试任务完成通知...');
            await cli.handleNotify(['--type', 'completed']);
            
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            console.log('测试等待输入通知...');
            await cli.handleNotify(['--type', 'waiting']);
            
            console.log('✅ 测试成功！');
            return true;
        } catch (error) {
            console.error(`❌ 测试失败: ${error.message}`);
            return false;
        }
    }

    displayUsage() {
        console.log('\n=== 安装完成 ===');
        console.log('');
        console.log('现在当您使用 Claude Code 时：');
        console.log('• 任务完成时会收到通知');
        console.log('• Claude 等待输入时会收到提醒');
        console.log('');
        console.log('常用命令：');
        console.log(`  node "${path.join(this.projectDir, 'taskping.js')}" config`);
        console.log(`  node "${path.join(this.projectDir, 'taskping.js')}" test`);
        console.log(`  node "${path.join(this.projectDir, 'taskping.js')}" status`);
        console.log('');
        console.log('如需卸载，请手动删除 Claude Code 设置中的 hooks 配置。');
    }
}

module.exports = Installer;