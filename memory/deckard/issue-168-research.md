# Issue #168: OpenClaw Configuration Research & Model Recommendations

## Executive Summary

Based on comprehensive analysis of OpenClaw documentation and current model pricing, this document provides:
1. **Complete config option inventory** for memory, models, agent behavior, and context management
2. **Model recommendations** optimized for D Squad's $1000/week budget and 5-agent team
3. **Production-ready openclaw.json** with annotations
4. **Weekly cost projections** with scenario breakdowns

---

## 1. OpenClaw Configuration Deep Dive

### 1.1 Memory Configuration Options

OpenClaw provides sophisticated memory management through multiple mechanisms:

#### Core Memory Settings
```json5
{
  agents: {
    defaults: {
      // Bootstrap context controls
      bootstrapMaxChars: 20000,           // Per-file limit (default: 20000)
      bootstrapTotalMaxChars: 150000,     // Total across all bootstrap files
      bootstrapPromptTruncationWarning: "once", // off | once | always
      
      // Memory flush before compaction
      compaction: {
        memoryFlush: {
          enabled: true,
          softThresholdTokens: 4000,      // Trigger threshold
          systemPrompt: "Session nearing compaction. Store durable memories now.",
          prompt: "Write any lasting notes to memory/YYYY-MM-DD.md; reply with NO_REPLY if nothing to store."
        }
      },
      
      // Vector memory search configuration
      memorySearch: {
        provider: "gemini",               // openai | gemini | voyage | mistral | ollama | local
        model: "gemini-embedding-001",
        fallback: "openai",
        
        // Hybrid search (BM25 + vector)
        query: {
          hybrid: {
            enabled: true,
            vectorWeight: 0.7,
            textWeight: 0.3,
            mmr: { enabled: true, lambda: 0.7 },        // Diversity re-ranking
            temporalDecay: { enabled: true, halfLifeDays: 30 }  // Recency boost
          }
        },
        
        cache: { enabled: true, maxEntries: 50000 }
      }
    }
  }
}
```

#### Session Maintenance
```json5
{
  session: {
    reset: {
      mode: "daily",        // daily | idle
      atHour: 4,
      idleMinutes: 120
    },
    maintenance: {
      mode: "warn",
      pruneAfter: "30d",
      maxEntries: 500,
      maxDiskBytes: "500mb"
    },
    parentForkMaxTokens: 100000
  }
}
```

### 1.2 Model Selection Configuration

```json5
{
  agents: {
    defaults: {
      model: {
        primary: "anthropic/claude-sonnet-4-6",
        fallbacks: ["openai/gpt-5.2", "google/gemini-2.5-pro"]
      },
      
      models: {
        "anthropic/claude-opus-4-6": {
          alias: "opus",
          params: {
            temperature: 0.7,
            maxTokens: 8192,
            cacheRetention: "long",
            context1m: true
          }
        }
      },
      
      thinkingDefault: "low",
      verboseDefault: "off",
      timeoutSeconds: 600,
      maxConcurrent: 3
    }
  }
}
```

### 1.3 Context Management

```json5
{
  agents: {
    defaults: {
      imageMaxDimensionPx: 1200,
      contextPruning: {
        mode: "cache-ttl",
        ttl: "1h",
        keepLastAssistants: 3
      },
      compaction: {
        mode: "safeguard",
        reserveTokensFloor: 24000
      }
    }
  }
}
```

---

## 2. Model Recommendations for D Squad

### 2.1 Current Pricing (per 1M tokens)

| Model | Input | Output | Context | Best For |
|-------|-------|--------|---------|----------|
| claude-opus-4.6 | $5.00 | $25.00 | 1M | Complex reasoning, research |
| claude-sonnet-4.6 | $3.00 | $15.00 | 1M | Balanced performance |
| gpt-5.2 | $1.75 | $14.00 | 272K | Coding, tools |
| gpt-5-mini | $0.25 | $2.00 | 272K | High volume, simple tasks |
| gemini-2.5-flash | ~$0.15 | ~$0.60 | 1M | Ultra cost-effective |

