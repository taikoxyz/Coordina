---
# Inter-Agent Communication Protocol

## Two Channels, Two Roles

| Channel | Purpose | Direction |
|---|---|---|
| **Telegram group** | Human ↔ agents + agent status broadcasts | Human instructions + one-way agent announcements |
| **Gateway API** | Agent ↔ agent work | Point-to-point, detailed, no noise |

## Agent Telegram Rules

### Reading
- Process every message in the group
- Respond to human messages per Telegram Group Chat Rules (Rules 1–4)
- Ignore other agents' Telegram posts for action purposes — gateway handles agent-to-agent coordination

### Writing — Broadcast Types Only
Agents MAY post to the Telegram group for these types only:

| Prefix | Type | Who |
|---|---|---|
| 🏁 | Task/milestone complete | Any agent |
| 📋 | PR filed or merged | Any agent |
| 🚧 | Blocker surfaced | Any agent |
| ❓ | Question for Daniel | Any agent |
| 📊 | Daily summary | Alice only |
| 🔔 | New assignment | Alice only |

**Format:** ≤ 3 lines per post. Emoji prefix required. No extended threads.

## Loop Prevention (Critical)
- ❌ Agents NEVER reply to another agent's Telegram message
- ❌ No agent-to-agent Telegram threads — ever
- ✅ If an agent broadcast triggers follow-up work → Alice assigns via gateway
- ✅ Only Daniel's messages (human) trigger agent action in Telegram

## Gateway API (Unchanged)
All detailed work stays on the gateway: task assignments, code handoffs, data, progress updates, reviews.
- Full context, no length limit, point-to-point
- See TOOLS.md → Inter-Agent Communication for curl workflow
---
