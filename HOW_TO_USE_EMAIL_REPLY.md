# TaskPing Email Reply Feature Guide

**English** | [中文](./HOW_TO_USE_EMAIL_REPLY_ZH.md)

## 📋 Complete Usage Workflow

### Step 1: Start Email Listening Service
Run in Terminal 1:
```bash
cd /Users/jessytsui/dev/TaskPing
npm run relay:pty
```

This will start the email listening service, monitoring replies to `noreply@example.com`.

### Step 2: Start Claude Code and Integrate TaskPing
Run in Terminal 2:
```bash
# Start Claude Code
claude

# Use TaskPing in Claude Code to send email notifications
# Example: Email notifications will be sent automatically when tasks complete
```

### Step 3: Configure Claude Code Hooks (if not configured)
Run in Claude Code:
```bash
# View current hook configuration
cat ~/.config/claude-code/settings/hooks.json

# If not configured, set up TaskPing hooks
# Copy TaskPing's hook configuration file
```

## 📧 Email Reply Test Workflow

### Method 1: Manual Email Test
```bash
# Run in TaskPing directory
node test-smtp-token.js
```

This will send a test email to `user@example.com` with a subject containing Token format:
`[TaskPing #XXXXXXXX] Claude Code Task Completed - TaskPing-Token-Test`

### Method 2: Integration Test
1. Execute a task in Claude Code
2. After task completion, TaskPing will automatically send email notification
3. Email will be sent to configured mailbox (`user@example.com`)

## 💌 How to Reply to Send Commands

### After Receiving Email:
1. Receive email at `user@example.com` with subject like:
   ```
   [TaskPing #A53PXR7F] Claude Code Task Completed - Project Name
   ```

2. **Reply directly to the email** with commands in the body:
   ```
   Continue optimizing code
   ```
   or
   ```
   Generate unit tests
   ```
   or
   ```
   Explain the purpose of this function
   ```

3. After sending reply, the email listening service will:
   - Receive the reply email
   - Extract the Token (A53PXR7F)
   - Find corresponding PTY session
   - Inject command into Claude Code CLI

## 🔧 Configuration File Description

### .env Configuration
```env
# Outgoing Mail Configuration (Feishu Email)
SMTP_HOST=smtp.feishu.cn
SMTP_USER=noreply@example.com
SMTP_PASS=your-smtp-password

# Incoming Mail Configuration (Feishu Email)  
IMAP_HOST=imap.feishu.cn
IMAP_USER=noreply@example.com
IMAP_PASS=your-imap-password

# User Notification Email
EMAIL_TO=user@example.com

# Allowed Command Senders (Security Whitelist)
ALLOWED_SENDERS=user@example.com
```

## 🐛 Troubleshooting

### 1. Not Receiving Email Replies
Check:
- Email listening service is running (`npm run relay:pty`)
- Reply is sent from whitelisted email (`user@example.com`)
- Email subject contains correct Token format

### 2. Commands Not Injected into Claude Code
Check:
- Claude Code is still running
- PTY session is still valid (Token not expired)
- Check service log output

### 3. View Debug Logs
```bash
# View detailed email listening logs
DEBUG=true npm run relay:pty
```

## 📱 Supported Email Clients

Users can reply from any email to `noreply@example.com`:
- ✅ Gmail Web/Client
- ✅ Mobile Gmail App
- ✅ Apple Mail
- ✅ Outlook
- ✅ QQ Mail
- ✅ 163 Mail
- ✅ Any SMTP-supported email

## 🔒 Security Features

1. **Token Verification**: Each session has unique Token to prevent misoperation
2. **Sender Whitelist**: Only authorized emails can send commands
3. **Session Expiry**: Token valid for 24 hours
4. **Command Filtering**: Automatically filters potentially dangerous commands

## 🎯 Real-world Use Cases

### Scenario 1: Long Build Process
```
1. Start project build in Claude Code
2. Leave computer, receive build completion email on phone
3. Reply directly from phone: "Continue deployment to production"
4. Deployment completed when returning to computer
```

### Scenario 2: Code Review
```
1. Claude Code completes code generation
2. Receive email notification
3. Reply: "Please add unit tests and documentation"
4. Claude automatically generates tests and docs
```

This enables true remote control of Claude Code!