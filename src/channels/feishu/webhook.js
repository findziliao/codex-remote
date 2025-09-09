/**
 * Feishu Webhook Handler
 * Handles incoming Feishu messages and commands
 */

const express = require('express');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const Logger = require('../../core/logger');
const ControllerInjector = require('../../utils/controller-injector');
const FeishuChannel = require('./feishu');

class FeishuWebhookHandler {
    constructor(config = {}) {
        this.config = config;
        this.logger = new Logger('FeishuWebhook');
        this.sessionsDir = path.join(__dirname, '../../data/sessions');
        this.injector = new ControllerInjector();
        this.feishuChannel = new FeishuChannel(config);
        this.app = express();
        
        this._setupMiddleware();
        this._setupRoutes();
    }

    _setupMiddleware() {
        // Parse JSON for all requests
        this.app.use(express.json());
        
        // Add request logging middleware
        this.app.use((req, res, next) => {
            this.logger.debug(`${req.method} ${req.path}`, {
                ip: req.ip,
                userAgent: req.get('User-Agent')
            });
            next();
        });
    }

    _setupRoutes() {
        // Feishu webhook endpoint
        this.app.post('/webhook/feishu', this._handleWebhook.bind(this));

        // Health check endpoint
        this.app.get('/health', (req, res) => {
            res.json({ status: 'ok', service: 'feishu-webhook' });
        });

        // Feishu verification endpoint (for webhook URL validation)
        this.app.get('/webhook/feishu', this._handleVerification.bind(this));
    }

    /**
     * Handle Feishu webhook URL verification
     * @param {Object} req - Express request
     * @param {Object} res - Express response
     */
    _handleVerification(req, res) {
        const challenge = req.query.challenge;
        if (challenge) {
            this.logger.info('Feishu webhook verification successful');
            res.json({ challenge });
        } else {
            res.status(400).json({ error: 'Challenge not provided' });
        }
    }

    /**
     * Verify Feishu webhook signature
     * @param {string} signature - Request signature
     * @param {string} timestamp - Request timestamp
     * @param {string} body - Request body
     * @returns {boolean} Verification result
     */
    _verifySignature(signature, timestamp, body) {
        if (!this.config.verificationToken) {
            this.logger.warn('Verification token not configured, skipping signature verification');
            return true;
        }

        // 飞书签名算法：timestamp + "\n" + verificationToken + "\n" + body
        const message = timestamp + "\n" + this.config.verificationToken + "\n" + body;
        
        const expectedSignature = crypto
            .createHmac('sha256', this.config.verificationToken)
            .update(message)
            .digest('base64');

        this.logger.debug('Signature verification:', {
            timestamp,
            timestampType: typeof timestamp,
            message: message.substring(0, 100) + '...',
            messageLength: message.length,
            received: signature,
            expected: expectedSignature,
            match: signature === expectedSignature,
            verificationToken: this.config.verificationToken ? 'present' : 'missing'
        });

        return signature === expectedSignature;
    }

