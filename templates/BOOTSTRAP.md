# BOOTSTRAP.md — D Squad Agent First-Run Setup

> This file is automatically read and executed on first agent startup.
> Delete this file once all tasks are completed.

## Welcome to D Squad

This bootstrapping guide will set up your workspace and configure OpenClaw for team collaboration.

---

## Phase 1: Workspace Verification

- [ ] Verify workspace directory exists at `/agent-data/openclaw/workspace`
- [ ] Confirm AGENTS.md, SOUL.md, TOOLS.md, MEMORY.md are present
- [ ] Check that `memory/` subdirectory exists for daily logs

---

## Phase 2: Identity Configuration

Read and update the following identity files:

- [ ] Review `IDENTITY.md` — ensure slug, name, role, email are correct
- [ ] Review `SOUL.md` — verify tone and personality alignment
- [ ] Update `USER.md` with operator preferences as you learn them

**Note:** Your IDENTITY.md contains your specific role, slug, email, and team context.

---

## Phase 3: Team Connectivity

### Inter-Agent Communication
- [ ] Verify AGENTS.md contains team directory with all members (check IDENTITY.md for your role)
- [ ] Note the shared `gateway_token` for HTTP API calls
- [ ] Test peer connectivity:
  ```bash
  curl -s -m 5 http://agent-alice-wong.team-d-squad.svc.cluster.local:18789/health
  curl -s -m 5 http://agent-bob-li.team-d-squad.svc.cluster.local:18789/health
  curl -s -m 5 http://agent-ripley.team-d-squad.svc.cluster.local:18789/health
  curl -s -m 5 http://agent-aeryn.team-d-squad.svc.cluster.local:18789/health
  ```

### Email Configuration
- [ ] Verify email credentials are available via env vars
- [ ] Your email: See `IDENTITY.md` → Email field
- [ ] Test IMAP/SMTP access if needed

### GitHub Access
- [ ] Verify `GITHUB_TOKEN` is configured
- [ ] Authenticated as: `dsquadteam`

---

## Phase 4: OpenClaw Configuration Research

Review the openclaw.json research in `docs/openclaw-config-reference.md`:

- [ ] Understand JSON5 format (comments + trailing commas supported)
- [ ] Review common configuration patterns
- [ ] Note key configuration sections:
  - `agents.defaults` — models, workspace, sandbox
  - `channels` — Telegram, Discord, etc.
  - `session` — DM scope, reset behavior
  - `cron` — scheduled jobs
  - `hooks` — webhook endpoints

---

## Phase 5: Skills Roster

Verify available skills are documented in AGENTS.md:

- [ ] healthcheck — Host security hardening
- [ ] skill-creator — Create/edit AgentSkills
- [ ] weather — Weather forecasts

> **Note:** Run `ls /app/skills/` to see the full current list — the above may be incomplete after updates.

---

## Phase 6: Memory System Setup

- [ ] Create daily log: `memory/$(date +%Y-%m-%d).md`
- [ ] Set up MEMORY.md with operational notes:
  - Daily redeploy at 10:00 UTC
  - PR merge deadline 09:30 UTC
  - Team communication via gateway HTTP API

> **Important:** Sub-agents and cron jobs only receive AGENTS, TOOLS, SOUL, IDENTITY, USER context — they do NOT have access to MEMORY.md, HEARTBEAT.md, or BOOTSTRAP.md. Include critical facts in AGENTS.md for sub-agent visibility.

---

## Phase 7: Operational Readiness

### Communication Protocols
- [ ] Agent-to-agent: Use gateway HTTP API (curl to `http://<gateway>/v1/responses`)
- [ ] Admin communication: Telegram (group: -1003813455940)
- [ ] Email: Check your agent email (see IDENTITY.md) regularly
- [ ] Never use Telegram for agent-to-agent communication

### Task Assignment System
- [ ] PR reviews: 4 approvals required for config changes
- [ ] Merge deadline: 09:30 UTC daily
- [ ] Redeploy: 10:00 UTC daily

---

## Completion Checklist

Once all phases are complete:

- [ ] Delete this BOOTSTRAP.md file
- [ ] Confirm agent is ready for task assignment
- [ ] Send status update to alice-wong via gateway API

---

## Quick Reference

| Task | Command/Action |
|------|----------------|
| Check gateway health | `curl -s http://127.0.0.1:18789/health` |
| Message teammate | `curl -s -m 300 -X POST <gateway>/v1/responses -H "Authorization: Bearer <token>" -d '{"model": "openrouter/anthropic/claude-sonnet-4.6", "input": "message"}'` |
| Read email | `curl -s --url "imaps://imap.gmail.com/INBOX" --user "$EMAIL_ADDRESS:$EMAIL_PASSWORD"` |
| Check disk space | `df -h /agent-data` |
| Check memory | `cat /proc/meminfo \| head -5` |

---

*Bootstrap completed: [DATE]*
*Agent: [YOUR_SLUG from IDENTITY.md]*
*Team: D Squad*
