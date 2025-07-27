# TaskPing - Intelligent Email Automation Assistant for Claude Code

TaskPing is an intelligent email automation tool that deeply integrates Claude Code with email systems. By monitoring email replies, it automatically inputs reply content into corresponding Claude Code sessions for execution, allowing you to remotely control Claude Code from anywhere via email.

## 🚀 Core Features

### 📧 Smart Email Notifications
- **Auto Detection**: Based on Claude Code official hooks mechanism, automatically identifies task completion and waiting input states
- **Real-time Notifications**: Automatically sends emails when tasks complete, including complete user questions and Claude responses
- **Session Binding**: Emails are bound to specific tmux sessions, ensuring replies go to the correct Claude Code window

### 🔄 Email Reply Auto-Execution
- **Remote Control**: Directly reply to emails, content automatically inputs into corresponding Claude Code sessions
- **Smart Injection**: Automatically detects tmux session state, precisely injects commands into correct windows
- **Duplicate Prevention**: Implements email deduplication mechanism to avoid processing the same email twice

### 🛡️ Stability Assurance
- **Single Instance**: Ensures only one email monitoring process runs, avoiding duplicate processing
- **State Management**: Comprehensive session state tracking and error recovery mechanisms
- **Security Verification**: Email source verification, ensures only authorized user replies are processed

## 📦 Installation and Setup

### 1. Clone and Install
```bash
git clone https://github.com/JessyTsui/TaskPing.git
cd TaskPing
npm install
```

### 2. Test Basic Functionality
```bash
# Test the main program
node taskping.js --help

# Check system status  
node taskping.js status

# Test notifications (desktop only, no email config needed)
node taskping.js test
```

### 3. Configure Email (Required for Remote Control)

#### 📧 Email Configuration (.env file)
Create and edit the `.env` file in project root:

```bash
# Copy example configuration
cp .env.example .env

# Edit with your settings
nano .env
```

**Required .env Configuration:**
```env
# ===== SMTP (发送邮件) =====
SMTP_HOST=smtp.your-domain.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=your-email@domain.com
SMTP_PASS=your-app-password

# ===== IMAP (接收邮件) =====  
IMAP_HOST=imap.your-domain.com
IMAP_PORT=993
IMAP_SECURE=true
IMAP_USER=your-email@domain.com
IMAP_PASS=your-app-password

# ===== 邮件路由 =====
EMAIL_TO=your-notification-email@gmail.com    # 接收通知的邮箱
ALLOWED_SENDERS=your-notification-email@gmail.com  # 允许发送命令的邮箱
```

**🔑 Common Email Providers:**
- **Gmail**: `smtp.gmail.com:587`, `imap.gmail.com:993` (需要应用密码)
- **Outlook**: `smtp-mail.outlook.com:587`, `outlook.office365.com:993`
- **飞书**: `smtp.feishu.cn:465`, `imap.feishu.cn:993`

### 4. Install Global Commands (Optional but Recommended)
```bash
# Install claude-control global command
node install-global.js

# Verify installation
claude-control --help
```

### 5. Configure Claude Code Hooks (Required for Auto-Notifications)
Add to `~/.claude/settings.json`:

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

Replace `/path/to/TaskPing` with your actual project path.

## ⚡ Quick Start (New Users)

**Just cloned? Try this 5-minute setup:**

```bash
# 1. Install dependencies
npm install

# 2. Test basic functionality (desktop notifications)
node taskping.js --help
node taskping.js status
node taskping.js test
```

**Result**: ✅ Desktop notifications work immediately!

### 🔄 Want Email + Remote Control? Continue:

```bash
# 3. Create email configuration
cp .env.example .env
# Edit .env with your email settings (see configuration section below)

# 4. Configure Claude Code hooks
# Edit ~/.claude/settings.json (see configuration section below)

# 5. Start email monitoring service
npm run relay:pty
```

**Result**: ✅ Full remote email control enabled!

## 🚀 How to Run After Clone

### 🎯 Three Main Running Modes

#### 🔔 Mode 1: Desktop Notification Only (Simplest)
**Use Case**: Just want desktop notifications when Claude completes tasks

```bash
# 1. Basic setup
npm install
node taskping.js test

# 2. Configure Claude hooks (see step 5 above)  
# 3. Use Claude Code normally
```
**Result**: ✅ Desktop notifications ❌ Email features