    /**
     * Handle incoming Feishu webhook
     * @param {Object} req - Express request
     * @param {Object} res - Express response
     */
    async _handleWebhook(req, res) {
        try {
            const body = JSON.stringify(req.body);
            
            // Check if this is a verification request (URL verification)
            if (req.body && req.body.type === 'url_verification') {
                this.logger.info('Received URL verification request, skipping signature verification');
                return res.json({ challenge: req.body.challenge });
            }
            
            // For message events, check for signature headers
            const signature = req.headers['x-lark-signature'] || 
                            req.headers['X-Lark-Signature'] ||
                            req.headers['x-lark_signature'] ||
                            req.headers['X-Lark_Signature'];
                            
            const timestamp = req.headers['x-lark-timestamp'] || 
                            req.headers['X-Lark-Timestamp'] ||
                            req.headers['x-lark_timestamp'] ||
                            req.headers['X-Lark_Timestamp'] ||
                            req.headers['x-lark-request-timestamp'] ||
                            req.headers['X-Lark-Request-Timestamp'];
            
            this.logger.debug('Headers received:', {
                allHeaders: Object.keys(req.headers),
                signature: signature ? 'present' : 'missing',
                timestamp: timestamp ? 'present' : 'missing',
                rawSignature: signature,
                rawTimestamp: timestamp
            });
            
            // For message events, verify signature if verification token is configured
            const event = req.body;
            const eventType = event?.header?.event_type;
            
            this.logger.info('Received Feishu event:', { 
                eventType: eventType,
                hasBody: !!event,
                eventId: event?.header?.event_id
            });
            
            // Extract timestamp from header if not provided in headers
            let finalTimestamp = timestamp;
            if (!finalTimestamp && event?.header?.create_time) {
                finalTimestamp = event.header.create_time;
                this.logger.info('Using timestamp from event header:', finalTimestamp);
            }
            
            // Only verify signature for message events
            if (this.config.verificationToken && eventType === 'im.message.receive_v1') {
                this.logger.info('Processing message event, checking signature');
                if (!signature) {
                    this.logger.warn('Missing signature headers for message event');
                    return res.status(401).json({ error: 'Missing signature headers' });
                }
                
                if (!this._verifySignature(signature, finalTimestamp, body)) {
                    this.logger.warn('Invalid webhook signature');
                    return res.status(401).json({ error: 'Invalid signature' });
                }
                this.logger.info('Signature verification successful for message event');
            }

            // Handle different event types
            if (eventType === 'im.message.receive_v1') {
                await this._handleMessage(event);
            } else {
                this.logger.info('Ignoring event type:', eventType);
            }

            res.json({ ok: true });
        } catch (error) {
            this.logger.error('Error handling Feishu webhook:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    /**
     * Handle incoming message
     * @param {Object} event - Feishu message event
     */
    async _handleMessage(event) {
        try {
            this.logger.info('Handling Feishu message event:', {
                messageId: event.event?.message?.message_id,
                msgType: event.event?.message?.msg_type,
                senderId: event.event?.sender?.sender_id?.user_id
            });
            
            const message = event.event.message;
            const sender = event.event.sender;

            // Handle different message types
            if (message.msg_type === 'text') {
                this.logger.info('Processing text message');
                await this._handleTextMessage(message, sender);
            } else if (message.msg_type === 'interactive') {
                this.logger.info('Processing interactive message');
                await this._handleInteractiveMessage(message, sender);
            } else {
                this.logger.info('Ignoring unsupported message type:', message.msg_type);
            }
        } catch (error) {
            this.logger.error('Error handling Feishu message:', error);
        }
    }

    /**
     * Handle text message
     * @param {Object} message - Message object
     * @param {Object} sender - Sender information
     */
    async _handleTextMessage(message, sender) {
        // Parse message content
        const content = JSON.parse(message.content);
        const text = content.text.trim();

        // Validate sender
        if (!this._validateSender(sender)) {
            this.logger.warn('Unauthorized sender:', sender);
            return;
        }

        this.logger.info('Received text message from Feishu:', text);

        // Parse and handle command
        const parsedCommand = this.feishuChannel._parseCommand(text);
        if (parsedCommand) {
            await this._handleCommand(parsedCommand, {
                messageId: message.message_id,
                sender: sender,
                chatType: message.chat_type,
                messageId: message.message_id
            });
        } else {
            // If no command format, try to handle as direct command in reply context
            await this._handleDirectCommand(text, {
                messageId: message.message_id,
                sender: sender,
                chatType: message.chat_type,
                messageId: message.message_id
            });
        }
    }

    /**
     * Handle interactive message (card button clicks)
     * @param {Object} message - Message object
     * @param {Object} sender - Sender information
     */
    async _handleInteractiveMessage(message, sender) {
        // Validate sender
        if (!this._validateSender(sender)) {
            this.logger.warn('Unauthorized sender:', sender);
            return;
        }

        const action = message.action;
        if (!action || !action.value) {
            this.logger.debug('No action value in interactive message');
            return;
        }

        const { cmd, token, command } = action.value;
        if (cmd === '/cmd' && token && command) {
            this.logger.info('Received card button command:', command);
            await this._handleCommand({ token, command }, {
                messageId: message.message_id,
                sender: sender,
                chatType: message.chat_type,
                messageId: message.message_id,
                isCardAction: true
            });
        }
    }

    /**
     * Validate message sender
     * @param {Object} sender - Sender information
     * @returns {boolean} Validation result
     */
    _validateSender(sender) {
        // Check whitelist if configured
        if (this.config.whitelist && this.config.whitelist.length > 0) {
            const senderId = sender.sender_id.user_id || sender.sender_id.open_id;
            if (!senderId || !this.config.whitelist.includes(senderId)) {
                return false;
            }
        }

        return true;
    }

    /**
     * Handle parsed command
     * @param {Object} parsedCommand - Parsed command
     * @param {Object} context - Command context
     */
    async _handleCommand(parsedCommand, context) {
        try {
            const result = await this.feishuChannel.handleCommand(parsedCommand.command, context);
            
            if (result) {
                this.logger.info('Command executed successfully');
                await this._sendResponse('✅ 命令执行成功', context);
            } else {
                this.logger.warn('Command execution failed');
                await this._sendResponse('❌ 命令执行失败，请检查token是否有效', context);
            }
        } catch (error) {
            this.logger.error('Error executing command:', error);
            await this._sendResponse('❌ 命令执行出错：' + error.message, context);
        }
    }

    /**
     * Handle direct command (without explicit token)
     * @param {string} command - Command text
     * @param {Object} context - Command context
     */
    async _handleDirectCommand(command, context) {
        try {
            // Try to find active session for this sender
            const senderId = context.sender.sender_id.user_id || context.sender.sender_id.open_id;
            const session = this._findActiveSession(senderId);

            if (session) {
                const result = await this.feishuChannel.handleCommand(command, {
                    ...context,
                    session: session
                });
                
                if (result) {
                    await this._sendResponse('✅ 命令执行成功', context);
                } else {
                    await this._sendResponse('❌ 命令执行失败', context);
                }
            } else {
                // No active session, send help message
                await this._sendResponse('❌ 无有效的会话，请先等待Claude完成任务后回复', context);
            }
        } catch (error) {
            this.logger.error('Error handling direct command:', error);
            await this._sendResponse('❌ 命令执行出错：' + error.message, context);
        }
    }

    /**
     * Find active session for sender
     * @param {string} senderId - Sender ID
     * @returns {Object|null} Session data
     */
    _findActiveSession(senderId) {
        try {
            if (!fs.existsSync(this.sessionsDir)) {
                return null;
            }

            const sessionFiles = fs.readdirSync(this.sessionsDir);
            const feishuSessions = sessionFiles.filter(file => file.startsWith('feishu_'));

            for (const file of feishuSessions) {
                const sessionPath = path.join(this.sessionsDir, file);
                const sessionData = JSON.parse(fs.readFileSync(sessionPath, 'utf8'));
                
                // Check if session is expired
                if (Date.now() > sessionData.expiresAt) {
                    fs.unlinkSync(sessionPath);
                    continue;
                }

                // Check if session belongs to this sender
                if (sessionData.receiveId === senderId) {
                    return sessionData;
                }
            }

            return null;
        } catch (error) {
            this.logger.error('Error finding session:', error);
            return null;
        }
    }

    /**
     * Send response message
     * @param {string} text - Response text
     * @param {Object} context - Message context
     */
    async _sendResponse(text, context) {
        try {
            const receiveId = context.sender.sender_id.user_id || context.sender.sender_id.open_id;
            const receiveType = context.chat_type === 'p2p' ? 'user' : 'group';

            const message = {
                msg_type: 'text',
                content: {
                    text: text
                }
            };

            await this.feishuChannel._sendMessage(receiveId, receiveType, message);
        } catch (error) {
            this.logger.error('Error sending response:', error);
        }
    }

    /**
     * Start the webhook server
     * @param {number} port - Port to listen on
     * @returns {Promise<Object>} Server instance
     */
    start(port = 3002) {
        return new Promise((resolve, reject) => {
            const server = this.app.listen(port, (err) => {
                if (err) {
                    reject(err);
                } else {
                    this.logger.info(`Feishu webhook server started on port ${port}`);
                    resolve(server);
                }
            });

            // Handle graceful shutdown
            process.on('SIGTERM', () => this._shutdown(server));
            process.on('SIGINT', () => this._shutdown(server));
        });
    }

    /**
     * Shutdown the server gracefully
     * @param {Object} server - Server instance
     */
    _shutdown(server) {
        this.logger.info('Shutting down Feishu webhook server...');
        server.close(() => {
            this.logger.info('Feishu webhook server stopped');
            process.exit(0);
        });
    }
}

module.exports = FeishuWebhookHandler;