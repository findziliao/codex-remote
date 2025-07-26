# TaskPing - Claude Code 邮件自动化

TaskPing 是一个智能的邮件自动化工具，可以监听你的邮件回复，并将回复内容自动输入到 Claude Code 中执行。

## 🚀 快速开始

### 1. 配置邮箱
```bash
npm run config
```
按照提示配置你的邮箱信息（SMTP和IMAP）。

### 2. 启动服务
```bash
npm start
```

### 3. 使用流程
1. 当 Claude Code 完成任务时，TaskPing 会发送邮件通知到你的邮箱
2. 直接回复这封邮件，在邮件中写入你想让 Claude Code 执行的下一个命令
3. TaskPing 会自动监听到你的回复，提取命令内容，并自动输入到 Claude Code 中
4. 命令会自动执行，无需任何手动操作

## ✨ 核心特性

### 🎯 智能检测
- 基于Claude Code官方hooks机制
- 自动识别任务完成和等待输入状态
- 无需手动监控，完全自动化

### 📢 多渠道通知
- **桌面通知**：即时本地通知
- **邮件通知**：远程邮件提醒 + 回复执行命令
- 支持自定义通知声音和消息内容
- 同时启用多个通知渠道

### 🏠 远程命令执行
- **邮件回复**：直接回复邮件执行下一步命令
- **自动化流程**：人不在电脑前也能继续对话
- **安全机制**：会话过期、命令过滤、来源验证

### 🌍 跨平台支持
- **macOS**：原生通知中心 + 系统提示音
- **Windows**：Toast通知系统
- **Linux**：libnotify桌面通知

### 🎛️ 灵活配置
- 多语言支持（中文、英文、日文）
- 自定义提示音（支持系统音效）
- 邮件 SMTP/IMAP 配置
- 可调节通知频率和超时时间

## 📦 快速安装

### 自动安装（推荐）

```bash
# 1. 克隆或下载项目
git clone <repository-url>
cd TaskPing

# 2. 运行安装脚本
node taskping.js install

# 3. 按提示完成配置
# 安装器会自动配置Claude Code的hooks设置
```

### 手动安装

```bash
# 1. 测试通知功能
node taskping.js test

# 2. 配置Claude Code
# 将以下内容添加到 ~/.claude/settings.json 的 "hooks" 部分：
```

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

## 🎮 使用方法

### 基本使用

安装完成后，TaskPing会自动工作：

```bash
# 1. 正常启动Claude Code
claude

# 2. 执行任务
> 请帮我重构这个项目的代码结构

# 3. 当Claude完成任务时，你会收到通知：
# 📱 "任务已完成，Claude正在等待下一步指令"

# 4. 当Claude需要你的输入时，你会收到提醒：
# 📱 "Claude需要您的进一步指导"
```

### 配置管理

```bash
# 启动配置工具
node taskping.js config

# 快速查看当前配置
node taskping.js config --show

# 查看系统状态
node taskping.js status

# 测试通知功能
node taskping.js test

# 启动邮件命令中继服务 (NEW!)
node taskping.js relay start
```

## 🔧 配置选项

### 语言设置
- `zh-CN`：简体中文
- `en`：英语
- `ja`：日语

### 提示音选择（macOS）
- `Glass`：清脆玻璃音（推荐用于任务完成）
- `Tink`：轻柔提示音（推荐用于等待输入）
- `Ping`、`Pop`、`Basso` 等系统音效

### 基础配置示例

```json
{
  "language": "zh-CN",
  "sound": {
    "completed": "Glass",
    "waiting": "Tink"
  },
  "enabled": true,
  "timeout": 5
}
```

### 邮件配置示例

```json
{
  "email": {
    "enabled": true,
    "config": {
      "smtp": {
        "host": "smtp.gmail.com",
        "port": 587,
        "secure": false,
        "auth": {
          "user": "your-email@gmail.com",
          "pass": "your-app-password"
        }
      },
      "imap": {
        "host": "imap.gmail.com",
        "port": 993,
        "secure": true
      },
      "from": "TaskPing <your-email@gmail.com>",
      "to": "your-email@gmail.com"
    }
  }
}
```

**📧 邮件功能设置指南**: 查看 [邮件功能详细指南](docs/EMAIL_GUIDE.md) 了解完整的配置和使用方法。

## 💡 实际应用场景

### 🏗️ 代码重构项目
```
你：请帮我重构这个React组件，提高性能
Claude：开始分析组件结构...
📱 通知：任务完成！
Claude：我找到了3个优化方案，你倾向于哪种？
📱 通知：Claude需要您的进一步指导
```

