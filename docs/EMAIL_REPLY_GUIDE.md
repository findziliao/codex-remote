# TaskPing 邮件回复功能使用指南

## 概述

TaskPing 的邮件回复功能允许您通过回复邮件的方式向 Claude Code CLI 发送命令。当您在移动设备或其他电脑上收到 TaskPing 的任务提醒邮件时，可以直接回复邮件来控制 Claude Code 继续执行任务。

## 工作原理

1. **发送提醒**: Claude Code 在任务暂停时发送包含会话 Token 的提醒邮件
2. **邮件监听**: PTY Relay 服务持续监听您的收件箱
3. **命令提取**: 从回复邮件中提取命令内容
4. **命令注入**: 通过 node-pty 将命令注入到对应的 Claude Code 会话

## 快速开始

### 1. 配置邮件账号

复制环境配置文件：
```bash
cp .env.example .env
```

编辑 `.env` 文件，填入您的邮件配置：
```env
# Gmail 示例
IMAP_HOST=imap.gmail.com
IMAP_PORT=993
IMAP_SECURE=true
IMAP_USER=your-email@gmail.com
IMAP_PASS=your-app-password  # 使用应用专用密码

# 安全设置
ALLOWED_SENDERS=your-email@gmail.com,trusted@company.com
```

### 2. 启动 PTY Relay 服务

```bash
npm run relay:pty
# 或者
./start-relay-pty.js
```

### 3. 测试邮件解析

运行测试工具验证配置：
```bash
npm run relay:test
```

## 使用方法

### 邮件格式要求

#### 主题格式
邮件主题必须包含 TaskPing Token，支持以下格式：
- `[TaskPing #TOKEN]` - 推荐格式
- `[TaskPing TOKEN]`
- `TaskPing: TOKEN`

例如：
- `Re: [TaskPing #ABC123] 任务等待您的指示`
- `回复: TaskPing: XYZ789`

#### 命令格式
支持三种命令输入方式：

1. **直接输入**（最简单）
   ```
   继续执行
   ```

2. **CMD 前缀**（明确标识）
   ```
   CMD: npm run build
   ```

3. **代码块**（复杂命令）
   ````
   ```
   git add .
   git commit -m "Update features"
   git push
   ```
   ````

### 示例场景

#### 场景 1: 简单确认
收到邮件：
```
主题: [TaskPing #TASK001] 是否继续部署到生产环境？
```

回复：
```
yes
```

#### 场景 2: 执行具体命令
收到邮件：
```
主题: [TaskPing #BUILD123] 构建失败，请输入修复命令
```

回复：
```
CMD: npm install missing-package
```

#### 场景 3: 多行命令
收到邮件：
```
主题: [TaskPing #DEPLOY456] 准备部署，请确认步骤
```

回复：
````
执行以下命令：

```
npm run test
npm run build
npm run deploy
```
````

## 高级配置

### 会话管理

会话映射文件 `session-map.json` 结构：
```json
{
  "TOKEN123": {
    "type": "pty",
    "createdAt": 1234567890,
    "expiresAt": 1234654290,
    "cwd": "/path/to/project",
    "description": "构建项目 X"
  }
}
```

### 环境变量说明

| 变量名 | 说明 | 默认值 |
|--------|------|--------|
| `IMAP_HOST` | IMAP 服务器地址 | 必需 |
| `IMAP_PORT` | IMAP 端口 | 993 |
| `IMAP_SECURE` | 使用 SSL/TLS | true |
| `IMAP_USER` | 邮箱账号 | 必需 |
| `IMAP_PASS` | 邮箱密码 | 必需 |
| `ALLOWED_SENDERS` | 允许的发件人列表 | 空（接受所有） |
| `SESSION_MAP_PATH` | 会话映射文件路径 | ./src/data/session-map.json |
| `CLAUDE_CLI_PATH` | Claude CLI 路径 | claude |
| `LOG_LEVEL` | 日志级别 | info |
| `PTY_OUTPUT_LOG` | 记录 PTY 输出 | false |

### 邮件服务器配置示例

#### Gmail
1. 启用 IMAP: 设置 → 转发和 POP/IMAP → 启用 IMAP
2. 生成应用专用密码: 账号设置 → 安全 → 应用专用密码

```env
IMAP_HOST=imap.gmail.com
IMAP_PORT=993
IMAP_SECURE=true
```

#### Outlook/Office 365
```env
IMAP_HOST=outlook.office365.com
IMAP_PORT=993
IMAP_SECURE=true
```

#### QQ 邮箱
```env
IMAP_HOST=imap.qq.com
IMAP_PORT=993
IMAP_SECURE=true
```

## 安全注意事项

1. **发件人验证**: 始终配置 `ALLOWED_SENDERS` 以限制谁可以发送命令
2. **命令过滤**: 系统会自动过滤危险命令（如 `rm -rf`）
3. **会话过期**: 会话有过期时间，过期后无法接受命令
4. **邮件加密**: 使用 SSL/TLS 加密的 IMAP 连接
5. **密码安全**: 使用应用专用密码而非主密码

## 故障排查

### 常见问题

1. **无法连接到邮件服务器**
   - 检查 IMAP 是否已启用
   - 验证服务器地址和端口
   - 确认防火墙设置

2. **邮件未被处理**
   - 检查发件人是否在白名单中
   - 验证邮件主题格式
   - 查看日志中的错误信息

3. **命令未执行**
   - 确认 Claude Code 进程正在运行
   - 检查会话是否已过期
   - 验证命令格式是否正确

### 查看日志

```bash
# 启动时查看详细日志
LOG_LEVEL=debug npm run relay:pty

# 查看 PTY 输出
PTY_OUTPUT_LOG=true npm run relay:pty
```

### 测试命令

```bash
# 测试邮件解析
npm run relay:test

# 手动启动（调试模式）
INJECTION_MODE=pty LOG_LEVEL=debug node src/relay/relay-pty.js
```

## 最佳实践

1. **使用专用邮箱**: 为 TaskPing 创建专用邮箱账号
2. **定期清理**: 定期清理过期会话和已处理邮件
3. **命令简洁**: 保持命令简短明确
4. **及时回复**: 在会话过期前回复邮件
5. **安全优先**: 不要在邮件中包含敏感信息

## 集成到现有项目

如果您想将邮件回复功能集成到现有的 Claude Code 工作流：

1. 在发送提醒时创建会话：
```javascript
const token = generateToken();
const session = {
  type: 'pty',
  createdAt: Math.floor(Date.now() / 1000),
  expiresAt: Math.floor((Date.now() + 3600000) / 1000),
  cwd: process.cwd()
};
saveSession(token, session);
```

2. 在邮件主题中包含 Token：
```javascript
const subject = `[TaskPing #${token}] ${taskDescription}`;
```

3. 启动 PTY Relay 服务监听回复

## 相关文档

- [邮件配置指南](./EMAIL_GUIDE.md)
- [快速邮件设置](./QUICK_EMAIL_SETUP.md)
- [系统架构说明](./EMAIL_ARCHITECTURE.md)

## 支持

如有问题，请查看：
- 项目 Issue: https://github.com/JessyTsui/TaskPing/issues
- 详细日志: `LOG_LEVEL=debug npm run relay:pty`