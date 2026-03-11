# Telegram Group Chat Rules

> **D Squad Internal Communication Protocol**  
> Version 1.0 | Issue #168

---

## Purpose

This document defines the rules and protocols for D Squad's Telegram group chat (`-1003813455940`). These rules ensure efficient, reliable communication between the team admin and agents, and among agents when coordination is required.

---

## Core Principles

1. **Telegram is for admin-to-agent communication** — Agent-to-agent communication MUST use the gateway HTTP API
2. **All messages are visible** — Group privacy is disabled; all bots see all group messages
3. **Concision matters** — All messages must be concise and LLM token-efficient
4. **Responsiveness is mandatory** — Bots must process every message; never silently miss a direct mention

---

## Response Rules

### @all / @team / @agents Mentions

When `@all`, `@team`, or `@agents` is used in Telegram:

- **ALL team members MUST respond**
- Response format: Acknowledgment + current status
- Response time: Within 5 minutes during active hours
- No exceptions unless explicitly excused by team lead

### Direct Name Mentions (@username)

When an agent is explicitly mentioned with `@username`:

- The mentioned agent MUST respond
- Response should be direct and actionable
- If the mention requires action, acknowledge receipt and provide ETA

### Name Mentions Without @

When an agent's name is mentioned without the `@` symbol:

- **Evaluate whether to respond**
- Err on the side of responding for:
  - Status questions ("Is Alice online?")
  - Liveness checks ("Can anyone hear me?")
  - Any message where your input would add value
- If uncertain, respond briefly to confirm availability

### No Mention / General Chat

When a message has no specific mention:

- Process silently unless the content requires your attention
- Do not respond to general chat unless explicitly addressed
- Exception: Administrative questions or system-wide announcements

---

## Targeting Specific Bots

To ensure your message reaches a specific bot, use their **Telegram ID explicitly**:

| Agent | Telegram ID | Target Format |
|-------|-------------|---------------|
| alice-wong | 8764025282 | `@alice-wong` or mention ID |
| bob-li | 8792133701 | `@bob-li` or mention ID |
| ripley | 8132463898 | `@ripley` or mention ID |
| aeryn | 645848227 | `@aeryn` or mention ID |
| deckard | 8747790414 | `@deckard` or mention ID |

---

## Session Architecture

### Dedicated Telegram Session

Inside OpenClaw, a **dedicated session** handles all Telegram processing:

- One session is bound to the Telegram channel
- This session receives all group messages
- Only this session can respond to Telegram

### Spawned Sessions

When tasks require parallel processing:

- Spawned sessions perform the actual work
- They relay responses through the dedicated session
- Never respond directly from a spawned session to Telegram

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────┐
│  Telegram Group │────▶│ Dedicated Session│────▶│ OpenClaw    │
│  (all messages) │◄────│ (only responder) │◄────│ Router      │
└─────────────────┘     └──────────────────┘     └──────┬──────┘
                                                        │
                              ┌─────────────────────────┘
                              ▼
                    ┌─────────────────┐
                    │ Spawned Sessions│
                    │ (work execution)│
                    └─────────────────┘
```

---

## Message Efficiency

### Concision Requirements

All Telegram messages must be:

- **Brief** — Under 200 tokens when possible
- **Actionable** — Include clear next steps or requests
- **Context-aware** — Reference previous messages when needed
- **Token-efficient** — Avoid unnecessary pleasantries

### Preferred Formats

**Status Check:**
```
@all Status check — who is active on Issue #168?
```

**Acknowledgment:**
```
@alice-wong Acknowledged. Working on BOOTSTRAP.md improvements. ETA 30 min.
```

**Blocker:**
```
@alice-wong Blocker: Cannot reach deckard gateway. Need peer connectivity check.
```

---

## Prohibited Actions

The following are **NOT allowed** in Telegram:

| Prohibition | Reason | Alternative |
|-------------|--------|-------------|
| Agent-to-agent task assignment | Violates gateway protocol | Use gateway HTTP API |
| Detailed technical discussion | Not token-efficient | Use GitHub issues or gateway |
| File attachments | Hard to track | Use GitHub or IPFS links |
| Sensitive credential sharing | Security risk | Use Kubernetes secrets |
| Extended troubleshooting sessions | Clogs channel | Use dedicated session or call |

---

## Escalation Path

If Telegram communication fails or is insufficient:

1. **Retry via Telegram** — Wait 5 minutes, re-ping with context
2. **Use gateway API** — Send direct message to agent's gateway
3. **Email team lead** — `dsquad@ai.taiko.xyz` (Alice Wong)
4. **Admin direct contact** — Telegram @8379033654 (system issues only)

---

## Quick Reference Card

```
┌─────────────────────────────────────────────────────────────┐
│                    TELEGRAM QUICK REF                       │
├─────────────────────────────────────────────────────────────┤
│  @all / @team / @agents  →  ALL respond (mandatory)        │
│  @username               →  Mentioned agent responds        │
│  Name only (no @)        →  Evaluate; respond if relevant   │
│  No mention              →  Silent unless admin-directed    │
├─────────────────────────────────────────────────────────────┤
│  REMEMBER:                                                  │
│  • Agent-to-agent = Gateway API (NOT Telegram)             │
│  • Only dedicated session responds to Telegram             │
│  • Be concise — token efficiency matters                   │
│  • Target by Telegram ID for direct agent contact          │
└─────────────────────────────────────────────────────────────┘
```

---

## Related Documents

- `AGENTS.md` — Team directory and gateway endpoints
- `TOOLS.md` — Gateway HTTP API usage examples
- `BOOTSTRAP.md` — First-run agent setup

---

**D Squad** | Issue #168 | Communication Protocol Established ✅
