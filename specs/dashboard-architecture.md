# D Squad Coordination Dashboard — Architecture

> **Repo:** dsquadteam/dsquad-dashboard  
> **Branch:** `d-squad`  
> **Stack:** Laravel 11 + Livewire 3 + FluxUI + Alpine.js  
> **Author:** Agent Ripley@team-d-squad

---

## Overview

Real-time coordination dashboard for D Squad agent management. Shows task kanban boards, project management, agent status cards, collaboration health metrics, and budget tracking.

## API Architecture — Primary→Fallback

The dashboard uses a **permanently dual-source** API architecture:

1. **Primary:** Bob Li's Project Management API at `http://agent-bob-li.team-d-squad.svc.cluster.local:19876`
2. **Fallback:** Local `MockDataService` (PHP) with realistic test data

`DashboardApiClient` tries the primary endpoint first. On connection failure/timeout, it falls back to MockDataService automatically. This is NOT temporary — mock data is the permanent development/test fallback.

### Bob's API URL Format (Important)
Bob's API uses **mixed URL patterns**:
- Projects: `/api/teams/team-d-squad/projects`
- Tasks, Agents, Events: `/api/v1/tasks`, `/api/v1/agents`, `/api/v1/events`
- Health: `/health`

### Port 19876 Cross-Pod Access
- Bob's API runs on port 19876 inside his pod
- K8s Service `project-api` (ClusterIP) exposes this — see `specs/project-api.yaml`
- The `additionalPorts` configuration in `team-d-squad.json` declares `{containerPort: 19876, name: "project-api"}`
- Requires Daniel to deploy from Coordina desktop app for changes to take effect

## SSE (Server-Sent Events) — Event Notation

**Critical alignment issue discovered and fixed:**

| Component | Notation | Example |
|-----------|----------|---------|
| Bob's API server | DOT | `task.created`, `agent.status_changed` |
| Local mock server (`server.cjs`) | COLON | `task:created`, `agent:status_changed` |
| Browser EventSource API | DOT (matches Bob) | Must use DOT for `.addEventListener()` |
| Alpine.js dispatch | DOT | `$dispatch('task.created', data)` |

**The sse-client.js must use DOT notation** to match Bob's actual SSE output. The local server.cjs uses COLON notation for development, but the SSE proxy route (`/sse/events`) forwards to Bob's primary endpoint first.

### SSE Events Emitted by Bob
- `task.created`, `task.updated`, `task.deleted`
- `agent.status_changed`
- `project.created`, `project.updated`
- `message.sent`, `token.usage` (health panel events)
- `heartbeat` (every 15s)
- `connected` (on initial connection)

**Note:** Bob does NOT emit `project.deleted` events.

### SSE Proxy Route
Laravel route at `/sse/events` acts as a proxy:
1. Try: `http://agent-bob-li...:19876/api/v1/events`
2. Fallback: Local mock SSE stream

### Smart Polling Pattern
Livewire components use adaptive polling:
- SSE connected → slow polling (60s fallback)
- SSE disconnected → fast polling (10-15s)
- Cache TTL reduced to 5s for SSE responsiveness

## Task Status Values

**Canonical status values** (aligned across all components):

| Status | Description |
|--------|-------------|
| `unclaimed` | No assignee |
| `in_progress` | Being worked on |
| `on_hold` | Paused/blocked |
| `completed` | Done |

**NOT used:** `review`, `done` — these were in early mocks but removed for consistency.

Status alignment must match in: Livewire validation rules, Kanban column keys, Blade color maps, MockDataService, and Bob's API.

## Key Components

### Pages
- **TaskKanban** — Drag-and-drop kanban board (unclaimed → in_progress → on_hold → completed)
- **TaskList** — Table view with search/filter
- **ProjectOverview** — Project cards with CRUD modals
- **DashboardStats** — Summary metrics
- **AgentStatusCards** — Real-time agent status grid

### Health Panel (Issue #156)
- **AgentHealthGrid** — Agent health status (30s poll)
- **CommunicationMatrix** — Inter-agent message flow (60s poll)
- **BudgetMeter** — Token budget tracking (5min poll)
- **AlertFeed** — System alerts with severity filter (30s poll)

### Bob's Health Panel API Endpoints
| Endpoint | Method | Response Shape |
|----------|--------|---------------|
| `/api/v1/messages` | GET | `{messages: [...], count, total}` — uses `message` field not `content`, no senderName/recipientName |
| `/api/v1/token-usage` | GET | `{usage: [...], count, total, summary}` |
| `/api/v1/token-usage/summary` | GET | `{total, byAgent, byModel}` — uses `period` param |
| `/api/v1/budget` | GET/PATCH | Budget configuration |
| `/api/v1/budget/status` | GET | `{configured, usage, alert}` — NO per-agent/per-model breakdown (get from summary) |

### Reusable Blade Components
- `x-skeleton-card`, `x-skeleton-line`, `x-skeleton-circle` — Loading states
- `x-empty-state` — Consistent empty view
- `x-error-panel` — Error with retry button

## Branch Strategy
- All dashboard work targets `d-squad` branch
- Feature branches: `feat/<description>` or `feature/<issue>-<description>`
- PRs target `d-squad`, Daniel merges `d-squad` → `main`

## Open PRs (dsquadteam/dsquad-dashboard)
- PR #6: Health Panel (Phase 1-2)
- PR #9: Kanban enhancements
- PR #13: SSE Livewire wiring
- PR #18: UX Polish (Issue #5)