### 📚 文档生成
```
你：为这个API生成完整的文档
Claude：正在分析API接口...
📱 通知：任务完成！
Claude：文档已生成，需要我添加使用示例吗？
📱 通知：Claude需要您的进一步指导
```

### 🐛 Bug调试
```
你：帮我找出这个内存泄漏的原因
Claude：开始深度分析代码...
📱 通知：任务完成！
Claude：发现了2个可能的原因，需要查看哪个文件？
📱 通知：Claude需要您的进一步指导
```

### 📧 远程邮件工作流程
```
1. 你在家里：启动 Claude Code 任务
2. 你出门了：📧 收到邮件 "任务完成，Claude等待下一步指令"
3. 在路上：回复邮件 "请继续优化代码性能"
4. 自动执行：命令自动在你的电脑上执行
5. 再次收到：📧 "优化完成" 邮件通知
6. 继续回复：进行下一步操作

真正实现远程 AI 编程！🚀
```

## 🛠️ 故障排除

### macOS权限问题
如果收不到通知，请检查：
1. 打开"系统偏好设置" → "安全性与隐私" → "隐私"
2. 选择"通知"，确保终端应用有权限
3. 或者在"系统偏好设置" → "通知"中启用终端通知

### Linux依赖缺失
```bash
# Ubuntu/Debian
sudo apt-get install libnotify-bin

# Fedora/RHEL
sudo dnf install libnotify

# Arch Linux
sudo pacman -S libnotify
```

### Windows执行策略
```powershell
# 如果遇到PowerShell执行策略限制
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

### 测试通知
```bash
# 测试所有通知渠道
node taskping.js test

# 手动发送通知
node taskping.js notify --type completed
node taskping.js notify --type waiting

# 查看系统状态
node taskping.js status
```

## 📊 项目结构

```
TaskPing/
├── 📄 README.md              # 项目文档
├── 🚀 taskping.js            # 主要CLI入口
├── 📋 TaskPing.md           # 产品规格文档
├── 📦 package.json          # 项目依赖
├── config/                  # 配置文件目录
│   ├── defaults/            # 默认配置模板
│   ├── user.json           # 用户个人配置
│   └── channels.json       # 通知渠道配置
├── src/                    # 核心源代码
│   ├── core/               # 核心模块
│   │   ├── config.js       # 配置管理器
│   │   ├── logger.js       # 日志系统
│   │   └── notifier.js     # 通知编排器
│   ├── channels/           # 通知渠道实现
│   │   ├── local/          # 本地通知
│   │   ├── email/          # 邮件通知
│   │   └── chat/           # 聊天应用通知
│   ├── tools/              # 管理工具
│   │   ├── installer.js    # 安装器
│   │   └── config-manager.js # 配置管理器
│   └── assets/             # 静态资源
└── docs/                   # 文档目录
```

## 🔮 发展规划

TaskPing按照产品规格文档分阶段开发：

### ✅ Phase 1 - 本地通知MVP（已完成）
- 本地桌面通知
- Claude Code hooks集成
- 基础配置管理

### ✅ Phase 2 - 邮件通知和远程执行（已完成）
- 📧 邮件通知功能
- 🔄 邮件回复命令执行
- 🔒 安全会话管理
- 🛠️ 命令中继服务

### 🚧 Phase 3 - 多渠道通知（规划中）
- Telegram/Discord/WhatsApp/飞书集成
- 移动端推送通知
- 多渠道命令中继

### 🌟 Phase 4 - 企业级功能（未来）
- 团队协作功能
- 用户权限管理
- 审计日志
- API 接口

## 🤝 贡献指南

欢迎参与TaskPing的开发！

### 如何贡献
1. Fork本项目
2. 创建功能分支：`git checkout -b feature/new-feature`
3. 提交更改：`git commit -am 'Add new feature'`
4. 推送分支：`git push origin feature/new-feature`
5. 提交Pull Request

### 开发环境
- Node.js >= 14.0.0
- 支持macOS、Linux、Windows开发

## 📄 许可证

本项目采用 [MIT License](LICENSE) 开源协议。

## 💬 联系我们

- 🐛 **问题反馈**：[提交Issue](https://github.com/TaskPing/TaskPing/issues)
- 💡 **功能建议**：[Discussion](https://github.com/TaskPing/TaskPing/discussions)
- 📧 **邮件联系**：contact@taskping.dev

---

<div align="center">

**让Claude Code工作流程更加智能高效！**

⭐ 如果这个项目对你有帮助，请给我们一个Star！

</div>