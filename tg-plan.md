# Implementation Plan: Telegram Integration for Coordina Agent Teams

_Plan date: 2026-03-04_

See `tg-research.md` for the underlying research and constraints.

---

## Goal

Each Coordina agent gets its own Telegram Bot identity. When a team is deployed, a shared Telegram supergroup is created and all agent bots are invited as members. Humans can message the channel; the relevant agent bot receives the message, routes it to the OpenClaw gateway, and streams the response back using Bot API 9.5's `sendMessageDraft`.

---

## Architecture Overview

```
Human ──► Telegram Group ──► Agent Bot (grammY listener)
                                  │
                         Existing WebSocket Proxy
                                  │
                         OpenClaw Agent Gateway (K8s)
                                  │
                         Agent Bot ──► sendMessageDraft ──► Telegram Group
```

Inter-agent communication remains on the OpenClaw WebSocket layer. Telegram is the human-facing surface only — bots cannot read each other's messages in a group (hard Telegram constraint).

---

## Phase 0 — Bootstrap (Human One-Time Setup, No Code Required)

These steps are performed manually by the operator before any integration code runs.

1. **Create an operator Telegram account** — a regular user account used for MTProto automation. This account will own the group and invite all bots.

2. **Register bots via `@BotFather`** — for each deployed agent:
   ```
   /newbot
   Name: Coordina Alpha · Ripley
   Username: coordina_alpha_ripleybot
   ```
   Save the API token. Disable Privacy Mode for each bot so it can see group messages:
   ```
   /mybots → Select bot → Bot Settings → Group Privacy → Turn off
   ```

3. **Store tokens securely** — GCP Secret Manager, one secret per bot:
   ```
   coordina/teams/{team-slug}/agents/{agent-slug}/telegram-token
   ```

4. **Create the group and invite bots** — run a one-time GramJS MTProto script:
   ```ts
   // creates supergroup "Alpha Team — Telegram"
   // invites all agent bots by user_id
   // returns channelId for storage in team spec
   ```
   (Full script in `scripts/telegram/bootstrap.ts`)

---

## Phase 1 — Spec & Storage

**Goal**: The team spec knows about Telegram identities.

### Files to modify

**`src/shared/types.ts`**
```ts
interface AgentSpec {
  // ... existing fields ...
  telegramBotToken?: string   // stored encrypted, never in git
  telegramUserId?: number     // numeric Telegram user_id for this bot
  telegramUsername?: string   // e.g. "coordina_alpha_ripleybot"
}

interface TeamSpec {
  // ... existing fields ...
  telegramChannelId?: string  // numeric group ID, e.g. "-1001234567890"
  telegramChannelLink?: string // e.g. "https://t.me/+xyz"
}
```

**`~/.coordina/teams/{slug}.json`** — naturally picks up new fields; no migration needed.

**`src/main/github/spec.ts`** — include `telegramUsername` in generated `IDENTITY.md`:
```md
## Contact
- Telegram: @coordina_alpha_ripleybot
```

---

## Phase 2 — Bot Registration Worker

**Goal**: Coordina can register a bot and create the team channel programmatically.

### New module: `src/main/integrations/telegram/`

#### `register.ts`
- Accepts `agentSlug`, `teamSlug`, `agentName`
- Calls BotFather via MTProto (GramJS) to create a new bot
- Returns `{ token, userId, username }`
- Note: Full programmatic BotFather registration requires MTProto; the Bot API alone cannot create bots

#### `channel.ts`
- Accepts list of bot `userId`s + team name
- Uses MTProto GramJS with the operator account to:
  1. `channels.createChannel` — creates supergroup `"{Team} — Telegram"`
  2. `channels.inviteToChannel` — invites each bot by `userId`
  3. Returns `channelId` and invite link

#### `bridge.ts`
- Starts one `grammY` Bot instance per agent bot token
- Listens for group messages mentioning the agent (or in a per-agent thread if using forum topics)
- Routes message to agent's OpenClaw WebSocket gateway via existing `useGatewayChat` logic
- Streams response back using `sendMessageDraft` (Bot API 9.5)

### Dependencies to add

