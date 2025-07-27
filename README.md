# Claude Code Remote - 远程邮件控制系统

一个强大的 Claude Code 远程控制工具，让你可以通过邮件回复来远程操控 Claude Code，实现真正的无人值守智能编程助手。

## 🌟 核心功能

- 📧 **智能邮件通知** - Claude 完成任务时自动发送邮件通知
- 🔄 **邮件回复控制** - 回复邮件内容自动注入到 Claude Code 中执行
- 📱 **完全远程操作** - 在任何地方通过邮件控制你的 Claude Code
- 🛡️ **安全可靠** - 白名单机制确保只有授权用户可以发送命令
- 📋 **多行支持** - 支持复杂的多行命令和格式化内容

## 🚀 新手完整教程

### 📋 前置要求

在开始之前，请确保你的系统满足以下要求：

- ✅ **macOS** (推荐) 或 Linux
- ✅ **Node.js 14+** 
- ✅ **Claude Code** 已安装并可正常使用
- ✅ **tmux** 已安装 (`brew install tmux`)
- ✅ **邮箱账号** (Gmail、Outlook 或其他 SMTP/IMAP 支持的邮箱)

### 🎯 第一步：快速体验（5分钟）

```bash
# 1. 克隆项目
git clone https://github.com/JessyTsui/Claude-Code-Remote.git
cd Claude-Code-Remote

# 2. 安装依赖
npm install

# 3. 测试基本功能
node claude-remote.js --help
node claude-remote.js status
node claude-remote.js test
```

如果看到桌面通知弹出，说明基础功能正常！

### 📧 第二步：配置邮件（10分钟）

#### 2.1 创建邮件配置文件

```bash
# 复制示例配置文件
cp .env.example .env
```

#### 2.2 编辑 .env 文件

编辑 `.env` 文件，替换为你的邮箱信息：

```bash
# 编辑配置文件
nano .env
# 或者使用其他编辑器
open .env
```

主要需要修改的配置项：

```env
# 你的邮箱地址和应用密码
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
IMAP_USER=your-email@gmail.com  
IMAP_PASS=your-app-password

# 接收通知的邮箱（可以是同一个）
EMAIL_TO=your-notification-email@gmail.com
ALLOWED_SENDERS=your-notification-email@gmail.com

# 你的实际项目路径
SESSION_MAP_PATH=/Users/your-username/path/to/Claude-Code-Remote/src/data/session-map.json
```

#### 2.3 常见邮箱配置

**Gmail**:
```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
IMAP_HOST=imap.gmail.com
IMAP_PORT=993
```

**Outlook/Hotmail**:
```env
SMTP_HOST=smtp-mail.outlook.com
SMTP_PORT=587
IMAP_HOST=outlook.office365.com
IMAP_PORT=993
```

