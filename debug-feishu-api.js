#!/usr/bin/env node

/**
 * Debug Feishu API to identify the exact issue
 */

require('dotenv').config();
const axios = require('axios');

const config = {
    appId: process.env.FEISHU_APP_ID,
    appSecret: process.env.FEISHU_APP_SECRET,
    userId: process.env.FEISHU_CHAT_ID,
    groupId: process.env.FEISHU_GROUP_ID
};

async function getAccessToken() {
    try {
        const response = await axios.post('https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal', {
            app_id: config.appId,
            app_secret: config.appSecret
        }, {
            headers: {
                'Content-Type': 'application/json; charset=utf-8'
            }
        });

        if (response.data.code === 0) {
            return response.data.tenant_access_token;
        } else {
            throw new Error(`Failed to get token: ${response.data.msg}`);
        }
    } catch (error) {
        throw new Error(`Token request failed: ${error.message}`);
    }
}

async function testMessageFormats() {
    console.log('🔍 Testing Feishu API message formats...\n');
    
    const token = await getAccessToken();
    console.log('✅ Access token obtained\n');
    
    const receiveId = config.userId || config.groupId;
    const receiveType = config.userId ? 'user' : 'group';
    
    console.log(`📤 Testing with receive_id: ${receiveId}`);
    console.log(`📤 Testing with receive_type: ${receiveType}\n`);
    
    // Test different receive_id_type parameters
    const idTypes = ['open_id', 'user_id', 'union_id', 'chat_id'];
    
    for (const idType of idTypes) {
        console.log(`🧪 Testing receive_id_type: ${idType}`);
        
        try {
            // Simple text message
            const message = {
                receive_id: receiveId,
                content: JSON.stringify({
                    text: `Test message with ${idType}`
                }),
                msg_type: 'text'
            };
            
            const response = await axios.post(
                `https://open.feishu.cn/open-apis/im/v1/messages?receive_id_type=${idType}`,
                message,
                {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json; charset=utf-8'
                    }
                }
            );
            
            if (response.data.code === 0) {
                console.log(`✅ SUCCESS with ${idType}:`, response.data);
                console.log(`Message ID: ${response.data.data.message_id}\n`);
            } else {
                console.log(`❌ FAILED with ${idType}:`, response.data.msg);
                console.log(`Error code: ${response.data.code}\n`);
            }
        } catch (error) {
            if (error.response) {
                console.log(`❌ ERROR with ${idType}:`, error.response.data.msg);
                console.log(`Error code: ${error.response.data.code}\n`);
            } else {
                console.log(`❌ NETWORK ERROR with ${idType}:`, error.message + '\n');
            }
        }
    }
    
    // Test user info endpoint to verify the user ID format
    console.log('🔍 Testing user info endpoint to verify user ID format...');
    try {
        const userInfoResponse = await axios.get(
            `https://open.feishu.cn/open-apis/contact/v1/user/${receiveId}?user_id_type=open_id`,
            {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json; charset=utf-8'
                }
            }
        );
        
        if (userInfoResponse.data.code === 0) {
            console.log('✅ User info retrieved successfully:');
            console.log('User name:', userInfoResponse.data.user.name);
            console.log('User ID formats:', {
                open_id: userInfoResponse.data.user.open_id,
                union_id: userInfoResponse.data.user.union_id,
                user_id: userInfoResponse.data.user.user_id
            });
        } else {
            console.log('❌ Failed to get user info:', userInfoResponse.data.msg);
        }
    } catch (error) {
        if (error.response) {
            console.log('❌ User info request failed:', error.response.data.msg);
        } else {
            console.log('❌ User info network error:', error.message);
        }
    }
}

testMessageFormats().catch(console.error);