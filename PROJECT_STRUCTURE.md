# TaskPing 项目结构

## 📁 核心文件

### 🎯 主要脚本
- **`hook-notify.js`** - 核心通知脚本，被Claude Code hooks调用
- **`config-tool.js`** - 交互式配置管理工具
- **`install.js`** - 自动安装脚本，配置Claude Code hooks

### ⚙️ 配置文件
- **`config.json`** - 用户配置（语言、音效、自定义消息等）
- **`i18n.json`** - 多语言文本
- **`claude-hooks.json`** - Claude Code hooks配置模板

### 📚 文档
- **`README.md`** - 完整项目文档
- **`QUICKSTART.md`** - 快速开始指南
- **`TaskPing.md`** - 产品规格文档

### 🎵 音效
- **`sounds/`** - 自定义音效目录
  - 支持格式：`.wav`, `.mp3`, `.m4a`, `.aiff`, `.ogg`
  - 用户可以添加自己的音效文件

### 📦 包管理
- **`package.json`** - Node.js项目配置
- **`LICENSE`** - MIT开源协议

## 🚀 使用流程

1. **安装**: `node install.js`
2. **配置**: `node config-tool.js`
3. **使用**: 正常使用Claude Code，自动收到通知

## 🔧 开发说明

- 主要语言：JavaScript (Node.js)
- 支持平台：macOS, Windows, Linux
- 核心依赖：无（使用Node.js内置模块）
- 音效播放：系统原生通知API

项目专注于简洁、高效的Claude Code任务通知功能。