*OpenRouter adds 5.5% platform fee to credit purchases*

### 2.2 Recommended Model Assignments

| Agent | Primary | Fallback | Use Case |
|-------|---------|----------|----------|
| alice-wong | claude-sonnet-4.6 | gpt-5.2 | Orchestration, planning |
| bob-li | claude-opus-4.6 | claude-sonnet-4.6 | Technical architecture |
| ripley | gpt-5.2 | gpt-5-mini | Code generation, UI |
| aeryn | gpt-5-mini | gemini-2.5-flash | Social media, high volume |
| deckard | claude-opus-4.6 | claude-sonnet-4.6 | Market analysis, research |

---

## 3. Recommended openclaw.json

```json5
{
  // Environment
  env: {
    OPENROUTER_API_KEY: "${OPENROUTER_API_KEY}",
    ANTHROPIC_API_KEY: "${ANTHROPIC_API_KEY}",
    OPENAI_API_KEY: "${OPENAI_API_KEY}",
    GEMINI_API_KEY: "${GEMINI_API_KEY}"
  },

  // Gateway
  gateway: {
    port: 18789,
    reload: { mode: "hybrid", debounceMs: 300 }
  },

  // Global model catalog
  models: {
    mode: "merge",
    providers: {
      anthropic: { apiKey: "${ANTHROPIC_API_KEY}", api: "anthropic-messages" },
      openai: { apiKey: "${OPENAI_API_KEY}", api: "openai-completions" },
      openrouter: {
        baseUrl: "https://openrouter.ai/api/v1",
        apiKey: "${OPENROUTER_API_KEY}",
        api: "openai-completions"
      }
    }
  },

  // Agent defaults
  agents: {
    defaults: {
      workspace: "~/.openclaw/workspace",
      
      model: {
        primary: "anthropic/claude-sonnet-4-6",
        fallbacks: ["openai/gpt-5.2"]
      },
      
      models: {
        "anthropic/claude-opus-4-6": {
          alias: "opus",
          params: { cacheRetention: "long", context1m: true }
        },
        "anthropic/claude-sonnet-4-6": {
          alias: "sonnet",
          params: { cacheRetention: "long" }
        },
        "openai/gpt-5.2": {
          alias: "gpt",
          params: { temperature: 0.7 }
        },
        "openai/gpt-5-mini": {
          alias: "gpt-mini",
          params: { temperature: 0.8 }
        }
      },
      
      thinkingDefault: "low",
      timeoutSeconds: 600,
      maxConcurrent: 3,
      
      // Memory configuration
      memorySearch: {
        provider: "gemini",
        model: "gemini-embedding-001",
        fallback: "openai",
        query: {
          hybrid: {
            enabled: true,
            vectorWeight: 0.7,
            textWeight: 0.3,
            temporalDecay: { enabled: true, halfLifeDays: 30 }
          }
        }
      },
      
      // Context management
      contextPruning: {
        mode: "cache-ttl",
        ttl: "1h",
        keepLastAssistants: 3
      },
      
      compaction: {
        mode: "safeguard",
        reserveTokensFloor: 24000,
        memoryFlush: {
          enabled: true,
          softThresholdTokens: 4000
        }
      },
      
      // Tool configuration
      tools: {
        profile: "coding",
        elevated: { enabled: true }
      },
      
      // Subagent defaults
      subagents: {
        model: "openai/gpt-5-mini",
        maxConcurrent: 2,
        runTimeoutSeconds: 900
      }
    },
    
    // Per-agent overrides
    list: [
      {
        id: "alice-wong",
        default: true,
        model: "anthropic/claude-sonnet-4-6",
        params: { cacheRetention: "long" }
      },
      {
        id: "bob-li",
        model: "anthropic/claude-opus-4-6",
        params: { cacheRetention: "long" }
      },
      {
        id: "ripley",
        model: "openai/gpt-5.2"
      },
      {
        id: "aeryn",
        model: "openai/gpt-5-mini",
        params: { cacheRetention: "none" }
      },
      {
        id: "deckard",
        model: "anthropic/claude-opus-4-6",
        params: { cacheRetention: "long" }
      }
    ]
  },

  // Session configuration
  session: {
    dmScope: "per-channel-peer",
    reset: { mode: "daily", atHour: 4, idleMinutes: 120 },
    maintenance: {
      mode: "warn",
      pruneAfter: "30d",
      maxEntries: 500
    }
  },

  // Channel configuration
  channels: {
    telegram: {
      enabled: true,
      dmPolicy: "pairing",
      groupPolicy: "allowlist",
      groups: { "*": { requireMention: true } }
    }
  },

  // Cron configuration
  cron: {
    enabled: true,
    maxConcurrentRuns: 2,
    sessionRetention: "24h"
  }
}
```