**📌 重要：Gmail 用户必须使用应用密码**
1. 访问 [Google 账户设置](https://myaccount.google.com/security)
2. 启用两步验证
3. 生成应用密码
4. 在 `.env` 文件中使用应用密码，而不是账户密码

#### 2.4 测试邮件配置

```bash
# 测试邮件发送功能
node claude-remote.js test
```

如果收到测试邮件，说明邮件配置成功！

### ⚙️ 第三步：配置 Claude Code 钩子（5分钟）

#### 3.1 找到 Claude Code 配置文件

```bash
# Claude Code 配置文件位置
~/.claude/settings.json
```

#### 3.2 编辑配置文件

将以下内容添加到 `~/.claude/settings.json`：

```json
{
  "hooks": {
    "Stop": [{
      "matcher": "*",
      "hooks": [{
        "type": "command",
        "command": "node /Users/your-username/path/to/Claude-Code-Remote/claude-remote.js notify --type completed",
        "timeout": 5
      }]
    }],
    "SubagentStop": [{
      "matcher": "*",
      "hooks": [{
        "type": "command",
        "command": "node /Users/your-username/path/to/Claude-Code-Remote/claude-remote.js notify --type waiting",
        "timeout": 5
      }]
    }]
  }
}
```

**🔥 重要：替换路径**
- 将 `/Users/your-username/path/to/Claude-Code-Remote` 替换为你的实际项目路径
- 可以用 `pwd` 命令获取当前目录的完整路径
- 确保文件名为 `claude-remote.js`

### 🎮 第四步：开始使用（马上开始！）

#### 4.1 启动邮件监听服务

```bash
# 在项目目录启动邮件监听
npm run relay:pty
```

你会看到类似输出：
```
🚀 Starting Claude Code Remote PTY Relay service...
📧 IMAP server: imap.gmail.com
👤 Email account: your-email@gmail.com
🔒 Whitelist senders: your-email@gmail.com
```

#### 4.2 创建 Claude Code 会话

在新的终端窗口中：
```bash
# 创建一个新的 Claude Code 会话
tmux new-session -d -s my-project
tmux attach -t my-project

# 在 tmux 会话中启动 Claude Code
claude
```

#### 4.3 开始远程控制

1. **与 Claude 对话**：
   ```
   > 请帮我分析这个项目的结构
   ```

2. **接收邮件通知**：
   Claude 完成任务后，你会收到邮件，内容类似：
   ```
   Subject: Claude Code Remote 任务完成通知 [#ABC123]
   
   Claude has completed your task:
   "请帮我分析这个项目的结构"
   
   [Claude的完整回复内容...]
   
   Reply to this email to send new commands.
   Token: ABC123
   ```

3. **回复邮件控制**：
   直接回复邮件：
   ```
   请继续优化代码性能
   ```

4. **命令自动执行**：
   你的回复会自动注入到 Claude Code 中并执行！

## 🎯 高级使用技巧

### 📝 多行命令支持

你可以在邮件回复中使用复杂的多行命令：

```
请按以下步骤进行：

1. 分析当前代码结构
2. 识别性能瓶颈
3. 提供具体的优化建议

详细要求：
- 重点关注数据库查询优化
- 检查内存使用情况
- 提供代码示例

谢谢！
```

### 🔄 多项目管理

```bash
# 项目 A
tmux new-session -d -s project-a
tmux send-keys -t project-a "cd /path/to/project-a && claude" Enter

# 项目 B  
tmux new-session -d -s project-b
tmux send-keys -t project-b "cd /path/to/project-b && claude" Enter
```

每个会话都会有独立的邮件 Token，你可以同时控制多个项目！

### 📊 监控和管理

```bash
# 查看系统状态
node claude-remote.js status

# 查看待处理命令
node claude-remote.js commands list

# 查看活跃会话
tmux list-sessions

# 清理命令队列
node claude-remote.js commands clear
```

## 🎬 使用场景示例

### 场景1：代码审查自动化
1. 在办公室启动代码审查任务
2. 回家路上收到完成邮件："发现3个问题"
3. 回复邮件："请修复第一个问题"
4. Claude 自动开始修复
5. 通过邮件持续跟进进度

### 场景2：长时间项目监控
1. 启动大型重构任务
2. Claude 分模块完成工作
3. 每个阶段完成时收到邮件通知
4. 通过邮件回复指导下一步工作

### 场景3：多地协作开发
1. 在不同地点都能通过邮件控制同一个 Claude Code 实例
2. 无需 VPN 或复杂的远程桌面设置
3. 只需要邮箱就能远程编程

## 🔧 系统管理命令

```bash
# 邮件监听服务
npm run relay:pty              # 启动邮件监听（前台运行）

# 系统状态检查
node claude-remote.js status        # 查看整体状态
node claude-remote.js test          # 测试所有功能

# 命令队列管理  
node claude-remote.js commands list    # 查看待处理命令
node claude-remote.js commands status  # 查看处理状态
node claude-remote.js commands clear   # 清空命令队列

# 会话管理
tmux list-sessions             # 查看所有会话
tmux attach -t session-name    # 连接到会话
tmux kill-session -t session-name  # 删除会话
```

## 🔍 故障排除

### ❓ 常见问题

**Q: npm install 失败**
```bash
# 检查 Node.js 版本
node -v  # 需要 14+

# 清理并重新安装
rm -rf node_modules package-lock.json
npm install
```

**Q: 邮件发送失败**
```bash
# 检查邮件配置
node claude-remote.js status
node claude-remote.js test

# 常见问题：
# 1. Gmail 用户必须使用应用密码
# 2. 检查 SMTP/IMAP 端口和安全设置
# 3. 确认网络可以访问邮件服务器
```

**Q: 命令注入失败**
```bash
# 检查 tmux 会话
tmux list-sessions

# 检查会话内容
tmux capture-pane -t session-name -p

# 检查允许的发件人
grep ALLOWED_SENDERS .env
```

**Q: Claude hooks 不触发**
```bash
# 验证 hooks 配置
cat ~/.claude/settings.json

# 手动测试 hook
node claude-remote.js notify --type completed

# 检查文件路径是否正确
```

**Q: 收不到邮件通知**
```bash
# 检查 SMTP 配置
node claude-remote.js test

# 检查垃圾邮件文件夹
# 确认邮件地址配置正确
```

### 🐛 调试模式

```bash
# 启用详细日志
LOG_LEVEL=debug npm run relay:pty

# 查看会话映射
cat src/data/session-map.json

# 查看处理过的邮件
cat src/data/processed-messages.json
```

## 🛡️ 安全说明

- ✅ **白名单机制** - 只有 `ALLOWED_SENDERS` 中的邮箱可以发送命令
- ✅ **会话隔离** - 每个 Token 只能控制对应的会话
- ✅ **命令验证** - 自动过滤危险命令
- ✅ **超时机制** - 会话有过期时间，自动清理

## 🤝 贡献和支持

### 报告问题
如果遇到问题，请在 [GitHub Issues](https://github.com/JessyTsui/Claude-Code-Remote/issues) 中报告。

### 功能请求
欢迎提交新功能建议和改进意见。

### 贡献代码
1. Fork 项目
2. 创建功能分支
3. 提交更改
4. 发起 Pull Request

## 📄 许可证

本项目采用 MIT 许可证。

---

**🚀 让 Claude Code 无处不在，随时随地智能编程！**

如果这个项目对你有帮助，请给我们一个 ⭐ Star！