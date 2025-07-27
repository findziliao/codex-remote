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

## 📦 Quick Installation

### 1. Clone Project
```bash
git clone https://github.com/JessyTsui/TaskPing.git
cd TaskPing
npm install
```

### 2. Configure Email
```bash
npm run config
```
Follow prompts to configure your email information (SMTP and IMAP).

### 3. Configure Claude Code Hooks
Add the following content to the `hooks` section of `~/.claude/settings.json`:

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

### 4. Install Global claude-control Command
```bash
node install-global.js
```

### 5. Start Email Monitoring Service
```bash
npm run relay:pty
```

## 🎮 Usage

### 1. Create Claude Code Session
```bash
# Can run from any directory
claude-control --session project-name
```

### 2. Use Claude Code Normally
Have normal conversations with Claude in tmux session:
```
> Please help me analyze the code structure of this project

Claude responds...
```

### 3. Automatic Email Notifications
When Claude completes tasks, you'll receive email notifications containing complete conversation content.

### 4. Email Reply Control
Directly reply to emails with your next instruction:
```
Please continue optimizing code performance
```

### 5. Automatic Execution
Your reply will be automatically injected into the corresponding Claude Code session and executed.

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

### Email Duplicate Processing Issue
Ensure only one email monitoring process is running:
```bash
# Check running status
ps aux | grep relay-pty

# Stop all processes
pkill -f relay-pty

# Restart
npm run relay:pty
```

### Command Injection Failure
Check tmux session status:
```bash
# View all sessions
tmux list-sessions

# Check session content
tmux capture-pane -t session-name -p
```

### Email Configuration Issues
Test email connection:
```bash
# Test SMTP
node -e "
const config = require('./config/user.json');
console.log('SMTP Config:', config.email.config.smtp);
"

# Test IMAP
node -e "
const config = require('./config/user.json');
console.log('IMAP Config:', config.email.config.imap);
"
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