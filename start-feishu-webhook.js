#!/usr/bin/env node

/**
 * Feishu Webhook Server
 * Starts the Feishu webhook server for receiving messages
 */

const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');
const Logger = require('./src/core/logger');
const FeishuWebhookHandler = require('./src/channels/feishu/webhook');

// Load environment variables
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
}

const logger = new Logger('Feishu-Webhook-Server');

// Load configuration
const config = {
    appId: process.env.FEISHU_APP_ID,
    appSecret: process.env.FEISHU_APP_SECRET,
    verificationToken: process.env.FEISHU_VERIFICATION_TOKEN,
    userId: process.env.FEISHU_USER_ID,
    groupId: process.env.FEISHU_GROUP_ID,
    whitelist: process.env.FEISHU_WHITELIST ? process.env.FEISHU_WHITELIST.split(',').map(id => id.trim()) : [],
    port: process.env.FEISHU_WEBHOOK_PORT || 3002,
    webhookUrl: process.env.FEISHU_WEBHOOK_URL
};

// Validate configuration
if (!config.appId) {
    logger.error('FEISHU_APP_ID must be set in .env file');
    process.exit(1);
}

if (!config.appSecret) {
    logger.error('FEISHU_APP_SECRET must be set in .env file');
    process.exit(1);
}

if (!config.userId && !config.groupId) {
    logger.error('Either FEISHU_USER_ID or FEISHU_GROUP_ID must be set in .env file');
    process.exit(1);
}

// Create and start webhook handler
const webhookHandler = new FeishuWebhookHandler(config);

async function start() {
    logger.info('Starting Feishu webhook server...');
    logger.info(`Configuration:`);
    logger.info(`- Port: ${config.port}`);
    logger.info(`- User ID: ${config.userId || 'Not set'}`);
    logger.info(`- Group ID: ${config.groupId || 'Not set'}`);
    logger.info(`- Whitelist: ${config.whitelist.length > 0 ? config.whitelist.join(', ') : 'None (using configured IDs)'}`);
    logger.info(`- Verification Token: ${config.verificationToken ? 'Configured' : 'Not configured'}`);
    
    // Show webhook setup information
    if (config.webhookUrl) {
        const webhookEndpoint = `${config.webhookUrl}/webhook/feishu`;
        logger.info(`Webhook endpoint: ${webhookEndpoint}`);
        logger.info(`Verification endpoint: ${webhookEndpoint}?challenge=YOUR_CHALLENGE`);
    } else {
        logger.warn('FEISHU_WEBHOOK_URL not set.');
        logger.info('Please configure the webhook URL in your Feishu app settings:');
        logger.info('https://your-domain.com/webhook/feishu');
    }
    
    // Start the server
    try {
        await webhookHandler.start(config.port);
    } catch (error) {
        logger.error('Failed to start Feishu webhook server:', error.message);
        process.exit(1);
    }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
    logger.info('Shutting down Feishu webhook server...');
    process.exit(0);
});

process.on('SIGTERM', () => {
    logger.info('Shutting down Feishu webhook server...');
    process.exit(0);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
    logger.error('Uncaught exception:', error);
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled rejection at:', promise, 'reason:', reason);
    process.exit(1);
});

start();