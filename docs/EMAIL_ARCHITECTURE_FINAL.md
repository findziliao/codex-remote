# TaskPing 邮件架构说明

## 📧 正确的邮件流程

### 1. 服务端配置（TaskPing 系统）

```
发送邮箱: noreply@pandalla.ai (飞书邮箱)
接收邮箱: noreply@pandalla.ai (飞书邮箱)
```

**用途**：
- 发送通知邮件给用户
- 接收用户的回复命令
- 处理邮件并注入到 Claude Code CLI

### 2. 用户端配置

```
通知接收邮箱: jiaxicui446@gmail.com (可配置为任意邮箱)
回复目标邮箱: noreply@pandalla.ai
```

**用途**：
- 接收 TaskPing 的任务通知
- 从任意邮箱回复命令到服务端

## 🔄 邮件流程图

```
1. 任务通知流程：
   TaskPing 系统 → noreply@pandalla.ai → jiaxicui446@gmail.com
   
2. 命令回复流程：
   用户邮箱(任意) → noreply@pandalla.ai → TaskPing 系统 → Claude Code CLI
```

## 📱 支持的用户邮箱

用户可以从以下**任意邮箱**发送回复到 `noreply@pandalla.ai`：

- ✅ Gmail (`jiaxicui446@gmail.com`)
- ✅ QQ邮箱 (`xxx@qq.com`)
- ✅ 163邮箱 (`xxx@163.com`)
- ✅ Outlook (`xxx@outlook.com`)
- ✅ 企业邮箱 (`xxx@company.com`)
- ✅ 任何支持SMTP的邮箱

## 🔧 配置文件

### .env 配置

```env
# 发件配置（飞书邮箱）
SMTP_HOST=smtp.feishu.cn
SMTP_USER=noreply@pandalla.ai
SMTP_PASS=kKgS3tNReRTL3RQC

# 收件配置（飞书邮箱）
IMAP_HOST=imap.feishu.cn
IMAP_USER=noreply@pandalla.ai
IMAP_PASS=kKgS3tNReRTL3RQC

# 用户通知邮箱（可配置）
EMAIL_TO=jiaxicui446@gmail.com

# 白名单（可配置多个用户邮箱）
ALLOWED_SENDERS=jiaxicui446@gmail.com
```

## 📝 使用方法

### 1. 接收通知
用户在 `jiaxicui446@gmail.com` 收到类似邮件：
```
发件人: TaskPing 通知系统 <noreply@pandalla.ai>
主题: [TaskPing #ABC123] 任务等待您的指示
内容: 任务详情...
```

### 2. 发送命令
用户可以：

**方式1：直接回复**
- 直接回复邮件
- 输入命令，如：`继续执行`

**方式2：新邮件**
- 从任意邮箱发送到 `noreply@pandalla.ai`
- 主题包含：`[TaskPing #ABC123]`
- 内容为命令

### 3. 系统处理
1. 飞书邮箱接收用户回复
2. TaskPing 解析命令
3. 通过 PTY 注入到 Claude Code
4. 任务继续执行

## 🔒 安全特性

1. **发件人验证**：只有白名单中的邮箱可以发送命令
2. **Token验证**：邮件主题必须包含有效的会话Token
3. **命令过滤**：自动过滤危险命令
4. **会话过期**：Token有时间限制
5. **去重处理**：防止重复执行同一命令

## 🚀 优势

1. **统一管理**：服务端使用单一邮箱管理
2. **用户灵活**：用户可用任意邮箱接收和回复
3. **简单配置**：只需配置一个飞书邮箱
4. **多用户支持**：可配置多个用户邮箱到白名单
5. **跨平台**：支持所有邮件客户端

## 📊 实际场景

### 场景1：移动办公
```
1. 开发者在电脑上运行 Claude Code 构建项目
2. 离开电脑，在手机 Gmail 收到构建完成通知
3. 直接在手机回复："继续部署"
4. 电脑上的 Claude Code 自动执行部署命令
```

### 场景2：团队协作
```
1. 团队领导 leader@company.com 收到项目通知
2. 从企业邮箱回复："批准发布"
3. 系统自动执行发布流程
4. 所有团队成员收到发布完成通知
```

### 场景3：多设备同步
```
1. 在办公室电脑启动长时间任务
2. 回家路上用个人 QQ 邮箱收到通知
3. 在家用 163 邮箱发送下一步指令
4. 办公室电脑自动执行，第二天查看结果
```

这种架构实现了：
- 服务端邮箱统一管理
- 用户邮箱灵活配置
- 多邮箱品牌支持
- 简单可靠的通信机制