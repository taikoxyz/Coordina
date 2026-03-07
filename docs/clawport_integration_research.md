# ClawPort vs Mission Control — Integration Research

Coordina deploys OpenClaw agent teams to GKE. This document evaluates ClawPort and Mission Control as complementary monitoring and management layers.

---

## Executive Summary

**ClawPort** is a local-first visual dashboard for developing and testing OpenClaw agent teams. It auto-discovers agents from workspace files, provides direct chat, org chart visualization, and memory browsing — all running on your machine with zero cloud dependencies.

**Mission Control** is a production-grade control plane deployed as a pod inside your GKE cluster. It provides task management, agent lifecycle monitoring, token/cost tracking, GitHub issue sync, webhooks, and RBAC — designed for teams operating agents in production.

**Verdict: They co-live.** ClawPort serves the development workflow; Mission Control serves the production workflow. No overlap, no conflict, no Coordina code changes required for either.

---

## Feature Comparison

| Feature | ClawPort | Mission Control |
|---------|----------|-----------------|
| **Org Chart / Agent Map** | Interactive React Flow visualization | Agent list with status |
| **Agent Chat** | Streaming text, images, voice, file attachments | Inter-agent messaging API |
| **Task Board** | Kanban (queued / in-progress / done) | Kanban (6 columns: inbox to done) |
| **Cron Monitoring** | Live status, error highlighting, auto-refresh | Background scheduler for heartbeats/cleanup |
| **Cost Dashboard** | Daily charts, per-job breakdown, model distribution | Per-model token tracking with trend charts |
| **Activity Logs** | Historical + live-stream widget (SSE) | Real-time WebSocket + SSE push |
| **Memory Browser** | Search agent memory files, Markdown rendering | Not available |
| **GitHub Sync** | Not available | Issue sync with label/assignee mapping |
| **Webhooks** | Not available | Outbound webhooks with retry |
| **Claude Session Tracking** | Not available | Auto-discovers ~/.claude/projects/ sessions |
| **RBAC / Auth** | None (local only) | Session + API key, viewer/operator/admin roles |
| **Themes** | 5 themes (Dark, Glass, Color, Light, System) | Standard dashboard |
| **Agent Discovery** | Auto-scan workspace (SOUL.md, IDENTITY.md) | API registration (POST /api/agents) |

---

## Architecture

### ClawPort (Local Development)

```
Developer Machine
├── ClawPort (Next.js, localhost:3000)
│   └── Reads: $WORKSPACE_PATH/agents/*/SOUL.md
│   └── Connects: OpenClaw Gateway (localhost:18789)
│
├── OpenClaw Daemon
│   └── Gateway (localhost:18789)
│   └── Claude Code sessions
│
└── Agent workspace files
    ├── SOUL.md, IDENTITY.md
    ├── agents/<name>/SOUL.md
    └── clawport/agents.json (optional override)
```

### Mission Control (GKE Production)

```
GKE Cluster (namespace: team-slug)
├── Mission Control Pod (port 3000)
│   ├── SQLite DB (PVC-backed)
│   ├── Connects: lead-agent.team-slug.svc.cluster.local:18789
│   └── Connects: agent-n.team-slug.svc.cluster.local:18789
│
├── Agent Pods (StatefulSets)
│   ├── lead-agent (gateway: 18789)
│   ├── agent-2 (gateway: 18789)
│   └── agent-n (gateway: 18789)
│
├── Heartbeat CronJob (every 1m)
│   └── Pings: MC /api/agents/:id/heartbeat
│
└── IAP Ingress
    ├── mc.your-domain → Mission Control
    └── agent.your-domain → Agent gateways (human access)
```

### Co-Living Architecture

```
Development                          Production (GKE)
┌─────────────────┐                  ┌──────────────────────────────┐
│ Developer Machine│                  │ GKE Cluster                  │
│                  │                  │                              │
│  ClawPort ───────┤── local ──────► │  Mission Control Pod         │
│  (localhost:3000)│   gateway       │  (mc.domain:3000)            │
│                  │   :18789        │       │                      │
│  OpenClaw Daemon │                  │       ▼ (K8s internal DNS)  │
│  (localhost:18789)                  │  Agent Pods (:18789 each)   │
│                  │                  │                              │
│  Agent workspace │   Coordina      │  IAP Ingress (human access) │
│  files (local)   │── deploys ────► │                              │
└─────────────────┘                  └──────────────────────────────┘
```

