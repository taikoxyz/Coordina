# Implementation Plan: Agentic Teams UI + Platform

> Status: Pre-implementation plan. No code written yet.
> Runtime constraint: ZeroClaw inside Docker.
> UI style reference: agent.minimax.io/chat — chat-first, left nav, minimal noise.

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Data Model](#2-data-model)
3. [ZeroClaw Container Wiring](#3-zeroclaw-container-wiring)
4. [API Surface](#4-api-surface)
5. [UI Layout and Components](#5-ui-layout-and-components)
6. [Slack Integration Strategy](#6-slack-integration-strategy)
7. [Google Workspace Integration](#7-google-workspace-integration)
8. [Kubernetes Resource Overrides](#8-kubernetes-resource-overrides)
9. [Liveness and Activity Signals](#9-liveness-and-activity-signals)
10. [Backup to Google Cloud](#10-backup-to-google-cloud)
11. [Phased Rollout Plan](#11-phased-rollout-plan)

---

## 1. Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                         ClawTeam Platform                           │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                   Web UI (Next.js :3000)                    │   │
│  │  Left nav: Teams/Members  │  Main: Chat + Context panel     │   │
│  └───────────────┬───────────────────────────────┬─────────────┘   │
│                  │ REST/WS                         │ REST/WS        │
│  ┌───────────────▼───────────┐  ┌─────────────────▼────────────┐  │
│  │    Platform API (Go)      │  │   Agent Gateway (per-member)  │  │
│  │  :8080                    │  │   ZeroClaw :18789             │  │
│  │  Team CRUD                │  │   (chat proxy, health, files) │  │
│  │  Member CRUD              │  └──────────────────────────────┘  │
│  │  Backup jobs              │                                     │
│  │  k8s orchestration        │                                     │
│  └───────────────┬───────────┘                                     │
│                  │                                                  │
│  ┌───────────────▼───────────────────────────────────────────┐    │
│  │                  Shared Team Volume                        │    │
│  │  teams/{team_id}/config.json                              │    │
│  │  teams/{team_id}/TASK_QUEUE.md                            │    │
│  │  teams/{team_id}/mailbox/{member_id}/                     │    │
│  │  teams/{team_id}/artifacts/                               │    │
│  └────┬──────────────────────┬──────────┬──────────┬─────────┘    │
│       │                      │          │          │               │
│  ┌────▼───┐  ┌───────┐  ┌────▼───┐  ┌──▼─────┐   ▼              │
│  │member-1│  │  ...  │  │member-N│  │coord.  │  k8s operator     │
│  │zeroclaw│  │       │  │zeroclaw│  │zeroclaw│                   │
│  │+sidecar│  │       │  │+sidecar│  │+sidecar│                   │
│  └────────┘  └───────┘  └────────┘  └────────┘                   │
└─────────────────────────────────────────────────────────────────────┘
```

### Components

| Component | Technology | Responsibility |
|-----------|-----------|----------------|
| **Web UI** | Next.js 15, TypeScript, Tailwind CSS, shadcn/ui | All user interactions |
| **Platform API** | Go (net/http + chi router) | Team/member CRUD, k8s ops, backup, chat history |
| **Platform DB** | SQLite (local) / PostgreSQL (k8s) | Chat history, team/member metadata, message queue |
| **Agent Sidecar** | Go or Python, per-container | Polls mailbox, exposes REST for UI proxy |
| **ZeroClaw** | ZeroClaw binary (Rust) | LLM agent runtime — chat, tools, memory |
| **Shared Volume** | Docker bind-mount / k8s RWX PVC | Team state, mailbox, artifacts |
| **Coordination Sidecar** | Lightweight Go service, per-container | Bridges ZeroClaw ↔ file mailbox |

### Deployment Modes

- **Local/Docker Compose:** single machine, shared bind-mount volume
- **Kubernetes:** k8s Deployments (or StatefulSets) + ReadWriteMany PVC + ingress

---

## 2. Data Model

### Team

```
Team {
  id:             uuid              // stable, generated on create
  name:           string            // slug-friendly, e.g. "acme" — used in project ID, member IDs, emails
  display_name:   string            // human-readable, e.g. "Acme Corp AI Team"
  domain:         string            // e.g. "acme.com" — used for Google Workspace email suffix
  gcp_project_id: string            // auto-derived: "coordina-{name}"; set after project creation
  gcp_project_status: enum          // "pending" | "provisioning" | "ready" | "error"
  size:           int               // = len(members), derived
  members:        Member[]
  defaults: {
    cpu:          string            // e.g. "500m"
    memory:       string            // e.g. "512Mi"
    disk:         string            // e.g. "5Gi"
  }
  created_at:     timestamp
  updated_at:     timestamp
}
```

### Member

```
Member {
  id:           string              // = "{team_name}_{name}" — stable identifier, immutable after set
  prefix:       string              // display-only: "Agent", "Mr", "Ms", etc. — NOT part of id or email
  name:         string              // slug-friendly, e.g. "alice"
  display_name: string              // human-friendly, e.g. "Alice Chen"
  team_id:      uuid
  is_team_lead: bool                // at least one member per team must be true
  role:         string              // "Coordinator", "Researcher", "Engineer", etc.
  model: {
    provider:   string              // "anthropic", "openai", "ollama"
    model_id:   string              // e.g. "claude-opus-4-6"
  }
  tools_enabled: string[]           // e.g. ["web_search", "file_write", "memory_search"]
  resources: {                      // nil = use team defaults
    cpu:        string | null
    memory:     string | null
    disk:       string | null
  }
  google_identity: {
    email:           string         // "{team_name}_{name}@{team.domain}" — auto-computed
    provisioned:     bool           // true once Platform API has created the Google account
    suspended:       bool           // true if account was suspended (e.g. on member delete)
    credential_ref:  string         // reference to secret store key (service account, per-team)
    scopes:          string[]       // ["gmail.readonly", "drive.file", "docs.readwrite"]
  } | null
  slack: {
    bot_token_ref: string | null    // nil = use team-shared bot token
    channel_ids:   string[]         // channels this member listens to
    user_handle:   string | null    // e.g. "@Agent_Alice"
  } | null
  created_at:   timestamp
  updated_at:   timestamp
}
```

### ID Formation Rules

- `id = "{team_name}_{name}"` — formed at create time, immutable
- `prefix` is display-only; it does not appear in `id` or `email`
- `name` is **immutable after creation** — it cannot be edited; to get a member with a different name, use the Duplicate flow (creates a new member with a new name and new `id`)
- Editable after creation: `display_name`, `prefix`, `role`, `model`, `tools_enabled`, `resources`, `is_team_lead`; `id`, `name`, and `email` are never mutated
- `name` must be lowercase alphanumeric + underscores
- `team.name` must be: lowercase, letters/digits/hyphens only, 3–20 chars (validated at team create; GCP-safe: `coordina-{team_name}` stays within 6–30 char limit)
- GCP project name collision: if `coordina-{team_name}` already exists in the org, the Platform API auto-increments the suffix: `coordina-{team_name}2`, `coordina-{team_name}3`, etc. until a free name is found. The resolved `gcp_project_id` is stored on the team and shown read-only in the Kubernetes tab.

### Team Immutability

- `team.name` (slug) is **immutable after creation** — embedded in GCP project ID and all member IDs
- `team.domain` is **immutable after creation** — embedded in all member Google email addresses
- `team.display_name` is freely editable
- The General tab in TeamSettingsModal shows `name` and `domain` as read-only fields with a tooltip explaining why

### Domain Uniqueness

`team.domain` must be unique per user account — two teams owned by the same user cannot share a domain. Teams owned by different users may use the same domain.

### Team Lead Rules

- Every team must have `is_team_lead: true` on at least one member
- The default chat target in the UI is the Team Lead member
- If the Team Lead is deleted, the UI prompts to designate a new one before allowing the delete

### Team Deletion Flow

Deleting a team is a multi-step confirmation dialog:

1. **Auto-backup triggered first:** Platform API automatically backs up all member files to GCS before any deletion proceeds. If backup fails, deletion is blocked (user can override with "Skip backup and delete anyway").
2. **Confirmation dialog** shows:
   - "This will permanently delete the GCP project `coordina-{team_name}` and all resources within it."
   - Checkbox: "Also delete all Google Workspace accounts for this team's members" (default: unchecked — accounts remain suspended if previously provisioned)
   - Checkbox: "I understand this cannot be undone"
3. On confirm: Platform API stops all containers, deletes k8s resources, **permanently deletes** the GCP project, suspends (or deletes, if checkbox checked) Google accounts, then removes the team record.

### Credential Storage

All credentials are entered by the user through the UI and stored in the secrets backend — nothing is provisioned out-of-band. The Platform API writes them on behalf of the user; containers receive them at deploy/restart time via environment variable injection.

- **Local/Docker:** encrypted file store at `~/.clawteam/secrets/{team_id}/{member_id}/`
- **k8s (GKE):** native Kubernetes Secrets; the Platform API creates/updates them via the k8s API; referenced by `{ref}` strings in the Member model

**Global (bootstrap) credentials — entered once in GlobalSettingsPanel:**

| Credential | Description |
|------------|-------------|
| GCP Organization ID | The org under which team projects are created |
| GCP Billing Account ID | Attached to every auto-created project |
| Bootstrap service account key JSON | Org-level SA; needs `resourcemanager.projects.create`, `billing.resourceAssociations.create`, `iam.serviceAccountAdmin`, `serviceusage.services.enable` |

Bootstrap credentials are required before any team can be created. They are stored at the app level (not per-team).

**Credentials collected via UI (full list):**

| Credential | Where entered | Scope |
|------------|--------------|-------|
| LLM API key (e.g. Anthropic) | Team Settings → API Keys | Per-team default; per-member override in MemberForm |
| GCS bucket name | Team Settings → Backup | Per-team |
| Slack App bot token | Team Settings → Slack | Per-team shared |
| Per-member Slack bot token | MemberForm → Slack | Per-member override |
| Google Workspace admin email | Team Settings → Google Workspace | Per-team (SA reused from auto-created team project) |

Note: The team GCP service account and GKE cluster are **auto-provisioned** per team — no manual key upload or cluster config required.

### GCP Project Auto-Provisioning (async, triggered on team create)

When `POST /api/teams` is called, after the team record is saved, the Platform API queues an async provisioning job:

1. **Validate** `team.name` slug: unique per user, GCP-safe characters
2. **Resolve GCP project name:** start with `coordina-{team_name}`; if it already exists in the org, increment: `coordina-{team_name}2`, `coordina-{team_name}3`, etc. until a free name is found (cap at suffix 99). Store resolved name as `team.gcp_project_id`.
3. **Create GCP project** using the resolved name and bootstrap SA
4. **Attach billing account** (bootstrap SA needs `billing.resourceAssociations.create`)
5. **Enable APIs:** `container.googleapis.com`, `storage.googleapis.com`, `admin.googleapis.com`, `file.googleapis.com`
6. **Create team service account** `clawteam-sa@{gcp_project_id}.iam.gserviceaccount.com`
7. **Grant SA roles:** GKE Admin, Storage Admin, Logging Writer
8. **Generate and store SA key** → secrets backend; referenced as `team.gcp_sa_key_ref`
9. **Set** `team.gcp_project_status = "ready"`

Steps 2–9 run asynchronously. UI shows a "Provisioning GCP project..." spinner (polling `GET /api/teams/{team_id}/gcp/status`). The team is immediately usable for local Docker/chat (Phase 0). GKE and GCS features are unlocked once `gcp_project_status = "ready"`.

### Chat History Storage

Chat history is stored in the **Platform API's database**, not in the ZeroClaw container. This means history persists across container restarts, redeploys, and is always readable from the UI.

```
ChatMessage {
  id:          uuid
  team_id:     uuid
  member_id:   string
  role:        "user" | "agent"
  content:     string
  created_at:  timestamp
}
```

**Offline message queue:** If a user sends a message when a member's container is offline, the message is saved to the Platform DB with `status: "queued"`. When the sidecar comes back online and calls its heartbeat, the Platform API delivers queued messages. The UI shows a "⏳ Queued" indicator on the message bubble until delivery is confirmed.

---

## 3. ZeroClaw Container Wiring

### Assumption

ZeroClaw accepts a config file (TOML or YAML) that specifies: model provider, API keys, enabled channels, tool allowlist, and identity. The exact schema must be confirmed against ZeroClaw docs before Phase 1 implementation.

### Per-Container Structure

```
zeroclaw-agent/
├── Dockerfile
├── entrypoint.sh         # Generates zeroclaw.toml from env vars at startup
├── sidecar/              # Coordination sidecar (Go binary)
│   └── main.go
└── config/
    └── zeroclaw.toml.tmpl
```

### `Dockerfile`

```dockerfile
FROM zeroclaw/zeroclaw:latest AS zeroclaw-bin

FROM debian:bookworm-slim
COPY --from=zeroclaw-bin /usr/local/bin/zeroclaw /usr/local/bin/zeroclaw
COPY sidecar/bin/sidecar /usr/local/bin/sidecar
COPY entrypoint.sh /entrypoint.sh

ENV MEMBER_ID=""
ENV MEMBER_ROLE=""
ENV MEMBER_MODEL=""
ENV MEMBER_PREFIX=""
ENV MEMBER_TOOLS=""
ENV ANTHROPIC_API_KEY=""
ENV TEAM_VOLUME="/mnt/team"

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD /usr/local/bin/sidecar healthcheck

ENTRYPOINT ["/entrypoint.sh"]
```

### `entrypoint.sh` (conceptual)

```bash
#!/bin/bash
set -e

# Generate zeroclaw.toml from env vars
envsubst < /app/config/zeroclaw.toml.tmpl > /home/zeroclaw/.config/zeroclaw/config.toml

# Seed memory directory from team volume if first boot
MEMBER_DIR="$TEAM_VOLUME/members/$MEMBER_ID"
LOCAL_MEM="/home/zeroclaw/.local/share/zeroclaw"
if [ ! -f "$LOCAL_MEM/.initialized" ] && [ -d "$MEMBER_DIR/seed" ]; then
  cp -rn "$MEMBER_DIR/seed/." "$LOCAL_MEM/"
  touch "$LOCAL_MEM/.initialized"
fi

# Start coordination sidecar in background
/usr/local/bin/sidecar \
  --member-id "$MEMBER_ID" \
  --team-volume "$TEAM_VOLUME" \
  --port 18788 &

# Start ZeroClaw
exec /usr/local/bin/zeroclaw
```

### Coordination Sidecar

ZeroClaw's inter-agent coordination is not natively documented. The sidecar bridges the gap:

- **Polls** `$TEAM_VOLUME/teams/{team_id}/mailbox/{member_id}/` every 5s for new JSON messages
- **Injects** new messages into ZeroClaw via its local API or stdin
- **Exposes** `GET /health`, `GET /files?format=markdown`, `GET /status` for the Platform API to call
- **Exports memory on request:** `GET /files?format=markdown` triggers ZeroClaw to dump its SQLite memory to a temporary markdown tree; the sidecar serves the result — no SQLite schema knowledge required by the Platform API or UI
- **Writes** ZeroClaw's responses to the shared mailbox for the coordinator

This sidecar is a lightweight Go binary (< 5 MB) co-deployed in the same container as ZeroClaw.

### docker-compose.yml (team deployment)

```yaml
services:
  # One service block per member — generated by Platform API
  # MEMBER_ID = "{team_name}_{name}", e.g. "acme_alice"
  acme_alice:
    image: clawteam-agent:latest
    environment:
      MEMBER_ID: "acme_alice"
      MEMBER_PREFIX: "Agent"           # display-only
      MEMBER_ROLE: "Team Coordinator"
      MEMBER_MODEL: "anthropic/claude-opus-4-6"
      MEMBER_TOOLS: "web_search,file_write,memory_search"
      ANTHROPIC_API_KEY: "${ANTHROPIC_API_KEY}"
    volumes:
      - acme_alice_data:/home/zeroclaw/.local/share/zeroclaw
      - team_shared:/mnt/team
    ports: ["18800:18789"]
    restart: unless-stopped

  # ... repeat per member

  ui:
    image: clawteam-ui:latest
    ports: ["3000:3000"]
    environment:
      PLATFORM_API_URL: "http://platform-api:8080"
    restart: unless-stopped

  platform-api:
    image: clawteam-platform-api:latest
    ports: ["8080:8080"]
    volumes:
      - team_shared:/mnt/team
      - /var/run/docker.sock:/var/run/docker.sock  # for container management
    restart: unless-stopped

volumes:
  acme_alice_data:
  # ... per member
  team_shared:
```

---

## 4. API Surface

### Platform API (Go, :8080)

#### Teams

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/teams` | List all teams |
| `POST` | `/api/teams` | Create team |
| `GET` | `/api/teams/{team_id}` | Get team |
| `PUT` | `/api/teams/{team_id}` | Update team (display_name, defaults only — name/domain immutable) |
| `DELETE` | `/api/teams/{team_id}` | Delete team: auto-backup → delete GCP project → stop containers → remove record |

#### Members

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/teams/{team_id}/members` | List members |
| `POST` | `/api/teams/{team_id}/members` | Create member |
| `GET` | `/api/teams/{team_id}/members/{member_id}` | Get member |
| `PUT` | `/api/teams/{team_id}/members/{member_id}` | Update member (display_name, role, model, resources) |
| `DELETE` | `/api/teams/{team_id}/members/{member_id}` | Delete member: stop + remove container, suspend Google account, remove from team group |
| `POST` | `/api/teams/{team_id}/members/{member_id}/duplicate` | Duplicate member (copy files + new name) |

Validation rules enforced by the API:
- `prefix` must be in team's allowlist
- `id` uniqueness within team
- At least one `is_team_lead: true` per team at all times
- Resource values must be valid k8s quantity strings

#### Chat

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/teams/{team_id}/chat` | Send message to Team Lead |
| `POST` | `/api/teams/{team_id}/members/{member_id}/chat` | Send message to specific member |
| `GET` | `/api/teams/{team_id}/members/{member_id}/chat/history` | Get chat history |
| `WS` | `/api/teams/{team_id}/members/{member_id}/stream` | Stream chat responses (WebSocket) |

#### Files (Memory Browser)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/teams/{team_id}/members/{member_id}/files` | List member's files (tree, markdown export) |
| `GET` | `/api/teams/{team_id}/members/{member_id}/files/{path}` | Get file content |
| `GET` | `/api/teams/{team_id}/members/{member_id}/files?filter=memory` | Filter for memory-related files |

**How the files endpoint works:**
1. Platform API calls sidecar `GET /files?format=markdown` on the member's container
2. Sidecar requests ZeroClaw to export its SQLite memory DB as a markdown tree (via ZeroClaw's export command or local API)
3. ZeroClaw writes the export to a temp path; sidecar streams it back
4. Platform API returns the markdown tree to the UI

This means the Platform API and UI are **never coupled to ZeroClaw's SQLite schema**. If ZeroClaw's internal storage changes, only the sidecar's export call needs updating.

Memory-related file detection heuristic (applied to the exported markdown tree):
- File name contains: `MEMORY`, `SOUL`, `IDENTITY`, `WORKING_STATE`, `KNOWLEDGE`, `notes`, `log`
- File extension: `.md`, `.txt`, `.json`

#### Kubernetes

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/teams/{team_id}/deploy/k8s` | Deploy team to k8s cluster |
| `GET` | `/api/teams/{team_id}/deploy/k8s/status` | Get deployment status |
| `DELETE` | `/api/teams/{team_id}/deploy/k8s` | Tear down k8s deployment |
| `PUT` | `/api/teams/{team_id}/deploy/k8s/resources` | Update resource allocations |

#### Backup

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/teams/{team_id}/backup` | Trigger backup to Google Cloud Storage |
| `GET` | `/api/teams/{team_id}/backup/history` | List past backups |

Note: there is no restore endpoint — backup is export-only.

#### Liveness

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/teams/{team_id}/members/{member_id}/health` | Get member health + active task |
| `GET` | `/api/teams/{team_id}/health` | Health summary for all members |

#### GCP Provisioning

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/teams/{team_id}/gcp/status` | Poll async GCP project provisioning progress |
| `POST` | `/api/teams/{team_id}/gcp/reprovision` | Retry provisioning on error |

#### Global Settings (Bootstrap GCP — app-level, not per-team)

| Method | Path | Description |
|--------|------|-------------|
| `PUT` | `/api/settings/gcp` | Save bootstrap SA key JSON + GCP org ID + billing account ID |
| `GET` | `/api/settings/gcp/test` | Verify bootstrap SA has required org-level permissions |

#### Team Settings (Credentials)

All credentials entered via UI are stored by the Platform API. Values are write-only after save — the UI can clear/replace but never reads back the raw value.

| Method | Path | Description |
|--------|------|-------------|
| `PUT` | `/api/teams/{team_id}/settings/apikeys` | Save team-default LLM API key + provider |
| `GET` | `/api/teams/{team_id}/settings/gke/test` | Verify GKE cluster connectivity (cluster auto-created in `coordina-{team_name}`) |
| `PUT` | `/api/teams/{team_id}/settings/backup` | Save GCS bucket config |
| `PUT` | `/api/teams/{team_id}/settings/slack` | Save shared Slack bot token + signing secret |
| `GET` | `/api/teams/{team_id}/settings/slack/test` | Verify Slack token validity |
| `PUT` | `/api/teams/{team_id}/settings/google` | Save Google Workspace admin email (SA reused from team project) |
| `GET` | `/api/teams/{team_id}/settings/google/test` | Verify domain-wide delegation is configured (lists one user) |
| `POST` | `/api/teams/{team_id}/members/{member_id}/google/provision` | Create Google account for member (Admin SDK) |
| `POST` | `/api/teams/{team_id}/members/{member_id}/google/suspend` | Suspend Google account |
| `POST` | `/api/teams/{team_id}/google/group/create` | Create Google Group `coordina_{team_name}@{team.domain}` |
| `POST` | `/api/teams/{team_id}/google/group/sync` | Sync all current members into the team Google Group |
| `PUT` | `/api/teams/{team_id}/members/{member_id}/settings/apikey` | Save per-member LLM API key override |
| `PUT` | `/api/teams/{team_id}/members/{member_id}/settings/slack` | Save per-member Slack token override |

#### Config Export

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/teams/{team_id}/export/docker-compose` | Generate docker-compose.yml |
| `GET` | `/api/teams/{team_id}/export/k8s` | Generate k8s manifests (zip) |

### WebSocket Events (from Platform API → UI)

```
{event: "member.health", member_id, status, active_task}
{event: "member.message", member_id, message, timestamp}
{event: "task.updated", task_id, status, assignee}
{event: "backup.progress", team_id, percent, stage}
{event: "gcp.provisioning", team_id, status, step, error}
```

---

## 5. UI Layout and Components

### Overall Layout

```
┌──────────────────────────────────────────────────────────────────────┐
│  Logo + Team selector dropdown                            [Settings] │
├─────────────────────┬────────────────────────────────────────────────┤
│  Left Nav (240px)   │  Main Panel                                    │
│                     │                                                │
│  [+] New Team       │  ┌──────────────────────────────────────────┐  │
│                     │  │  Chat Header: Member name + status badge │  │
│  ▼ Acme Team        │  ├──────────────────────────────────────────┤  │
│  👑 Agent Alice     │  │                                          │  │
│  · Agent Bob        │  │  Chat Messages (scrollable)              │  │
│  · Mr Carlos        │  │                                          │  │
│  · Ms Diana         │  │  [user message]                          │  │
│  [+ Add Member]     │  │    [member response]                     │  │
│                     │  │                                          │  │
│  ▶ Beta Team        │  │                                          │  │
│                     │  ├──────────────────────────────────────────┤  │
│  ─────────────────  │  [Tab: Alice] [Tab: Bob] [+ New chat]          │
│  [Files]            │  ─────────────────────────────────────────────  │
│  [Tasks]            │  │  [Message input]          [Send ▶]       │  │
│  [Health]           │  └──────────────────────────────────────────┘  │
│  [Settings]         │                                                │
│                     │  Context Panel (collapsible, right side)       │
│                     │  Member info | Files | Tasks | Activity        │
└─────────────────────┴────────────────────────────────────────────────┘
```

### Reusable Components

#### `<TeamNav>`
- Team name + collapse/expand arrow
- Member list: avatar, `{prefix} {display_name}` (e.g. "Agent Alice Chen"), status dot (green/yellow/red)
- Crown icon on Team Lead(s)
- "Add Member" button at bottom
- Context menu on right-click: Edit, Duplicate, Delete
- Clicking a member opens their chat in a new tab in the main panel (or focuses the existing tab if already open)

#### `<MemberAvatar>`
- Initials from `display_name`, colored by `prefix` hash
- Status overlay dot (online/busy/offline)

#### `<ChatPanel>` (multi-tab)
- Main panel supports multiple open chat tabs simultaneously — one tab per member
- Tab bar: each tab shows `{prefix} {display_name}` + status dot; closeable with ×
- Clicking a member in the left nav opens a new tab or focuses the existing one
- Per tab: chat history with message bubbles (user = right, agent = left)
- Agent messages include model badge (e.g. "claude-opus-4-6")
- Streaming support: partial response tokens appear as they arrive
- Markdown rendering for agent responses
- Header per tab: `{prefix} {display_name}` + `id` (smaller) + health badge

#### `<ContextSidebar>` (collapsible right panel)
- Always reflects the member of the **active (focused) chat tab** — follows tab focus automatically
- Tabs: **Info** | **Files** | **Tasks** | **Activity**
- **Info tab:** member fields, model, role, resources, Google identity, Slack config
- **Files tab:** file tree with search; "memory" filter toggle highlights memory-related files
- **Tasks tab:** member's current + past tasks from TASK_QUEUE.md
- **Activity tab:** active thread identifier, last heartbeat timestamp, token usage

#### `<MemberForm>` (modal — create/edit, tabbed)

Three tabs:

**Basic tab:**
- Display prefix (select from allowlist; default "Agent"; cosmetic only)
- Name (slug; **editable on create only — read-only when editing**, with tooltip "Name is immutable")
- ID preview (read-only): `{team_name}_{name}` — auto-computed below the Name field
- Display Name, Role, Model (dropdown), Tools (checkboxes), Team Lead toggle
- Validation: name slug format, unique id check

**Integrations tab:**
- *API Key section:* LLM API key override (text input + "Use team default" checkbox; value masked after save)
- *Google Identity section:* email (read-only, auto-computed: `{team_name}_{name}@{team.domain}`), status badge (Not configured / Active / Suspended), OAuth scopes checklist, "Provision Google account" button (manual trigger)
- *Slack section:* Bot token override (text input + "Use team shared token" checkbox), Channel IDs, User handle

**Resources tab:**
- CPU, Memory, Disk inputs (with "Use team defaults" checkbox for each)
- Effective resource preview: shows resolved value (override or team default)

#### `<DuplicateMemberModal>`
- Shows source member
- Input: new Name (slug; the only way to get a member with a different name)
- ID preview shown: `{team_name}_{new_name}` (auto-computed, read-only)
- Confirmation: "Will copy all files from {source_id} and create a new member {team_name}_{new_name}"

#### Left nav links: [Files], [Tasks], [Health]

These links are **context-aware**:
- **No member selected (or team-level click):** opens a team-scoped view — aggregated across all members (e.g. all tasks in TASK_QUEUE.md, health grid for all members, all files browsable by member subfolder)
- **Member selected:** opens the same view scoped to that member only

The main panel replaces the chat area when a Files/Tasks/Health page is open. Chat tabs remain open in the tab bar and can be switched back to.

#### `<OnboardingWizard>` (first-run, shown on first app launch)

Shown before any team can be created. Steps:
1. **Welcome** — brief product intro; "Let's set up your GCP credentials"
2. **Bootstrap GCP SA** — GCP Organization ID, Billing Account ID, SA key upload, "Test permissions" button; must pass before Next is enabled
3. **Done** — "Your platform is ready. Create your first team."

If the user closes the wizard without completing, they land on the main UI with a persistent banner: "GCP not configured — [Open Setup]". Team creation is blocked until step 2 passes.

#### `<HealthDashboard>`
- Grid of member cards: status badge, last heartbeat, active task label
- Click member card → opens that member's chat tab

#### `<BackupPanel>`
- GCS bucket input, backup scope selector (all members / selected members)
- Format: zip of file tree (human-readable markdown exports)
- "Backup now" button + progress bar (via WebSocket event)
- Backup history table: timestamp, size — **no restore; backup is export-only**

#### `<K8sPanel>`
- Resource editor: team defaults (CPU/memory/disk) + per-member override table
- Override rule display: "Member overrides team default — effective: 1000m CPU"
- "Deploy to cluster" button → shows manifest preview → confirm (initial deploy)
- **Pending deployment banner:** when members are added or resources changed after initial deploy, a banner appears: "N member(s) have pending changes — [Deploy now]"; user explicitly confirms before any containers are affected
- When a member is deleted, Platform API automatically stops and removes their container (no manual action required)
- Deployment status per member: Pending / Running / Failed

#### `<TeamSettingsModal>` (tabbed)

**General tab:**
- Team display name (editable)
- Team name slug (read-only after creation — immutable; shown grayed out with tooltip explaining why)
- Domain (read-only after creation — immutable; changing would invalidate all member emails and GCP project)
- Prefix allowlist editor (add/remove; default `["Agent"]`); removing a prefix that is currently in use by any member is **blocked** — UI shows "Cannot remove: N member(s) use this prefix"

**API Keys tab:**
- Team-default LLM API key (text input, masked after save; used by all members unless overridden)
- Provider selector (Anthropic / OpenAI / Ollama base URL)

**Kubernetes tab (GKE):**
- GCP Project: `coordina-{team_name}` (read-only; auto-created)
- Status badge: Provisioning... / Ready / Error
- GKE cluster: `{team_name}-cluster` (read-only; auto-named within the project)
- "Re-provision" button (visible only when status = Error; retries the async provisioning job)
- Default storage class (pre-filled: `standard-rwx` for GKE Filestore; editable)
- "Test connection" button → Platform API verifies cluster reachability

**Backup tab:**
- GCS bucket name (text input)
- GCS credentials: uses team SA (shown read-only; auto-created with team)
- Backup scope: all members or selected members
- "Backup now" button; backup history list (timestamp, size) — no restore option

**Slack tab:**
- Slack App Bot Token (shared; text input, masked after save)
- Slack Signing Secret (for webhook verification)
- "Test connection" button

**Google Workspace tab:**
- Admin email (e.g. `admin@acme.com`) — the domain admin the team SA impersonates for provisioning
- SA email shown (read-only): `clawteam-sa@coordina-{team_name}.iam.gserviceaccount.com` (auto-created with the team)
- Client ID shown (read-only) — user copies this into Google Admin Console → Security → API Controls → Domain-wide Delegation, granting these scopes:
  - `admin.directory.user` (create/suspend member accounts)
  - `admin.directory.group` (create team Google Group, add/remove members)
  - `gmail.readonly`, `drive.file`, `docs` (agent tool access)
- Default agent scopes checklist: Gmail Read, Drive Files, Docs Read/Write
- Google Group: shows `coordina_{team_name}@{team.domain}` (read-only; auto-created on first Google Workspace setup)
- "Test provisioning" button → Platform API attempts to list one user in the domain to verify delegation is configured correctly

#### `<GlobalSettingsPanel>` (gear icon in app header — app-level, not per-team)

Also surfaced via `<OnboardingWizard>` on first launch. Contains:
- GCP Organization ID (text input)
- GCP Billing Account ID (text input)
- Bootstrap service account key JSON (file upload; masked after save; requires org-level permissions: `resourcemanager.projects.create`, `billing.resourceAssociations.create`, `iam.serviceAccountAdmin`, `serviceusage.services.enable`)
- "Test permissions" button → `GET /api/settings/gcp/test` → verifies SA can create projects and enable APIs
- If bootstrap SA is not configured: persistent banner in main UI and team creation blocked

---

## 6. Slack Integration Strategy

### Shared vs. Per-Member Config

| Config item | Shared (team level) | Per-member override |
|-------------|---------------------|---------------------|
| Slack App + Bot token | ✅ One bot for whole team | ✅ Member can have own bot token |
| Workspace URL | ✅ Same workspace | Fixed — all members in one workspace |
| Channel subscriptions | — | ✅ Per-member: which channels to listen to |
| User handle / display name | — | ✅ Per-member: `@{prefix}_{name}` |
| Direct message routing | — | ✅ Per-member: their DMs go to their agent |

### Configuration Flow

1. Team settings: configure one Slack app (OAuth App or Socket Mode), store shared bot token
2. Per-member: optionally add a per-member bot token (for separate Slack identities); otherwise, the shared bot dispatches messages to/from the correct agent based on channel + mention
3. ZeroClaw's Slack channel adapter is configured via env var at container start:
   - `SLACK_BOT_TOKEN` = member token (if set) OR team shared token
   - `SLACK_CHANNEL_IDS` = comma-separated list from member config
   - `SLACK_MEMBER_HANDLE` = `@{prefix}_{name}`

### Dispatch Model (shared bot token)

When one bot token is shared, a routing sidecar (or Platform API webhook handler) receives all incoming Slack events and routes them to the correct member's agent based on:
- Channel ID → member subscription map
- Direct message: look up Slack user → mapped member

This avoids per-member Slack apps (which require separate OAuth installs per member).

---

## 7. Google Workspace Integration

### Credential Model

One model only — service account with domain-wide delegation:

- The team GCP service account (`clawteam-sa@coordina-{team_name}.iam.gserviceaccount.com`) is **auto-created** when the team is provisioned — no manual SA upload needed
- Admin grants domain-wide delegation in Google Admin Console (one-time manual step; guided by the UI with copy-paste Client ID)
- Delegation scopes: `admin.directory.user`, `admin.directory.group` + agent tool scopes (Gmail, Drive, Docs)
- Service account impersonates the domain admin for provisioning/group management, and each member's email for tool access
- Stored in secrets backend; injected into Platform API and ZeroClaw containers at runtime

### Account Provisioning Flow (automated)

Google account creation is **manually triggered** — the user explicitly clicks "Provision Google account" in MemberForm → Integrations tab. It does not auto-trigger on member creation, even if the team has Google Workspace configured.

1. User creates member (email `{team_name}_{name}@{team.domain}` auto-computed and shown read-only)
2. User opens MemberForm → Integrations tab → clicks "Provision Google account"
3. Platform API calls **Google Workspace Admin SDK (Directory API)**:
   - `POST https://admin.googleapis.com/admin/directory/v1/users`
   - Body: `primaryEmail`, `name.givenName`, `name.familyName`, `password` (generated), `changePasswordAtNextLogin: true`
   - Authenticated as: service account impersonating the domain admin email
4. On success: `member.google_identity.provisioned = true`; a one-time temporary password is shown in the UI (not stored)
5. On failure: error shown inline; member saved without Google identity; can retry from MemberForm

### Account Suspension (on member delete)

Google accounts are **suspended, not deleted**, when a member is removed — deleting a Google account permanently deletes Drive/Gmail data, which is irreversible.

- `DELETE /api/teams/{team_id}/members/{member_id}` → Platform API calls Admin SDK to suspend the account
- Suspended accounts can be re-activated manually by the domain admin if needed
- UI shows a warning: "The Google account {email} will be suspended. To permanently delete it, use Google Admin Console."

### UI Flow

1. Team Settings → Google Workspace tab → upload service account key JSON + enter admin email
2. UI shows Client ID + delegation instructions (copy-paste into Google Admin Console)
3. "Test provisioning" button confirms delegation is working
4. From that point on: creating a member with Google enabled → account created automatically
5. MemberForm shows Google status badge: `Not configured` / `Provisioning...` / `Active` / `Suspended`
6. Per-member scope override: default = team scopes, override = subset

### Google Group Lifecycle

Each team has a dedicated Google Group that aggregates all member identities:

- **Group email:** `coordina_{team_name}@{team.domain}`
- **Created:** automatically when the team's Google Workspace integration is first configured (Team Settings → Google Workspace → "Test provisioning" success, or on first member Google account creation)
- **Member add:** when a member's Google account is provisioned → Platform API calls Groups API to add `{team_name}_{name}@{team.domain}` to the group
- **Member remove:** when a member is deleted → account is suspended + member is removed from the group
- **Group purpose:** allows emailing the entire team at one address; can be granted shared access to Drive folders, Docs, calendars at the team level

**API calls (using team SA with `admin.directory.group` scope):**
```
POST https://admin.googleapis.com/admin/directory/v1/groups
  { email: "coordina_{team_name}@{team.domain}", name: "coordina_{team_name}" }

POST https://admin.googleapis.com/admin/directory/v1/groups/{groupKey}/members
  { email: "{team_name}_{member_name}@{team.domain}", role: "MEMBER" }

DELETE https://admin.googleapis.com/admin/directory/v1/groups/{groupKey}/members/{memberKey}
```

The group email is shown read-only in Team Settings → Google Workspace tab. Manual management of the group (description, membership type, external access) is left to the Google Admin Console.

### ZeroClaw Google Tool Wiring

ZeroClaw's trait-based tool system requires a Google Workspace tool adapter. This is a new adapter to build:
- Implements ZeroClaw's `Tool` trait (Rust)
- Wraps Google API client (Gmail, Drive, Docs)
- Credential injection: reads from env var pointing to credential file path
- Built as a plugin or compiled into the ZeroClaw binary (to be determined by ZeroClaw's extension model)

**Assumption:** If ZeroClaw does not yet support a Google Workspace tool adapter, this must be built as a sidecar HTTP tool server that ZeroClaw calls via its generic HTTP tool interface.

---

## 8. Kubernetes Resource Overrides

### Override Hierarchy

```
Team defaults (cpu, memory, disk)
    ↓
Member resources (if non-null, overrides team defaults for that member)
```

### Effective Resource Computation (Platform API)

```
effective_cpu    = member.resources.cpu    ?? team.defaults.cpu
effective_memory = member.resources.memory ?? team.defaults.memory
effective_disk   = member.resources.disk   ?? team.defaults.disk
```

### Validation Rules

- Values must be valid k8s quantity strings: `"500m"`, `"1"`, `"512Mi"`, `"2Gi"`
- Minimum values enforced: CPU ≥ `"100m"`, memory ≥ `"128Mi"`, disk ≥ `"1Gi"`
- Per-member override must be ≥ team minimum (no reducing below floor)

### k8s Manifest Generation

Per member, the Platform API generates a k8s Deployment (or StatefulSet for stable PVC binding):

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: {team_id}-{member_id}
spec:
  replicas: 1
  template:
    spec:
      containers:
        - name: zeroclaw
          image: clawteam-agent:latest
          env:
            - name: MEMBER_ID
              value: "{member.id}"
            # ... other env vars
          resources:
            requests:
              cpu: "{effective_cpu}"
              memory: "{effective_memory}"
            limits:
              cpu: "{effective_cpu}"
              memory: "{effective_memory}"
          volumeMounts:
            - name: member-data
              mountPath: /home/zeroclaw/.local/share/zeroclaw
            - name: team-shared
              mountPath: /mnt/team
      volumes:
        - name: member-data
          persistentVolumeClaim:
            claimName: {team_id}-{member_id}-data
        - name: team-shared
          persistentVolumeClaim:
            claimName: {team_id}-shared
```

### Shared PVC Strategy (GKE)

- Storage class: `standard-rwx` (GKE Filestore CSI driver — supports ReadWriteMany)
- Requires Filestore CSI driver enabled on the GKE cluster (available on Autopilot and Standard clusters)
- Storage class name is editable in Team Settings → Kubernetes tab in case the user's cluster uses a custom class
- The Platform API creates the shared PVC before deploying any member pods

---

## 9. Liveness and Activity Signals

### What to Measure

| Signal | Source | Description |
|--------|--------|-------------|
| Container status | Docker/k8s API | Running / Stopped / Error |
| ZeroClaw health | Sidecar `/health` endpoint | ZeroClaw process alive, last heartbeat |
| Active task | Sidecar `/status` endpoint | Current task ID from TASK_QUEUE.md |
| Active thread | ZeroClaw local state | Current conversation / session ID |
| Token usage | ZeroClaw metrics (if exposed) | Tokens used in last N sessions |
| Last message timestamp | Sidecar | When the member last sent/received a message |

### Storage

- Sidecar writes a `status.json` file to `$TEAM_VOLUME/members/{member_id}/status.json` every 30s
- Platform API reads `status.json` files from the shared volume for all members
- This avoids polling N HTTP endpoints — one volume read gets all statuses

```json
{
  "member_id": "Agent_Alice",
  "container_status": "running",
  "zeroclaw_healthy": true,
  "last_heartbeat": "2026-03-02T14:30:00Z",
  "active_task_id": "task-007",
  "active_task_label": "Research ZeroClaw k8s wiring",
  "last_message_at": "2026-03-02T14:28:00Z",
  "tokens_used_session": 12400
}
```

### Display

- **Left nav:** small colored dot next to each member (green = healthy + active, yellow = healthy + idle, red = unhealthy/offline)
- **HealthDashboard page:** grid of member cards showing all signals
- **ContextSidebar > Activity tab:** detailed view for the selected member
- **Chat header:** status badge inline with member name

### Health Polling

- Platform API polls Docker/k8s for container status every 30s
- Sidecar writes `status.json` every 30s (the UI reads this, not HTTP polls per member)
- WebSocket pushes `member.health` events to the UI when status changes

---

## 10. Backup to Google Cloud

### Backup Scope

A backup captures all per-member files for selected members in a team:

```
backup-{team_id}-{timestamp}/
├── team-config.json                  # Team + member metadata (no secrets)
├── members/
│   ├── Agent_Alice/
│   │   ├── files/                    # Full private volume snapshot
│   │   │   ├── MEMORY.md (or export)
│   │   │   └── ...
│   │   └── zeroclaw-memory/          # Markdown export from ZeroClaw sidecar
│   │       ├── MEMORY.md             #   (exported at backup time via GET /files?format=markdown)
│   │       └── ...                   #   schema-independent; no raw SQLite in backup
│   └── Agent_Bob/
│       └── ...
└── shared/
    ├── config.json
    ├── TASK_QUEUE.md
    └── mailbox/
```

### Backup Format

- Zip archive (`.zip`) — all content is human-readable markdown
- ZeroClaw memory exported as markdown via sidecar `GET /files?format=markdown` — no raw SQLite in the archive
- No secrets included — credential refs are backed up, not the values

### Google Cloud Storage (GCS) Backend

- User configures GCS bucket name + service account in Team Settings
- Platform API uses GCS client with the team's service account credential
- Uploads to: `gs://{bucket}/{team_id}/{backup_id}.zip`
- Backup ID = ISO timestamp

### Backup Flow

1. UI triggers `POST /api/teams/{team_id}/backup` with `{scope: "all" | [member_ids], bucket: "..."}`
2. Platform API:
   a. Pauses writes to shared volume (advisory lock file)
   b. For each member: call sidecar `GET /files?format=markdown` → ZeroClaw exports memory to markdown → Platform API collects the tree
   c. Creates zip in memory or temp dir
   d. Uploads zip to GCS
   e. Removes lock file
3. Progress updates via WebSocket `backup.progress` events
4. On completion: stores backup metadata in `$TEAM_VOLUME/backups/history.json`

### Backup-Only — No Restore

Backup is intentionally export-only. The zip in GCS is a human-readable archive the user can inspect, download, or use as a reference. There is no in-platform restore operation. If a user needs to recover from a backup, they do so manually by extracting the zip and copying files to the relevant volume paths.

---

## 11. Phased Rollout Plan

### Phase 0: MVP — Local Team Config + Chat (4 weeks)

**Goal:** Create/edit teams and members in the UI, chat with any member via docker-compose deployment.

**Pre-condition:** On first launch, `<OnboardingWizard>` is shown and must be completed (bootstrap GCP SA configured and tested) before any team can be created. If closed early, a persistent banner blocks team creation until setup is complete.

**Acceptance criteria:**
- User can create a team with all fields on the create form: name (slug, 3–20 chars), display name, domain, prefix allowlist (default `["Agent"]`), and default resources (CPU/memory/disk)
- Team creation triggers async GCP project provisioning (`coordina-{team_name}`); UI shows "Provisioning GCP project..." status badge on the team card; team immediately usable for chat while provisioning runs
- User can enter team-default LLM API key via Team Settings → API Keys tab; value is masked after save
- User can create members with display prefix (cosmetic), name, display_name, role, model; `id` auto-computed as `{team_name}_{name}` and shown read-only in MemberForm
- System enforces `id = {team_name}_{name}` format and team lead requirement
- User can chat with the Team Lead; chat is proxied to the ZeroClaw container
- User can switch to chat with any specific member
- Health status (online/offline) visible per member in the left nav
- docker-compose.yml (with API key injected from secrets store) can be exported and started locally

**Components built:**
- Web UI: OnboardingWizard, GlobalSettingsPanel, TeamNav, ChatPanel (multi-tab), MemberForm, HealthDashboard (basic)
- Platform API: Team CRUD, Member CRUD, Chat proxy, Global settings endpoints
- ZeroClaw container: Dockerfile + entrypoint.sh + coordination sidecar (health only)

**Out of scope:** Google Workspace, Slack, k8s, backup, file browser, duplicate member

---

### Phase 1: File Browser + Liveness + Duplicate (3 weeks)

**Goal:** Inspect each member's files and memory; see active task; duplicate members.

**Acceptance criteria:**
- File tree browsable per member via UI
- "Memory" filter highlights relevant files
- Active task ID + label visible in context sidebar
- `status.json` written every 30s by sidecar; UI reflects it
- Duplicate member: copies all files, prompts for new name, creates new member with new `id`

**Components built:**
- Platform API: Files endpoint, Health endpoint (reads status.json), Duplicate endpoint
- Sidecar: writes status.json (active task detection from TASK_QUEUE.md polling)
- UI: ContextSidebar (Files + Activity tabs), DuplicateMemberModal

---

### Phase 2: Slack Integration (3 weeks)

**Goal:** Configure Slack per team (shared) and per member (override); agents accessible via Slack.

**Acceptance criteria:**
- Team settings: shared Slack bot token + workspace
- Per-member: optional bot token override, channel subscriptions, user handle
- ZeroClaw Slack adapter configured at container start from env vars
- Shared-bot routing: Platform API webhook handler dispatches Slack events to correct member
- UI shows Slack status (connected / not configured) per member

**Components built:**
- Platform API: Slack webhook handler + routing logic
- UI: Slack section in MemberForm + TeamSettingsModal
- ZeroClaw container: SLACK_BOT_TOKEN, SLACK_CHANNEL_IDS env wiring

---

### Phase 3: Kubernetes Deployment + Resource Overrides (4 weeks)

**Goal:** Deploy teams to k8s from the UI; configure resources at team and member level.

**Acceptance criteria:**
- Team Settings → Kubernetes tab shows read-only: GCP project `coordina-{team_name}`, GKE cluster `{team_name}-cluster`, status badge; no manual GCP fields
- "Test connection" button confirms cluster reachability before any deployment
- Platform API generates k8s Deployments with correct resource requests/limits
- Per-member resource overrides take precedence over team defaults; validated against minimums
- Shared `standard-rwx` PVC created for team (GKE Filestore); per-member PVCs for private storage
- Platform API creates k8s Secrets from UI-entered credentials; containers receive them as env vars
- Deployment status shown per member in K8sPanel (Pending / Running / Failed)
- Adding a new member to an already-deployed team shows a "1 member pending deployment" banner; user explicitly deploys via banner button
- Export: download manifest zip

**Components built:**
- Platform API: K8s deploy/status/teardown endpoints, manifest generation, resource override logic
- UI: K8sPanel, resource override table in MemberForm

---

### Phase 4: Google Workspace + Backup (4 weeks)

**Goal:** Per-member Google identity; backup all member files to GCS.

**Acceptance criteria:**
- Team Settings → Google Workspace tab shows SA email (read-only, auto-created with team), admin email input, Client ID, delegation scope instructions, Google Group address (`coordina_{team_name}@{team.domain}`)
- No separate SA upload required — team SA already exists from provisioning
- "Test provisioning" confirms delegation works before any account is created
- User explicitly clicks "Provision Google account" in MemberForm → Integrations tab; Platform API creates `{team_name}_{name}@{team.domain}` via Admin SDK; member is added to `coordina_{team_name}@{team.domain}` group; temporary password shown once in UI
- Deleting a member → Google account suspended + removed from team group; UI shows warning
- Per-member: Google status badge (Not configured / Provisioning / Active / Suspended), scope override
- ZeroClaw containers receive Google credential env vars for agent tool access
- Google Workspace tool adapter available in ZeroClaw (or sidecar HTTP tool server fallback)
- Backup: select members, GCS bucket, trigger backup → progress bar → success
- Backup history: list past backups (timestamp, size) — no restore; backup is export-only

**Components built:**
- Platform API: Backup/restore endpoints, GCS client, credential injection
- ZeroClaw adapter (or sidecar HTTP tool server): Google Workspace tool
- UI: BackupPanel, Google identity section in MemberForm

---

### Phase Summary

| Phase | Duration | What Users Can Do | Key Risk |
|-------|----------|-------------------|----------|
| Pre-0 | Setup | Configure bootstrap GCP SA in GlobalSettingsPanel | Requires org-level GCP access |
| 0: MVP | 4 weeks | Create teams (GCP project auto-provisioned), chat with members locally | ZeroClaw config schema unknown |
| 1: Files + Liveness | 3 weeks | Browse memory files, see active task, duplicate members | ZeroClaw export command / API surface unknown |
| 2: Slack | 3 weeks | Connect members to Slack | Per-member Slack routing complexity |
| 3: Kubernetes | 4 weeks | Deploy teams to auto-provisioned GKE cluster, set resource limits | RWX PVC / Filestore CSI availability |
| 4: Google + Backup | 4 weeks | Connect Google identities (auto-provisioned SA), team Google Group, backup to GCS | Domain-wide delegation setup; Google Group quota |

**Total estimated duration:** ~18 weeks to full feature parity.

---

## Open Questions

1. **ZeroClaw config schema:** What is the exact TOML/YAML format for ZeroClaw's config file? Must be answered before Phase 0 begins.
2. **ZeroClaw local API:** Does ZeroClaw expose a local HTTP API (like OpenClaw's gateway on :18789)? Or is chat input only via connected channel (Slack/Telegram)? This affects the chat proxy architecture in Phase 0.
3. **ZeroClaw tool extension model:** Does ZeroClaw support HTTP-based external tools, or must new tools be compiled into the binary? This determines the Google Workspace integration approach in Phase 4.
4. **ZeroClaw memory export command:** What CLI flag or local API call triggers ZeroClaw to export its SQLite memory as markdown? This is the only ZeroClaw internal detail the sidecar needs to know. Options: `zeroclaw export --format=markdown`, a local REST endpoint, or a signal. Must be confirmed before Phase 1.
5. ~~**Prefix allowlist:**~~ Resolved: default is `["Agent"]`; editable per team in Team Settings.
6. ~~**Team domain uniqueness:**~~ Resolved: unique per user account.
7. ~~**Secret store backend:**~~ Resolved: native k8s Secrets on GKE; encrypted file store for local Docker.
8. ~~**GCP project name collision:**~~ Resolved: Platform API auto-increments suffix — `coordina-{team_name}`, `coordina-{team_name}2`, `coordina-{team_name}3`, … until a free name is found. Resolved project ID stored on the team and shown read-only in the Kubernetes tab.
9. **Google Group quota:** Google Workspace has a default limit of 10,000 groups per domain. At scale this is not a concern, but the provisioning code should handle the `quotaExceeded` error gracefully and surface it in the UI.
10. **Google Group creation timing:** Should the group be created (a) on team create (before Google Workspace is configured) or (b) on first Google Workspace provisioning success? Recommended: (b) — create group only when Google Workspace tab is first configured and test passes, to avoid stale/empty groups for teams that never enable Google integration.
