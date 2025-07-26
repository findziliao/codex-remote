# TaskPing — 邮件回复写回 Claude Code CLI（执行手册）

> 目标读者：能执行脚本的 AI/自动化代理  
> 运行环境：Linux/macOS（建议），Node.js ≥ 18，Claude Code 已安装并可在终端运行 `claude`

---

## 1. 背景与目标

**项目背景**：用户在本机通过 Claude Code（CLI）进行编码。当前已实现：
- 通过 hooks 在任务结束/等待下一步时**发出邮件提醒**；
- 用户在手机上**回复邮件**；
- 本机有一个常驻“中继/Relay”进程轮询收件箱，能够拿到该回复。

**当前卡点**：**把邮件正文写回到对应的 Claude Code CLI 会话，并回车执行**。

**本文档目的**：为 AI/自动化代理提供两种可执行的落地方案：
1) **子进程/PTY 模式**：用 `node-pty` 驱动一个 Claude Code 子进程，直接向伪终端写入并回车；  
2) **tmux 模式**：让 Claude Code 运行在指定 `tmux` pane，收到邮件后用 `tmux send-keys` 注入文本并回车。

两种方案都要求：
- 能**路由**到正确的 Claude 会话；
- 能**清洗**邮件正文，仅保留要注入的命令；
- 有**安全**与**幂等**控制；
- 有**可观测性**（日志/Tracing）。

---

## 2. 全局约束与安全要求

- **会话识别**：优先按 `In-Reply-To` 的 `Message-ID` 匹配；回退使用 `Subject` 中的 token（形如 `[TaskPing #ABC123]`）。
- **白名单**：仅允许来自配置的发件人域/邮箱（通过 SPF/DKIM/DMARC 验证后再放行）。
- **正文提取**：只取**最新回复**；去除历史引用、签名、HTML 标签、图片占位。支持三种输入：
  - 纯文本一行命令；
  - 代码块 ``` 包起来的命令（优先级最高）；
  - 主题/首行以 `CMD:` 前缀标识。
- **幂等**：用 `Message-ID` 或 `gmailThreadId` 去重（重复投递不再次注入）。
- **限流**：同一会话每分钟最多 1 条；单条长度上限（例如 8KB）。
- **日志**：记录 token、会话、pane/pty id、注入摘要（前 120 字符），屏蔽隐私。

---

## 3. 公共依赖与配置

### 3.1 依赖（Node.js）
```bash
npm i imapflow mailparser node-pty pino dotenv execa
# tmux 方案需要系统安装 tmux：macOS: brew install tmux；Debian/Ubuntu: apt-get install tmux
```

### 3.2 环境变量（`.env`）
```bash
# 邮件接收
IMAP_HOST=imap.example.com
IMAP_PORT=993
IMAP_SECURE=true
IMAP_USER=bot@example.com
IMAP_PASS=********

# 邮件路由安全
ALLOWED_SENDERS=jessy@example.com,panda@company.com

# 路由与会话存储（JSON 文件路径）
SESSION_MAP_PATH=/var/lib/taskping/session-map.json

# 模式选择：pty 或 tmux
INJECTION_MODE=pty

# tmux 方案可选：默认 session/pane 名称前缀
TMUX_SESSION_PREFIX=taskping
```

### 3.3 会话映射（`SESSION_MAP_PATH`）
结构示例：
```json
{
  "ABC123": {
    "type": "pty",
    "ptyId": "b4c1...",
    "createdAt": 1732672100,
    "expiresAt": 1732679300,
    "messageId": "<CA+abc@mail.example.com>",
    "imapUid": 12345
  },
  "XYZ789": {
    "type": "tmux",
    "session": "taskping-XYZ789",
    "pane": "taskping-XYZ789.0",
    "createdAt": 1732672200,
    "expiresAt": 1732679400,
    "messageId": "<CA+xyz@mail.example.com>"
  }
}
```
> 注：会话映射由**发送提醒时**创建（包含 token 与目标 CLI 会话信息）。

---

## 4. 方案一：子进程/PTY 模式（推荐）

### 4.1 适用场景
- 由中继程序**直接管理** Claude Code 生命周期；
- 需要最稳定的注入通道（不依赖额外终端复用器）。

### 4.2 实现思路
- 用 `node-pty` `spawn('claude', [...])` 启动 CLI；
- 将返回的 `pty` 与生成的 token 绑定，写入 `SESSION_MAP_PATH`；
- 收到邮件 → 路由 token → 清洗正文 → `pty.write(cmd + '\r')`；
- 监控 `pty.onData`，必要时截取摘要回传提醒（可选）。

### 4.3 关键代码骨架（`relay-pty.js`）
```js
import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';
import pino from 'pino';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { spawn as spawnPty } from 'node-pty';
import dotenv from 'dotenv';

