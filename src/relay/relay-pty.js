/**
 * Relay PTY Service
 * 使用 node-pty 管理 Claude Code 进程并注入邮件命令
 */

const { ImapFlow } = require('imapflow');
const { simpleParser } = require('mailparser');
const pino = require('pino');
const { readFileSync, writeFileSync, existsSync } = require('fs');
const { spawn: spawnPty } = require('node-pty');
const dotenv = require('dotenv');
const path = require('path');

// 加载环境变量
dotenv.config();

// 初始化日志
const log = pino({ 
    level: process.env.LOG_LEVEL || 'info',
    transport: {
        target: 'pino-pretty',
        options: {
            colorize: true,
            translateTime: 'HH:MM:ss.l',
            ignore: 'pid,hostname'
        }
    }
});

// 会话映射文件路径
const SESS_PATH = process.env.SESSION_MAP_PATH || path.join(__dirname, '../data/session-map.json');

// PTY 池，管理活跃的 Claude Code 进程
const PTY_POOL = new Map();

// 已处理的邮件ID集合，用于去重
const PROCESSED_MESSAGES = new Set();

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

// 保存会话映射
function saveSessions(map) {
    try {
        const dir = path.dirname(SESS_PATH);
        if (!existsSync(dir)) {
            require('fs').mkdirSync(dir, { recursive: true });
        }
        writeFileSync(SESS_PATH, JSON.stringify(map, null, 2));
    } catch (error) {
        log.error({ error }, 'Failed to save session map');
    }
}

// 标准化允许的发件人列表
function normalizeAllowlist() {
    return (process.env.ALLOWED_SENDERS || '')
        .split(',')
        .map(s => s.trim().toLowerCase())
        .filter(Boolean);
}

const ALLOW = new Set(normalizeAllowlist());

// 检查发件人是否在白名单中
function isAllowed(addressObj) {
    if (!addressObj) return false;
    const list = []
        .concat(addressObj.value || [])
        .map(a => (a.address || '').toLowerCase());
    return list.some(addr => ALLOW.has(addr));
}

