# Heartbeat — Coordination Health Checks

<!-- ============================================================
  HEARTBEAT.md Template — Coordina Agent Coordination Protocol
  
  CRITICAL CONSTRAINT: Heartbeat runs see ONLY this file.
  No AGENTS.md, TOOLS.md, SOUL.md, or any other workspace file.
  This file MUST be fully self-contained.
  
  Heartbeat runs should be FAST and FOCUSED. Each check follows:
    1. Run a specific command
    2. Evaluate the result
    3. Take action if needed (fix it or escalate)
  
  Budget: keep lean. Heartbeat is lightweight mode.
  ============================================================ -->

## Agent Identity

<!-- [COORDINA-MANAGED] Duplicated here because heartbeat has no access to AGENTS.md. -->
- slug: {{AGENT_SLUG}}
- team: {{TEAM_SLUG}}
- lead: {{LEAD_SLUG}}
- lead_gateway: {{LEAD_GATEWAY_URL}}
- gateway_token: {{GATEWAY_TOKEN}}
- telegram_group_chat_id: {{TELEGRAM_GROUP_ID}}

## Heartbeat Instructions

Run ALL checks below in order. Keep total execution under 60 seconds.
Only escalate if a check explicitly says to. Do not start conversations or side tasks.

---

## 1. Infrastructure Checks

### 1a. Gateway Health
```bash
curl -s -m 5 http://127.0.0.1:18789/health
```
- **Pass**: Returns 200 with health status.
- **Fail**: Run `ps aux | grep openclaw` to check if process is alive. Log to `memory/YYYY-MM-DD.md`: `[HEARTBEAT] Gateway down at <timestamp>`. If down for 2+ consecutive heartbeats, escalate.

### 1b. Disk Space
```bash
df -h /agent-data | tail -1 | awk '{print $5}'
```
- **Pass**: Usage < 85%.
- **Fail (≥85%)**: Run `du -sh /agent-data/openclaw/workspace/memory/* | sort -rh | head -5` and archive old logs. If > 95%, escalate immediately.

### 1c. Memory
```bash
awk '/MemAvailable/ {print $2}' /proc/meminfo
```
- **Pass**: MemAvailable > 256000 kB (256 MB).
- **Fail**: Log warning. If < 128000 kB, escalate.

---

## 2. Coordination Health

<!-- [COORDINA-MANAGED] Task assignments are injected here since heartbeat
  cannot read the Task Registry in AGENTS.md. -->

### 2a. My Active Tasks

<!-- Coordina injects a summary of this agent's assigned tasks: -->
<!-- Example:
  - T-123-001 | in-progress | high | Design AGENTS.md schema | last: 2026-03-10T20:00:00Z
  - T-123-005 | blocked | normal | Review sync PR | last: 2026-03-10T16:00:00Z
-->

**Check for each task listed above:**
- If `last_updated` is > 24 hours ago and status is `in-progress`: Update the task or escalate if blocked.
- If status is `blocked` for > 4 hours: Escalate to team lead with reason.
- If you have no active tasks: Check if any `unclaimed` tasks are listed below.

### 2b. Unclaimed Tasks Needing Attention

<!-- Coordina injects unclaimed tasks matching this agent's capabilities: -->
<!-- Example:
  - T-123-003 | unclaimed | normal | Write integration tests for handoff | deps: T-123-002
-->

**Action**: If an unclaimed task has no unmet dependencies and matches your capabilities, claim it by updating your AGENTS.md Task Registry and notifying the team lead.

### 2c. Stale Task Alerts

<!-- Coordina injects tasks across the team that are stale (>24h no update): -->
<!-- Example:
  - T-123-002 | bob-li | in-progress | last: 2026-03-09T12:00:00Z (32h stale)
-->

**Action**: If a teammate's task is stale and you depend on it, send a check-in message via their gateway. If still no response after next heartbeat, escalate to team lead.

---

## 3. Communication Checks

### 3a. Peer Gateway Connectivity

<!-- [COORDINA-MANAGED] List of teammates and their gateways. -->

Check each teammate's gateway health:

<!-- Example for D Squad:
```bash
curl -s -m 5 http://agent-alice-wong.team-d-squad.svc.cluster.local:18789/health
curl -s -m 5 http://agent-bob-li.team-d-squad.svc.cluster.local:18789/health
curl -s -m 5 http://agent-aeryn.team-d-squad.svc.cluster.local:18789/health
curl -s -m 5 http://agent-deckard.team-d-squad.svc.cluster.local:18789/health
```
-->

- **Pass**: All return 200.
- **Fail**: Log which agent is unreachable. If the unreachable agent owns a task you depend on, escalate.

### 3b. DNS Resolution
```bash
nslookup kubernetes.default.svc.cluster.local 2>&1 | head -5
```
- **Pass**: Resolves successfully.
- **Fail**: Log DNS failure. Most peer checks will also fail — do not duplicate alerts.

---

## 4. Escalation Triggers

If ANY of the following are true, send a message to the team lead:

| Condition | Action |
|-----------|--------|
| Gateway down for 2+ consecutive heartbeats | Escalate: `ESCALATION: My gateway has been down since <timestamp>` |
| Disk usage > 95% | Escalate: `ESCALATION: Disk critically full at <percent>%` |
| Memory < 128 MB available | Escalate: `ESCALATION: Memory critically low (<X> MB available)` |
| Own task blocked > 4 hours | Escalate: `ESCALATION: Task <id> blocked for <hours>h — <reason>` |
| Dependency task stale > 24h, no response to check-in | Escalate: `ESCALATION: <agent> unresponsive, task <id> stale <hours>h` |
| Critical-priority task unclaimed > 1 hour | Escalate: `ESCALATION: Critical task <id> unclaimed for <time>` |

### How to Escalate

```bash
cat > /tmp/heartbeat-escalation.json << 'ENDJSON'
{"model": "openrouter/anthropic/claude-opus-4.6", "input": "ESCALATION from {{AGENT_SLUG}}: <describe the issue>"}
ENDJSON
curl -s -m 300 -X POST {{LEAD_GATEWAY_URL}}/v1/responses \
  -H "Authorization: Bearer {{GATEWAY_TOKEN}}" \
  -H "Content-Type: application/json" \
  -d @/tmp/heartbeat-escalation.json
```

If the lead's gateway is also unreachable, fall back to Telegram group notification (requires TOOLS.md context — log the issue to `memory/YYYY-MM-DD.md` for the main session to handle).

---

## 5. Heartbeat Log

After all checks, write a one-line summary to `memory/YYYY-MM-DD.md`:

```
[HEARTBEAT <timestamp>] infra:OK|WARN peers:<N>/<total>:OK tasks:<N> active, <N> blocked escalations:<N>
```

Example:
```
[HEARTBEAT 2026-03-10T20:15:00Z] infra:OK peers:4/4:OK tasks:1 active, 0 blocked escalations:0
```
