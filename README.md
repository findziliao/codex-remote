# TaskPing - 智能邮件自动化 Claude Code 助手

TaskPing 是一个智能的邮件自动化工具，实现了 Claude Code 与邮件系统的深度集成。通过监听邮件回复，自动将回复内容输入到对应的 Claude Code 会话中执行，让你可以在任何地方通过邮件远程控制 Claude Code。

## 🚀 核心功能

### 📧 智能邮件通知
- **自动检测**: 基于 Claude Code 官方 hooks 机制，自动识别任务完成和等待输入状态
- **实时通知**: 任务完成时自动发送邮件，包含完整的用户问题和 Claude 回复内容
- **会话绑定**: 邮件与特定的 tmux 会话绑定，确保回复到正确的 Claude Code 窗口

### 🔄 邮件回复自动执行
- **远程控制**: 直接回复邮件，内容自动输入到对应的 Claude Code 会话中
- **智能注入**: 自动检测 tmux 会话状态，将命令精确注入到正确的窗口
- **防重复处理**: 实现邮件去重机制，避免重复处理同一封邮件

### 🛡️ 稳定性保障
- **单实例运行**: 确保只有一个邮件监听进程运行，避免重复处理
- **状态管理**: 完善的会话状态跟踪和错误恢复机制
- **安全验证**: 邮件来源验证，确保只处理授权用户的回复

## 📦 快速安装

### 1. 克隆项目
```bash
git clone https://github.com/your-username/TaskPing.git
cd TaskPing
npm install
```

### 2. 配置邮箱
```bash
npm run config
```
按照提示配置你的邮箱信息（SMTP 和 IMAP）。

### 3. 配置 Claude Code 钩子
将以下内容添加到 `~/.claude/settings.json` 的 `hooks` 部分：

```json
{
  "hooks": {
    "Stop": [{
      "matcher": "*",
      "hooks": [{
        "type": "command",
        "command": "node /path/to/TaskPing/taskping.js notify --type completed",
        "timeout": 5
      }]
    }],
    "SubagentStop": [{
      "matcher": "*",
      "hooks": [{
        "type": "command",
        "command": "node /path/to/TaskPing/taskping.js notify --type waiting",
        "timeout": 5
      }]
    }]
  }
}
```

### 4. 全局安装 claude-control 命令
```bash
node install-global.js
```

### 5. 启动邮件监听服务
```bash
npm run relay:pty
```

## 🎮 使用方法

### 1. 创建 Claude Code 会话
```bash
# 在任何目录下都可以运行
claude-control --session project-name
```

### 2. 正常使用 Claude Code
在 tmux 会话中正常与 Claude 对话：
```
> 请帮我分析这个项目的代码结构

Claude 回复...
```

### 3. 自动邮件通知
当 Claude 完成任务时，你会收到包含完整对话内容的邮件通知。

### 4. 邮件回复控制
直接回复邮件，输入下一个指令：
```
请继续优化代码性能
```

### 5. 自动执行
你的回复会自动注入到对应的 Claude Code 会话中并执行。

## 🔧 项目架构

```
TaskPing/
├── src/
│   ├── channels/email/
│   │   └── smtp.js           # SMTP 邮件发送
│   ├── core/
│   │   ├── config.js         # 配置管理
│   │   ├── logger.js         # 日志系统
│   │   └── notifier.js       # 通知协调器
│   ├── data/
│   │   ├── session-map.json  # 会话映射表
│   │   └── processed-messages.json  # 已处理邮件记录
│   ├── relay/
│   │   └── relay-pty.js      # 邮件监听和 PTY 注入服务
│   └── utils/
│       └── tmux-monitor.js   # Tmux 会话监控
├── taskping.js               # 主入口文件
├── claude-control.js         # Claude Code 会话管理
├── start-relay-pty.js        # 邮件监听服务启动器
└── install-global.js         # 全局安装脚本
```

## 🛠️ 核心技术实现

### 邮件监听与处理
- 使用 `node-imap` 监听 IMAP 邮箱新邮件
- 实现邮件去重机制（基于 UID、messageId 和内容哈希）
- 异步事件处理，避免竞态条件

### 会话管理
- Tmux 会话自动检测和命令注入
- 会话状态持久化存储
- 支持多会话并发处理

### 通知系统
- 自动捕获当前 tmux 会话的用户问题和 Claude 回复
- 生成包含完整对话内容的邮件通知
- 支持多种通知渠道（桌面通知、邮件等）

## 🔍 故障排除

### 邮件重复处理问题
确保只运行一个邮件监听进程：
```bash
# 检查运行状态
ps aux | grep relay-pty

# 停止所有进程
pkill -f relay-pty

# 重新启动
npm run relay:pty
```

### 命令注入失败
检查 tmux 会话状态：
```bash
# 查看所有会话
tmux list-sessions

# 检查会话内容
tmux capture-pane -t session-name -p
```

### 邮件配置问题
测试邮件连接：
```bash
# 测试 SMTP
node -e "
const config = require('./config/user.json');
console.log('SMTP Config:', config.email.config.smtp);
"

# 测试 IMAP
node -e "
const config = require('./config/user.json');
console.log('IMAP Config:', config.email.config.imap);
"
```

## 🎯 使用场景

### 远程编程工作流
1. 在办公室启动一个 Claude Code 代码审查任务
2. 下班回家，收到邮件"代码审查完成，发现3个问题"
3. 回复邮件"请修复第一个问题"
4. Claude 自动开始修复，完成后再次发送邮件通知
5. 继续回复邮件进行下一步操作

### 长时间任务监控
1. 启动大型项目重构任务
2. Claude 分步骤完成各个模块
3. 每个阶段完成都发送邮件通知进度
4. 通过邮件回复指导下一步方向

## 🤝 贡献指南

1. Fork 本项目
2. 创建功能分支：`git checkout -b feature/new-feature`
3. 提交更改：`git commit -am 'Add new feature'`
4. 推送分支：`git push origin feature/new-feature`
5. 提交 Pull Request

## 📄 许可证

本项目采用 MIT License 开源协议。

---

**让 Claude Code 工作流程更加智能高效！**

如果这个项目对你有帮助，请给我们一个 ⭐！