---

## 4. Weekly Cost Breakdown

### 4.1 Budget Scenarios

**Conservative Estimate (40% of budget)**
| Component | Daily Usage | Weekly Cost |
|-----------|-------------|-------------|
| Opus agents (2 × 500K in/out/day) | 2 × $15 | $210 |
| Sonnet agent (1 × 500K/day) | $9 | $63 |
| GPT-5.2 (1 × 300K/day) | $4.73 | $33 |
| GPT-Mini (1 × 1M/day) | $2.25 | $16 |
| Embeddings + overhead | - | $50 |
| **Total** | | **~$372/week** |

**Moderate Usage (70% of budget)**
| Component | Daily Usage | Weekly Cost |
|-----------|-------------|-------------|
| Opus agents (2 × 1M in/out/day) | 2 × $30 | $420 |
| Sonnet agent (1 × 1M/day) | $18 | $126 |
| GPT-5.2 (1 × 600K/day) | $9.45 | $66 |
| GPT-Mini (1 × 2M/day) | $4.50 | $32 |
| Embeddings + overhead | - | $100 |
| **Total** | | **~$744/week** |

**Heavy Usage (100% of budget)**
| Component | Daily Usage | Weekly Cost |
|-----------|-------------|-------------|
| Opus agents (2 × 2M in/out/day) | 2 × $60 | $840 |
| Sonnet agent (1 × 2M/day) | $36 | $252 |
| GPT-5.2 (1 × 1M/day) | $15.75 | $110 |
| GPT-Mini (1 × 3M/day) | $6.75 | $47 |
| Embeddings + overhead | - | $150 |
| **Total** | | **~$1,399/week** |

### 4.2 Cost Optimization Recommendations

1. **Use cache retention strategically**: Set `cacheRetention: "long"` for agents with long sessions (reduces cache write costs)

2. **Enable context pruning**: `mode: "cache-ttl"` removes old tool results before sending to LLM

3. **Subagent cost control**: Spawn subagents with `gpt-5-mini` for simple parallel tasks

4. **Image dimension tuning**: Lower `imageMaxDimensionPx` for screenshot-heavy workflows

5. **Daily reset schedule**: Configure `reset: { mode: "daily", atHour: 4 }` to manage context growth

6. **Model-specific overrides**: Use cheaper models for specific tools via `tools.byProvider`

---

## 5. Implementation Checklist

- [ ] Set up auth-profiles.json with API keys for Anthropic, OpenAI, Gemini
- [ ] Create per-agent workspaces
- [ ] Configure Telegram bot tokens and allowlists
- [ ] Test model fallbacks with `/model` command
- [ ] Verify memory search is working with `/context` command
- [ ] Set up monitoring via `/status` and `/usage full`
- [ ] Configure heartbeat for critical agents
- [ ] Set up cron jobs for periodic tasks

---

*Document compiled by Deckard (D Squad Market Intelligence) for Issue #168*
*Last updated: June 2025*
