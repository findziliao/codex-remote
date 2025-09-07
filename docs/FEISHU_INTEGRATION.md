# 飞书集成指南

Claude Code Remote 现已支持飞书（Lark）通知频道，您可以通过飞书机器人接收Claude任务完成通知并发送远程命令。

## 🚀 快速开始

### 1. 创建飞书应用

1. 访问 [飞书开放平台](https://open.feishu.cn/)
2. 登录并进入开发者后台
3. 创建企业自建应用
4. 获取应用凭证：
   - App ID
   - App Secret
   - Verification Token（用于webhook验证）

### 2. 配置应用权限

在应用管理后台，开启以下权限：

**基础权限**
- `im:message` - 发送和接收消息
- `im:message.group_at_msg` - 群组消息
- `im:message.group_at_msg:readonly` - 读取群组消息

**机器人权限**
- 添加机器人功能
- 启用事件订阅

### 3. 配置环境变量

在项目根目录的 `.env` 文件中添加以下配置：

```bash
# 启用飞书频道
FEISHU_ENABLED=true

# 飞书应用配置
FEISHU_APP_ID=cli_a7a8e4f2a9f91013
FEISHU_APP_SECRET=dFJxWkR4S2J3U1JkWWN0M2p2d0t2WTFaY3Rp
FEISHU_VERIFICATION_TOKEN=VhXkRw2J3SRdWct3jpv0k2WFkrt

# 接收者配置（二选一）
FEISHU_USER_ID=ou_84e90a83a0ef775ca61508f1a0c7cae6
# FEISHU_GROUP_ID=oc_xxxxxx

# Webhook配置
FEISHU_WEBHOOK_URL=https://your-domain.com/webhook
FEISHU_WEBHOOK_PORT=3002

# 安全配置（可选）
FEISHU_WHITELIST=user_id1,user_id2,group_id1
```

### 4. 配置Webhook

在飞书应用后台设置webhook：

1. 进入应用管理的"事件订阅"页面
2. 订阅地址设置为：`https://your-domain.com/webhook/feishu`
3. 选择订阅事件：
   - `im.message.receive_v1` - 接收消息事件
4. 点击验证完成配置

### 5. 启动服务

```bash
# 启动飞书webhook服务器
npm run feishu

# 或启动所有启用的通知平台
npm run webhooks
```

## 📋 详细配置说明

### 环境变量详解

| 变量名 | 必需 | 说明 | 示例 |
|--------|------|------|------|
| `FEISHU_ENABLED` | 是 | 是否启用飞书频道 | `true` |
| `FEISHU_APP_ID` | 是 | 飞书应用ID | `cli_a7a8e4f2a9f91013` |
| `FEISHU_APP_SECRET` | 是 | 飞书应用密钥 | `dFJxWkR4S2J3U1JkWWN0M2p2d0t2WTFaY3Rp` |
| `FEISHU_VERIFICATION_TOKEN` | 是 | Webhook验证令牌 | `VhXkRw2J3SRdWct3jpv0k2WFkrt` |
| `FEISHU_USER_ID` | 二选一 | 用户ID（私聊） | `ou_84e90a83a0ef775ca61508f1a0c7cae6` |
| `FEISHU_GROUP_ID` | 二选一 | 群组ID（群聊） | `oc_xxxxxx` |
| `FEISHU_WEBHOOK_URL` | 是 | Webhook服务器URL | `https://your-domain.com/webhook` |
| `FEISHU_WEBHOOK_PORT` | 否 | Webhook端口（默认3002） | `3002` |
| `FEISHU_WHITELIST` | 否 | 白名单用户/群组ID | `user1,user2,group1` |

### 如何获取用户ID和群组ID

**获取用户ID：**
1. 在飞书中发送任意消息给机器人
2. 查看webhook服务器日志，找到 `sender.sender_id.user_id` 或 `sender.sender_id.open_id`

**获取群组ID：**
1. 将机器人添加到群组
2. 在群组中发送消息
3. 查看webhook服务器日志，找到 `chat_id`

## 🎮 使用说明

### 接收通知

当Claude完成任务时，您会收到一个精美的交互式卡片消息：

**🎨 卡片格式预览：**

```
┌─────────────────────────────────────────┐
│ ✅ Claude Task Completed                │
├─────────────────────────────────────────┤
│ 📁 项目: your-project-name             │
│ ⏰ 时间: 2025/9/7 10:50:29             │
│                                         │
│ 📋 任务详情:                            │
│ Claude has completed the task          │
│ successfully.                          │
│                                         │
├─────────────────────────────────────────┤
│ 🔑 会话令牌: ABCDEFGH                   │
│                                         │
│ 💡 回复执行命令:                         │
│ /cmd ABCDEFGH <你的命令>                │
│                                         │
│ [📊 查看状态] [🔄 重新运行]              │
└─────────────────────────────────────────┘
```

**卡片特性：**
- 🎨 **美观的卡片界面** - 使用飞书富文本卡片格式
- 📱 **响应式设计** - 支持手机和桌面端完美显示
- 🔘 **交互按钮** - 快捷操作按钮，一键执行常用命令
- 📊 **信息丰富** - 包含项目名称、时间戳、任务详情等
- 🎯 **令牌高亮** - 清晰显示会话令牌，方便复制使用

### 发送命令

#### 🎯 方式1：交互按钮（推荐）
直接点击卡片上的快捷按钮：
- **📊 查看状态** - 快速查看当前项目状态
- **🔄 重新运行** - 重新执行上一个任务

#### 📝 方式2：文本回复
支持两种文本命令格式：

**格式1：/cmd 前缀**
```
/cmd ABCDEFGH 请分析这个代码
```

**格式2：Token 前缀**
```
Token ABCDEFGH 请创建一个新的测试文件
```

### 支持的命令类型

- **代码分析**: `请分析这个文件`
- **文件操作**: `创建新文件 test.js`
- **代码重构**: `重构这个函数`
- **测试运行**: `运行测试`
- **Git操作**: `提交代码`
- **项目构建**: `构建项目`

### 会话管理

- **会话时长**: 24小时自动过期
- **令牌格式**: 8位大写字母数字组合
- **安全机制**: 每个令牌绑定特定的用户/群组
- **自动清理**: 过期会话自动删除

## 🔧 高级配置

### 多用户/群组配置

如果需要为多个用户或群组提供服务，可以使用白名单功能：

```bash
FEISHU_WHITELIST=ou_user1,ou_user2,oc_group1,oc_group2
```

### 反向代理配置

如果使用Nginx反向代理，配置示例：

```nginx
server {
    listen 443 ssl;
    server_name your-domain.com;
    
    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;
    
    location /webhook/feishu {
        proxy_pass http://localhost:3002;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### Docker部署

```dockerfile
FROM node:16-alpine

WORKDIR /app
COPY package*.json ./
RUN npm install

COPY . .
EXPOSE 3002

CMD ["npm", "run", "feishu"]
```

## 🛠️ 故障排除

### 常见问题

**1. 接收不到通知**
- 检查 `FEISHU_ENABLED=true`
- 验证飞书应用权限配置
- 确认webhook URL配置正确
- 查看服务器日志

**2. 命令执行失败**
- 确认令牌未过期（24小时有效期）
- 检查命令格式是否正确
- 验证用户/群组是否在白名单中

**3. Webhook验证失败**
- 确认 `FEISHU_VERIFICATION_TOKEN` 配置正确
- 检查服务器是否可以公网访问
- 验证SSL证书有效性

### 调试模式

启用详细日志：

```bash
LOG_LEVEL=debug npm run feishu
```

### 测试配置

测试飞书集成是否正常工作：

```bash
# 测试通知功能
node claude-hook-notify.js completed

# 测试webhook服务器
npm run feishu
```

## 🔒 安全说明

### 认证机制

- **应用认证**: 使用App ID + App Secret获取access token
- **Webhook验证**: 验证请求签名和verification token
- **会话令牌**: 8位随机令牌，24小时过期
- **白名单**: 可配置允许的用户/群组ID

### 最佳实践

1. **定期轮换密钥**: 定期更新App Secret和Verification Token
2. **使用HTTPS**: 确保webhook服务器使用SSL加密
3. **限制访问**: 使用防火墙限制服务器访问
4. **监控日志**: 定期检查访问日志和错误日志

## 📞 支持与反馈

如果遇到问题或有改进建议：

1. 查看项目 [GitHub Issues](https://github.com/JessyTsui/Claude-Code-Remote/issues)
2. 检查现有文档和FAQ
3. 提交详细的错误报告

## 🎉 更新日志

### v1.0.0 (2025-09-07)
- ✅ 首次发布飞书集成功能
- ✅ 支持消息通知和命令中继
- ✅ 完整的会话管理和安全机制
- ✅ 多用户/群组支持
- ✅ 详细的配置文档

---

**🚀 现在您可以通过飞书远程控制Claude Code了！**