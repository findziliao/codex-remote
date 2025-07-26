# TaskPing 邮件功能架构设计

## 功能概述

实现邮件通知和远程命令执行功能，用户可以：
1. 接收 Claude Code 任务完成的邮件通知
2. 通过回复邮件来远程执行下一步命令
3. 在不坐在电脑前的情况下继续 Claude Code 对话

## 整体架构

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Claude Code   │ ──▶│   TaskPing CLI   │ ──▶│  Email Channel  │
│    (hooks)      │    │                  │    │   (SMTP Send)   │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                                         │
                                                         ▼
                       ┌──────────────────┐    ┌─────────────────┐
                       │  Command Relay   │◀───│ Email Listener  │
                       │    Service       │    │  (IMAP Receive) │
                       └──────────────────┘    └─────────────────┘
                                │
                                ▼
                       ┌──────────────────┐
                       │   Claude Code    │
                       │   (stdin input)  │
                       └──────────────────┘
```

## 核心组件

### 1. 邮件通知渠道 (Email Channel)
- **位置**: `src/channels/email/smtp.js`
- **功能**: 发送任务完成通知邮件
- **特性**:
  - 支持多种 SMTP 配置
  - 邮件模板化
  - 会话 ID 生成和嵌入
  - 安全回复指令

### 2. 邮件监听器 (Email Listener)
- **位置**: `src/relay/email-listener.js`
- **功能**: 监听和解析邮件回复
- **特性**:
  - IMAP/POP3 邮件接收
  - 邮件解析和命令提取
  - 会话 ID 验证
  - 安全检查

### 3. 命令中继服务 (Command Relay Service)
- **位置**: `src/relay/command-relay.js`
- **功能**: 管理命令队列和执行
- **特性**:
  - 会话管理
  - 命令队列
  - Claude Code 集成
  - 安全验证

### 4. 会话管理器 (Session Manager)
- **位置**: `src/relay/session-manager.js`
- **功能**: 管理 Claude Code 会话状态
- **特性**:
  - 会话创建和跟踪
  - 超时管理
  - 状态持久化

## 数据流程

### 发送通知流程
1. Claude Code 触发 hook → TaskPing CLI
2. TaskPing 创建会话 ID 和通知
3. 邮件渠道发送包含会话信息的邮件
4. 会话管理器记录会话状态

### 命令执行流程  
1. 用户回复邮件 → 邮件监听器接收
2. 解析邮件内容和会话 ID
3. 验证会话有效性和安全性
4. 将命令加入执行队列
5. 命令中继服务执行命令

## 邮件模板设计

### 通知邮件模板
```
主题: [TaskPing] Claude Code 任务完成 - {project}

{user_name}，您好！

Claude Code 已完成任务，正在等待您的下一步指令。

项目: {project}
时间: {timestamp}
状态: {status}

要继续对话，请直接回复此邮件，在邮件正文中输入您的指令。

示例回复:
"请继续优化代码"
"生成单元测试"
"解释这个函数的作用"

---
会话ID: {session_id}
安全提示: 请勿转发此邮件，会话将在24小时后过期
```

### 回复解析规则
- 提取邮件正文作为 Claude Code 指令
- 忽略邮件签名和引用内容
- 验证会话 ID 有效性
- 检查指令安全性

## 安全机制

### 1. 会话验证
- 唯一会话 ID (UUID v4)
- 24小时过期时间
- 用户邮箱验证

### 2. 命令安全
- 危险命令黑名单
- 长度限制 (< 1000 字符)
- 特殊字符过滤

### 3. 频率限制
- 每会话最多 10 次命令
- 每小时最多 5 个新会话
- 异常行为检测

## 配置结构

### 邮件配置 (config/channels.json)
```json
{
  "email": {
    "type": "email",
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
        "secure": true,
        "auth": {
          "user": "your-email@gmail.com",
          "pass": "your-app-password"
        }
      },
      "from": "TaskPing <your-email@gmail.com>",
      "to": "your-email@gmail.com",
      "template": {
        "subject": "[TaskPing] Claude Code 任务完成 - {{project}}",
        "checkInterval": 30
      }
    }
  }
}
```

### 中继配置 (config/relay.json)
```json
{
  "enabled": true,
  "security": {
    "sessionTimeout": 86400,
    "maxCommandsPerSession": 10,
    "maxSessionsPerHour": 5,
    "commandMaxLength": 1000
  },
  "claudeCode": {
    "detectMethod": "ps",
    "inputMethod": "stdin"
  }
}
```

## 实现计划

1. **Phase 1**: 邮件发送功能
   - 实现 SMTP 邮件渠道
   - 创建邮件模板系统
   - 配置管理界面

2. **Phase 2**: 邮件接收功能
   - IMAP 邮件监听器
   - 邮件解析和命令提取
   - 会话管理器

3. **Phase 3**: 命令中继功能
   - 命令队列系统
   - Claude Code 集成
   - 安全验证机制

4. **Phase 4**: 测试和优化
   - 端到端测试
   - 错误处理完善
   - 性能优化