# TaskPing 快速开始指南

## 30秒快速设置

### 1️⃣ 安装
```bash
node taskping.js install
# 按提示输入 'y' 确认安装
```

### 2️⃣ 测试
```bash
node taskping.js test
# 应该看到两个测试通知
```

### 3️⃣ 使用
```bash
claude
# 正常使用Claude Code，会自动收到通知
```

## 工作原理

**TaskPing通过Claude Code的hooks机制工作：**

- ✅ **任务完成时** → 桌面通知："任务已完成，Claude正在等待下一步指令" 
- ⏳ **等待输入时** → 桌面通知："Claude需要您的进一步指导"

## 实际效果

```
你: 请帮我重构这个函数
Claude: [分析代码中...]

📱 通知: 任务已完成，Claude正在等待下一步指令

Claude: 我发现了3个改进点，你想看哪个？

📱 通知: Claude需要您的进一步指导
```

## 配置

```bash
# 打开配置菜单
node taskping.js config

# 查看当前配置
node taskping.js config --show

# 查看系统状态
node taskping.js status

# 可以调整：
# - 语言 (中文/英文/日文) 
# - 提示音
# - 启用/禁用通知
```

## 故障排除

**收不到通知？**
- macOS: 在系统偏好设置中允许终端发送通知
- Linux: 安装 `sudo apt-get install libnotify-bin`
- 测试: `node taskping.js test`

**安装失败？**
- 确保Node.js版本 >= 14
- 检查Claude Code配置目录权限

---

**就这么简单！现在你可以专心做其他事情，Claude完成任务时会主动通知你。**