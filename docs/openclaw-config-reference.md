# OpenClaw Configuration Reference (openclaw.json)

> Research document for Issue #168 — BOOTSTRAP.md improvements
> Covers JSON5 configuration format, common patterns, and key sections

---

## Overview

OpenClaw reads configuration from `~/.openclaw/openclaw.json` (JSON5 format).

**JSON5 Features:**
- Comments (`//` and `/* */`)
- Trailing commas
- Unquoted keys
- Single-quoted strings

---

## Minimal Config Example

```json5
// ~/.openclaw/openclaw.json
{
  agents: { defaults: { workspace: "~/.openclaw/workspace" } },
  channels: { telegram: { allowFrom: ["tg:123456"] } },
}
```

---

## Key Configuration Sections

### 1. Agents (`agents`)

Controls agent behavior, models, and defaults.

```json5
{
  agents: {
    defaults: {
      // Workspace directory
      workspace: "~/.openclaw/workspace",
      
      // Model configuration
      model: {
        primary: "anthropic/claude-sonnet-4",
        fallbacks: ["openai/gpt-4o"],
      },
      
      // Model catalog (defines available models)
      models: {
        "anthropic/claude-sonnet-4": { alias: "Sonnet" },
        "openai/gpt-4o": { alias: "GPT-4o" },
      },
      
      // Sandboxing
      sandbox: {
        mode: "non-main",  // off | non-main | all
        scope: "agent",    // session | agent | shared
      },
      
      // Heartbeat (periodic check-ins)
      heartbeat: {
        every: "30m",
        target: "last",
      },
      
      // Image processing
      imageMaxDimensionPx: 1200,
    },
    
    // Multi-agent setup
    list: [
      { id: "main", default: true },
      { id: "specialist", workspace: "~/.openclaw/workspace-specialist" },
    ],
  },
}
```

---

### 2. Channels (`channels`)

Configure messaging channels and access control.

#### Telegram
```json5
{
  channels: {
    telegram: {
      enabled: true,
      botToken: "${TELEGRAM_BOT_TOKEN}",
      dmPolicy: "pairing",   // pairing | allowlist | open | disabled
      allowFrom: ["tg:123456", "tg:789012"],
      groupPolicy: "allowlist", // allowlist | open
    },
  },
}
```

#### Discord
```json5
{
  channels: {
    discord: {
      enabled: true,
      botToken: "${DISCORD_BOT_TOKEN}",
      dmPolicy: "pairing",
      allowFrom: ["discord:123456789"],
    },
  },
}
```

#### WhatsApp
```json5
{
  channels: {
    whatsapp: {
      enabled: true,
      dmPolicy: "pairing",
      allowFrom: ["+15555550123"],
    },
  },
}
```

**DM Policy Options:**
| Policy | Description |
|--------|-------------|
| `pairing` | Unknown senders get a one-time pairing code (default) |
| `allowlist` | Only senders in `allowFrom` |
| `open` | Allow all DMs (requires `allowFrom: ["*"]`) |
| `disabled` | Ignore all DMs |

---

### 3. Session (`session`)

Controls conversation continuity and isolation.

```json5
{
  session: {
    // DM session scoping
    dmScope: "per-channel-peer",  // main | per-peer | per-channel-peer | per-account-channel-peer
    
    // Thread bindings (Discord)
    threadBindings: {
      enabled: true,
      idleHours: 24,
      maxAgeHours: 0,
    },
    
    // Automatic session reset
    reset: {
      mode: "daily",      // daily | idle | never
      atHour: 4,          // For daily mode
      idleMinutes: 120,   // For idle mode
    },
  },
}
```

---

### 4. Gateway (`gateway`)

Server configuration and reload behavior.

```json5
{
  gateway: {
    port: 18789,
    bind: "127.0.0.1",
    
    // Authentication
    auth: {
      token: "${OPENCLAW_GATEWAY_TOKEN}",
    },
    
    // Config reload behavior
    reload: {
      mode: "hybrid",  // hybrid | hot | restart | off
      debounceMs: 300,
    },
    
    // Remote gateway settings
    remote: {
      enabled: false,
    },
  },
}
```

**Reload Modes:**
| Mode | Behavior |
|------|----------|
| `hybrid` | Hot-applies safe changes, auto-restarts for critical ones (default) |
| `hot` | Hot-applies only, warns about restart-required changes |
| `restart` | Restarts on any config change |
| `off` | Disables file watching |

---

### 5. Cron Jobs (`cron`)

Scheduled automation configuration.

