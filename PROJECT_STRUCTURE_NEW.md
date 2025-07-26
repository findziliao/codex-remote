# TaskPing 新项目结构设计

## 📁 重构后的目录结构

```
TaskPing/
├── 📦 src/                          # 源代码目录
│   ├── 🎯 core/                     # 核心模块
│   │   ├── notifier.js              # 通知核心类
│   │   ├── config.js                # 配置管理
│   │   └── logger.js                # 日志记录
│   ├── 📢 channels/                 # 通知渠道
│   │   ├── base/                    # 基础接口
│   │   │   └── channel.js           # 通知渠道基类
│   │   ├── local/                   # 本地通知
│   │   │   └── desktop.js           # 桌面通知
│   │   ├── email/                   # 邮件通知
│   │   │   └── smtp.js              # SMTP邮件
│   │   ├── chat/                    # 聊天平台
│   │   │   ├── discord.js           # Discord
│   │   │   ├── telegram.js          # Telegram
│   │   │   ├── whatsapp.js          # WhatsApp
│   │   │   └── feishu.js            # 飞书
│   │   └── webhook/                 # Webhook通知
│   │       └── generic.js           # 通用Webhook
│   ├── 🔄 relay/                    # 命令中继模块
│   │   ├── server.js                # 中继服务器
│   │   ├── client.js                # 中继客户端
│   │   └── commands.js              # 命令处理
│   ├── 🛠️ tools/                    # 工具模块
│   │   ├── cli.js                   # 命令行工具
│   │   ├── installer.js             # 安装器
│   │   └── config-manager.js        # 配置管理器
│   └── 🎵 assets/                   # 静态资源
│       └── sounds/                  # 音效文件
├── 📋 config/                       # 配置文件
│   ├── default.json                 # 默认配置
│   ├── user.json                    # 用户配置
│   ├── channels.json                # 渠道配置
│   └── templates/                   # 配置模板
│       ├── claude-hooks.json        # Claude Code hooks
│       └── channel-templates/       # 各渠道配置模板
├── 📚 docs/                         # 文档目录
│   ├── README.md                    # 主文档
│   ├── QUICKSTART.md                # 快速开始
│   ├── api/                         # API文档
│   ├── channels/                    # 各渠道使用指南
│   └── examples/                    # 使用示例
├── 🧪 tests/                        # 测试目录
│   ├── unit/                        # 单元测试
│   ├── integration/                 # 集成测试
│   └── fixtures/                    # 测试数据
├── 📦 项目根文件
│   ├── package.json                 # Node.js配置
│   ├── taskping.js                  # 主入口文件
│   ├── LICENSE                      # 开源协议
│   └── .gitignore                   # Git忽略
└── 🚀 scripts/                      # 构建脚本
    ├── build.js                     # 构建脚本
    ├── dev.js                       # 开发脚本
    └── deploy.js                    # 部署脚本
```

## 🏗️ 模块设计原则

### 1. 核心抽象
- **NotificationChannel**: 所有通知渠道的基类
- **CommandRelay**: 命令中继的统一接口
- **ConfigManager**: 统一的配置管理

### 2. 插件化架构
- 每个通知渠道独立模块
- 支持动态加载和卸载
- 标准化的接口和生命周期

### 3. 配置分离
- 用户配置与默认配置分离
- 渠道配置模块化
- 敏感信息加密存储

## 🔄 工作流程

### Phase 1: 本地通知 (当前)
Claude Code → hook-notify.js → Desktop Notification

### Phase 2: 多渠道通知
Claude Code → Core Notifier → Channel Router → [Email|Discord|Telegram|...]

### Phase 3: 命令中继
Channel → Command Relay Server → Claude Code Client → Execute Command

## 🎯 入口点设计

```bash
# 主命令
taskping [command] [options]

# 子命令
taskping install           # 安装和配置
taskping config           # 配置管理
taskping test            # 测试通知
taskping serve           # 启动中继服务
taskping relay           # 连接中继服务
```

这个结构为未来的扩展提供了良好的基础。