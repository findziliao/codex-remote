/**
 * Email Notification Channel
 * Sends notifications via email with reply support
 */

const NotificationChannel = require('../base/channel');
const nodemailer = require('nodemailer');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');

class EmailChannel extends NotificationChannel {
    constructor(config = {}) {
        super('email', config);
        this.transporter = null;
        this.sessionsDir = path.join(__dirname, '../../data/sessions');
        this.templatesDir = path.join(__dirname, '../../assets/email-templates');
        
        this._ensureDirectories();
        this._initializeTransporter();
    }

    _ensureDirectories() {
        if (!fs.existsSync(this.sessionsDir)) {
            fs.mkdirSync(this.sessionsDir, { recursive: true });
        }
        if (!fs.existsSync(this.templatesDir)) {
            fs.mkdirSync(this.templatesDir, { recursive: true });
        }
    }

    _initializeTransporter() {
        if (!this.config.smtp) {
            this.logger.warn('SMTP configuration not found');
            return;
        }

        try {
            this.transporter = nodemailer.createTransport({
                host: this.config.smtp.host,
                port: this.config.smtp.port,
                secure: this.config.smtp.secure || false,
                auth: {
                    user: this.config.smtp.auth.user,
                    pass: this.config.smtp.auth.pass
                },
                // 添加超时设置
                connectionTimeout: 10000,
                greetingTimeout: 10000,
                socketTimeout: 10000
            });

            this.logger.debug('Email transporter initialized');
        } catch (error) {
            this.logger.error('Failed to initialize email transporter:', error.message);
        }
    }

    async _sendImpl(notification) {
        if (!this.transporter) {
            throw new Error('Email transporter not initialized');
        }

        if (!this.config.to) {
            throw new Error('Email recipient not configured');
        }

        // 生成会话ID
        const sessionId = uuidv4();
        
        // 创建会话记录
        await this._createSession(sessionId, notification);

        // 生成邮件内容
        const emailContent = this._generateEmailContent(notification, sessionId);
        
        const mailOptions = {
            from: this.config.from || this.config.smtp.auth.user,
            to: this.config.to,
            subject: emailContent.subject,
            html: emailContent.html,
            text: emailContent.text,
            // 添加自定义头部用于回复识别
            headers: {
                'X-TaskPing-Session-ID': sessionId,
                'X-TaskPing-Type': notification.type
            }
        };

        try {
            const result = await this.transporter.sendMail(mailOptions);
            this.logger.info(`Email sent successfully to ${this.config.to}, Session: ${sessionId}`);
            return true;
        } catch (error) {
            this.logger.error('Failed to send email:', error.message);
            // 清理失败的会话
            await this._removeSession(sessionId);
            return false;
        }
    }

    async _createSession(sessionId, notification) {
        const session = {
            id: sessionId,
            created: new Date().toISOString(),
            expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24小时后过期
            notification: {
                type: notification.type,
                project: notification.project,
                message: notification.message
            },
            status: 'waiting',
            commandCount: 0,
            maxCommands: 10
        };

        const sessionFile = path.join(this.sessionsDir, `${sessionId}.json`);
        fs.writeFileSync(sessionFile, JSON.stringify(session, null, 2));
        
        this.logger.debug(`Session created: ${sessionId}`);
    }

    async _removeSession(sessionId) {
        const sessionFile = path.join(this.sessionsDir, `${sessionId}.json`);
        if (fs.existsSync(sessionFile)) {
            fs.unlinkSync(sessionFile);
            this.logger.debug(`Session removed: ${sessionId}`);
        }
    }

    _generateEmailContent(notification, sessionId) {
        const template = this._getTemplate(notification.type);
        const timestamp = new Date().toLocaleString('zh-CN');
        
        // 模板变量替换
        const variables = {
            project: notification.project,
            message: notification.message,
            timestamp: timestamp,
            sessionId: sessionId,
            type: notification.type === 'completed' ? '任务完成' : '等待输入'
        };

        let subject = template.subject;
        let html = template.html;
        let text = template.text;

        // 替换模板变量
        Object.keys(variables).forEach(key => {
            const placeholder = new RegExp(`{{${key}}}`, 'g');
            subject = subject.replace(placeholder, variables[key]);
            html = html.replace(placeholder, variables[key]);
            text = text.replace(placeholder, variables[key]);
        });

        return { subject, html, text };
    }