```json
{
  "grammy": "^1.x",        // Bot API — TypeScript, tree-shakeable
  "telegram": "^2.x"       // GramJS — MTProto client for group creation
}
```

### IPC handlers to add in `src/main/ipc/index.ts`

```ts
'telegram:register-agent'   // Phase 0 alternative: register one bot
'telegram:create-channel'   // Create group + invite all bots
'telegram:start-bridge'     // Start grammY listeners for a team
'telegram:stop-bridge'      // Stop listeners (team teardown)
```

---

## Phase 3 — UI Integration

**Goal**: Operators can set up and monitor Telegram from the Coordina UI.

### New UI component: `TelegramCard`

Added to the team detail panel, visible after a team is successfully deployed.

**States:**
1. **Not configured** — "Connect Telegram" button → triggers `telegram:create-channel` IPC
2. **Configuring** — spinner with step labels (creating group, inviting bots)
3. **Connected** — channel link, list of agent bot usernames, "Open in Telegram" button
4. **Bridge running** — green indicator, message count, last activity timestamp

**Location**: `src/renderer/src/components/TelegramCard.tsx`

---

## Phase 4 — Message Bridge (Bidirectional)

**Goal**: Full two-way communication between humans in Telegram and agents in K8s.

### Human → Agent flow

1. Human sends a message in the team Telegram group
2. grammY listener on the agent bot receives the message (Privacy Mode must be OFF or bot is admin)
3. `bridge.ts` determines which agent should respond (lead agent by default, or via `@mention`)
4. Message forwarded to agent's WebSocket gateway using existing proxy infrastructure
5. Agent processes and returns response tokens

### Agent → Human flow

1. Agent emits an activity event (task complete, status update, error) via OpenClaw
2. `bridge.ts` intercepts the event
3. Agent's bot calls `sendMessageDraft` to stream the response into the group
4. Final message replaces the draft (fully rendered in Telegram)

### Thread-per-agent (optional enhancement)

Use forum topics (supergroup with `is_forum: true`) to give each agent their own thread. This avoids a cluttered single-thread channel when multiple agents are active simultaneously.

- `createForumTopic(chat_id, name: agentName, icon_color)` — one topic per agent
- All agent responses go into their own named thread
- Human replies go to the correct thread → auto-routes to that agent

---

## Key Files Summary

| File | Change |
|---|---|
| `src/shared/types.ts` | Add telegram fields to `AgentSpec` and `TeamSpec` |
| `src/main/ipc/index.ts` | Add 4 telegram IPC handlers |
| `src/main/github/spec.ts` | Include `telegramUsername` in IDENTITY.md |
| `src/main/integrations/telegram/register.ts` | New — bot registration via MTProto |
| `src/main/integrations/telegram/channel.ts` | New — group creation and bot invitation |
| `src/main/integrations/telegram/bridge.ts` | New — grammY listeners + WS routing |
| `src/renderer/src/components/TelegramCard.tsx` | New — Telegram UI card |
| `scripts/telegram/bootstrap.ts` | New — one-time operator setup script |

---

## Constraints & Decisions

| Constraint | Decision |
|---|---|
| Max 20 bots per group | Coordina teams are typically 4–8 agents — well within limit |
| Bots cannot read each other's messages | All inter-agent comms stay on OpenClaw WS layer |
| Bots cannot self-join groups | One-time MTProto operator script handles invitations |
| Bot tokens are sensitive | Stored in GCP Secret Manager, never in spec JSON committed to git |
| Streaming 15% Stars commission | Irrelevant — internal team channels don't use Star payments |

---

## Verification Checklist

- [ ] `@BotFather` bot created for one agent; bot appears in Telegram search
- [ ] MTProto bootstrap script creates group and all agent bots appear as members
- [ ] Privacy Mode confirmed OFF for each bot (or bot is group admin)
- [ ] Human message in group → routed to agent gateway → response appears in Telegram
- [ ] `sendMessageDraft` streams response token-by-token
- [ ] Team spec JSON updated with `telegramChannelId` and per-agent `telegramUserId`
- [ ] Coordina UI shows `TelegramCard` with channel link after deploy
