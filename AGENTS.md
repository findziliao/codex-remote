# Repository Guidelines

## Project Structure & Module Organization
- `src/core/`: configuration (`config`), logging (`logger`), multi‑channel notifier (`notifier`).
- `src/channels/`: platform adapters (`email/`, `telegram/`, `line/`, `local/`).
- `src/relay/`: command injection/bridge (`tmux-injector`, `smart-injector`, `command-relay`).
- `src/utils/`: `tmux-monitor`, `conversation-tracker`, `trace-capture`, `subagent-tracker`.
- Entrypoints: `claude-remote.js` (CLI), `claude-hook-notify.js` (hook), `start-*.js` (service launchers).
- Config & assets: `config/`, `assets/`, `docs/`, `logs/`.

## Build, Test, and Development Commands
- Install deps: `npm install`
- Start all enabled services: `npm run webhooks` or `node start-all-webhooks.js`
- Start single channel: `npm run telegram` | `npm run line` | `npm run feishu`
- Email daemon: `npm run daemon:start` | stop with `npm run daemon:stop`
- Quick diagnostics: `node claude-remote.js status` | `diagnose` | `test`
- Send test notification: `node claude-hook-notify.js completed`

## Coding Style & Naming Conventions
- Node.js (>=14), CommonJS (`require/module.exports`).
- Indentation 4 spaces; semicolons; single quotes.
- Filenames: kebab-case (`smart-monitor.js`); classes: PascalCase; vars/functions: camelCase.
- Use `src/core/logger` for logs (no `console.log` in production).
- Configuration via `.env` and `config/*.json`; never hardcode secrets.

## Testing Guidelines
- No formal test runner yet; use provided scripts:
  - Integration: `node claude-remote.js test`
  - Channel checks: `node test-telegram-notification.js`, `node test-real-notification.js`
  - Injection: `node test-injection.js`
- End‑to‑end: run Claude in tmux, enable hooks, then `npm run webhooks` and reply via the channel.
- Place new test utilities at repo root as `test-*.js`; keep output structured via the logger.

## Commit & Pull Request Guidelines
- Conventional Commits: `type(scope): description`.
  - Examples: `feat(telegram): add inline keyboard support`; `fix(email): handle SMTP timeout #123`.
- Branches: `feature/...`, `fix/...`, `docs/...`.
- PRs must include: clear description, linked issues (`Fixes #123`), affected platforms tested (Email/Telegram/LINE/Desktop), no secrets, proper error handling, and updated docs if APIs/config changed.

## Security & Configuration Tips
- Copy `.env.example` to `.env`; do not commit `.env`.
- Prefer env vars and `config/channels.json` for credentials.
- Validate all external inputs (webhooks, email) and use tokenized sessions (`src/data/`).

