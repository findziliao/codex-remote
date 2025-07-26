# TaskPing 快速配置指南

## 🚀 5分钟快速开始

本指南帮助您快速配置 TaskPing 的邮件通知和回复功能。

## 第一步：配置邮件账号

### 1.1 复制环境配置文件
```bash
cp .env.example .env
```

### 1.2 编辑 .env 文件

您的配置已经部分完成：
- ✅ 发件服务器：飞书邮箱 (noreply@pandalla.ai)
- ✅ 收件邮箱：Gmail (jiaxicui446@gmail.com)
- ❌ Gmail 应用密码：需要您配置

### 1.3 获取 Gmail 应用专用密码

1. 登录您的 Gmail 账号 (jiaxicui446@gmail.com)
2. 访问 [Google 账号安全设置](https://myaccount.google.com/security)
3. 开启"两步验证"（如果未开启）
4. 访问 [应用专用密码页面](https://myaccount.google.com/apppasswords)
5. 选择应用"邮件"，设备选择"其他"
6. 输入名称"TaskPing"
7. 点击"生成"获取16位密码
8. 将密码复制到 .env 文件的 `IMAP_PASS` 字段

## 第二步：更新配置

```bash
# 更新邮件配置到系统
npm run email:config
```

## 第三步：测试邮件发送

```bash
# 发送测试邮件
npm run email:test
```

成功后您会看到：
```
✅ 邮件发送成功！
   Message ID: <xxx@pandalla.ai>
   Response: 250 2.0.0 OK: queued
```

## 第四步：启动邮件监听服务

```bash
# 启动 PTY 模式的邮件监听
npm run relay:pty
```

服务启动后会显示：
```
🚀 正在启动 TaskPing PTY Relay 服务...
📧 IMAP服务器: imap.gmail.com
👤 邮件账号: jiaxicui446@gmail.com
```

## 第五步：测试完整流程

1. **检查收件箱**
   - 查看 jiaxicui446@gmail.com 是否收到测试邮件
   - 主题类似：`[TaskPing #TESTXXXXX] 测试邮件 - 等待您的指令`

2. **回复测试命令**
   - 直接回复邮件
   - 内容输入：`echo "Hello from TaskPing"`
   - 发送

3. **查看服务日志**
   - PTY Relay 服务会显示收到的命令
   - Claude Code 会执行该命令

## 📝 常用命令速查

| 功能 | 命令 |
|------|------|
| 更新邮件配置 | `npm run email:config` |
| 测试邮件发送 | `npm run email:test` |
| 启动监听服务 | `npm run relay:pty` |
| 测试邮件解析 | `npm run relay:test` |
| 查看配置状态 | `cat .env` |

## 🔧 故障排查

### 邮件发送失败
- 检查飞书邮箱 SMTP 密码是否正确
- 确认网络可以访问 smtp.feishu.cn:465

### 邮件接收失败
- 确认 Gmail 应用专用密码已配置
- 检查 Gmail 是否开启了 IMAP
- 查看服务日志中的错误信息

### 命令未执行
- 确认回复邮件的主题包含原始 Token
- 检查邮件内容格式是否正确
- 验证 Claude Code 是否在运行

## 💡 使用技巧

1. **邮件回复格式**
   ```
   # 简单命令
   继续
   
   # 明确命令
   CMD: npm run build
   
   # 多行命令
   ```
   git add .
   git commit -m "Update"
   ```
   ```

2. **会话管理**
   - 每个会话有1小时有效期
   - Token 在邮件主题中：`[TaskPing #TOKEN]`
   - 过期后需要新的通知邮件

3. **安全建议**
   - 只从受信任的邮箱发送命令
   - 定期更换应用专用密码
   - 不要在邮件中包含敏感信息

## 🎯 实际使用场景

1. **移动办公**
   - 在手机上收到任务通知
   - 直接回复邮件继续任务
   - 无需返回电脑操作

2. **远程协作**
   - 团队成员可以通过邮件控制任务
   - 支持多人协作（配置白名单）
   - 保留邮件审计记录

3. **自动化工作流**
   - 集成到现有邮件系统
   - 支持邮件规则触发
   - 可以配置自动回复

## 📚 更多文档

- [详细邮件配置指南](./EMAIL_GUIDE.md)
- [邮件回复功能说明](./EMAIL_REPLY_GUIDE.md)
- [系统架构文档](./EMAIL_ARCHITECTURE.md)

---

有问题？查看 [GitHub Issues](https://github.com/JessyTsui/TaskPing/issues) 或运行调试模式：
```bash
LOG_LEVEL=debug npm run relay:pty
```