// 从主题中提取 TaskPing token
function extractTokenFromSubject(subject = '') {
    // 支持多种格式: [TaskPing #TOKEN], [TaskPing TOKEN], TaskPing: TOKEN
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

// 从会话ID中提取 token (支持向后兼容)
function extractTokenFromSessionId(sessionId) {
    if (!sessionId) return null;
    
    // 如果sessionId本身就是token格式
    if (/^[A-Za-z0-9_-]+$/.test(sessionId)) {
        return sessionId;
    }
    
    // 从UUID格式的sessionId中提取token（如果有映射）
    const sessions = loadSessions();
    for (const [token, session] of Object.entries(sessions)) {
        if (session.sessionId === sessionId) {
            return token;
        }
    }
    
    return null;
}

// 清理邮件回复内容，提取命令
function stripReply(text = '') {
    // 优先识别 ``` 代码块
    const codeBlock = text.match(/```[\s\S]*?```/);
    if (codeBlock) {
        return codeBlock[0].replace(/```/g, '').trim();
    }
    
    // 查找 CMD: 前缀的命令
    const cmdMatch = text.match(/^CMD:\s*(.+)$/im);
    if (cmdMatch) {
        return cmdMatch[1].trim();
    }
    
    // 清理邮件内容，移除引用和签名
    const lines = text.split(/\r?\n/);
    const cleanLines = [];
    
    for (const line of lines) {
        // 检测邮件引用开始标记
        if (line.match(/^>+\s*/) ||  // 引用标记
            line.includes('-----Original Message-----') ||
            line.includes('--- Original Message ---') ||
            line.includes('在') && line.includes('写道:') ||
            line.includes('On') && line.includes('wrote:') ||
            line.includes('会话ID:') ||
            line.includes('Session ID:')) {
            break;
        }
        
        // 检测邮件签名
        if (line.match(/^--\s*$/) || 
            line.includes('Sent from') ||
            line.includes('发自我的')) {
            break;
        }
        
        cleanLines.push(line);
    }
    
    // 获取有效内容的第一行
    const cleanText = cleanLines.join('\n').trim();
    const firstLine = cleanText.split(/\r?\n/).find(l => l.trim().length > 0) || '';
    
    // 长度限制
    return firstLine.slice(0, 8192).trim();
}

// 处理邮件消息
async function handleMailMessage(source, uid) {
    try {
        const parsed = await simpleParser(source);
        
        // 检查是否已处理过
        const messageId = parsed.messageId;
        if (messageId && PROCESSED_MESSAGES.has(messageId)) {
            log.debug({ messageId }, 'Message already processed, skipping');
            return;
        }
        
        // 验证发件人
        if (!isAllowed(parsed.from)) {
            log.warn({ from: parsed.from?.text }, 'Sender not allowed');
            return;
        }
        
        // 提取 token
        const subject = parsed.subject || '';
        let token = extractTokenFromSubject(subject);
        
        // 如果主题中没有token，尝试从邮件头或正文中提取
        if (!token) {
            // 检查自定义邮件头
            const sessionIdHeader = parsed.headers?.get('x-taskping-session-id');
            if (sessionIdHeader) {
                token = extractTokenFromSessionId(sessionIdHeader);
            }
            
            // 从正文中查找会话ID
            if (!token) {
                const bodyText = parsed.text || '';
                const sessionMatch = bodyText.match(/会话ID:\s*([a-f0-9-]{36})/i);
                if (sessionMatch) {
                    token = extractTokenFromSessionId(sessionMatch[1]);
                }
            }
        }
        
        if (!token) {
            log.warn({ subject }, 'No token found in email');
            return;
        }
        
        // 加载会话信息
        const sessions = loadSessions();
        const sess = sessions[token];
        
        if (!sess) {
            log.warn({ token }, 'Session not found');
            return;
        }
        
        // 检查会话是否过期
        if (sess.expiresAt && sess.expiresAt * 1000 < Date.now()) {
            log.warn({ token }, 'Session expired');
            // 清理过期会话
            delete sessions[token];
            saveSessions(sessions);
            return;
        }
        
        // 提取命令
        const cmd = stripReply(parsed.text || parsed.html || '');
        if (!cmd) {
            log.warn({ token }, 'Empty command after stripping');
            return;
        }
        
        // 获取或创建 PTY
        const pty = await getOrCreatePty(token, sess);
        if (!pty) {
            log.error({ token }, 'Failed to get PTY');
            return;
        }
        
        // 注入命令
        log.info({ 
            token, 
            command: cmd.slice(0, 120),
            from: parsed.from?.text 
        }, 'Injecting command to Claude Code');
        
        // 发送命令并按回车
        pty.write(cmd + '\r');
        
        // 标记邮件为已处理
        if (messageId) {
            PROCESSED_MESSAGES.add(messageId);
        }
        
        // 更新会话状态
        sess.lastCommand = cmd;
        sess.lastCommandAt = Date.now();
        sess.commandCount = (sess.commandCount || 0) + 1;
        sessions[token] = sess;
        saveSessions(sessions);
        
    } catch (error) {
        log.error({ error, uid }, 'Error handling mail message');
    }
}

// 获取或创建 PTY 实例
async function getOrCreatePty(token, session) {
    // 检查是否已有 PTY 实例
    if (PTY_POOL.has(token)) {
        const pty = PTY_POOL.get(token);
        // 检查 PTY 是否还活着
        try {
            // node-pty 没有直接的 isAlive 方法，但我们可以尝试写入空字符来测试
            pty.write('');
            return pty;
        } catch (error) {
            log.warn({ token }, 'PTY is dead, removing from pool');
            PTY_POOL.delete(token);
        }
    }
    
    // 创建新的 PTY 实例
    try {
        const shell = process.env.CLAUDE_CLI_PATH || 'claude';
        const args = [];
        
        // 如果会话有特定的工作目录，设置它
        const cwd = session.cwd || process.cwd();
        
        log.info({ token, shell, cwd }, 'Spawning new Claude Code PTY');
        
        const pty = spawnPty(shell, args, {
            name: 'xterm-256color',
            cols: 120,
            rows: 40,
            cwd: cwd,
            env: process.env
        });
        
        // 存储 PTY 实例
        PTY_POOL.set(token, pty);
        
        // 设置输出处理（可选：记录到文件或发送通知）
        pty.onData((data) => {
            // 可以在这里添加输出日志或通知逻辑
            if (process.env.PTY_OUTPUT_LOG === 'true') {
                log.debug({ token, output: data.slice(0, 200) }, 'PTY output');
            }
        });
        
        // 处理 PTY 退出
        pty.onExit(({ exitCode, signal }) => {
            log.info({ token, exitCode, signal }, 'PTY exited');
            PTY_POOL.delete(token);
            
            // 更新会话状态
            const sessions = loadSessions();
            if (sessions[token]) {
                sessions[token].ptyExited = true;
                sessions[token].ptyExitedAt = Date.now();
                saveSessions(sessions);
            }
        });
        
        // 等待 Claude Code 初始化
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        return pty;
        
    } catch (error) {
        log.error({ error, token }, 'Failed to spawn PTY');
        return null;
    }
}

// 启动 IMAP 监听
async function startImap() {
    const client = new ImapFlow({
        host: process.env.IMAP_HOST,
        port: Number(process.env.IMAP_PORT || 993),
        secure: process.env.IMAP_SECURE === 'true',
        auth: { 
            user: process.env.IMAP_USER, 
            pass: process.env.IMAP_PASS 
        },
        logger: false  // 禁用 ImapFlow 的内置日志
    });
    
    try {
        await client.connect();
        log.info('Connected to IMAP server');
        
        // 打开收件箱
        const lock = await client.getMailboxLock('INBOX');
        
        try {
            // 获取最近的未读邮件
            const messages = await client.search({ seen: false });
            if (messages.length > 0) {
                log.info(`Found ${messages.length} unread messages`);
                
                for (const uid of messages) {
                    const { source } = await client.download(uid, '1', { uid: true });
                    const chunks = [];
                    for await (const chunk of source) {
                        chunks.push(chunk);
                    }
                    await handleMailMessage(Buffer.concat(chunks), uid);
                    
                    // 标记为已读
                    await client.messageFlagsAdd(uid, ['\\Seen'], { uid: true });
                }
            }
            
            // 监听新邮件
            log.info('Starting IMAP monitor...');
            
            for await (const msg of client.idle()) {
                if (msg.path === 'INBOX' && msg.type === 'exists') {
                    log.debug({ count: msg.count }, 'New message notification');
                    
                    // 获取最新的邮件
                    const messages = await client.search({ seen: false });
                    for (const uid of messages) {
                        const { source } = await client.download(uid, '1', { uid: true });
                        const chunks = [];
                        for await (const chunk of source) {
                            chunks.push(chunk);
                        }
                        await handleMailMessage(Buffer.concat(chunks), uid);
                        
                        // 标记为已读
                        await client.messageFlagsAdd(uid, ['\\Seen'], { uid: true });
                    }
                }
            }
        } finally {
            lock.release();
        }
    } catch (error) {
        log.error({ error }, 'IMAP error');
        throw error;
    } finally {
        await client.logout();
    }
}

// 清理过期会话和孤儿 PTY
function cleanupSessions() {
    const sessions = loadSessions();
    const now = Date.now();
    let cleaned = 0;
    
    for (const [token, session] of Object.entries(sessions)) {
        // 清理过期会话
        if (session.expiresAt && session.expiresAt * 1000 < now) {
            delete sessions[token];
            cleaned++;
            
            // 终止相关的 PTY
            if (PTY_POOL.has(token)) {
                const pty = PTY_POOL.get(token);
                try {
                    pty.kill();
                } catch (error) {
                    log.warn({ token, error }, 'Failed to kill PTY');
                }
                PTY_POOL.delete(token);
            }
        }
    }
    
    if (cleaned > 0) {
        log.info({ cleaned }, 'Cleaned up expired sessions');
        saveSessions(sessions);
    }
}

// 主函数
async function main() {
    // 验证配置
    const required = ['IMAP_HOST', 'IMAP_USER', 'IMAP_PASS'];
    const missing = required.filter(key => !process.env[key]);
    
    if (missing.length > 0) {
        log.error({ missing }, 'Missing required environment variables');
        process.exit(1);
    }
    
    // 显示配置信息
    log.info({
        mode: 'pty',
        imapHost: process.env.IMAP_HOST,
        imapUser: process.env.IMAP_USER,
        allowedSenders: Array.from(ALLOW),
        sessionMapPath: SESS_PATH
    }, 'Starting relay-pty service');
    
    // 定期清理
    setInterval(cleanupSessions, 5 * 60 * 1000); // 每5分钟清理一次
    
    // 处理退出信号
    process.on('SIGINT', () => {
        log.info('Shutting down...');
        
        // 终止所有 PTY
        for (const [token, pty] of PTY_POOL.entries()) {
            try {
                pty.kill();
            } catch (error) {
                log.warn({ token }, 'Failed to kill PTY on shutdown');
            }
        }
        
        process.exit(0);
    });
    
    // 启动 IMAP 监听
    while (true) {
        try {
            await startImap();
        } catch (error) {
            log.error({ error }, 'IMAP connection lost, retrying in 30s...');
            await new Promise(resolve => setTimeout(resolve, 30000));
        }
    }
}

// 仅在作为主模块运行时启动
if (require.main === module) {
    main().catch(error => {
        log.error({ error }, 'Fatal error');
        process.exit(1);
    });
}

module.exports = {
    handleMailMessage,
    getOrCreatePty,
    extractTokenFromSubject,
    stripReply
};