```json5
{
  cron: {
    enabled: true,
    maxConcurrentRuns: 2,
    sessionRetention: "24h",
    runLog: {
      maxBytes: "2mb",
      keepLines: 2000,
    },
  },
}
```

---

### 6. Webhooks/Hooks (`hooks`)

HTTP webhook endpoints.

```json5
{
  hooks: {
    enabled: true,
    token: "shared-secret",
    path: "/hooks",
    defaultSessionKey: "hook:ingress",
    allowRequestSessionKey: false,
    allowedSessionKeyPrefixes: ["hook:"],
    mappings: [
      {
        match: { path: "gmail" },
        action: "agent",
        agentId: "main",
        deliver: true,
      },
    ],
  },
}
```

---

### 7. Environment Variables (`env`)

```json5
{
  env: {
    OPENROUTER_API_KEY: "sk-or-...",
    vars: {
      GROQ_API_KEY: "gsk-...",
    },
    shellEnv: {
      enabled: true,
      timeoutMs: 15000,
    },
  },
}
```

---

### 8. Secret References

For sensitive values, use SecretRef objects:

```json5
{
  models: {
    providers: {
      openai: {
        apiKey: {
          source: "env",
          provider: "default",
          id: "OPENAI_API_KEY",
        },
      },
    },
  },
  channels: {
    googlechat: {
      serviceAccountRef: {
        source: "exec",
        provider: "vault",
        id: "channels/googlechat/serviceAccount",
      },
    },
  },
}
```

**Source Types:**
- `env` — Read from environment variable
- `file` — Read from file path
- `exec` — Execute command and capture output

---

### 9. Config Splitting (`$include`)

Organize large configs across multiple files:

```json5
// ~/.openclaw/openclaw.json
{
  gateway: { port: 18789 },
  agents: { $include: "./agents.json5" },
  broadcast: {
    $include: ["./clients/a.json5", "./clients/b.json5"],
  },
}
```

Rules:
- Single file: replaces containing object
- Array of files: deep-merged in order (later wins)
- Nested includes: supported up to 10 levels
- Relative paths: resolved relative to including file

---

## Common Tasks

### Set a config value via CLI
```bash
openclaw config set agents.defaults.heartbeat.every "30m"
```

### Get a config value
```bash
openclaw config get agents.defaults.workspace
```

### Apply full config (replaces entire file)
```bash
openclaw gateway call config.apply --params '{
  "raw": "{ agents: { defaults: { workspace: \"~/.openclaw/workspace\" } } }",
  "baseHash": "<hash>",
  "sessionKey": "agent:main:telegram:dm:+15555550123"
}'
```

### Patch config (partial update)
```bash
openclaw gateway call config.patch --params '{
  "raw": "{ channels: { telegram: { dmPolicy: \"allowlist\" } } }",
  "baseHash": "<hash>"
}'
```

---

## Environment Variable Substitution

Reference env vars in any config string:

```json5
{
  gateway: {
    auth: { token: "${OPENCLAW_GATEWAY_TOKEN}" },
  },
  models: {
    providers: {
      custom: { apiKey: "${CUSTOM_API_KEY}" },
    },
  },
}
```

Rules:
- Only uppercase names: `[A-Z_][A-Z0-9_]*`
- Missing/empty vars throw at load time
- Escape with `$${VAR}` for literal output

---

## Validation

OpenClaw strictly validates configuration:
- Unknown keys cause Gateway to refuse to start
- Malformed types or invalid values are rejected
- Only exception: `$schema` root key for JSON Schema metadata

When validation fails:
1. Gateway does not boot
2. Only diagnostic commands work (`openclaw doctor`, `openclaw logs`)
3. Run `openclaw doctor` to see exact issues
4. Run `openclaw doctor --fix` to apply repairs

---

## Hot Reload

The Gateway watches `openclaw.json` and applies changes automatically.

**What hot-applies:**
- Channels, agents, models, routing
- Hooks, cron, heartbeat
- Sessions, messages, tools, media
- UI, logging, identity, bindings

**What needs restart:**
- Gateway server settings (port, bind, auth, TLS)
- Infrastructure (discovery, canvasHost, plugins)

---

## Sources

- Full reference: `/app/docs/gateway/configuration-reference.md`
- Examples: `/app/docs/gateway/configuration-examples.md`
- Secrets: `/app/docs/gateway/secrets.md`
- Bootstrapping: `/app/docs/start/bootstrapping.md`

---

*Research completed: 2026-03-11*
*Agent: Deckard*
*Issue: #168*
