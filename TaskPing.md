# Claude Code Notify Assistant – Product Specification

## 1  Purpose & Vision

Provide developers with an **event‑driven companion** for Claude‑powered CLI sessions. When a long‑running task finishes, the assistant instantly notifies the user on their preferred channel and lets them **reply from mobile to trigger the next command**, achieving a seamless *desktop↔mobile↔AI* loop.

---

## 2  Problem Statement

CLI workflows often involve scripts that run for minutes or hours. Users must poll the terminal or stay near the computer, wasting time and focus. Existing notification tools are channel‑specific or lack bi‑directional control, and none are optimised for Claude Code agents.

---

## 3  Solution Overview

1. **CLI Hook**: A tiny cross‑platform wrapper (`claude-notify run <cmd>`) that executes any shell command, streams logs to the backend, and raises a `TaskFinished` event when exit‑code ≠ “running”.
2. **Notification Orchestrator (backend)**: Consumes events, applies user quota/business rules, and fan‑outs messages via pluggable channel adapters.
3. **Interactive Relay**: Converts user replies (e.g., from Telegram) into authenticated API calls that queue the next CLI command on the origin machine through a persistent WebSocket tunnel.
4. **Usage Metering**: Tracks daily quota (3 e‑mails for free tier) and subscription status (Stripe webhook).

---

## 4  Personas & User Journeys

| Persona                    | Primary Goal                          | Typical Flow                                                                                                                                 |
| -------------------------- | ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| **Indie Dev – Free**       | Compile & test large project remotely | 1) `claude-notify run make` → 2) E‑mail sent on finish → 3) Next morning sees mail; quota resets                                             |
| **Startup Engineer – Pro** | Continuous fine‑tuning jobs on GPU VM | 1) Task completes → 2) Telegram alert with success log snippet → 3) Replies `launch next.sh` from subway → 4) Claude Code executes instantly |
| **Ops Lead – Pro**         | Batch data pipelines                  | 1) Weekly cron triggers job → 2) Feishu group ping with status + link to dashboard                                                           |

---

## 5  Feature Matrix

| Area                     | Free        | Pro (USD 4.9/mo)                                 |
| ------------------------ | ----------- | ------------------------------------------------ |
| Daily notification quota | 3           | Unlimited                                        |
| Channels                 | E‑mail      | E‑mail, Discord, Telegram, SMS, Feishu, Webhooks |
| Command Relay            | —           | ✅                                                |
| Notification Templates   | Default     | Custom markdown & rich‑link cards                |
| Log Attachment           | 10 KB tail  | Full log (configurable)                          |
| Team Workspaces          | —           | Up to 5 members                                  |
| SLA                      | Best effort | 99.9 %                                           |

---

## 6  System Architecture

```
+-----------+                 HTTPS / WSS                  +-----------------+
| CLI Agent |  <──────────▶  API Gateway   ───────────▶  |  Auth Service   |
|  (Go/Rust)|                                            +-----------------+
|           |── stream logs ─▶  Event Queue (NATS) ──▶  Task Processor
+-----------+                                            │(Python Worker)
          ▲                                                │              │
          │ SSH/WebSocket                                  │              │
          │                                                ▼              ▼
          │                                    +-----------------+  +-----------------+
          │                                    | Notification    |  |  Usage / Billing|
          └── receive command ◀── Relay ◀──────┤   Fan‑out       |  |  (Postgres +   |
                                               +-----------------+  |   Stripe)      |
```

**Tech choices**

- **CLI Agent**: Rust binary, \~3 MB, single‑file, auto‑updates (GitHub Releases).
- **Backend**: FastAPI + Celery, Redis broker, Postgres store.
- **Channel Adapters**: Modular; each implements `send(message: Notification) -> DeliveryResult`.
- **Security**: JWT (CLI) + signed HMAC Webhook secrets; all data in‑flight TLS 1.2+.
- **Scaling**: Horizontal via Kubernetes; stateless workers.

---

## 7  API Contracts (simplified)

