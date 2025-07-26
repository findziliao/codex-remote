/**
 * TaskPing Configuration Manager
 * Interactive configuration tool for managing settings
 */

const readline = require('readline');
const Logger = require('../core/logger');

class ConfigurationManager {
    constructor(configManager) {
        this.config = configManager;
        this.logger = new Logger('ConfigManager');
        
        this.rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });

        // Enable keypress events
        if (process.stdin.isTTY) {
            process.stdin.setRawMode(true);
        }
        readline.emitKeypressEvents(process.stdin, this.rl);
    }

    async run(args = []) {
        if (args.includes('--help') || args.includes('-h')) {
            this.showHelp();
            this.rl.close();
            return;
        }

        if (args.includes('--show')) {
            this.displayCurrentConfig();
            this.rl.close();
            return;
        }

        await this.showMainMenu();
    }

    async question(prompt) {
        return new Promise((resolve) => {
            this.rl.question(prompt, resolve);
        });
    }

    displayCurrentConfig() {
        console.log('\n当前配置:');
        console.log('├─ 语言:', this.config.get('language'));
        console.log('├─ 启用状态:', this.config.get('enabled') ? '启用' : '禁用');
        console.log('├─ 超时时间:', this.config.get('timeout') + '秒');
        console.log('├─ 完成提示音:', this.config.get('sound.completed'));
        console.log('└─ 等待提示音:', this.config.get('sound.waiting'));
        console.log();
    }

    async showMainMenu() {
        while (true) {
            console.log('\n=== TaskPing 配置管理器 ===');
            this.displayCurrentConfig();
            console.log('选项:');
            console.log('1. 基础设置');
            console.log('2. 音效配置');
            console.log('3. 通知渠道');
            console.log('4. 命令中继');
            console.log('5. 测试通知');
            console.log('6. 保存并退出');
            console.log('7. 退出(不保存)');

            const choice = await this.question('\n请选择 (1-7): ');

            switch (choice) {
                case '1':
                    await this.configureBasicSettings();
                    break;
                case '2':
                    await this.configureSounds();
                    break;
                case '3':
                    await this.configureChannels();
                    break;
                case '4':
                    await this.configureRelay();
                    break;
                case '5':
                    await this.testNotifications();
                    break;
                case '6':
                    if (this.config.save()) {
                        console.log('✅ 配置已保存');
                        this.rl.close();
                        return;
                    } else {
                        console.log('❌ 保存失败');
                    }
                    break;
                case '7':
                    console.log('退出(未保存更改)');
                    this.rl.close();
                    return;
                default:
                    console.log('❌ 无效选择');
            }
        }
    }

    async configureBasicSettings() {
        console.log('\n=== 基础设置 ===');
        console.log('1. 配置语言');
        console.log('2. 切换启用状态');
        console.log('3. 配置超时时间');
        console.log('4. 自定义消息');
        console.log('0. 返回主菜单');

        const choice = await this.question('\n请选择 (0-4): ');

        switch (choice) {
            case '1':
                await this.configureLanguage();
                break;
            case '2':
                await this.toggleEnabled();
                break;
            case '3':
                await this.configureTimeout();
                break;
            case '4':
                await this.configureCustomMessages();
                break;
            case '0':
                return;
            default:
                console.log('❌ 无效选择');
        }
    }

    async configureLanguage() {
        const languages = ['zh-CN', 'en', 'ja'];
        console.log('\n可用语言:');
        languages.forEach((lang, index) => {
            console.log(`${index + 1}. ${lang}`);
        });

        const choice = await this.question(`选择语言 (1-${languages.length}): `);
        const index = parseInt(choice) - 1;

        if (index >= 0 && index < languages.length) {
            this.config.set('language', languages[index]);
            console.log(`✅ 语言已设置为: ${languages[index]}`);
        } else {
            console.log('❌ 无效选择');
        }
    }

    async toggleEnabled() {
        const current = this.config.get('enabled', true);
        this.config.set('enabled', !current);
        console.log(`✅ 通知已${!current ? '启用' : '禁用'}`);
    }

    async configureTimeout() {
        const timeout = await this.question('设置超时时间(秒): ');
        const timeoutNum = parseInt(timeout);
        if (timeoutNum > 0 && timeoutNum <= 30) {
            this.config.set('timeout', timeoutNum);
            console.log(`✅ 超时时间已设置为: ${timeoutNum}秒`);
        } else {
            console.log('❌ 无效的超时时间 (1-30秒)');
        }
    }

    async configureSounds() {
        // Load desktop channel to get available sounds
        const DesktopChannel = require('../channels/local/desktop');
        const desktop = new DesktopChannel();
        const soundCategories = desktop.getAvailableSounds();

        console.log('\n=== 音效配置 ===');
        
        // Configure completed sound
        console.log('\n--- 配置任务完成提示音 ---');
        const completedSound = await this.selectSoundFromCategories(soundCategories, '任务完成');
        if (completedSound) {
            this.config.set('sound.completed', completedSound);
            console.log(`✅ 任务完成提示音已设置为: ${completedSound}`);
        }

        // Configure waiting sound
        console.log('\n--- 配置等待输入提示音 ---');
        const waitingSound = await this.selectSoundFromCategories(soundCategories, '等待输入');
        if (waitingSound) {
            this.config.set('sound.waiting', waitingSound);
            console.log(`✅ 等待输入提示音已设置为: ${waitingSound}`);
        }
    }

    async selectSoundFromCategories(soundCategories, type) {
        const categories = Object.keys(soundCategories);
        
        console.log(`\n选择${type}音效分类:`);
        categories.forEach((category, index) => {
            const count = soundCategories[category].length;
            console.log(`${index + 1}. ${category} (${count}个音效)`);
        });
        console.log('0. 跳过');

        const choice = await this.question(`\n请选择分类 (0-${categories.length}): `);
        const index = parseInt(choice) - 1;

        if (choice === '0') {
            return null;
        }

        if (index >= 0 && index < categories.length) {
            const category = categories[index];
            const sounds = soundCategories[category];
            return await this.selectSoundFromList(sounds, type);
        } else {
            console.log('❌ 无效选择');
            return null;
        }
    }

    async selectSoundFromList(sounds, type) {
        console.log(`\n选择${type}提示音:`);
        sounds.forEach((sound, index) => {
            console.log(`${index + 1}. ${sound}`);
        });
        console.log('0. 返回分类选择');

        const choice = await this.question(`\n请选择 (0-${sounds.length}): `);
        const index = parseInt(choice) - 1;

        if (choice === '0') {
            return null;
        }

        if (index >= 0 && index < sounds.length) {
            const selectedSound = sounds[index];
            
            // Play sound preview
            try {
                const DesktopChannel = require('../channels/local/desktop');
                const desktop = new DesktopChannel();
                desktop._playSound(selectedSound);
                console.log(`播放音效: ${selectedSound}`);
            } catch (error) {
                // Ignore playback errors
            }

            const confirm = await this.question('确认使用这个音效吗? (y/n): ');
            if (confirm.toLowerCase() === 'y' || confirm.toLowerCase() === 'yes') {
                return selectedSound;
            }
        } else {
            console.log('❌ 无效选择');
        }

        return null;
    }

    async configureChannels() {
        console.log('\n=== 通知渠道配置 ===');
        console.log('1. 桌面通知 (已启用)');
        console.log('2. 邮件通知');
        console.log('3. Discord通知 (即将支持)');
        console.log('4. Telegram通知 (即将支持)');
        console.log('5. WhatsApp通知 (即将支持)');
        console.log('6. 飞书通知 (即将支持)');
        console.log('0. 返回主菜单');

        const choice = await this.question('\n请选择要配置的渠道 (0-6): ');

        switch (choice) {
            case '1':
                console.log('\n桌面通知已启用且工作正常！');
                break;
            case '2':
                await this.configureEmailChannel();
                break;
            case '3':
            case '4':
            case '5':
            case '6':
                console.log('\n此渠道即将在后续版本中支持！');
                break;
            case '0':
                return;
            default:
                console.log('❌ 无效选择');
        }
        
        if (choice !== '0') {
            await this.question('\n按回车继续...');
        }
    }

    async configureRelay() {
        console.log('\n=== 命令中继配置 ===');
        console.log('(此功能将在后续版本中实现)');
        console.log('将支持通过通知渠道发送命令，自动在Claude Code中执行');
        
        await this.question('\n按回车继续...');
    }

    async configureCustomMessages() {
        console.log('\n=== 自定义消息配置 ===');
        console.log('提示：使用 {project} 作为项目名占位符');
        console.log('示例：[{project}] 任务已完成！\n');

        // Configure completed message
        const currentCompleted = this.config.get('customMessages.completed') || '使用默认文本';
        console.log(`当前任务完成文本: ${currentCompleted}`);
        const completedMsg = await this.question('新的任务完成文本 (回车跳过): ');
        if (completedMsg.trim()) {
            this.config.set('customMessages.completed', completedMsg.trim());
            console.log('✅ 已更新任务完成文本');
        }

        // Configure waiting message
        const currentWaiting = this.config.get('customMessages.waiting') || '使用默认文本';
        console.log(`\n当前等待输入文本: ${currentWaiting}`);
        const waitingMsg = await this.question('新的等待输入文本 (回车跳过): ');
        if (waitingMsg.trim()) {
            this.config.set('customMessages.waiting', waitingMsg.trim());
            console.log('✅ 已更新等待输入文本');
        }
    }

    async testNotifications() {
        console.log('\n=== 测试通知 ===');
        
        try {
            const Notifier = require('../core/notifier');
            const notifier = new Notifier(this.config);
            await notifier.initializeChannels();
            
            console.log('发送任务完成通知...');
            await notifier.notify('completed', { test: true });
            
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            console.log('发送等待输入通知...');
            await notifier.notify('waiting', { test: true });
            
            console.log('✅ 测试完成');
        } catch (error) {
            console.error('❌ 测试失败:', error.message);
        }
        
        await this.question('\n按回车继续...');
    }

    async configureEmailChannel() {
        console.log('\n=== 邮件通知配置 ===');
        
        // 获取当前邮件配置
        const currentEmailConfig = this.config.getChannel('email') || { enabled: false, config: {} };
        const emailConfig = currentEmailConfig.config || {};
        
        console.log(`当前状态: ${currentEmailConfig.enabled ? '✅ 已启用' : '❌ 已禁用'}`);
        
        console.log('\n📧 SMTP 发送配置:');
        
        // SMTP 主机配置
        const currentHost = emailConfig.smtp?.host || '';
        console.log(`当前 SMTP 主机: ${currentHost || '未配置'}`);
        const smtpHost = await this.question('SMTP 主机 (如: smtp.gmail.com): ');
        
        // SMTP 端口配置
        const currentPort = emailConfig.smtp?.port || 587;
        console.log(`当前 SMTP 端口: ${currentPort}`);
        const smtpPortInput = await this.question('SMTP 端口 (默认 587): ');
        const smtpPort = parseInt(smtpPortInput) || 587;
        
        // 安全连接配置
        const currentSecure = emailConfig.smtp?.secure || false;
        console.log(`当前安全连接: ${currentSecure ? 'SSL/TLS' : 'STARTTLS'}`);
        const secureInput = await this.question('使用 SSL/TLS? (y/n，默认n): ');
        const secure = secureInput.toLowerCase() === 'y';
        
        // 用户名配置
        const currentUser = emailConfig.smtp?.auth?.user || '';
        console.log(`当前用户名: ${currentUser || '未配置'}`);
        const smtpUser = await this.question('SMTP 用户名 (邮箱地址): ');
        
        // 密码配置
        console.log('SMTP 密码: [隐藏]');
        const smtpPass = await this.question('SMTP 密码 (应用密码): ');
        
        console.log('\n📥 IMAP 接收配置 (用于接收回复):');
        
        // IMAP 主机配置
        const currentImapHost = emailConfig.imap?.host || '';
        console.log(`当前 IMAP 主机: ${currentImapHost || '未配置'}`);
        const imapHost = await this.question('IMAP 主机 (如: imap.gmail.com): ');
        
        // IMAP 端口配置
        const currentImapPort = emailConfig.imap?.port || 993;
        console.log(`当前 IMAP 端口: ${currentImapPort}`);
        const imapPortInput = await this.question('IMAP 端口 (默认 993): ');
        const imapPort = parseInt(imapPortInput) || 993;
        
        // IMAP 安全连接
        const currentImapSecure = emailConfig.imap?.secure !== false;
        const imapSecureInput = await this.question('IMAP 使用 SSL? (y/n，默认y): ');
        const imapSecure = imapSecureInput.toLowerCase() !== 'n';
        
        // 收件人配置
        console.log('\n📬 收件人配置:');
        const currentTo = emailConfig.to || '';
        console.log(`当前收件人: ${currentTo || '未配置'}`);
        const toEmail = await this.question('收件人邮箱: ');
        
        // 发件人配置
        const currentFrom = emailConfig.from || '';
        console.log(`当前发件人: ${currentFrom || '未配置'}`);
        const fromEmail = await this.question(`发件人显示名 (默认: TaskPing <${smtpUser}>): `);
        
        // 构建邮件配置
        const newEmailConfig = {
            enabled: true,
            config: {
                smtp: {
                    host: smtpHost || currentHost,
                    port: smtpPort,
                    secure: secure,
                    auth: {
                        user: smtpUser || currentUser,
                        pass: smtpPass || emailConfig.smtp?.auth?.pass || ''
                    }
                },
                imap: {
                    host: imapHost || currentImapHost,
                    port: imapPort,
                    secure: imapSecure,
                    auth: {
                        user: smtpUser || currentUser,
                        pass: smtpPass || emailConfig.imap?.auth?.pass || ''
                    }
                },
                from: fromEmail || `TaskPing <${smtpUser || currentUser}>`,
                to: toEmail || currentTo
            }
        };
        
        // 保存配置
        this.config.setChannel('email', newEmailConfig);
        console.log('\n✅ 邮件配置已保存');
        
        // 询问是否测试
        const testChoice = await this.question('\n测试邮件发送? (y/n): ');
        if (testChoice.toLowerCase() === 'y') {
            await this.testEmailChannel();
        }
    }
    
    async testEmailChannel() {
        console.log('\n🧪 测试邮件发送...');
        
        try {
            const EmailChannel = require('../channels/email/smtp');
            const emailConfig = this.config.getChannel('email');
            
            if (!emailConfig || !emailConfig.enabled) {
                console.log('❌ 邮件渠道未启用');
                return;
            }
            
            const emailChannel = new EmailChannel(emailConfig.config);
            const testResult = await emailChannel.test();
            
            if (testResult) {
                console.log('✅ 邮件发送测试成功！');
                console.log('📧 请检查您的邮箱，应该收到一封测试邮件');
                console.log('💡 您可以尝试回复该邮件来测试命令中继功能');
            } else {
                console.log('❌ 邮件发送测试失败');
                console.log('请检查您的 SMTP 配置是否正确');
            }
        } catch (error) {
            console.log('❌ 邮件测试失败:', error.message);
            console.log('请检查您的网络连接和邮件配置');
        }
    }

    showHelp() {
        console.log(`
TaskPing Configuration Manager

Usage: taskping config [options]

Options:
  --show    显示当前配置
  --help    显示帮助信息

Interactive Commands:
  1. 基础设置    - 语言、启用状态、超时时间等
  2. 音效配置    - 配置任务完成和等待输入的提示音
  3. 通知渠道    - 配置邮件、Discord、Telegram等通知渠道
  4. 命令中继    - 配置远程命令执行功能
  5. 测试通知    - 测试所有配置的通知渠道
        `);
    }
}

module.exports = ConfigurationManager;