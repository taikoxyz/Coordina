# Research: OpenClaw Framework

> Status: Initial research — March 2026
> Sources: GitHub, official docs, community articles

---

## What is OpenClaw?

OpenClaw is an open-source AI agent framework that runs agents locally or in cloud containers, connecting to any of 12+ LLM providers (Claude, GPT-4, DeepSeek, Ollama, etc.). Created by Austrian programmer Peter Steinberger and launched in late January 2026, it reached 145,000+ GitHub stars in under a week with 20,000+ forks and 300+ contributors. In February 2026, Steinberger joined OpenAI and the project moved to an open-source foundation.

- **Repo**: https://github.com/openclaw/openclaw
- **Install**: `npm install -g openclaw`
- **Skill registry**: https://github.com/openclaw/clawhub

---

## Agent Configuration Files

Each OpenClaw agent workspace lives at `~/.openclaw/workspace/` and is driven by a set of markdown files injected into the system prompt at every session:

| File | Purpose |
|------|---------|
| `SOUL.md` | Personality, tone, values, long-term behavioral constraints. Loaded every session. |
| `IDENTITY.md` | Name, vibe, emoji, quirks. Created/updated during bootstrap. |
| `MEMORY.md` | Curated long-term memory. Agent writes daily logs to `memory/YYYY-MM-DD.md` and distills key learnings into MEMORY.md. |

### Implications for our product

- Each agent in our system gets its own set of these files, living under `agents/<slug>/` in the team spec repo.
- `SOUL.md` and `IDENTITY.md` are the primary targets for admin input + AI enhancement.
- `MEMORY.md` is runtime-generated; the UI should surface it read-only.
- The admin never edits raw files — the form system generates and commits them.

---

## Gateway Architecture

OpenClaw uses a **Gateway** — a single multiplexed server (default port **18789**) that serves three things simultaneously:

1. **WebSocket RPC** — all control traffic from CLI, Control UI, plugins, and Node.js apps
2. **HTTP APIs** — including `POST /tools/invoke` for external tool calls and an **OpenAI-compatible API surface**
3. **Served Assets** — the browser-based Control UI SPA

### Authentication

- Token-based (`gateway.remote.token`) or password-based (`.password`)
- **Default**: gateway binds to loopback (`127.0.0.1`) — local-only by default
- **Remote access**: Recommended safest pattern is loopback + SSH tunnel or Tailscale Serve
- For K8s, the operator handles remote exposure securely (see Deployment section)

### Relevant endpoints

- `POST /tools/invoke` — invoke any tool externally
- OpenAI-compatible surface — use standard OpenAI SDK to talk to the agent
- WebSocket RPC — for streaming sessions and control commands

### Implications for our product

- The Mac app communicates with each deployed team via the gateway's HTTP/WebSocket API.
- The API server pod in the K8s cluster is the OpenClaw gateway, exposed via GKE Ingress with auth token.
- The Mac app stores the auth token per deployment environment and proxies requests through its local backend.

---

## Skills System

Skills are documentation-centric extensions that teach agents how to use external tools:

```
~/.openclaw/workspace/skills/
  my-skill/
    SKILL.md        # YAML frontmatter + description
    install.sh      # Optional: runs on skill installation
    config.json     # Optional: skill configuration
```

- Skills ship with OpenClaw (bundled) or are installed from ClawHub
- **Local overrides** take precedence over bundled versions
- When an agent's skill list changes, it must re-evaluate which skills to install/remove

### Implications for our product

- The admin configures a list of skill slugs per agent in the form UI
- When the skill list changes and the team is deployed, the relevant pod must be restarted so the agent can re-evaluate its skills
- Future UI feature: browse ClawHub for available skills

---

## LLM Provider Support

OpenClaw supports 12+ providers:

| Provider | Notes |
|----------|-------|
| Anthropic | Claude Opus, Sonnet (via direct API or OpenRouter) |
| OpenAI | GPT-4 and variants |
| DeepSeek | DeepSeek V3 |
| Ollama | Auto-detected at `http://127.0.0.1:11434/v1` |
| xAI | Grok models |
| Mistral | Mistral models |
| Groq | Fast inference |
| Cerebras | Fast inference |
| OpenRouter | Meta-provider routing to many models |
| Others | MiniMax, Kimi, Hugging Face |

Model is configurable via:
- `/model` command in a session
- `openclaw.json` config file
- Per-session override

### Implications for our product

- Model Providers are first-class objects in our data model — reusable across agents
- Each agent references a provider by ID; changing the provider triggers a pod restart
- Provider config maps to `openclaw.json` in the agent workspace

---

## Docker Deployment

OpenClaw supports containerization via Docker Compose with two volumes:

```yaml
volumes:
  - ~/.openclaw:/root/.openclaw        # Config, API keys, memory
  - ~/openclaw/workspace:/workspace    # Agent workspace
```

- Script: `docker-setup.sh` in the repo
- Suitable for single-host or simple multi-agent setups

---

## Kubernetes Deployment

**Official K8s Operator**: https://github.com/openclaw-rocks/k8s-operator

Production-grade features:
- **StatefulSets** — each agent pod has stable identity and its own PVC
- **NetworkPolicy** — default-deny for network isolation between agent pods
- **Resource limits** — CPU/memory quotas per pod
- **Read-only root filesystem** — security hardening
- **Minimal RBAC** — least-privilege access
- **RWX PVC support** — for multi-replica setups
- **Helm support** — chart-based deployment and upgrade lifecycle
- **Horizontal autoscaling** — scale pod replicas under load

### Advantages over Docker Compose

Multiple replicas, automatic failover, rolling deployments, better observability, production-grade security defaults.

### Implications for our product

- Use the official K8s operator as the deployment mechanism — don't reinvent Helm charts from scratch
- One StatefulSet per agent, with PVC for workspace persistence
- The lead agent's gateway is exposed via GKE Ingress as the API server pod
- Team spec repo contains the Helm values/overrides generated by our app

---

## Key Sources

- [OpenClaw GitHub](https://github.com/openclaw/openclaw)
- [OpenClaw Docs — Agent Workspace](https://docs.openclaw.ai/concepts/agent-workspace)
- [OpenClaw Docs — Skills](https://docs.openclaw.ai/tools/skills)
- [OpenClaw Docs — Gateway Security](https://docs.openclaw.ai/gateway/security)
- [OpenClaw Docs — Docker](https://docs.openclaw.ai/install/docker)
- [OpenClaw Docs — Model Providers](https://docs.openclaw.ai/concepts/model-providers)
- [K8s Operator](https://github.com/openclaw-rocks/k8s-operator)
- [OpenClaw Architecture Overview](https://ppaolo.substack.com/p/openclaw-system-architecture-overview)
- [OpenClaw Memory Files Explained](https://openclaw-setup.me/blog/openclaw-memory-files/)
- [CrowdStrike Security Analysis](https://www.crowdstrike.com/en-us/blog/what-security-teams-need-to-know-about-openclaw-ai-super-agent/)