---

## Integration Assessment for Coordina

### ClawPort Integration

**Effort: Zero code changes.** ClawPort is a standalone CLI tool that reads OpenClaw workspace files.

| Step | Action |
|------|--------|
| 1 | `npm install -g clawport-ui` |
| 2 | `clawport setup` (auto-detects OpenClaw config) |
| 3 | `clawport dev` (launches dashboard at localhost:3000) |

**When to use**: During local agent development — testing SOUL.md configs, chatting with agents before deploying, reviewing memory files, monitoring cron jobs.

**Optional enhancement**: Add a `clawport/agents.json` to team spec repos so ClawPort can render the same agent hierarchy that Coordina deploys. This file is ignored by OpenClaw and Coordina — it's ClawPort-only metadata.

### Mission Control Integration

**Effort: Ops-only (no Coordina code changes).** Already documented in `docs/mission_control_integration_plan.md`.

| Step | Action |
|------|--------|
| 1 | Build and push MC Docker image to GCR/Artifact Registry |
| 2 | Create K8s Secret with MC config in agent namespace |
| 3 | Apply PVC, Deployment, Service, Ingress manifests |
| 4 | Register agents via MC API (script-able) |
| 5 | Deploy heartbeat CronJob |

**When to use**: Production monitoring — tracking token costs, managing tasks across agents, GitHub issue sync, alerting on agent failures.

**Optional enhancement**: Add a post-deploy hook in Coordina that auto-registers newly deployed agents with Mission Control via `POST /api/agents` and `POST /api/gateways`. This would eliminate the manual registration step.

---

## Recommendation

### Phase 1 — Mission Control (production priority)

Mission Control addresses the immediate need: production visibility into deployed agent teams. Follow the existing plan in `docs/mission_control_integration_plan.md`.

**Why first**: You already have agents running in GKE without monitoring. MC gives you task tracking, cost visibility, and agent health in production.

### Phase 2 — ClawPort (developer experience)

Add ClawPort to the developer workflow for local agent testing and configuration.

**Why second**: It's a zero-effort install (`npm install -g clawport-ui`) with no dependencies on Coordina. Developers can adopt it independently.

### Phase 3 — Optional Coordina enhancements

Consider adding lightweight integration points if the manual steps become painful:

1. **Auto-register with MC on deploy**: After `kubectl apply`, call MC's `/api/agents` and `/api/gateways` endpoints to register new agents automatically
2. **ClawPort agents.json generation**: When exporting team specs to GitHub, also write a `clawport/agents.json` for local development parity
3. **Link to MC from Coordina UI**: Add a "Open Mission Control" button in the team view that opens `mc.{domain}` in the browser

---

## Key Links

| Resource | URL |
|----------|-----|
| ClawPort repo | https://github.com/JohnRiceML/clawport-ui |
| ClawPort npm | `clawport-ui` |
| ClawPort docs | SETUP.md, docs/API.md, docs/COMPONENTS.md in repo |
| Mission Control repo | https://github.com/builderz-labs/mission-control |
| MC integration plan | `docs/mission_control_integration_plan.md` (this repo) |
| MC latest release | v1.3.0 (March 2026) |
| ClawPort latest | v0.6.0 (March 2026) |

---

## Risk Notes

| Risk | Impact | Mitigation |
|------|--------|------------|
| MC is alpha (APIs may change) | Breaking changes on upgrade | Pin MC image version, test upgrades in staging |
| ClawPort is v0.6 (early) | Missing features, breaking changes | It's local-only — low blast radius |
| SQLite single-writer (MC) | No HA for Mission Control | Acceptable for operator dashboard; add Litestream if needed |
| No auto-discovery in MC | Manual agent registration on each deploy | Script it now, automate in Coordina later (Phase 3) |
| ClawPort requires local OpenClaw | Can't monitor GKE agents remotely | Use MC for remote; ClawPort for local dev only |
