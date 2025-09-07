#!/usr/bin/env node

/**
 * Test Feishu message format and API
 */

require('dotenv').config();
const FeishuChannel = require('./src/channels/feishu/feishu');
const Logger = require('./src/core/logger');

const logger = new Logger('FeishuTest');

// Load configuration from environment variables
const config = {
    appId: process.env.FEISHU_APP_ID,
    appSecret: process.env.FEISHU_APP_SECRET,
    verificationToken: process.env.FEISHU_VERIFICATION_TOKEN,
    userId: process.env.FEISHU_CHAT_ID, // Using open_id format
    groupId: process.env.FEISHU_GROUP_ID,
    whitelist: process.env.FEISHU_WHITELIST ? process.env.FEISHU_WHITELIST.split(',') : [],
    webhookUrl: process.env.FEISHU_WEBHOOK_URL,
    port: parseInt(process.env.FEISHU_WEBHOOK_PORT) || 3002
};

async function testFeishu() {
    console.log('🧪 Testing Feishu Configuration...');
    console.log('Configuration:', {
        appId: config.appId,
        userId: config.userId,
        webhookUrl: config.webhookUrl,
        port: config.port
    });

    const feishuChannel = new FeishuChannel(config);
    
    // Test configuration validation
    console.log('\n🔍 Testing configuration validation...');
    const isValid = feishuChannel.validateConfig();
    console.log('Configuration valid:', isValid);
    
    if (!isValid) {
        console.log('❌ Configuration validation failed');
        return;
    }

    // Test access token
    console.log('\n🔑 Testing access token acquisition...');
    try {
        const token = await feishuChannel._getAccessToken();
        console.log('✅ Access token acquired successfully');
        console.log('Token expires at:', new Date(feishuChannel.tokenExpiry).toLocaleString());
    } catch (error) {
        console.log('❌ Failed to get access token:', error.message);
        return;
    }

    // Test different message formats
    console.log('\n📨 Testing message formats...');
    
    const testNotification = {
        type: 'completed',
        title: 'Claude Task Completed',
        message: 'This is a test notification from Claude Code Remote',
        project: 'test-project',
        timestamp: new Date().toISOString()
    };

    // Test 1: Simple text message
    console.log('\n📝 Test 1: Simple text message');
    try {
        const simpleMessage = {
            msg_type: 'text',
            content: {
                text: '🎉 Test notification from Claude Code Remote!\n\nProject: test-project\nTime: ' + new Date().toLocaleString('zh-CN')
            }
        };
        
        const receiveId = config.userId || config.groupId;
        const receiveType = config.userId ? 'user' : 'group';
        
        console.log('Sending to:', receiveId);
        console.log('Message type:', receiveType);
        console.log('Message content:', JSON.stringify(simpleMessage, null, 2));
        
        const result = await feishuChannel._sendMessage(receiveId, receiveType, simpleMessage);
        console.log('Simple text message result:', result ? '✅ Success' : '❌ Failed');
    } catch (error) {
        console.log('❌ Simple text message failed:', error.message);
        if (error.response) {
            console.log('Error response:', error.response.data);
        }
    }

    // Test 2: Interactive card message
    console.log('\n🎨 Test 2: Interactive card message');
    try {
        const cardMessage = feishuChannel._formatMessage(testNotification);
        console.log('Card message structure:', JSON.stringify(cardMessage, null, 2));
        
        const receiveId = config.userId || config.groupId;
        const receiveType = config.userId ? 'user' : 'group';
        
        const result = await feishuChannel._sendMessage(receiveId, receiveType, cardMessage);
        console.log('Interactive card message result:', result ? '✅ Success' : '❌ Failed');
    } catch (error) {
        console.log('❌ Interactive card message failed:', error.message);
        if (error.response) {
            console.log('Error response:', error.response.data);
        }
    }

    // Test 3: Minimal card message
    console.log('\n🎯 Test 3: Minimal card message');
    try {
        const minimalCard = {
            msg_type: 'interactive',
            card: {
                config: {
                    wide_screen_mode: true
                },
                elements: [
                    {
                        tag: 'div',
                        text: {
                            tag: 'lark_md',
                            content: '**🎉 Test Message**\n\nThis is a minimal test card.'
                        }
                    }
                ]
            }
        };
        
        const receiveId = config.userId || config.groupId;
        const receiveType = config.userId ? 'user' : 'group';
        
        const result = await feishuChannel._sendMessage(receiveId, receiveType, minimalCard);
        console.log('Minimal card message result:', result ? '✅ Success' : '❌ Failed');
    } catch (error) {
        console.log('❌ Minimal card message failed:', error.message);
        if (error.response) {
            console.log('Error response:', error.response.data);
        }
    }

    console.log('\n📊 Test Summary:');
    console.log('Configuration:', isValid ? '✅ Valid' : '❌ Invalid');
    console.log('Access Token: ✅ Working');
    console.log('Please check your Feishu client for test messages.');
}

testFeishu().catch(console.error);