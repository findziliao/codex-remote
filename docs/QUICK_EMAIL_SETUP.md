# TaskPing 邮件功能快速配置指南

## 🚀 三种配置方式

TaskPing 现在提供三种方式来配置邮件功能，您可以选择最适合的方式：

### 方式 1: 快速配置向导 (推荐 ⭐)

```bash
node taskping.js setup-email
```

**优点**: 
- 🎯 一步到位，引导式配置
- 🛡️ 内置常见邮箱提供商设置
- 🧪 配置完成后可立即测试

**适用于**: 初次配置，想要快速开始使用的用户

---

### 方式 2: 直接编辑配置文件

```bash
node taskping.js edit-config channels
```

**优点**: 
- ⚡ 最快速，适合有经验的用户
- 🔧 完全控制所有配置选项
- 📝 支持批量修改和复制粘贴

**适用于**: 熟悉JSON格式，需要精确控制配置的用户

---

### 方式 3: 交互式配置管理器

```bash
node taskping.js config
# 选择 "3. 通知渠道" → "2. 邮件通知"
```

**优点**: 
- 🎮 交互式界面，逐步配置
- 💡 详细的配置说明和提示
- 🔄 可以随时修改现有配置

**适用于**: 喜欢逐步配置，需要详细指导的用户

---

## 📧 常见邮箱配置

### Gmail 配置

**前提条件**:
1. 启用两步验证
2. 生成应用密码 (16位)

**配置参数**:
```json
{
  "smtp": {
    "host": "smtp.gmail.com",
    "port": 587,
    "secure": false
  },
  "imap": {
    "host": "imap.gmail.com", 
    "port": 993,
    "secure": true
  }
}
```

### QQ邮箱配置

**前提条件**:
1. 开启SMTP/IMAP服务
2. 获取授权码

**配置参数**:
```json
{
  "smtp": {
    "host": "smtp.qq.com",
    "port": 587,
    "secure": false
  },
  "imap": {
    "host": "imap.qq.com",
    "port": 993, 
    "secure": true
  }
}
```

### 163邮箱配置

**配置参数**:
```json
{
  "smtp": {
    "host": "smtp.163.com",
    "port": 587,
    "secure": false
  },
  "imap": {
    "host": "imap.163.com",
    "port": 993,
    "secure": true
  }
}
```

---

## 🛠️ 配置后的使用流程

### 1. 测试邮件发送

```bash
node taskping.js test
```

应该能看到：
```
Testing notification channels...

✅ desktop: PASS
✅ email: PASS

Test completed: 2/2 channels passed
```

### 2. 查看系统状态

```bash
node taskping.js status
```

应该能看到：
```
TaskPing Status

Configuration:
  Enabled: Yes
  Language: zh-CN
  Sounds: Submarine / Hero

Channels:
  desktop:
    Enabled: ✅
    Configured: ✅
    Supports Relay: ❌
  email:
    Enabled: ✅
    Configured: ✅
    Supports Relay: ✅
```

### 3. 启动命令中继服务

```bash
node taskping.js relay start
```

看到以下信息表示成功：
```
🚀 启动邮件命令中继服务...
✅ 命令中继服务已启动
📧 正在监听邮件回复...
💡 现在您可以通过回复邮件来远程执行Claude Code命令

按 Ctrl+C 停止服务
```

### 4. 开始使用

现在当您使用 Claude Code 时：
1. 任务完成时会收到邮件通知
2. 回复邮件即可远程执行下一步命令
3. 享受远程AI编程的便利！

---

## 🚨 常见问题解决

### Q: 邮件发送失败

**检查清单**:
- ✅ 邮箱密码是否使用应用密码 (不是登录密码)
- ✅ SMTP/IMAP 服务是否已开启
- ✅ 网络连接是否正常
- ✅ 防火墙是否阻止连接

**解决方法**:
```bash
# 重新配置
node taskping.js setup-email

# 或检查配置文件
node taskping.js edit-config channels
```

### Q: 收不到邮件

**检查清单**:
- ✅ 垃圾邮件文件夹
- ✅ 邮件地址是否正确
- ✅ 邮箱存储空间是否充足

### Q: 无法接收回复

**检查清单**:
- ✅ 中继服务是否运行 (`taskping relay status`)
- ✅ IMAP 配置是否正确
- ✅ 是否回复的是 TaskPing 发送的邮件

---

## 📱 使用技巧

### 1. 邮件模板定制

您可以通过编辑配置文件自定义邮件检查间隔：

```bash
node taskping.js edit-config channels
```

找到 `template.checkInterval` 并修改值 (单位：秒)：
```json
"template": {
  "checkInterval": 30  // 每30秒检查一次新邮件
}
```

### 2. 多项目管理

不同项目的通知会自动包含项目名称：
```
[TaskPing] Claude Code 任务完成 - MyProject
[TaskPing] Claude Code 任务完成 - AnotherProject
```

### 3. 批量配置

如果您有多台电脑需要配置，可以：
1. 在一台电脑上配置好
2. 复制 `config/channels.json` 文件
3. 粘贴到其他电脑的同一位置

---

## 🎯 最佳实践

1. **安全性**: 定期更换应用密码
2. **性能**: 根据使用频率调整检查间隔
3. **维护**: 定期清理命令历史 (`taskping relay cleanup`)
4. **监控**: 定期检查中继服务状态 (`taskping relay status`)

---

开始享受远程AI编程的便利吧！🚀