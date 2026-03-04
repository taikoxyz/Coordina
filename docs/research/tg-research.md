# Telegram Research: AI Agent Identity & Channels

_Research date: 2026-03-04_

---

## Most Recent Telegram Announcement: AI Agent Support

### October 10, 2025 — Threads & Streaming for AI Bots

Pavel Durov's 12-feature update directly named AI bots as a first-class use case:

- **Threaded conversations**: Bots can now manage several distinct topic threads in parallel — enabling multi-topic AI chatbots without context bleeding between conversations.
- **Streaming responses**: Bots can send responses incrementally (token by token), rather than waiting for a full reply. This is the ChatGPT-style "typing" experience, delivered natively in Telegram.

Source: [Telegram blog — Threads for Bots](https://telegram.org/blog/comments-in-video-chats-threads-for-bots)

### March 1, 2026 — Bot API 9.5 (most recent release)

`sendMessageDraft` is now available universally to all bots — private DMs, groups, and topic threads. Previously (Bot API 9.3, December 2025) it was limited to private chats with forum topics enabled.

**Method signature:**
```
sendMessageDraft(
  chat_id,
  text,
  parse_mode?,
  entities?,
  link_preview_options?,
  reply_parameters?,
  message_thread_id?,
  reply_markup?
) → Message
```

**Cost caveat**: Enabling streaming via BotFather triggers a 15% commission on in-bot Star purchases (Telegram developer terms §6.2.6). Irrelevant for internal/team channels that don't use Stars.

Source: [aibase.com Bot API 9.5 coverage](https://news.aibase.com/news/25881)

### Other Notable 2025 Context

| Date | Event |
|---|---|
| May 2025 | Telegram signed $300M deal with xAI to integrate Grok natively |
| Oct 2025 | Launched "Cocoon" — decentralized AI compute network on TON blockchain |
| Apr 2025 | Bot API 9.0 — full Business Account management for bots |
| Jan 2025 | Bot API 8.2 — bots can issue official verification badges |

---

## Per-Agent Telegram Identity

### How Each Agent Gets Its Own Telegram ID

Every bot registered via `@BotFather → /newbot` receives:

1. **Unique `@username`** — must end in `bot` (e.g. `@coordina_alpha_ripley_bot`)
2. **Numeric `user_id`** — Telegram's internal unique identifier for the bot entity
3. **API token** — format `123456789:AABBCCDDEEFFaabbccddeeff`, used for all API calls

There is **no limit** on the number of bots a single developer account can create.

### Username Options

- **Standard**: chosen via BotFather (must end in `bot`, must be unique across Telegram)
- **Premium via Fragment**: [fragment.com](https://fragment.com) — blockchain marketplace on TON for buying short/branded usernames. Can be assigned to bot accounts. Costs vary from free to tens of thousands of dollars.

### Suggested Naming Convention for Coordina

```
@coordina_{team_slug}_{agent_slug}_bot
```

Examples: `@coordina_alpha_ripleybot`, `@coordina_alpha_neobot`

---

## Group Channel Membership

### What's Possible

- Bots **can** join Telegram groups and supergroups as members
- Up to **20 bots per group** (hard Telegram limit — cannot be increased)
- Bots must be **added by a human admin** (or a MTProto user script) — they cannot self-join via invite links
- Bots appear as members in the group member list with a "Bot" label

### Privacy Mode (default ON)

When Privacy Mode is ON (the default), a bot only sees:
- Commands directly addressed to it (`/command@BotUsername`)
- Replies to its own messages
- Messages sent via inline mode through it

To have a bot see all human messages in a group:
- Disable Privacy Mode via BotFather → the bot must be re-added to the group after this change
- Or grant the bot **admin rights** in the group (no re-add required)

### Critical Architectural Constraint

> **Bots cannot receive messages sent by other bots in a group, under any configuration.**

This is a permanent, hard restriction in Telegram's architecture. It cannot be bypassed with admin rights, Privacy Mode disabled, or any API workaround. This is officially documented in the Telegram Bots FAQ.

**Implication**: Telegram groups serve as a **human-visible interface** to the agent team. Inter-agent orchestration must continue through the existing backend channel (OpenClaw WebSocket gateway). Telegram does not replace agent-to-agent communication — it surfaces it to humans.

---

## API: Bot API vs MTProto

| Capability | Bot API (HTTP) | MTProto (GramJS / Telethon / Pyrogram) |
|---|---|---|
| Auth | Token only (no phone) | Phone number + 2FA |
| Create groups programmatically | No | Yes (`channels.createChannel`) |
| Add bots to groups programmatically | No | Yes (`channels.inviteToChannel`) |
| Initiate DMs | No | Yes |
| Receive all messages | Partial (Privacy Mode) | Full |
| Access message history | Limited | Full |
| Complexity | Low | High |
| Best library (TypeScript) | grammY | GramJS |

**Summary**: For ongoing bot operations (receiving messages, sending responses, streaming), use the Bot API via grammY. For one-time setup automation (creating the group, inviting all bots), use MTProto via GramJS with a human operator account.

---

## Rate Limits

| Scope | Limit |
|---|---|
| Single chat | 1 message/second (short bursts allowed) |
| Single group | 20 messages/minute |
| Bulk broadcast (free) | ~30 messages/second |
| Bulk broadcast (paid Stars) | Up to 1,000 messages/second (requires 100k Stars + 100k MAU) |

For a team channel with 4–8 agents posting status updates, these limits are not a concern.

---

## Bot API Changelog Reference (2024–2026)

| Version | Date | Relevant Feature |
|---|---|---|
| Bot API 7.9 | Aug 2024 | Super Channels |
| Bot API 8.0 | Nov 2024 | Full-screen Mini Apps, Star subscriptions |
| Bot API 8.2 | Jan 2025 | `verifyUser`, `verifyChat` — org-level verification badges |
| Bot API 9.0 | Apr 2025 | Full Business Account management |
| Bot API 9.2 | Aug 2025 | Channel Direct Messages, Suggested Posts |
| Bot API 9.3 | Dec 2025 | `sendMessageDraft` (streaming) — private chats with topics only |
| Bot API 9.5 | Mar 1, 2026 | `sendMessageDraft` universally available — all bots, all chat types |

---

## Sources

- [Telegram Bots intro](https://core.telegram.org/bots)
- [Telegram Bots FAQ](https://core.telegram.org/bots/faq)
- [Bot API changelog](https://core.telegram.org/bots/api-changelog)
- [Telegram blog — Threads for Bots](https://telegram.org/blog/comments-in-video-chats-threads-for-bots)
- [Bot API 9.5 streaming coverage](https://news.aibase.com/news/25881)
- [Telethon: MTProto vs Bot API](https://docs.telethon.dev/en/stable/concepts/botapi-vs-mtproto.html)
- [Fragment — collectible usernames](https://fragment.com)
- [Telegram rate limits](https://limits.tginfo.me/en)
- [Telegram Grok/$300M xAI deal](https://www.coindesk.com/business/2025/05/28/telegram-signs-usd300m-deal-to-integrate-grok-ai-into-app-ton-token-up-16)
- [Cocoon decentralized AI network](https://decrypt.co/346645/telegram-launches-cocoon-decentralized-ai-network-pays-gpu-owners-crypto)
