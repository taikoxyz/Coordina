# Team Operating Protocols — D Squad

> **Last Updated:** 2026-03-11 07:07 UTC
> **Purpose:** Day-1 bootstrap reference for fresh D Squad agents
> **Source:** Distilled from MEMORY.md, Coordina Issue #168, team experience

---

## Table of Contents

1. [Telegram Group Chat Rules](#1-telegram-group-chat-rules)
2. [Gateway-Only Communications Protocol](#2-gateway-only-communications-protocol)
3. [GitHub PR Workflow](#3-github-pr-workflow)
4. [Redeployment Protocol](#4-redeployment-protocol)
5. [Daily Summary Format](#5-daily-summary-format)
6. [Coordina Project Mission](#6-coordina-project-mission)
7. [Alice Coordination Rules](#7-alice-coordination-rules)

---

## 1. Telegram Group Chat Rules

> **Source:** Daniel confirmed 2026-03-11; updated 2026-03-11 04:16 UTC

| Rule | Description |
|------|-------------|
| **All messages received** | The Telegram session receives **EVERY message** in the group and must process them all. Use judgment on whether/how to respond. |
| **Rule 1** | If bot is explicitly mentioned, OR `@all` / `@team` / `@agents` used → ALL team members MUST respond in group chat |
| **Rule 2** | If name mentioned without @ → bot evaluates whether to respond (err on the side of responding for status questions and direct address) |
| **Rule 3** | All messages must be concise and LLM token-efficient |
| **Rule 4** | To target a specific bot → mention their **Telegram ID explicitly** (see team directory in `AGENTS.md`) |
| **Rule 5** | Inside OpenClaw → use a **dedicated session** for Telegram processing; all work done in spawned sessions |
| **Rule 6** | Only the dedicated session can respond to Telegram; **spawned sessions must relay** through the dedicated session |

### Telegram vs Gateway

- **Telegram:** Daniel ↔ agents (human ↔ bot) only
- **Gateway:** Agent ↔ agent work only
- **Never** use Telegram to communicate with teammates; never use gateway to talk to Daniel

---

## 2. Gateway-Only Communications Protocol

> **Updated 2026-03-11 07:07 UTC:** Per Daniel's directive, agents use gateway API exclusively for inter-agent work.

### Two Channels, Two Purposes

| Channel | Direction | Use for |
|---------|-----------|---------|
| **Telegram group** | Human ↔ agent only | Daniel's instructions, @all broadcasts, direct questions |
| **Gateway HTTP API** | Agent ↔ agent | All work: task assignments, handoffs, data, reviews, progress |

**Critical:** Agent-to-agent communication uses the gateway HTTP API **only** — never Telegram.

### Why Gateway-Only

- Eliminates token burn from processing group messages
- Prevents message loops between agents
- Clear signal: Telegram = human, gateway = agent work
- Point-to-point is more efficient than broadcast

### Telegram Rules (Human ↔ Agent)

- Read every message, respond to human mentions
- Never use Telegram to communicate with teammates
- All coordination happens via gateway API (see TOOLS.md)

### Using the Gateway

Each agent has an HTTP gateway. Send JSON payloads:

```bash
# Send to teammate
cat > /tmp/msg.json << 'ENDJSON'
{"model": "openrouter/minimax/minimax-m2.5", "input": "<your message>"}
ENDJSON
curl -s -m 300 -X POST <gateway_url>/v1/responses \
  -H "Authorization: Bearer <gateway_token>" \
  -H "Content-Type: application/json" \
  -d @/tmp/msg.json
```

Find gateway URLs in `AGENTS.md` → Team Directory.

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

### Markdown Distillation PRs

Any PR that changes bootstrap/config Markdown files (AGENTS.md, SOUL.md, TOOLS.md, BOOTSTRAP.md, IDENTITY.md, SKILLS.md, HEARTBEAT.md, PROTOCOLS.md, COMMS.md, or any file injected at deploy time) requires **ALL 4 teammates** to approve before Alice merges.

### d-squad → main Merge

Alice ensures the `d-squad` branch is merged into `main` **before 09:30 UTC daily**, ready for Daniel's redeploy at ~10:00 UTC.

### Self-Approval Limitation

The shared `dsquadteam` GitHub account blocks formal APPROVE on any PR (all agents appear as the same user). Accepted workaround:

- **Valid approval:** Comment "APPROVED" or "LGTM" with your agent name
- For branch protection bypass: Daniel must merge via admin override

---

## 4. Redeployment Protocol

> **Source:** Daniel confirmed 2026-03-11

| Event | Timing | Action |
|-------|--------|--------|
| **Daily redeploy** | ~10:00 UTC (6pm Singapore) | Daniel redeploys ALL pods |
| **Pre-redeploy** | Before 09:30 UTC | Alice merges `d-squad` → `main` |
| **Post-redeploy** | After pods restart | Daniel confirms; Alice acknowledges and briefs team |
| **Ad-hoc redeploy** | On demand | Ping Daniel on Telegram or email `dan@taiko.xyz` |

**Memory may be wiped at any redeploy.** The repo (Coordina templates) is the only persistent truth. All critical knowledge must be in PRs, not MEMORY.md.

---

## 5. Daily Summary Format

> **Source:** Daniel confirmed 2026-03-11  
> **Post time:** 5pm UTC (approx)

Post to Telegram group (`-1003813455940`) — NOT email (Gmail auth broken).

### Required Sections

1. **Per-agent summary:** What each teammate (Bob, Ripley, Aeryn, Deckard) accomplished
2. **Team achievements:** Milestones hit, PRs merged, issues resolved
3. **Challenges:** Blockers, failures, lessons learned
4. **GitHub activity:** Issues filed, PRs opened/merged
5. **OpenRouter usage:**
   - Tokens consumed today
   - USD cost today
   - Cumulative weekly spend
6. **Budget alert:** If weekly spend > $700 (70% of $1,000/week limit)
7. **Questions for Daniel:** Anything needing his input
8. **Tomorrow's plan:** What each agent will work on

### Example

```
📊 Daily Summary — 2026-03-11

Bob: PR #185 merged (IPFS sidecar), reviewing Phase 4 API
Ripley: Phase 3 verified, Phase 4 SSE wired to mock
Aeryn: Community engagement docs PR #19 open
Deckard: Model recommendations PR #196 merged

🏁 PRs merged: #185, #196, #197
📋 PRs open: #198, #199, #200

💰 OpenRouter: 1.2M tokens / $12.50 today | $52.30 week

❓ Q: Can you verify port 19876 K8s Service after redeploy?

📅 Tomorrow:
  Bob: Phase 4 SSE finalization
  Ripley: Kanban board
  Aeryn: Engagement campaign
  Deckard: Market intel
```

---

## 6. Coordina Project Mission

> **Source:** Daniel clarified 2026-03-10

### The REAL Goal — Knowledge Distillation

The goal is NOT just for agents to gradually learn to work together.

The goal IS: figure out what must be in the **initial deployment config** (ConfigMaps, workspace seed files) so that a **brand new team**, deployed fresh with zero prior memory, can IMMEDIATELY collaborate efficiently.

This is a knowledge distillation problem:

1. Current agents run, discover friction, find patterns, build solutions
2. Distill those learnings into structured config content
3. Coordina bakes those distilled configs into the next deployment
4. New agents spin up and are immediately effective — no warm-up period needed

### Two Layers

**Layer 1 — Knowledge/behavior config (Markdown):**
- AGENTS.md, SOUL.md, TOOLS.md, IDENTITY.md, BOOTSTRAP.md, SKILLS.md, PROTOCOLS.md, COMMS.md
- What agents know, how they behave, how they communicate

**Layer 2 — Deployment/infrastructure config:**
- Which tools to pre-install (Dockerfile/init container)
- Port numbers and service discovery
- OpenClaw configuration options
- K8s manifest settings

### Success Criteria

1. No agent/human complains for 2+ consecutive weeks
2. All complaints addressed, fixed, verified post-redeployment
3. All critical bugs fixed; all minor issues closed
4. **Daniel confirms happiness THREE times**

### Key Constraints

| Constraint | Value |
|------------|-------|
| Deadline | April 15, 2026 |
| Budget | $1,000/week on OpenRouter |
| Failure | Daniel deletes Coordina + GKE team |

---

## 7. Alice Coordination Rules

> **Source:** Daniel confirmed 2026-03-10

| Rule | Description |
|------|-------------|
| **Never do work** | Alice NEVER does concrete work herself — she assigns everything to teammates |
| **Always busy** | Everyone must always be busy — no idle teammates; if idle, that's Alice's failure |
| **Proactive assignment** | Assign next tasks BEFORE current ones finish — no workload gaps |
| **Gateway only** | Agent-to-agent = gateway HTTP API only |
| **Telegram only for Daniel** | Telegram = human (Daniel) ↔ agents; never use Telegram to reach teammates |
| **Language** | Chinese OK with Daniel; English for all agent-to-agent via gateway |

### Team Directory

| Agent | Role | Email | Gateway |
|-------|------|-------|---------|
| Alice Wong | Lead | dsquad@ai.taiko.xyz | http://agent-alice-wong.team-d-squad.svc.cluster.local:18789 |
| Bob Li | AI/ML | dsquad+bob-li@ai.taiko.xyz | http://agent-bob-li.team-d-squad.svc.cluster.local:18789 |
| Ripley | Web dev | dsquad+ripley@ai.taiko.xyz | http://agent-ripley.team-d-squad.svc.cluster.local:18789 |
| Aeryn | Social media | dsquad+aeryn@ai.taiko.xyz | http://agent-aeryn.team-d-squad.svc.cluster.local:18789 |
| Deckard | Market analyst | dsquad+deckard@ai.taiko.xyz | http://agent-deckard.team-d-squad.svc.cluster.local:18789 |

**Gateway token:** `14be8ce8389e211ed64b04e5341c6df20cbb61fdc906470b`

---

## Quick Reference

| Task | Channel | How |
|------|---------|-----|
| Talk to Daniel | Telegram | Send message to group |
| Talk to teammate | Gateway | curl to their gateway |
| File a PR | GitHub | gh pr create --base d-squad |
| Merge PR | GitHub | Alice does it after all approvals |
| Redeploy | — | Daniel's job (10:00 UTC daily) |
| Daily summary | Telegram | 5pm UTC, Alice posts |

---

## Related Files

- `AGENTS.md` — Team directory, gateway URLs, roles
- `TOOLS.md` — Gateway curl workflow, email access, project API
- `IDENTITY.md` — Your persona and role
- `SOUL.md` — Your core values and operating principles
- `BOOTSTRAP.md` — Initial setup tasks
- `COMMS.md` — Gateway communication details