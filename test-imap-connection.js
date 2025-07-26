#!/usr/bin/env node

/**
 * 测试 IMAP 连接
 * 验证邮箱服务器连接和邮件读取
 */

const { ImapFlow } = require('imapflow');
const { simpleParser } = require('mailparser');
require('dotenv').config();

async function testImapConnection() {
    console.log('🔍 测试 IMAP 连接...\n');
    
    const client = new ImapFlow({
        host: process.env.IMAP_HOST,
        port: Number(process.env.IMAP_PORT || 993),
        secure: process.env.IMAP_SECURE === 'true',
        auth: { 
            user: process.env.IMAP_USER, 
            pass: process.env.IMAP_PASS 
        },
        logger: false
    });
    
    try {
        console.log(`连接到: ${process.env.IMAP_HOST}:${process.env.IMAP_PORT}`);
        console.log(`账号: ${process.env.IMAP_USER}`);
        console.log(`SSL: ${process.env.IMAP_SECURE}`);
        console.log('');
        
        // 连接
        await client.connect();
        console.log('✅ IMAP 连接成功');
        
        // 打开收件箱
        const lock = await client.getMailboxLock('INBOX');
        console.log('✅ 收件箱已打开');
        
        try {
            // 获取邮箱状态
            const status = await client.status('INBOX', { 
                messages: true, 
                unseen: true, 
                recent: true 
            });
            console.log(`📧 邮箱状态:`);
            console.log(`   总邮件数: ${status.messages}`);
            console.log(`   未读邮件: ${status.unseen}`);
            console.log(`   新邮件: ${status.recent}`);
            console.log('');
            
            // 搜索未读邮件
            const unseenMessages = await client.search({ seen: false });
            console.log(`🔍 找到 ${unseenMessages.length} 封未读邮件`);
            
            if (unseenMessages.length > 0) {
                console.log('📋 未读邮件列表:');
                
                // 只处理最近的5封邮件
                const recentMessages = unseenMessages.slice(-5);
                
                for (const uid of recentMessages) {
                    try {
                        console.log(`\n📧 处理邮件 UID: ${uid}`);
                        
                        // 获取邮件头信息
                        const envelope = await client.fetchOne(uid, { 
                            envelope: true,
                            flags: true
                        }, { uid: true });
                        
                        console.log(`   发件人: ${envelope.envelope?.from?.[0]?.address || 'unknown'}`);
                        console.log(`   主题: ${envelope.envelope?.subject || 'no subject'}`);
                        console.log(`   日期: ${envelope.envelope?.date?.toLocaleString('zh-CN') || 'unknown'}`);
                        console.log(`   标志: ${Array.isArray(envelope.flags) ? envelope.flags.join(', ') : 'none'}`);
                        
                        // 下载并解析邮件
                        const message = await client.fetchOne(uid, { 
                            source: true 
                        }, { uid: true });
                        
                        if (!message || !message.source) {
                            console.log(`   ⚠️  无法获取邮件内容`);
                            continue;
                        }
                        
                        const chunks = [];
                        for await (const chunk of message.source) {
                            chunks.push(chunk);
                        }
                        
                        const parsed = await simpleParser(Buffer.concat(chunks));
                        
                        // 检查是否是 TaskPing 相关邮件
                        const isTaskPingReply = parsed.subject?.includes('TaskPing') || 
                                              parsed.subject?.includes('[TaskPing') ||
                                              parsed.text?.includes('TaskPing') ||
                                              parsed.headers?.get('x-taskping-session-id');
                        
                        if (isTaskPingReply) {
                            console.log(`   🎯 这是 TaskPing 相关邮件！`);
                            console.log(`   正文预览: ${(parsed.text || '').substring(0, 100)}...`);
                            
                            // 尝试提取 Token
                            const tokenMatch = parsed.subject?.match(/\[TaskPing\s+#([A-Za-z0-9_-]+)\]/);
                            if (tokenMatch) {
                                console.log(`   🔑 找到 Token: ${tokenMatch[1]}`);
                            }
                        } else {
                            console.log(`   ℹ️  非 TaskPing 邮件，跳过`);
                        }
                        
                    } catch (messageError) {
                        console.log(`   ❌ 处理邮件失败: ${messageError.message}`);
                    }
                }
            }
            
        } finally {
            lock.release();
        }
        
        console.log('\n✅ IMAP 测试完成');
        
    } catch (error) {
        console.error('\n❌ IMAP 连接失败:', error.message);
        console.log('\n可能的原因:');
        console.log('1. 邮箱服务器地址或端口错误');
        console.log('2. 用户名或密码错误');
        console.log('3. IMAP 服务未开启');
        console.log('4. 网络连接问题');
        console.log('5. SSL/TLS 配置错误');
        
        if (error.code) {
            console.log(`\n错误代码: ${error.code}`);
        }
        
    } finally {
        await client.logout();
    }
}

// 主函数
async function main() {
    console.log('╔══════════════════════════════════════════════════════════╗');
    console.log('║             TaskPing IMAP Connection Test                 ║');
    console.log('╚══════════════════════════════════════════════════════════╝\n');
    
    // 检查配置
    if (!process.env.IMAP_HOST || !process.env.IMAP_USER || !process.env.IMAP_PASS) {
        console.error('❌ 缺少 IMAP 配置，请检查 .env 文件');
        process.exit(1);
    }
    
    await testImapConnection();
}

// 运行
main().catch(console.error);