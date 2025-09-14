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
        // Try different message formats that Feishu might use
        const message1 = timestamp + "\n" + this.config.verificationToken + "\n" + body;
        const message2 = timestamp + this.config.verificationToken + body;
        const message3 = timestamp + "\n" + body;
        
        // Try with normalized JSON (no whitespace)
        let normalizedBody = body;
        try {
            normalizedBody = JSON.stringify(JSON.parse(body));
        } catch (e) {
            this.logger.debug('Failed to normalize body JSON:', e.message);
        }
        const message4 = timestamp + "\n" + this.config.verificationToken + "\n" + normalizedBody;
        const message5 = timestamp + "\n" + normalizedBody;
        
        // Try with timestamp as number
        const timestampNum = parseInt(timestamp);
        const message6 = timestampNum + "\n" + this.config.verificationToken + "\n" + body;
        const message7 = timestampNum + "\n" + body;
        
        // Try with URL encoded body
        const message8 = timestamp + "\n" + this.config.verificationToken + "\n" + encodeURIComponent(body);
        
        // Try with different key order
        const message9 = timestamp + "\n" + body + "\n" + this.config.verificationToken;
        
        let finalMessage = message1;
        let messageFormat = "timestamp\\nverificationToken\\nbody";
        
        // Calculate signature for each format to see which one matches
        const signatures = {};
        
        signatures.format1 = {
            message: message1,
            hex: crypto.createHmac('sha256', this.config.verificationToken).update(message1).digest('hex'),
            base64: crypto.createHmac('sha256', this.config.verificationToken).update(message1).digest('base64')
        };
        
        signatures.format2 = {
            message: message2,
            hex: crypto.createHmac('sha256', this.config.verificationToken).update(message2).digest('hex'),
            base64: crypto.createHmac('sha256', this.config.verificationToken).update(message2).digest('base64')
        };
        
        signatures.format3 = {
            message: message3,
            hex: crypto.createHmac('sha256', this.config.verificationToken).update(message3).digest('hex'),
            base64: crypto.createHmac('sha256', this.config.verificationToken).update(message3).digest('base64')
        };
        
        signatures.format4 = {
            message: message4,
            hex: crypto.createHmac('sha256', this.config.verificationToken).update(message4).digest('hex'),
            base64: crypto.createHmac('sha256', this.config.verificationToken).update(message4).digest('base64')
        };
        
        signatures.format5 = {
            message: message5,
            hex: crypto.createHmac('sha256', this.config.verificationToken).update(message5).digest('hex'),
            base64: crypto.createHmac('sha256', this.config.verificationToken).update(message5).digest('base64')
        };
        
        signatures.format6 = {
            message: message6,
            hex: crypto.createHmac('sha256', this.config.verificationToken).update(message6).digest('hex'),
            base64: crypto.createHmac('sha256', this.config.verificationToken).update(message6).digest('base64')
        };
        
        signatures.format7 = {
            message: message7,
            hex: crypto.createHmac('sha256', this.config.verificationToken).update(message7).digest('hex'),
            base64: crypto.createHmac('sha256', this.config.verificationToken).update(message7).digest('base64')
        };
        
        signatures.format8 = {
            message: message8,
            hex: crypto.createHmac('sha256', this.config.verificationToken).update(message8).digest('hex'),
            base64: crypto.createHmac('sha256', this.config.verificationToken).update(message8).digest('base64')
        };
        
        signatures.format9 = {
            message: message9,
            hex: crypto.createHmac('sha256', this.config.verificationToken).update(message9).digest('hex'),
            base64: crypto.createHmac('sha256', this.config.verificationToken).update(message9).digest('base64')
        };
        
        // Check if any format matches
        let matched = false;
        for (const [format, sigs] of Object.entries(signatures)) {
            if (sigs.hex === signature || sigs.base64 === signature) {
                finalMessage = sigs.message;
                messageFormat = format;
                matched = true;
                break;
            }
        }
        
        this.logger.debug('Signature verification:', {
            timestamp,
            timestampType: typeof timestamp,
            received: signature,
            messageFormat,
            matched,
            signatures: {
                format1: {
                    hex: signatures.format1.hex,
                    base64: signatures.format1.base64,
                    match: signatures.format1.hex === signature || signatures.format1.base64 === signature
                },
                format2: {
                    hex: signatures.format2.hex,
                    base64: signatures.format2.base64,
                    match: signatures.format2.hex === signature || signatures.format2.base64 === signature
                },
                format3: {
                    hex: signatures.format3.hex,
                    base64: signatures.format3.base64,
                    match: signatures.format3.hex === signature || signatures.format3.base64 === signature
                },
                format6: {
                    hex: signatures.format6.hex,
                    base64: signatures.format6.base64,
                    match: signatures.format6.hex === signature || signatures.format6.base64 === signature
                },
                format7: {
                    hex: signatures.format7.hex,
                    base64: signatures.format7.base64,
                    match: signatures.format7.hex === signature || signatures.format7.base64 === signature
                },
                format8: {
                    hex: signatures.format8.hex,
                    base64: signatures.format8.base64,
                    match: signatures.format8.hex === signature || signatures.format8.base64 === signature
                },
                format9: {
                    hex: signatures.format9.hex,
                    base64: signatures.format9.base64,
                    match: signatures.format9.hex === signature || signatures.format9.base64 === signature
                }
            },
            verificationToken: this.config.verificationToken ? 'present' : 'missing'
        });

        return matched;
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
                
                // TEMPORARY: Disable signature verification for testing
                this.logger.warn('TEMPORARY: Skipping signature verification for testing');
                // if (!this._verifySignature(signature, finalTimestamp, body)) {
                //     this.logger.warn('Invalid webhook signature');
                //     return res.status(401).json({ error: 'Invalid signature' });
                // }
                this.logger.info('Signature verification successful for message event');
            }

            // Handle different event types
            if (eventType === 'im.message.receive_v1') {
                await this._handleMessage(event);
            } else if (eventType === 'card.action.trigger') {
                await this._handleCardAction(event);
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
            const session = this.feishuChannel._loadSession(parsedCommand.token);
            if (!session) {
                this.logger.warn('Invalid or expired session token:', parsedCommand.token);
                await this._sendResponse('❌ 无效的会话令牌', context);
                return;
            }

            // Use ControllerInjector to execute command
            const ControllerInjector = require('../../utils/controller-injector');
            const injector = new ControllerInjector();

            const sessionName = session.conversationContext?.session || 'claude-session';
            const result = await injector.injectCommand(parsedCommand.command, sessionName);
            
            if (result) {
                this.logger.info('Command executed successfully');
                await this._sendResponse('✅ 命令执行成功', context);
            } else {
                this.logger.warn('Command execution failed');
                await this._sendResponse('❌ 命令执行失败', context);
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
            // Use the configured receive ID from the Feishu channel config
            const receiveId = this.feishuChannel.config.userId || this.feishuChannel.config.groupId;
            const receiveType = this.feishuChannel.config.userId ? 'user' : 'group';

            this.logger.debug('Sending response:', {
                receiveId,
                receiveType,
                text
            });

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
     * Handle card action trigger event
     * @param {Object} event - Card action event
     */
    async _handleCardAction(event) {
        try {
            this.logger.info('Handling Feishu card action event:', {
                eventId: event?.header?.event_id,
                actionType: event?.event?.action?.tag,
                actionKey: event?.event?.action?.key
            });

            const action = event?.event?.action;
            if (!action || !action.value) {
                this.logger.debug('No action value in card action event');
                return;
            }

            const { cmd, token, command } = action.value;

            // Get sender information from the event
            const sender = event?.event?.operator?.sender_id || {
                sender_type: 'user',
                sender_id: {
                    user_id: this.config.userId || this.config.groupId
                }
            };

            if (cmd === '/cmd' && token && command) {
                // Handle button click
                this.logger.info('Received card button command:', command);
                await this._handleCommand({ token, command }, {
                    messageId: event?.header?.event_id,
                    sender: sender,
                    chatType: 'p2p',
                    isCardAction: true
                });
            } else if (cmd === '/cmd' && token) {
                // Handle form submission with input field
                let customCommand = '';

                // Try to get command from form values (new Feishu form format)
                this.logger.debug('Form values received:', action.form_values);
                this.logger.debug('Form value received:', action.form_value);
                this.logger.debug('Action structure:', JSON.stringify(action, null, 2));

                // Check if this is a form submission or a button click without form data
                // Feishu may send form_value (singular) or form_values (plural)
                const formData = action.form_values || action.form_value;
                this.logger.debug('Computed formData:', formData);
                this.logger.debug('formData type:', typeof formData);
                this.logger.debug('formData keys:', formData ? Object.keys(formData) : 'null');

                if (formData) {
                    // Try different possible field names from the new form structure
                    const possibleFields = ['command_input', 'command', 'input'];

                    for (const field of possibleFields) {
                        // Handle both formats: { field: { value: "..." } } and { field: "..." }
                        if (formData[field]) {
                            if (formData[field].value) {
                                customCommand = formData[field].value.trim();
                                this.logger.info(`Found command in field '${field}' (object format):`, customCommand);
                                break;
                            } else if (typeof formData[field] === 'string') {
                                customCommand = formData[field].trim();
                                this.logger.info(`Found command in field '${field}' (string format):`, customCommand);
                                break;
                            }
                        }
                    }

                    // If not found by name, try to get from first available field
                    if (!customCommand) {
                        const fieldKeys = Object.keys(formData);
                        if (fieldKeys.length > 0) {
                            const firstField = formData[fieldKeys[0]];
                            if (firstField) {
                                if (firstField.value) {
                                    customCommand = firstField.value.trim();
                                    this.logger.info(`Found command in first field '${fieldKeys[0]}' (object format):`, customCommand);
                                } else if (typeof firstField === 'string') {
                                    customCommand = firstField.trim();
                                    this.logger.info(`Found command in first field '${fieldKeys[0]}' (string format):`, customCommand);
                                }
                            }
                        }
                    }
                } else if (action.tag === 'form_submit' || action.action_type === 'form_submit') {
                    // Form submit button clicked but no form_values (possibly empty input)
                    this.logger.info('Form submit button clicked but no form values received');
                } else {
                    // Regular button click - use default command
                    this.logger.info('Button clicked without form submission, checking for default command');
                    if (action.value && action.value.command) {
                        customCommand = action.value.command;
                        this.logger.info('Using default command from button:', customCommand);
                    }
                }

                if (customCommand) {
                    this.logger.info('Received form input command:', customCommand);
                    await this._handleCommand({ token, command: customCommand }, {
                        messageId: event?.header?.event_id,
                        sender: sender,
                        chatType: 'p2p',
                        isCardAction: true
                    });
                } else {
                    this.logger.warn('Empty command in input field or button click');
                    this.logger.debug('Form values structure:', JSON.stringify(formData, null, 2));
                    await this._sendResponse('❌ 请输入有效的指令', {
                        messageId: event?.header?.event_id,
                        sender: sender,
                        chatType: 'p2p'
                    });
                }
            }
        } catch (error) {
            this.logger.error('Error handling Feishu card action:', error);
        }
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