    _getTemplate(type) {
        // 默认模板
        const templates = {
            completed: {
                subject: '[TaskPing] Claude Code 任务完成 - {{project}}',
                html: `
                <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
                    <div style="background-color: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
                        <h2 style="color: #2c3e50; margin-top: 0; border-bottom: 2px solid #3498db; padding-bottom: 10px;">
                            🎉 Claude Code 任务完成
                        </h2>
                        
                        <div style="background-color: #ecf0f1; padding: 15px; border-radius: 6px; margin: 20px 0;">
                            <p style="margin: 0; color: #2c3e50;">
                                <strong>项目:</strong> {{project}}<br>
                                <strong>时间:</strong> {{timestamp}}<br>
                                <strong>状态:</strong> {{type}}
                            </p>
                        </div>

                        <div style="background-color: #e8f5e8; padding: 15px; border-radius: 6px; border-left: 4px solid #27ae60;">
                            <p style="margin: 0; color: #2c3e50;">{{message}}</p>
                        </div>

                        <div style="margin: 25px 0; padding: 20px; background-color: #fff3cd; border-radius: 6px; border-left: 4px solid #ffc107;">
                            <h3 style="margin-top: 0; color: #856404;">💡 如何继续对话</h3>
                            <p style="margin: 10px 0; color: #856404;">
                                要继续与 Claude Code 对话，请直接<strong>回复此邮件</strong>，在邮件正文中输入您的指令。
                            </p>
                            <div style="background-color: white; padding: 10px; border-radius: 4px; font-family: monospace; color: #495057;">
                                示例回复:<br>
                                • "请继续优化代码"<br>
                                • "生成单元测试"<br>
                                • "解释这个函数的作用"
                            </div>
                        </div>

                        <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #dee2e6; font-size: 12px; color: #6c757d;">
                            <p style="margin: 5px 0;">会话ID: <code>{{sessionId}}</code></p>
                            <p style="margin: 5px 0;">🔒 安全提示: 请勿转发此邮件，会话将在24小时后自动过期</p>
                            <p style="margin: 5px 0;">📧 这是一封来自 TaskPing 的自动邮件</p>
                        </div>
                    </div>
                </div>
                `,
                text: `
[TaskPing] Claude Code 任务完成 - {{project}}

项目: {{project}}
时间: {{timestamp}}
状态: {{type}}

消息: {{message}}

如何继续对话:
要继续与 Claude Code 对话，请直接回复此邮件，在邮件正文中输入您的指令。

示例回复:
• "请继续优化代码"
• "生成单元测试"  
• "解释这个函数的作用"

会话ID: {{sessionId}}
安全提示: 请勿转发此邮件，会话将在24小时后自动过期
                `
            },
            waiting: {
                subject: '[TaskPing] Claude Code 等待输入 - {{project}}',
                html: `
                <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
                    <div style="background-color: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
                        <h2 style="color: #2c3e50; margin-top: 0; border-bottom: 2px solid #e74c3c; padding-bottom: 10px;">
                            ⏳ Claude Code 等待您的指导
                        </h2>
                        
                        <div style="background-color: #ecf0f1; padding: 15px; border-radius: 6px; margin: 20px 0;">
                            <p style="margin: 0; color: #2c3e50;">
                                <strong>项目:</strong> {{project}}<br>
                                <strong>时间:</strong> {{timestamp}}<br>
                                <strong>状态:</strong> {{type}}
                            </p>
                        </div>

                        <div style="background-color: #fdf2e9; padding: 15px; border-radius: 6px; border-left: 4px solid #e67e22;">
                            <p style="margin: 0; color: #2c3e50;">{{message}}</p>
                        </div>

                        <div style="margin: 25px 0; padding: 20px; background-color: #d1ecf1; border-radius: 6px; border-left: 4px solid #17a2b8;">
                            <h3 style="margin-top: 0; color: #0c5460;">💬 请提供指导</h3>
                            <p style="margin: 10px 0; color: #0c5460;">
                                Claude 需要您的进一步指导。请<strong>回复此邮件</strong>告诉 Claude 下一步应该做什么。
                            </p>
                        </div>

                        <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #dee2e6; font-size: 12px; color: #6c757d;">
                            <p style="margin: 5px 0;">会话ID: <code>{{sessionId}}</code></p>
                            <p style="margin: 5px 0;">🔒 安全提示: 请勿转发此邮件，会话将在24小时后自动过期</p>
                            <p style="margin: 5px 0;">📧 这是一封来自 TaskPing 的自动邮件</p>
                        </div>
                    </div>
                </div>
                `,
                text: `
[TaskPing] Claude Code 等待输入 - {{project}}

项目: {{project}}
时间: {{timestamp}}
状态: {{type}}

消息: {{message}}

Claude 需要您的进一步指导。请回复此邮件告诉 Claude 下一步应该做什么。

会话ID: {{sessionId}}
安全提示: 请勿转发此邮件，会话将在24小时后自动过期
                `
            }
        };

        return templates[type] || templates.completed;
    }

    validateConfig() {
        if (!this.config.smtp) {
            return { valid: false, error: 'SMTP configuration required' };
        }
        
        if (!this.config.smtp.host) {
            return { valid: false, error: 'SMTP host required' };
        }
        
        if (!this.config.smtp.auth || !this.config.smtp.auth.user || !this.config.smtp.auth.pass) {
            return { valid: false, error: 'SMTP authentication required' };
        }
        
        if (!this.config.to) {
            return { valid: false, error: 'Recipient email required' };
        }

        return { valid: true };
    }

    async test() {
        try {
            if (!this.transporter) {
                throw new Error('Email transporter not initialized');
            }

            // 验证 SMTP 连接
            await this.transporter.verify();
            
            // 发送测试邮件
            const testNotification = {
                type: 'completed',
                title: 'TaskPing 测试',
                message: '这是一封测试邮件，用于验证邮件通知功能是否正常工作。',
                project: 'TaskPing-Test',
                metadata: {
                    test: true,
                    timestamp: new Date().toISOString()
                }
            };

            const result = await this._sendImpl(testNotification);
            return result;
        } catch (error) {
            this.logger.error('Email test failed:', error.message);
            return false;
        }
    }

    getStatus() {
        const baseStatus = super.getStatus();
        return {
            ...baseStatus,
            configured: this.validateConfig().valid,
            supportsRelay: true,
            smtp: {
                host: this.config.smtp?.host || 'not configured',
                port: this.config.smtp?.port || 'not configured',
                secure: this.config.smtp?.secure || false
            },
            recipient: this.config.to || 'not configured'
        };
    }
}

module.exports = EmailChannel;