dotenv.config();
const log = pino({ level: 'info' });
const SESS_PATH = process.env.SESSION_MAP_PATH;

function loadSessions() {
  if (!existsSync(SESS_PATH)) return {};
  return JSON.parse(readFileSync(SESS_PATH, 'utf8'));
}
function saveSessions(map) {
  writeFileSync(SESS_PATH, JSON.stringify(map, null, 2));
}

function normalizeAllowlist() {
  return (process.env.ALLOWED_SENDERS || '')
    .split(',')
    .map(s => s.trim().toLowerCase())
    .filter(Boolean);
}
const ALLOW = new Set(normalizeAllowlist());

function isAllowed(addressObj) {
  const list = []
    .concat(addressObj?.value || [])
    .map(a => (a.address || '').toLowerCase());
  return list.some(addr => ALLOW.has(addr));
}

function extractTokenFromSubject(subject = '') {
  const m = subject.match(/\[TaskPing\s+#([A-Za-z0-9_-]+)\]/);
  return m ? m[1] : null;
}

function stripReply(text = '') {
  // 优先识别 ``` 块
  const codeBlock = text.match(/```[\s\S]*?```/);
  if (codeBlock) {
    return codeBlock[0].replace(/```/g, '').trim();
  }
  // 取首行或以 CMD: 前缀
  const firstLine = text.split(/\r?\n/).find(l => l.trim().length > 0) || '';
  const cmdPrefix = firstLine.match(/^CMD:\s*(.+)$/i);
  const candidate = (cmdPrefix ? cmdPrefix[1] : firstLine).trim();

  // 去除引用与签名
  return candidate
    .replace(/^>.*$/gm, '')
    .replace(/^--\s+[\s\S]*$/m, '')
    .slice(0, 8192) // 长度限制
    .trim();
}

async function handleMailMessage(source) {
  const parsed = await simpleParser(source);
  if (!isAllowed(parsed.from)) {
    log.warn({ from: parsed.from?.text }, 'sender not allowed');
    return;
  }

  const subject = parsed.subject || '';
  const token = extractTokenFromSubject(subject);
  if (!token) {
    log.warn({ subject }, 'no token in subject');
    return;
  }

  const sessions = loadSessions();
  const sess = sessions[token];
  if (!sess || sess.expiresAt * 1000 < Date.now()) {
    log.warn({ token }, 'session not found or expired');
    return;
  }
  if (sess.type !== 'pty' || !sess.ptyId) {
    log.error({ token }, 'session is not pty type');
    return;
  }

  const cmd = stripReply(parsed.text || parsed.html || '');
  if (!cmd) {
    log.warn({ token }, 'empty command after strip');
    return;
  }

  // 取得 pty 实例：这里演示为“按需重建/保持单例”两种策略之一
  const pty = getOrRestorePty(sess);
  log.info({ token, cmd: cmd.slice(0, 120) }, 'inject command');
  pty.write(cmd + '\r');
}

const PTY_POOL = new Map();
function getOrRestorePty(sess) {
  if (PTY_POOL.has(sess.ptyId)) return PTY_POOL.get(sess.ptyId);

  // 如果需要重建，会话应当保存启动参数；这里演示简化为新起一个 claude
  const shell = 'claude'; // 或绝对路径
  const pty = spawnPty(shell, [], {
    name: 'xterm-color',
    cols: 120,
    rows: 32
  });
  PTY_POOL.set(sess.ptyId, pty);
  pty.onData(d => process.stdout.write(d)); // 可替换为日志/回传
  pty.onExit(() => PTY_POOL.delete(sess.ptyId));
  return pty;
}

async function startImap() {
  const client = new ImapFlow({
    host: process.env.IMAP_HOST,
    port: Number(process.env.IMAP_PORT || 993),
    secure: process.env.IMAP_SECURE === 'true',
    auth: { user: process.env.IMAP_USER, pass: process.env.IMAP_PASS }
  });
  await client.connect();
  const lock = await client.getMailboxLock('INBOX');
  try {
    for await (const msg of client.monitor()) {
      if (msg.type === 'exists') {
        const { uid } = msg;
        const { source } = await client.download('INBOX', uid);
        const chunks = [];
        for await (const c of source) chunks.push(c);
        await handleMailMessage(Buffer.concat(chunks));
      }
    }
  } finally {
    lock.release();
  }
}

if (process.env.INJECTION_MODE === 'pty') {
  startImap().catch(err => {
    console.error(err);
    process.exit(1);
  });
}
```

> 说明：生产化时，建议在**发送提醒**一侧创建会话并持久化 `ptyId` 与参数；这里演示了“按需复原”的简化路径。

### 4.4 启动
```bash
node relay-pty.js
```

### 4.5 验收清单
- [ ] 未授权邮箱无法触发注入；  
- [ ] 合法邮件写入后，Claude Code 能立即进入下一步；  
- [ ] 重复转发的同一邮件不会二次注入；  
- [ ] 过期会话拒绝注入；  
- [ ] 大段/HTML/带签名的邮件能正确抽取命令。

---

## 5. 方案二：tmux 模式（简单稳妥）

### 5.1 适用场景
- 你已经在 `tmux` 里运行 Claude Code；
- 希望由外部进程向**指定 pane** 注入按键，不改变现有启动流程。

### 5.2 实现思路
- 为每个 token 创建/记录一个 `tmux` session 与 pane：`session = taskping-<token>`；
- Claude Code 在该 pane 里运行；
- 收到邮件 → 定位到 pane → `tmux send-keys -t <pane> "<cmd>" Enter`。

### 5.3 管理脚本（`tmux-utils.sh`）
```bash
#!/usr/bin/env bash
set -euo pipefail

SESSION="$1"      # 例如 taskping-ABC123
CMD="${2:-}"      # 可选：一次性注入命令

if ! tmux has-session -t "${SESSION}" 2>/dev/null; then
  tmux new-session -d -s "${SESSION}"
  tmux rename-window -t "${SESSION}:0" "claude"
  tmux send-keys -t "${SESSION}:0" "claude" C-m
  sleep 0.5
fi

if [ -n "${CMD}" ]; then
  tmux send-keys -t "${SESSION}:0" "${CMD}" C-m
fi

# 输出 pane 目标名，供上层程序记录
echo "${SESSION}.0"
```

### 5.4 注入程序（`relay-tmux.js`）
```js
import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';
import pino from 'pino';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import dotenv from 'dotenv';
import { execa } from 'execa';

dotenv.config();
const log = pino({ level: 'info' });
const SESS_PATH = process.env.SESSION_MAP_PATH;

function loadSessions() {
  if (!existsSync(SESS_PATH)) return {};
  return JSON.parse(readFileSync(SESS_PATH, 'utf8'));
}

function extractTokenFromSubject(subject = '') {
  const m = subject.match(/\[TaskPing\s+#([A-Za-z0-9_-]+)\]/);
  return m ? m[1] : null;
}

function stripReply(text = '') {
  const codeBlock = text.match(/```[\s\S]*?```/);
  if (codeBlock) return codeBlock[0].replace(/```/g, '').trim();
  const firstLine = text.split(/\r?\n/).find(l => l.trim().length > 0) || '';
  const cmdPrefix = firstLine.match(/^CMD:\s*(.+)$/i);
  return (cmdPrefix ? cmdPrefix[1] : firstLine).trim().slice(0, 8192);
}

async function injectToTmux(sessionName, cmd) {
  const utils = new URL('./tmux-utils.sh', import.meta.url).pathname;
  const { stdout } = await execa('bash', [utils, sessionName, cmd], { stdio: 'pipe' });
  return stdout.trim(); // 返回 pane 目标名
}

async function startImap() {
  const client = new ImapFlow({
    host: process.env.IMAP_HOST,
    port: Number(process.env.IMAP_PORT || 993),
    secure: process.env.IMAP_SECURE === 'true',
    auth: { user: process.env.IMAP_USER, pass: process.env.IMAP_PASS }
  });
  await client.connect();
  await client.mailboxOpen('INBOX');

  for await (const msg of client.monitor()) {
    if (msg.type !== 'exists') continue;
    const { uid } = msg;
    const { source } = await client.download('INBOX', uid);
    const chunks = [];
    for await (const c of source) chunks.push(c);
    const parsed = await simpleParser(Buffer.concat(chunks));

    const token = extractTokenFromSubject(parsed.subject || '');
    if (!token) continue;

    const cmd = stripReply(parsed.text || parsed.html || '');
    if (!cmd) continue;

    const sessionName = `${process.env.TMUX_SESSION_PREFIX || 'taskping'}-${token}`;
    const pane = await injectToTmux(sessionName, cmd);
    console.log(`[inject] ${sessionName} -> ${pane} :: ${cmd.slice(0, 120)}`);
  }
}

if (process.env.INJECTION_MODE === 'tmux') {
  startImap().catch(err => {
    console.error(err);
    process.exit(1);
  });
}
```

### 5.5 启动
```bash
chmod +x tmux-utils.sh
INJECTION_MODE=tmux node relay-tmux.js
```

### 5.6 验收清单
- [ ] `tmux` 中能看到 Claude 进程始终在运行；  
- [ ] 邮件回复注入后，当前 pane 光标位置正确、命令无截断；  
- [ ] 会话名与 token 一一对应，过期会话自动清理；  
- [ ] `tmux` 重启或 SSH 断连后自动恢复。

---

## 6. 选择建议与权衡

| 维度 | 子进程/PTY | tmux |
|---|---|---|
| 复杂度 | 中 | 低 |
| 稳定性 | 高（直连伪终端） | 高（依赖 tmux 自愈） |
| 多会话并发 | 简单（多 PTY） | 简单（多 pane/session） |
| 恢复/重连 | 需自管 | `tmux` 自带 |
| 可移植性 | 受 pty/Windows 影响 | Linux/macOS 友好 |
| 外部可观测 | 需自行实现 | `tmux capture-pane` 可用 |

**建议**：桌面或服务器长期常驻，优先 **PTY 模式**；已广泛使用 `tmux` 的团队，直接 **tmux 模式**。

---

## 7. 测试用例（AI 执行）

1. **路由正确性**：构造两个 token（A、B），分别回复不同命令，验证注入不串台。  
2. **HTML 邮件**：从 iOS/Android 客户端发送富文本，确认能抽取纯文本命令。  
3. **代码块优先**：正文包含代码块和普通文本时，优先选用代码块内容。  
4. **幂等**：同一封邮件重复投递三次，仅执行一次。  
5. **过期处理**：将 `expiresAt` 回退到过去，验证拒绝注入。  
6. **白名单**：非授权邮箱发送，日志报警且不注入。  
7. **超长命令**：超过 8KB 截断并拒绝，返回提示。

---

## 8. 运行与守护

- 建议用 `pm2`/`systemd` 管理 `relay-pty.js` 或 `relay-tmux.js`；
- 每 20 分钟向 IMAP 发送 NOOP（ImapFlow monitor 已处理），断线自动重连；
- 定时清理过期会话与孤儿 `tmux` session / PTY。

---

## 9. 故障排查

- **注入后无响应**：检查会话路由是否匹配（token、pane/pty）；确认 Claude 是否在**等待输入**的状态。  
- **乱码/截断**：调大 pty 列数；tmux 保证 pane 有焦点且无行编辑冲突。  
- **重复执行**：确认以 `Message-ID` 去重；避免多客户端造成“已读后又转发”。  
- **权限问题**：`tmux` 由同一用户启动；Node 进程需与 `tmux` 同一用户。

---

## 10. 清单（AI 请按序执行）

1. 安装依赖与 `tmux`（如需）。  
2. 写入 `.env`（IMAP/白名单/模式）。  
3. 准备并加载 `SESSION_MAP_PATH`（由发送提醒侧写入）。  
4. 选择 **INJECTION_MODE=pty** 或 **tmux**，启动对应 `relay-*.js`。  
5. 发送带 `[TaskPing #TOKEN]` 的提醒邮件，收到后**回复命令**进行回归测试。  
6. 通过测试清单后，接入 hooks，开启常驻与告警监控。