```http
POST /v1/tasks
{
  "cmd": "python train.py",
  "session_id": "abc",
  "notify_on": "exit", // or "partial", "custom_regex"
  "channels": ["email", "tg"]
}
→ 201 Created {"task_id":"t123"}

POST /v1/commands
Authorization: Bearer <mobile_reply_token>
{
  "session_id": "abc",
  "command": "git pull && make test"
}
→ 202 Accepted
```

*Complete OpenAPI spec in appendix.*

---

## 8  Data Model (Postgres)

```sql
CREATE TABLE users (
  id UUID PK, email TEXT UNIQUE, plan TEXT, quota_used INT, …
);
CREATE TABLE tasks (
  id UUID PK, user_id FK, session_id TEXT, cmd TEXT, status TEXT,
  started_at TIMESTAMPTZ, finished_at TIMESTAMPTZ, log_url TEXT, …
);
CREATE TABLE notifications (
  id UUID PK, task_id FK, channel TEXT, delivered BOOL, …
);
```

---

## 9  Quota & Pricing Logic

```text
If plan == "free":
    limit daily_sent_email <= 3
    reject other channel
Else if plan == "pro":
    no channel limit
    fair‑use: 30 SMS / day default
```

Billing via **Stripe Billing Portal**; pro‑rated upgrades.

---

## 10  On‑boarding Flow

1. OAuth (GitHub) or E‑mail link signup.
2. Download CLI (`curl -sL https://cli.claude‑notify.sh | bash`).
3. `claude-notify login <token>` – stores token locally.
4. Configure channels in Web UI (Discord bot auth, etc.).
5. First task run offers interactive tour.

---

## 11  Operational & Security Considerations

- **Secrets**: Only hash task logs > 10 MB for storage; encrypt full logs (AES‑256‑GCM) at rest.
- **Abuse prevention**: Per‑minute rate limits on incoming mobile commands; banlist keywords.
- **Observability**: Prometheus metrics, Grafana dashboard; Sentry for exceptions.
- **Compliance**: GDPR + China PIPL data residency via multi‑region storage.

---

## 11a Implementation Phases

### Phase 1 – Local Desktop Notification MVP

- **Scope**: Notify on local machine only.
- **Trigger**: CLI Agent detects task exit and calls OS‑native notification helper.
- **OS Support**:
  - macOS: `terminal-notifier` or AppleScript.
  - Windows: Toast via `SnoreToast`.
  - Linux: `libnotify`.
- **Customization**: `--title`, `--message`, `--sound=/path/to/file` flags; sensible defaults provided.
- **Offline & Privacy**: No network calls; runs entirely locally.
- **Quota**: Unlimited (cloud quota applies in later phases).
- **Future‑Proofing**: Uses the same `TaskFinished` event schema as the cloud orchestrator, enabling a smooth upgrade path.

### Phase 2 – Cloud Notification Service (E‑mail, Telegram, Discord)

- Add backend Notification Orchestrator, channel adapters, and basic auth.
- Implement daily quota enforcement and Pro billing (Stripe).

### Phase 3 – Mobile Command Relay & Team Features

- Enable interactive replies that queue new commands via WebSocket tunnel.
- Introduce Workspaces, role permissions, and activity audit logs.

---

## 12 Roadmap

| Quarter | Milestone                                                  |
| ------- | ---------------------------------------------------------- |
|  Q3‑25  | MVP (E‑mail + Telegram) / Invite‑only beta                 |
|  Q4‑25  | Payments, Discord & Feishu adapters / Public launch        |
|  Q1‑26  | Mobile app (Flutter) push notifications / Team workspaces  |
|  Q2‑26  | Marketplace for community adapters (e.g., Slack, WhatsApp) |

---

## 13  Open Questions

1. Support for streaming partial logs?
2. Granular role permissions for team plans.
3. Enterprise SSO & on‑prem backend – worth pursuing?
4. Automatic Claude Code context carry‑over between sequential commands.

---

*© 2025 Panda Villa Tech Limited – Internal draft – v0.9*