#### 📧 Mode 2: Desktop + Email Notifications  
**Use Case**: Want both desktop and email notifications, no remote control

```bash
# 1. Basic setup + email configuration
npm install
# Configure .env file

# 2. Test email functionality
node taskping.js test

# 3. Configure Claude hooks and use normally
```
**Result**: ✅ Desktop notifications ✅ Email notifications ❌ Remote control

#### 🚀 Mode 3: Full Remote Control System (Complete Solution)
**Use Case**: Complete remote control via email replies

```bash
# 1. Complete setup (all configuration steps above)

# 2. Start email monitoring service
npm run relay:pty

# 3. Use Claude Code normally
# 4. Reply to emails to control remotely
```
**Result**: ✅ Desktop notifications ✅ Email notifications ✅ Remote email control

### 🎮 Complete Usage Workflow

#### 🔧 Initial Setup (One-time)
```bash
# 1. Clone and install
git clone https://github.com/JessyTsui/TaskPing.git
cd TaskPing
npm install

# 2. Configure email (for remote control)
cp .env.example .env
nano .env  # Edit with your email settings

# 3. Configure Claude Code hooks
nano ~/.claude/settings.json
```

**Add to `~/.claude/settings.json`:**
```json
{
  "hooks": {
    "Stop": [{
      "matcher": "*",
      "hooks": [{
        "type": "command",
        "command": "node /your/path/to/TaskPing/taskping.js notify --type completed",
        "timeout": 5
      }]
    }],
    "SubagentStop": [{
      "matcher": "*",
      "hooks": [{
        "type": "command",
        "command": "node /your/path/to/TaskPing/taskping.js notify --type waiting",
        "timeout": 5
      }]
    }]
  }
}
```

#### 🚀 Daily Usage

**Step 1: Start Email Monitoring (Remote Control Mode)**
```bash
# Start email monitoring service (keeps running)
npm run relay:pty
```

**Step 2: Use Claude Code Normally**
```bash
# In a new terminal, start Claude Code
tmux new-session -d -s my-project
tmux attach -t my-project
claude

# Or simply
claude
```

**Step 3: Work and Control Remotely**
1. 💬 **Use Claude normally**: Ask questions, give tasks
2. 📧 **Get notifications**: When Claude completes tasks, receive email
3. 📨 **Reply to control**: Reply to notification emails with new commands
4. 🔄 **Auto execution**: Your email replies automatically execute in Claude

#### 📧 Email Control Examples

**Received notification email:**
```
Subject: TaskPing 任务完成通知 [#ABC123]

Claude has completed your task:
"Please analyze the project structure"

Reply to this email to send new commands.
Token: ABC123
```

**Send commands by replying:**
```
Please continue with the performance analysis
```

**Or use explicit command format:**
```
CMD: help me optimize the database queries
```

**Or code blocks:**
```
please run:
```
npm test
```
```

#### 🎯 Advanced Usage Patterns

**Pattern 1: Long-running Projects**
```bash
# Start persistent session
tmux new-session -d -s project-alpha
tmux attach -t project-alpha

# Start TaskPing monitoring
npm run relay:pty  # In background terminal

# Work remotely via email all day
```

**Pattern 2: Multiple Projects**
```bash
# Project A
tmux new-session -d -s project-a
# Project B  
tmux new-session -d -s project-b

# Each session gets unique email tokens
# Control different projects via email
```

### 🔧 Service Management Commands

```bash
# Email Monitoring Service
npm run relay:pty              # Start email monitoring (foreground)
# Use Ctrl+C to stop

# System Status
node taskping.js status        # View overall system status
node taskping.js test          # Test all notification channels

# Command Queue Management  
node taskping.js commands list    # View pending email commands
node taskping.js commands status  # Check command processing status
node taskping.js commands clear   # Clear command queue

# Configuration
node taskping.js config        # Interactive configuration wizard
```

### 📊 How It Works

1. **🔗 Integration**: Claude Code hooks automatically trigger TaskPing
2. **📧 Notification**: Email sent when Claude completes tasks (includes session token)
3. **📨 Reply Processing**: Your email replies are parsed for commands  
4. **🔄 Auto Injection**: Commands automatically injected into the correct Claude session
5. **🛡️ Security**: Only whitelisted email addresses can send commands

## 🔧 Project Architecture

