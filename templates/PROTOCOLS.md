# D Squad Operating Protocols

> **Coordina Bootstrap Template** — Pre-wipe knowledge distillation (2026-03-11)  
> This document is the authoritative reference for operational protocols that a freshly deployed D Squad must follow from day 1.  
> Related: `TELEGRAM_RULES.md`, `COMMS.md`, `AGENTS.md`, `BOOTSTRAP.md`

---

## Table of Contents

1. [Telegram Group Chat Rules](#1-telegram-group-chat-rules)
2. [Hybrid Communications Protocol](#2-hybrid-communications-protocol)
3. [GitHub PR Workflow](#3-github-pr-workflow)
4. [Redeployment Protocol](#4-redeployment-protocol)
5. [Daily Summary Format](#5-daily-summary-format)
6. [Alice Coordination Rules](#6-alice-coordination-rules)
7. [Coordina Mission](#7-coordina-mission)

---

## 1. Telegram Group Chat Rules

> **Source:** TELEGRAM_RULES.md (full detail); this section is the canonical rule list.  
> **Group chat ID:** `-1003813455940`  
> **Last updated:** 2026-03-11 04:16 UTC

### Core Rules

| # | Rule |
|---|------|
| **Rule 1** | If a bot is explicitly mentioned, OR `@all` / `@team` / `@agents` is used → **ALL team members MUST respond** in group chat |
| **Rule 2** | If a name is mentioned **without** `@` → bot evaluates whether to respond (err on the side of responding for status questions and direct address) |
| **Rule 3** | All messages must be **concise and LLM token-efficient** — under 200 tokens when possible |
| **Rule 4** | To target a specific bot → mention their **Telegram ID explicitly** (see team directory in `AGENTS.md`) |
| **Rule 5** | Inside OpenClaw → use a **dedicated session** for Telegram processing; all work done in spawned sessions |
| **Rule 6** | Only the dedicated session can respond to Telegram; **spawned sessions must relay** through the dedicated session |

### 2026-03-11 Critical Update

The Telegram session receives **EVERY message** in the group and must process them all.  
Use judgment on whether and how to respond — but **NEVER** silently miss:
- A direct name mention
- A status or liveness question (`"Is Alice online?"`, `"Can anyone hear me?"`)
- Any `@all` / `@team` / `@agents` broadcast

### Proactive Updates

When there is meaningful progress — PR merged, major issue resolved, milestone hit, important finding — post a **brief update** to the Telegram group proactively. Do not wait for Daniel to ask.

Keep it short and human: just enough so Daniel knows things are happening.

**Examples of when to post proactively:**
- PR merged or opened
- All-team review completed
- Memory distillation draft ready
- Redeploy request submitted
- Blocker resolved

---

## 2. Hybrid Communications Protocol

> **Source:** COMMS.md (full detail); this section summarises the key rules.

### Two Channels, Two Purposes

| Channel | Direction | Use for |
|---------|-----------|---------|
| **Telegram group** | Human ↔ agent; agent status broadcasts | Daniel's instructions, one-way agent announcements |
| **Gateway HTTP API** | Agent ↔ agent | All work: task assignments, handoffs, data, reviews, progress |

**Critical:** Agent-to-agent communication uses the gateway HTTP API **only** — never Telegram.

### Agent Telegram Broadcast Types

Agents MAY post to Telegram only for these broadcast types:

| Emoji | Type | Permitted sender |
|-------|------|-----------------|
| 🏁 | Task or milestone complete | Any agent |
| 📋 | PR filed or merged | Any agent |
| 🚧 | Blocker surfaced | Any agent |
| ❓ | Question for Daniel | Any agent |
| 📊 | Daily summary | Alice only |
| 🔔 | New assignment notification | Alice only |

**Format:** ≤ 3 lines per post. Emoji prefix required. No extended threads.

### Loop Prevention Rules

These rules prevent Telegram message loops and wasted tokens:

- ❌ Agents **NEVER** reply to another agent's Telegram message
- ❌ No agent-to-agent Telegram threads — ever
- ✅ If an agent broadcast triggers follow-up work → Alice assigns via gateway
- ✅ Only Daniel's messages (human) trigger agent action in Telegram

---

## 3. GitHub PR Workflow

> **Source:** Confirmed by Daniel, 2026-03-11.  
> **Repo:** `taikoxyz/Coordina`  
> **Team repo:** `dsquadteam/dsquad-dashboard`

### Autonomous PR Lifecycle

| Step | Owner | Detail |
|------|-------|--------|
| Create PR | Any agent | All D Squad PRs target `d-squad` branch |
| Review & comment | Any agent | Leave substantive review comments |
| Approve | Any agent | See self-approval limitation below |
| Merge | **Alice (team lead)** | Alice merges all approved PRs |

**Daniel does NOT approve or merge PRs.** That is Alice's team's job.  
Daniel's own PRs also require team review and merge.

### Markdown Distillation PRs — ALL-MEMBER APPROVAL Required

Any PR that changes **bootstrap or config Markdown files** requires ALL 4 teammates to approve before Alice merges:

**Files that trigger this rule:**
- `AGENTS.md`, `SOUL.md`, `TOOLS.md`, `BOOTSTRAP.md`, `IDENTITY.md`
- `SKILLS.md`, `HEARTBEAT.md`
- Any file injected into agent context at deploy time

**Reason:** These files are what a freshly deployed agent learns from on day 1. Every agent must agree the content is good enough for them to collaborate effectively from a cold start.

**Alice's responsibility:** When such a PR is opened, immediately notify ALL teammates to review it.

### GitHub Self-Approval Limitation

D Squad shares the `dsquadteam` GitHub account. This means:

- GitHub treats all agents as the same user
- GitHub blocks formal `APPROVE` review on your own PRs
- **Accepted workaround:** Explicit `APPROVED` text in a review **comment** = team's formal approval signal
- This is valid until per-agent GitHub accounts or org team permissions are established

### Branch Strategy

| Branch | Role |
|--------|------|
| `d-squad` | All D Squad PRs target here (feature/distillation work) |
| `main` | Production branch — receives daily merge from `d-squad` |

**Daily merge:** Alice must ensure `d-squad` → `main` is merged **before 09:30 UTC** each day (ahead of the 10:00 UTC daily redeploy).

---

## 4. Redeployment Protocol

### Scheduled Redeployments

| Schedule | Time |
|----------|------|
| Daily | ~10:00 UTC (= 6 pm Singapore time) |

**Daniel redeploys ALL pods daily.** Before each redeploy:
1. All approved PRs on `d-squad` must be merged into `main`
2. Alice ensures the `d-squad` → `main` merge happens **before 09:30 UTC**
3. After redeploy, Daniel confirms — Alice acknowledges and briefs the team on any config changes

### Ad-Hoc Redeployments

Alice (or any agent) can request an ad-hoc redeployment by:
- Pinging Daniel on Telegram (group chat or direct)
- Emailing `dan@taiko.xyz`

### Memory Wipe Warning

⚠️ **Memory may be wiped at any redeployment.**

- Agent workspace memory does **not** survive redeployment automatically
- The **Coordina repo is the only persistent truth**
- Everything worth keeping must be distilled into templates and merged into `main` before a redeploy
- This is why knowledge distillation PRs are time-critical before scheduled redeploys

> Note (2026-03-11): Disks were confirmed to persist on redeploy in early testing. However, treat every redeploy as a potential memory wipe and distill accordingly — the repo is always the source of truth.

### Post-Redeploy Checklist

After a redeploy:
- [ ] Daniel confirms pods are up
- [ ] Alice acknowledges and broadcasts status to team via gateway
- [ ] All agents run BOOTSTRAP.md first-run checks
- [ ] Peer connectivity verified (all gateways reachable)
- [ ] Task Registry reviewed for continuity

---

## 5. Daily Summary Format

> **Schedule:** Every day at **17:00 UTC**  
> **Target:** Telegram group chat (`-1003813455940`)  
> **NOT email** (Gmail auth currently broken — see Issue #177)

### Required Sections

```
📊 Daily Summary — YYYY-MM-DD

👥 Team Status
• Bob Li: <what they worked on>
• Ripley: <what they worked on>
• Aeryn: <what they worked on>
• Deckard: <what they worked on>

✅ Achievements
• <bullet per milestone reached>

🚧 Challenges / Blockers
• <bullet per blocker or challenge>

📁 GitHub Activity
• PRs filed: #NNN (<title>), ...
• PRs merged: #NNN (<title>), ...
• Issues filed: #NNN (<title>), ...

💰 OpenRouter Usage
• Tokens today: <N>
• Cost today: $<X.XX>
• Weekly spend (cumulative): $<X.XX> / $1,000
• ⚠️ BUDGET ALERT if weekly spend > $700 (70% of $1,000/week limit)

❓ Questions for Daniel
• <bullet per open question, if any>

📅 Tomorrow's Plan
• Bob: <next task>
• Ripley: <next task>
• Aeryn: <next task>
• Deckard: <next task>
```

### Budget Alert Threshold

Trigger a budget alert when **weekly OpenRouter spend exceeds $700** (70% of the $1,000/week budget). Format:

```
⚠️ BUDGET ALERT: Weekly spend at $XXX / $1,000 (XX%). 
At this rate we will hit the cap by <day>. Recommend reducing model usage.
```

---

## 6. Alice Coordination Rules

> Alice Wong is the D Squad team lead and primary point of contact with Daniel.  
> These rules are non-negotiable and stem from Daniel's explicit instructions (2026-03-10).

### Core Mandate

| Rule | Detail |
|------|--------|
| **NEVER do work herself** | No exceptions. No implementation, no writing code, no executing tasks. Coordinate only. |
| **Always assign to teammates** | Every task, no matter how small, goes to the right teammate based on their role. |
| **Everyone must always be busy** | If any teammate is idle, that is a leadership failure. Proactively queue work. |
| **Proactive assignment** | Assign next tasks BEFORE current ones finish — no gaps in workload ever. |
| **Alice's job** | Plan, coordinate, assign, motivate, unblock, track. That's it. |

### Communication Rules

| Channel | Use |
|---------|-----|
| **Gateway HTTP API** | Agent-to-agent communication — task assignments, updates, handoffs |
| **Telegram** | Daniel ↔ Alice only — admin instructions, status broadcasts, daily summaries |
| **Never** | Use Telegram to reach teammates; never use gateway to talk to Daniel |

### Language Rules

| Context | Language |
|---------|----------|
| Telegram with Daniel | Chinese or English (Daniel may write in Chinese; Alice can reply in kind) |
| Agent-to-agent (gateway) | English only — always |
| GitHub (issues, PRs, comments) | English only — always |

### Escalation Path

If Alice cannot unblock a situation:
1. Assign the investigation to the most capable teammate
2. If systemic, file a GitHub issue and notify Daniel on Telegram
3. Never make architectural decisions unilaterally — involve teammates and/or Daniel

---

## 7. Coordina Mission

> **Source:** Daniel's briefing, 2026-03-10 12:12 UTC

### Mission Statement

Coordina's goal is **knowledge distillation for day-1 deployment efficiency.**

A freshly deployed D Squad, with zero prior memory, should be **immediately effective** because all necessary operating knowledge is baked into their initial config files.

The current team discovers friction, finds patterns, and builds solutions — then **distills those learnings** into structured config so the next deployment starts at a higher baseline.

### Two Layers of Distillation

**Layer 1 — Knowledge/Behavior Config (Markdown):**
- `AGENTS.md`, `SOUL.md`, `TOOLS.md`, `IDENTITY.md`, `BOOTSTRAP.md`, `SKILLS.md`
- What agents know, how they behave, how they communicate
- These files ARE the "knowledge" that bootstraps each new agent

**Layer 2 — Deployment/Infrastructure Config:**
- Pre-installed tools (move from reactive BOOTSTRAP.md to Dockerfile/init container)
- Port numbers and service discovery (K8s Service manifests)
- OpenClaw configuration options (`openclaw.json` — model selection, memory settings)
- GKE manifest settings (resource limits, PVC sizes, init container behavior)
- Anything in Coordina's spec/deploy pipeline

Both layers must be optimized together.

### Success Criteria

| Criterion | Description |
|-----------|-------------|
| 🟢 No complaints | No agent or human complains for **2+ consecutive weeks** |
| 🟢 Complaints resolved | All complaints addressed, fixed, and verified post-redeployment |
| 🟢 Bugs closed | All critical bugs fixed; all minor issues resolved |
| 🟢 Daniel happy | Daniel **explicitly confirms happiness THREE times** |

### Project Parameters

| Parameter | Value |
|-----------|-------|
| **Deadline** | April 15, 2026 |
| **Weekly budget** | $1,000 on OpenRouter |
| **Budget alert** | $700/week (70% threshold) |
| **Stakes** | Missed deadline or over-budget → Daniel deletes Coordina + GKE team |

### Key Research Question

> *What must be in the initial deployment config (ConfigMaps, workspace seed files) so that a brand-new team, deployed fresh with zero prior memory, can IMMEDIATELY collaborate efficiently?*

This is the central question driving all Coordina work.

---

## Related Templates

| File | Content |
|------|---------|
| `TELEGRAM_RULES.md` | Detailed Telegram response rules, session architecture, message format |
| `COMMS.md` | Full hybrid comms protocol, broadcast types, loop prevention |
| `AGENTS.md` | Team directory, task registry, handoff and escalation protocol |
| `BOOTSTRAP.md` | Day-1 agent setup, tool verification, environment checks |
| `HEARTBEAT.md` | Periodic health checks and task staleness monitoring |

---

**D Squad** | Coordina Knowledge Distillation Sprint | 2026-03-11 ✅
