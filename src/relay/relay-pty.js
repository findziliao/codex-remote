#!/usr/bin/env node

/**
 * relay-pty.js - 修复版本
 * 使用 node-imap 替代 ImapFlow 来解决飞书邮箱兼容性问题
 */

require('dotenv').config();
const Imap = require('node-imap');
const { simpleParser } = require('mailparser');
const { spawn } = require('node-pty');
const { existsSync, readFileSync, writeFileSync } = require('fs');
const path = require('path');
const pino = require('pino');

// 配置日志
const log = pino({
    level: process.env.LOG_LEVEL || 'info',
    transport: {
        target: 'pino-pretty',
        options: {
            colorize: true,
            translateTime: 'HH:MM:ss'
        }
    }
});

// 全局配置
const SESS_PATH = process.env.SESSION_MAP_PATH || path.join(__dirname, '../data/session-map.json');
const PROCESSED_PATH = path.join(__dirname, '../data/processed-messages.json');
const ALLOWED_SENDERS = (process.env.ALLOWED_SENDERS || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
const PTY_POOL = new Map();
let PROCESSED_MESSAGES = new Set();

// 加载已处理消息
function loadProcessedMessages() {
    if (existsSync(PROCESSED_PATH)) {
        try {
            const data = JSON.parse(readFileSync(PROCESSED_PATH, 'utf8'));
            const now = Date.now();
            // 只保留7天内的记录
            const validMessages = data.filter(item => (now - item.timestamp) < 7 * 24 * 60 * 60 * 1000);
            PROCESSED_MESSAGES = new Set(validMessages.map(item => item.id));
            // 更新文件，移除过期记录
            saveProcessedMessages();
        } catch (error) {
            log.error({ error }, 'Failed to load processed messages');
            PROCESSED_MESSAGES = new Set();
        }
    }
}

// 保存已处理消息
function saveProcessedMessages() {
    try {
        const now = Date.now();
        const data = Array.from(PROCESSED_MESSAGES).map(id => ({
            id,
            timestamp: now
        }));
        
        // 确保目录存在
        const dir = path.dirname(PROCESSED_PATH);
        if (!existsSync(dir)) {
            require('fs').mkdirSync(dir, { recursive: true });
        }
        
        writeFileSync(PROCESSED_PATH, JSON.stringify(data, null, 2));
    } catch (error) {
        log.error({ error }, 'Failed to save processed messages');
    }
}

// 加载会话映射
function loadSessions() {
    if (!existsSync(SESS_PATH)) return {};
    try {
        return JSON.parse(readFileSync(SESS_PATH, 'utf8'));
    } catch (error) {
        log.error({ error }, 'Failed to load session map');
        return {};
    }
}

// 检查发件人是否在白名单中
function isAllowed(fromAddress) {
    if (!fromAddress) return false;
    const addr = fromAddress.toLowerCase();
    return ALLOWED_SENDERS.some(allowed => addr.includes(allowed));
}

// 从主题中提取 TaskPing token
function extractTokenFromSubject(subject = '') {
    const patterns = [
        /\[TaskPing\s+#([A-Za-z0-9_-]+)\]/,
        /\[TaskPing\s+([A-Za-z0-9_-]+)\]/,
        /TaskPing:\s*([A-Za-z0-9_-]+)/i
    ];
    
    for (const pattern of patterns) {
        const match = subject.match(pattern);
        if (match) return match[1];
    }
    
    return null;
}

// 清理邮件正文
function cleanEmailText(text = '') {
    const lines = text.split(/\r?\n/);
    const cleanLines = [];
    
    for (const line of lines) {
        // 检测引用内容（更全面的检测）
        if (line.includes('-----Original Message-----') ||
            line.includes('--- Original Message ---') ||
            line.includes('在') && line.includes('写道:') ||
            line.includes('On') && line.includes('wrote:') ||
            line.includes('会话ID:') ||
            line.includes('Session ID:') ||
            line.includes('<noreply@pandalla.ai>') ||
            line.includes('TaskPing 通知系统') ||
            line.includes('于2025年') && line.includes('写道：') ||
            line.match(/^>.*/) ||  // 引用行以 > 开头
            line.includes('From:') && line.includes('@') ||
            line.includes('To:') && line.includes('@') ||
            line.includes('Subject:') ||
            line.includes('Sent:') ||
            line.includes('Date:')) {
            break;
        }
        
        // 检测邮件签名
        if (line.match(/^--\s*$/) || 
            line.includes('Sent from') ||
            line.includes('发自我的') ||
            line.includes('Best regards') ||
            line.includes('此致敬礼')) {
            break;
        }
        
        cleanLines.push(line);
    }
    
    // 获取有效内容
    const cleanText = cleanLines.join('\n').trim();
    
    // 查找实际的命令内容（跳过问候语等）
    const contentLines = cleanText.split(/\r?\n/).filter(l => l.trim().length > 0);
    
    // 查找命令行（通常是包含实际命令的行）
    for (const line of contentLines) {
        const trimmedLine = line.trim();
        // 跳过常见的问候语
        if (trimmedLine.match(/^(hi|hello|谢谢|thanks|好的|ok|是的|yes)/i)) {
            continue;
        }
        // 跳过纯中文问候
        if (trimmedLine.match(/^(这是|请|帮我|您好)/)) {
            continue;
        }
        // 跳过邮件引用残留
        if (trimmedLine.includes('TaskPing 通知系统') ||
            trimmedLine.includes('<noreply@pandalla.ai>') ||
            trimmedLine.includes('于2025年')) {
            continue;
        }
        // 如果找到疑似命令的行，检查并去重
        if (trimmedLine.length > 3) {
            const command = trimmedLine.slice(0, 8192);
            // 检查命令是否重复（如："喝可乐好吗喝可乐好吗"）
            const deduplicatedCommand = deduplicateCommand(command);
            return deduplicatedCommand;
        }
    }
    
    // 如果没有找到明显的命令，返回第一行非空内容（并去重）
    const firstLine = contentLines[0] || '';
    const command = firstLine.slice(0, 8192).trim();
    return deduplicateCommand(command);
}

// 去重复的命令文本（处理如："喝可乐好吗喝可乐好吗" -> "喝可乐好吗"）
function deduplicateCommand(command) {
    if (!command || command.length === 0) {
        return command;
    }
    
    // 检查命令是否是自己重复的
    const length = command.length;
    for (let i = 1; i <= Math.floor(length / 2); i++) {
        const firstPart = command.substring(0, i);
        const remaining = command.substring(i);
        
        // 检查剩余部分是否完全重复第一部分
        if (remaining === firstPart.repeat(Math.floor(remaining.length / firstPart.length))) {
            // 找到重复模式，返回第一部分
            log.debug({ 
                originalCommand: command, 
                deduplicatedCommand: firstPart,
                pattern: firstPart
            }, 'Detected and removed command duplication');
            return firstPart;
        }
    }
    
    // 没有检测到重复，返回原命令
    return command;
}

// 无人值守远程命令注入 - tmux优先，智能备用
async function injectCommandRemote(token, command) {
    const sessions = loadSessions();
    const session = sessions[token];
    
    if (!session) {
        log.warn({ token }, 'Session not found');
        return false;
    }
    
    // 检查会话是否过期
    const now = Math.floor(Date.now() / 1000);
    if (session.expiresAt && session.expiresAt < now) {
        log.warn({ token }, 'Session expired');
        return false;
    }
    
    try {
        log.info({ token, command }, 'Starting remote command injection');
        
        // 方法1: 优先使用tmux无人值守注入
        const TmuxInjector = require('./tmux-injector');
        const tmuxSessionName = session.tmuxSession || 'claude-taskping';
        const tmuxInjector = new TmuxInjector(log, tmuxSessionName);
        
        const tmuxResult = await tmuxInjector.injectCommandFull(token, command);
        
        if (tmuxResult.success) {
            log.info({ token, session: tmuxResult.session }, 'Tmux remote injection successful');
            return true;
        } else {
            log.warn({ token, error: tmuxResult.error }, 'Tmux injection failed, trying smart fallback');
            
            // 方法2: 回退到智能注入器
            const SmartInjector = require('./smart-injector');
            const smartInjector = new SmartInjector(log);
            
            const smartResult = await smartInjector.injectCommand(token, command);
            
            if (smartResult) {
                log.info({ token }, 'Smart injection fallback successful');
                return true;
            } else {
                log.error({ token }, 'All remote injection methods failed');
                return false;
            }
        }
        
    } catch (error) {
        log.error({ error, token }, 'Failed to inject command remotely');
        return false;
    }
}

// 尝试自动粘贴到活跃窗口
async function tryAutoPaste(command) {
    return new Promise((resolve) => {
        // 先复制命令到剪贴板
        const { spawn } = require('child_process');
        const pbcopy = spawn('pbcopy');
        pbcopy.stdin.write(command);
        pbcopy.stdin.end();
        
        pbcopy.on('close', (code) => {
            if (code !== 0) {
                resolve({ success: false, error: 'clipboard_copy_failed' });
                return;
            }
            
            // 执行AppleScript自动粘贴
            const autoScript = `
            tell application "System Events"
                set claudeApps to {"Claude", "Claude Code", "Terminal", "iTerm2", "iTerm"}
                set targetApp to null
                set targetName to ""
                
                repeat with appName in claudeApps
                    try
                        if application process appName exists then
                            set targetApp to application process appName
                            set targetName to appName
                            exit repeat
                        end if
                    end try
                end repeat
                
                if targetApp is not null then
                    set frontmost of targetApp to true
                    delay 0.8
                    
                    repeat 10 times
                        if frontmost of targetApp then exit repeat
                        delay 0.1
                    end repeat
                    
                    if targetName is in {"Terminal", "iTerm2", "iTerm"} then
                        keystroke "${command.replace(/"/g, '\\"')}"
                        delay 0.3
                        keystroke return
                        return "terminal_typed"
                    else
                        keystroke "a" using command down
                        delay 0.2
                        keystroke "v" using command down
                        delay 0.5
                        keystroke return
                        return "claude_pasted"
                    end if
                else
                    return "no_target_found"
                end if
            end tell
            `;
            
            const { exec } = require('child_process');
            exec(`osascript -e '${autoScript}'`, (error, stdout, stderr) => {
                if (error) {
                    resolve({ success: false, error: error.message });
                    return;
                }
                
                const result = stdout.trim();
                
                switch(result) {
                    case 'terminal_typed':
                        resolve({ success: true, method: '终端直接输入' });
                        break;
                    case 'claude_pasted':
                        resolve({ success: true, method: 'Claude应用粘贴' });
                        break;
                    case 'no_target_found':
                        resolve({ success: false, error: 'no_target_application' });
                        break;
                    default:
                        resolve({ success: false, error: `unknown_result: ${result}` });
                }
            });
        });
    });
}

// 回退到剪贴板+强提醒
async function fallbackToClipboard(command) {
    return new Promise((resolve) => {
        // 复制到剪贴板
        const { spawn } = require('child_process');
        const pbcopy = spawn('pbcopy');
        pbcopy.stdin.write(command);
        pbcopy.stdin.end();
        
        pbcopy.on('close', (code) => {
            if (code !== 0) {
                resolve(false);
                return;
            }
            
            // 发送强提醒通知
            const shortCommand = command.length > 30 ? command.substring(0, 30) + '...' : command;
            const notificationScript = `
                display notification "🚨 邮件命令已自动复制！请立即在Claude Code中粘贴执行 (Cmd+V)" with title "TaskPing 自动注入" subtitle "${shortCommand.replace(/"/g, '\\"')}" sound name "Basso"
            `;
            
            const { exec } = require('child_process');
            exec(`osascript -e '${notificationScript}'`, (error) => {
                if (error) {
                    log.warn({ error: error.message }, 'Failed to send notification');
                } else {
                    log.info('Strong reminder notification sent');
                }
                resolve(true);
            });
        });
    });
}

// 处理邮件消息
async function handleMailMessage(parsed) {
    try {
        log.debug({ uid: parsed.uid, messageId: parsed.messageId }, 'handleMailMessage called');
        // 简化的重复检测（UID已在前面检查过）
        const uid = parsed.uid;
        const messageId = parsed.messageId;
        
        // 仅对没有UID的邮件进行额外检查
        if (!uid) {
            const identifier = messageId;
            if (identifier && PROCESSED_MESSAGES.has(identifier)) {
                log.debug({ messageId, identifier }, 'Message already processed by messageId, skipping');
                return;
            }
            
            // 内容哈希去重（作为最后手段）
            const emailSubject = parsed.subject || '';
            const emailDate = parsed.date || new Date();
            const contentHash = `${emailSubject}_${emailDate.getTime()}`;
            
            if (PROCESSED_MESSAGES.has(contentHash)) {
                log.debug({ subject: emailSubject, date: emailDate, contentHash }, 'Message already processed by content hash, skipping');
                return;
            }
        }
        
        // 验证发件人
        if (!isAllowed(parsed.from?.text || '')) {
            log.warn({ from: parsed.from?.text }, 'Sender not allowed');
            return;
        }
        
        // 提取token
        const subject = parsed.subject || '';
        const token = extractTokenFromSubject(subject);
        
        if (!token) {
            log.warn({ subject }, 'No token found in email');
            return;
        }
        
        // 提取命令 - 添加详细调试
        log.debug({ 
            token, 
            rawEmailText: parsed.text?.substring(0, 500),
            emailSubject: parsed.subject 
        }, 'Raw email content before cleaning');
        
        const command = cleanEmailText(parsed.text);
        
        log.debug({ 
            token, 
            cleanedCommand: command,
            commandLength: command?.length 
        }, 'Email content after cleaning');
        
        if (!command) {
            log.warn({ token }, 'No command found in email');
            return;
        }
        
        log.info({ token, command }, 'Processing email command');
        
        // 无人值守远程命令注入（tmux优先，智能备用）
        const success = await injectCommandRemote(token, command);
        
        if (!success) {
            log.warn({ token }, 'Could not inject command');
            return;
        }
        
        // 标记为已处理（只在成功处理后标记）
        if (uid) {
            // 标记UID为已处理
            PROCESSED_MESSAGES.add(uid);
            log.debug({ uid }, 'Marked message UID as processed');
        } else {
            // 没有UID的邮件，使用messageId和内容哈希
            if (messageId) {
                PROCESSED_MESSAGES.add(messageId);
                log.debug({ messageId }, 'Marked message as processed by messageId');
            }
            
            // 内容哈希标记
            const emailSubject = parsed.subject || '';
            const emailDate = parsed.date || new Date();
            const contentHash = `${emailSubject}_${emailDate.getTime()}`;
            PROCESSED_MESSAGES.add(contentHash);
            log.debug({ contentHash }, 'Marked message as processed by content hash');
        }
        
        // 持久化已处理消息
        saveProcessedMessages();
        
        log.info({ token }, 'Command injected successfully via remote method');
        
    } catch (error) {
        log.error({ error }, 'Failed to handle email message');
    }
}

// 启动IMAP监听
function startImap() {
    // 首先加载已处理消息
    loadProcessedMessages();
    
    log.info('Starting relay-pty service', {
        mode: 'pty',
        imapHost: process.env.IMAP_HOST,
        imapUser: process.env.IMAP_USER,
        allowedSenders: ALLOWED_SENDERS,
        sessionMapPath: SESS_PATH,
        processedCount: PROCESSED_MESSAGES.size
    });
    
    const imap = new Imap({
        user: process.env.IMAP_USER,
        password: process.env.IMAP_PASS,
        host: process.env.IMAP_HOST,
        port: parseInt(process.env.IMAP_PORT) || 993,
        tls: process.env.IMAP_SECURE === 'true',
        connTimeout: 60000,
        authTimeout: 30000,
        keepalive: true
    });
    
    imap.once('ready', function() {
        log.info('Connected to IMAP server');
        
        imap.openBox('INBOX', false, function(err, box) {
            if (err) {
                log.error({ error: err.message }, 'Failed to open INBOX');
                return;
            }
            
            log.info(`Mailbox opened: ${box.messages.total} total messages, ${box.messages.new} new`);
            
            // 只在启动时处理现有的未读邮件
            processExistingEmails(imap);
            
            // 监听新邮件（主要机制）
            imap.on('mail', function(numNewMsgs) {
                log.info({ newMessages: numNewMsgs }, 'New mail arrived');
                // 增加延迟，避免与现有邮件处理冲突
                setTimeout(() => {
                    processNewEmails(imap);
                }, 1000);
            });
            
            // 定期检查新邮件（仅作为备用，延长间隔）
            setInterval(() => {
                log.debug('Periodic email check...');
                processNewEmails(imap);
            }, 120000); // 每2分钟检查一次，减少频率
        });
    });
    
    imap.once('error', function(err) {
        log.error({ error: err.message }, 'IMAP error');
        // 重连机制
        setTimeout(() => {
            log.info('Attempting to reconnect...');
            startImap();
        }, 10000);
    });
    
    imap.once('end', function() {
        log.info('IMAP connection ended');
    });
    
    imap.connect();
    
    // 优雅关闭
    process.on('SIGINT', () => {
        log.info('Shutting down gracefully...');
        imap.end();
        process.exit(0);
    });
}

// 处理现有邮件
function processExistingEmails(imap) {
    // 搜索未读邮件
    imap.search(['UNSEEN'], function(err, results) {
        if (err) {
            log.error({ error: err.message }, 'Failed to search emails');
            return;
        }
        
        if (results.length > 0) {
            log.info(`Found ${results.length} unread messages`);
            log.debug({ uids: results }, 'Unread message UIDs');
            fetchAndProcessEmails(imap, results);
        } else {
            log.debug('No unread messages found');
        }
    });
}

// 处理新邮件
function processNewEmails(imap) {
    // 搜索最近5分钟的邮件
    const since = new Date();
    since.setMinutes(since.getMinutes() - 5);
    const sinceStr = since.toISOString().split('T')[0]; // YYYY-MM-DD
    
    imap.search([['SINCE', sinceStr], 'UNSEEN'], function(err, results) {
        if (err) {
            log.error({ error: err.message }, 'Failed to search new emails');
            return;
        }
        
        if (results.length > 0) {
            log.info(`Found ${results.length} new messages`);
            fetchAndProcessEmails(imap, results);
        }
    });
}

// 获取并处理邮件
function fetchAndProcessEmails(imap, uids) {
    log.debug({ uids }, 'Starting to fetch emails');
    const fetch = imap.fetch(uids, { 
        bodies: '',  // 获取完整邮件
        markSeen: true  // 标记为已读
    });
    
    fetch.on('message', function(msg, seqno) {
        let buffer = '';
        let messageUid = null;
        let skipProcessing = false;
        let bodyProcessed = false;
        let attributesReceived = false;
        
        // 获取UID以防重复处理
        msg.once('attributes', function(attrs) {
            messageUid = attrs.uid;
            attributesReceived = true;
            log.debug({ uid: messageUid, seqno }, 'Received attributes');
            
            // 只检查是否已处理，不要立即标记
            if (messageUid && PROCESSED_MESSAGES.has(messageUid)) {
                log.debug({ uid: messageUid, seqno }, 'Message UID already processed, skipping entire message');
                skipProcessing = true;
                return; // 直接返回，不继续处理
            }
            log.debug({ uid: messageUid, seqno }, 'Message UID ready for processing');
            
            // 如果body已经处理完了，现在可以解析邮件
            if (bodyProcessed && !skipProcessing) {
                processEmailBuffer(buffer, messageUid, seqno);
            }
        });
        
        msg.on('body', function(stream, info) {
            stream.on('data', function(chunk) {
                buffer += chunk.toString('utf8');
            });
            
            stream.once('end', function() {
                bodyProcessed = true;
                log.debug({ uid: messageUid, seqno, bufferLength: buffer.length, attributesReceived }, 'Body stream ended');
                
                // 如果attributes已经收到且没有标记跳过，现在可以解析邮件
                if (attributesReceived && !skipProcessing) {
                    processEmailBuffer(buffer, messageUid, seqno);
                }
            });
        });
        
        // 分离出的邮件处理函数
        function processEmailBuffer(buffer, uid, seqno) {
            if (buffer.length > 0 && uid) {
                log.debug({ uid, seqno }, 'Starting email parsing');
                simpleParser(buffer, function(err, parsed) {
                    if (err) {
                        log.error({ error: err.message, seqno, uid }, 'Failed to parse email');
                        PROCESSED_MESSAGES.delete(uid);
                    } else {
                        log.debug({ uid, seqno }, 'Email parsed successfully, calling handleMailMessage');
                        parsed.uid = uid;
                        handleMailMessage(parsed);
                    }
                });
            } else {
                log.debug({ uid, seqno, bufferLength: buffer.length }, 'Skipping email - no buffer or uid');
            }
        }
        
        msg.once('error', function(err) {
            log.error({ error: err.message, seqno, uid: messageUid }, 'Error fetching message');
        });
    });
    
    fetch.once('error', function(err) {
        log.error({ error: err.message }, 'Error fetching emails');
    });
    
    fetch.once('end', function() {
        log.debug('Email fetch completed');
    });
}

// 启动服务
if (require.main === module) {
    startImap();
}

module.exports = {
    startImap,
    handleMailMessage,
    extractTokenFromSubject,
    cleanEmailText
};