```
TaskPing/
├── src/
│   ├── channels/email/
│   │   └── smtp.js           # SMTP email sending
│   ├── core/
│   │   ├── config.js         # Configuration management
│   │   ├── logger.js         # Logging system
│   │   └── notifier.js       # Notification coordinator
│   ├── data/
│   │   ├── session-map.json  # Session mapping table
│   │   └── processed-messages.json  # Processed email records
│   ├── relay/
│   │   └── relay-pty.js      # Email monitoring and PTY injection service
│   └── utils/
│       └── tmux-monitor.js   # Tmux session monitoring
├── taskping.js               # Main entry file
├── claude-control.js         # Claude Code session management
├── start-relay-pty.js        # Email monitoring service starter
└── install-global.js         # Global installation script
```

## 🛠️ Core Technical Implementation

### Email Monitoring and Processing
- Uses `node-imap` to monitor IMAP mailbox for new emails
- Implements email deduplication mechanism (based on UID, messageId, and content hash)
- Asynchronous event handling to avoid race conditions

### Session Management
- Tmux session auto-detection and command injection
- Session state persistent storage
- Support for concurrent multi-session processing

### Notification System
- Automatically captures current tmux session's user questions and Claude responses
- Generates email notifications containing complete conversation content
- Supports multiple notification channels (desktop notifications, email, etc.)

## 🔍 Troubleshooting

### ❓ Common Issues & Solutions

#### 🔧 Setup Problems

**"npm install" fails:**
```bash
# Check Node.js version (requires 14+)
node -v

# Fix package.json issues
npm install

# If still failing, try
rm -rf node_modules package-lock.json
npm install
```

**"Module not found" errors:**
```bash
# Make sure you're in the right directory
pwd
ls package.json taskping.js  # Should exist

# Reinstall dependencies
npm install
```

#### 📧 Email Issues

**Test email configuration:**
```bash
# Check configuration status
node taskping.js status

# Test email sending  
node taskping.js test

# Check .env file
cat .env
```

**Email not working:**
```bash
# Common fixes:
# 1. Check SMTP/IMAP settings in .env
# 2. Verify email passwords (use app passwords for Gmail)
# 3. Check firewall/network connectivity
# 4. Ensure ports are correct (465/587 for SMTP, 993 for IMAP)
```

#### 🔄 Remote Control Issues

**Email monitoring not starting:**
```bash
# Start monitoring service
npm run relay:pty

# If fails, check:
cat .env  # Verify email configuration
ps aux | grep relay  # Check for conflicts
```

**Commands not executing:**
```bash
# Check Claude session exists
tmux list-sessions

# Verify command queue
node taskping.js commands list

# Check allowed senders in .env
grep ALLOWED_SENDERS .env
```

**Claude hooks not triggering:**
```bash
# Verify hooks configuration
cat ~/.claude/settings.json

# Test hook manually
node taskping.js notify --type completed

# Check file paths in hooks configuration
```

#### 🐛 System Issues

**Multiple processes running:**
```bash
# Check running processes
ps aux | grep -E "(relay-pty|taskping)"

# Stop all TaskPing processes
pkill -f relay-pty
pkill -f taskping

# Restart clean
npm run relay:pty
```

**Desktop notifications not working (macOS):**
```bash
# Test notifications
node taskping.js test

# Check macOS notification permissions:
# System Preferences > Notifications & Focus > Terminal
```

**Session management issues:**
```bash
# Clean session data
rm src/data/session-map.json

# Restart email monitoring
npm run relay:pty

# Check session creation logs
```

## 🎯 Use Cases

### Remote Programming Workflow
1. Start a Claude Code code review task at the office
2. Go home, receive email "Code review completed, found 3 issues"
3. Reply to email "Please fix the first issue"
4. Claude automatically starts fixing, sends email notification when complete
5. Continue replying to emails for next steps

### Long-running Task Monitoring
1. Start large project refactoring task
2. Claude completes modules step by step
3. Each stage completion sends email notification of progress
4. Guide next steps through email replies

## 🤝 Contributing

1. Fork this project
2. Create feature branch: `git checkout -b feature/new-feature`
3. Commit changes: `git commit -am 'Add new feature'`
4. Push branch: `git push origin feature/new-feature`
5. Submit Pull Request

## 📄 License

This project is licensed under the MIT License.

---

**Make Claude Code workflows smarter and more efficient!**

If this project helps you, please give us a ⭐!