# Coordina — Product Specification

> Version: 0.2
> Last updated: March 2026

---

## Vision

Coordina is a macOS app that lets anyone compose, configure, and deploy teams of OpenClaw AI agents to cloud infrastructure — without writing YAML, editing files, or understanding Kubernetes. The admin describes the team through forms; Coordina materializes it into a production-grade deployment with a single click.

---

## Problem

OpenClaw makes it possible to run capable, persistent AI agents. But assembling a *team* of agents — each with the right personality, skills, and connections — requires manually editing config files, managing a Kubernetes cluster, and understanding OpenClaw's internal file structure. This is inaccessible to most people who would benefit from it, and tedious even for those who understand it.

Coordina removes that friction entirely.

---

## Core Concepts

| Concept | Definition |
|---------|-----------|
| **Team** | A named group of AI agents with a lead, a GitHub repo (team spec), and optionally a deployed environment |
| **Agent** | An OpenClaw instance running as a Kubernetes pod, with its own persistent workspace and LLM config |
| **Lead Agent** | The first agent in a team; the default point of contact for humans, and the orchestrator of all other agents |
| **Team Member** | Any non-lead agent in the team |
| **Model Provider** | A reusable LLM configuration (provider, model, API key) that agents reference |
| **Team Spec** | The git repository that stores all config files for a team; the single source of truth |
| **Deployment Environment** | A cloud K8s cluster where a team can be materialized into running pods |
| **Skill** | An OpenClaw skill (SKILL.md + optional install.sh) that extends an agent's capabilities |
| **Materialization** | The act of deploying a committed team spec to a deployment environment |

---

## User Roles

**Admin (human)**
- Creates and manages teams and agents
- Fills out configuration forms
- Never edits files directly
- Deploys and undeploys teams
- Interacts with the lead agent (and optionally, any agent)

**AI Enhancer (embedded AI)**
- Improves admin-provided text for skills and soul descriptions
- Operates on demand (admin clicks "Enhance")
- Does not touch system-provided default content from OpenClaw templates

---

## Key User Flows

### 1. Create a Team

1. Click "+ New Team"
2. Enter team name → slug is derived and previewed (`Engineering Alpha → engineering-alpha`)
3. Connect a GitHub repo (OAuth, select org + repo name; app creates the repo if it doesn't exist)
4. First agent is created automatically as the **Lead Agent**

### 2. Add / Edit an Agent

See [Agent Configuration Model](#agent-configuration-model) below.

### 3. Configure Model Providers

1. Navigate to Model Providers (global, shared across teams)
2. Click "+ Add Provider"
3. Select provider type (Anthropic, OpenAI, DeepSeek, Ollama, etc.)
4. Enter API key and select model
5. Name the provider (e.g., "Claude Sonnet — Production")
6. Provider is now available in all agent config forms

### 4. Deploy a Team

1. All changes must be committed to the team spec's GitHub `main` branch (app enforces this; "Deploy" button is disabled with uncommitted changes)
2. Click "Deploy Team"
3. Select a deployment environment
4. App generates Helm values from team spec, applies to GKE cluster via K8s operator
5. Deploy progress shown inline; success/failure notification

### 5. Undeploy a Team

1. Click "Undeploy"
2. Confirmation dialog: "This will destroy all agent pods and permanently delete their runtime data. This cannot be undone. The team spec remains in GitHub."
3. Confirm → app tears down all pods and PVCs in the environment
4. Team is now undeployed and can be redeployed to any environment

### 6. Interact with the Lead Agent

1. Click "Chat" on the lead agent card (or use the team-level "Chat" button)
2. App opens a chat interface routed to the lead agent's OpenClaw gateway
3. Lead agent handles orchestration of other team members internally

### 7. Interact with Any Agent Directly

1. Navigate to an agent's detail page
2. Click "Chat with [agent name]"
3. App routes directly to that agent's gateway, bypassing the lead
4. Banner: "You are talking directly to Bob Smith, bypassing the lead agent"

### 8. View Agent Files

1. Navigate to an agent's detail page → click "Files" or any file badge
2. A file browser panel opens (drawer or side panel)
3. Left sidebar: full OpenClaw workspace file tree with file sizes
4. Tab bar: open multiple files simultaneously
5. Right pane: rendered markdown (Preview mode) or raw source (Source mode), toggle between them
6. Search box to filter files by name
7. Refresh button to pull latest from the running pod
8. All files are **read-only** in Coordina — users configure agents through forms, not file edits

Files visible (all OpenClaw workspace files): `SOUL.md`, `IDENTITY.md`, `MEMORY.md`, `AGENTS.md`, `HEARTBEAT.md`, `TOOLS.md`, `USER.md`, `skills/`, `memory/YYYY-MM-DD.md` daily logs, and any other files the agent has created in its workspace.

---

## Agent Configuration Model

### Fields

| Field | Type | Editable after creation? | AI-enhanceable? |
|-------|------|--------------------------|-----------------|
| **Name** | Text (human-readable) | Yes | No |
| **Slug** | Auto-derived from name | No (locked) | No |
| **Role** | Select (Engineer, Designer, PM, QA, Researcher, Writer, Other) | Yes | No |
| **Model Provider** | Reference to configured provider | Yes (triggers pod restart) | No |
| **Skills** | Tag list of OpenClaw skill slugs (free-text input) | Yes (triggers skill re-eval on restart) | Yes (AI suggests skills based on role) |
| **Soul Description** | Long text | Yes | Yes |
| **Email** | Text | Yes | No |
| **Slack handle** | Text | Yes | No |
| **GitHub ID** | Text | Yes | No |
| **Custom identity fields** | Key-value pairs | Yes | No |

### AI Enhancement Rules

**The golden rule**: *Enhance then merge, not merge then enhance.*

1. Admin provides input in a form field
2. Admin clicks "✨ Enhance" — AI improves the input
3. A before/after preview is shown
4. Admin selects "Use enhanced" or "Keep original"
5. The selected version is merged with OpenClaw's default template content
6. The OpenClaw default template portions are **never** AI-enhanced — only admin-provided sections are

**Fields that are never AI-enhanced**: Name, slug, role, email, Slack handle, GitHub ID, model provider selection.

### How agent config maps to OpenClaw files

| Config field | OpenClaw file | Location in file |
|-------------|---------------|-----------------|
| Name, role, slug | `IDENTITY.md` | Core identity section |
| Soul description | `SOUL.md` | Merged with default template |
| Email, Slack, GitHub ID | `IDENTITY.md` | Contact/identity fields |
| Skills | Skill installation + `AGENTS.md` | Skill list |
| Model provider | `openclaw.json` | `model` and `apiKey` fields |

---

## Team Spec (GitHub Repo)

### What lives in the repo

The repo has two top-level directories with completely separate ownership:

```
team-spec-repo/
│
├── spec/                        ← Coordina ONLY writes here
│   ├── team.json                   Machine-readable team manifest
│   ├── agents/
│   │   ├── alice/
│   │   │   ├── SOUL.md             Generated from form (AI-enhanced + template)
│   │   │   ├── IDENTITY.md         Generated from form fields
│   │   │   ├── AGENTS.md           Generated operational rules
│   │   │   └── openclaw.json       Model provider config
│   │   └── bob/
│   │       └── ...
│   └── deploy/
│       └── helm/
│           ├── Chart.yaml
│           └── values.yaml      Generated from team config
│
└── memory/                      ← Agents ONLY write here (each to their own subdirectory)
    ├── alice/
    │   ├── MEMORY.md               Curated long-term memory (agent maintains)
    │   ├── HEARTBEAT.md            Runtime state
    │   ├── TOOLS.md                Discovered tools
    │   └── daily/
    │       ├── 2026-03-01.md
    │       └── 2026-03-02.md
    └── bob/
        ├── MEMORY.md
        └── daily/
```

### Why this separation matters

**No conflicts between Coordina and agents.** Git conflicts only occur when two writers touch the same path. With strict directory ownership:
- Coordina commits to `spec/` — agents never touch this
- Each agent commits only to `memory/<its-slug>/` — no two writers share a path
- Concurrent commits from multiple agents are safe: pull-rebase-push retry resolves any race

**The deploy gate only checks `spec/`.** Agent memory commits (which happen continuously and autonomously) never block deployment.

### Memory durability across undeploy/redeploy

Because memory lives in git, it survives the undeploy/redeploy lifecycle:

1. **Before undeploy**: Coordina triggers a final checkpoint commit on each agent pod, flushing current memory to `memory/<slug>/` in the repo
2. **On deploy**: Coordina pulls `memory/<slug>/` from git and seeds it into each agent's fresh PVC before the pod starts
3. **Result**: Memory is preserved when moving a team from one environment to another

### How agents commit their memory

Each deployed agent pod has:
- A **GitHub deploy key** (scoped to the team spec repo) injected as a K8s Secret at deploy time
- A **periodic commit cron** (configurable, default: every hour and on session end) that git-commits `memory/<slug>/` changes
- Commit message format: `memory(alice): checkpoint 2026-03-02T14:00Z`

Coordina generates the deploy key and injects it into the Helm values at deploy time. The key has write access only to the `memory/` path (enforced via GitHub's path-scoped deploy keys or a GitHub App with restricted permissions).

### Commit policy

- Coordina commits `spec/` changes automatically on save — descriptive messages: `feat: add agent bob-smith`, `config: update alice-chen soul`
- **Materialization is blocked** until `spec/` files on `main` match the current form state
- Agent memory commits to `memory/` never block deployment
- Admins can browse the repo at any time (link in team settings) but must not edit files manually

---

## Deployment Environments

### Adding an environment (GKE)

Wizard flow:
1. Name the environment
2. Select type: Google Kubernetes Engine
3. Authenticate: Google OAuth (default) or service account JSON upload (secondary option)
4. Select GCP project and cluster
5. Coordina configures IAP on the cluster (one-time per environment)
6. Confirm

### GKE Authentication

**Primary: Google OAuth**
The user signs in with their Google account. Coordina uses the `gke-gcloud-auth-plugin` standard for cluster API calls (the same approach kubectl, Lens, and k9s use). Short-lived tokens (1 hour), auto-refreshed, no long-lived credentials stored.

**Secondary: Service Account JSON**
Available for CI/automated workflows or restricted-OAuth environments. The admin uploads a JSON key file; Coordina stores only the private key in the OS keychain. Carries inherent long-lived credential risk — shown with a warning in the UI. See [`research/gke_auth_compare.md`](research/gke_auth_compare.md) for full comparison.

### Gateway Access via Google Identity-Aware Proxy (IAP)

Rather than maintaining a separate auth layer for the OpenClaw gateway, Coordina uses **Google Cloud IAP** to gate all gateway access behind the user's Google identity.

```
Coordina macOS App
  │
  ├─ Authenticated via Google OAuth (same session as GKE auth)
  │  → Holds a Google ID token
  │
  ├─ HTTP/WebSocket request to: https://<team-slug>.<env-domain>/
  │  Header: Authorization: Bearer <google-id-token>
  │
  ▼
Google Cloud Load Balancer (GKE Ingress)
  │
  ├─ IAP verifies ID token
  ├─ IAP checks IAM role: IAP-secured Web App User
  │
  ▼  ← only authenticated, authorized users reach this point
OpenClaw Gateway Pod (:18789)
```

**Net effect**: A user cannot reach any agent gateway unless they hold valid Google credentials with the correct IAM role. No gateway-level tokens need to be stored or rotated by Coordina. GKE cluster authentication and gateway access share a single credential: the user's Google account.

Coordina configures IAP automatically when setting up a deployment environment (as part of the wizard).

### Environment lifecycle rules

- An environment **cannot be deleted** once a team has been deployed to it
- A team can only be deployed to **one environment at a time**
- To move a team: undeploy from current env → deploy to new env
- Undeploying destroys all pods and PVCs — runtime data is lost (team spec in GitHub is preserved)

### What gets deployed

Per agent:
- **StatefulSet** — one pod per agent, stable identity (via OpenClaw K8s operator `OpenClawInstance` CRD)
- **PersistentVolumeClaim** — 10Gi by default, stores OpenClaw workspace
- **Service** — ClusterIP for internal cluster routing

Per team:
- **GKE Ingress** — routes external traffic to the lead agent's gateway (port 18789)
- **TLS certificate** — managed via GKE-managed certificates
- **IAP BackendConfig** — gates Ingress access via Google identity
- **NetworkPolicy** — isolates agent pods by default (K8s operator default)
- **OAuth credentials Secret** — `iap-oauth-credentials` containing IAP client ID and secret

### Interacting with a deployed team

The Mac app connects to the team via the lead agent's IAP-protected Ingress URL:
```
https://<team-slug>.<env-domain>/
```
The user's Google ID token is included in every request. No separate gateway token management.

---

## Mac App Architecture

### Shell

Electron — web-based shell with Node.js backend. Chosen over Tauri because the Google Cloud and GitHub SDK ecosystems are significantly richer in Node.js, and Coordina's local backend is SDK-heavy (GKE API, GitHub API, OAuth flows). macOS-only deployment eliminates Electron's main weakness (cross-platform WebView inconsistencies).

### Modularity Principle

Model Providers and Deployment Environments are **independent modules** implementing a shared interface. Adding a new provider or environment type means adding one new module file — no changes to core application logic, forms, or routing.

Both module types use a **Registry** pattern: modules register themselves at startup, and the core app looks them up by ID. The frontend renders configuration forms from **JSON Schema** supplied by each module — so the form system is schema-driven and generic.

See [`research/05-architecture.md`](research/05-architecture.md) for full interface definitions and source tree layout.

### Module: Model Provider

Each provider implements a single interface:

```typescript
interface ModelProvider {
  id: string                          // e.g. "anthropic"
  displayName: string                 // e.g. "Anthropic"
  configSchema: JSONSchema            // drives the Add Provider form
  supportedModels: string[]
  validate(config: unknown): ValidationResult
  toOpenClawJson(config: unknown): OpenClawModelConfig
}
```

Built-in providers: `anthropic`, `openai`, `deepseek`, `ollama`, `openrouter`.
Adding a new provider = one new file implementing `ModelProvider`, registered in `src/providers/index.ts`.

### Module: Deployment Environment

Each environment type implements a single interface:

```typescript
interface DeploymentEnvironment {
  id: string                          // e.g. "gke"
  displayName: string                 // e.g. "Google Kubernetes Engine"
  configSchema: JSONSchema            // drives the Add Environment wizard
  validate(config: unknown): ValidationResult
  setupAuth(config: unknown): Promise<AuthCredential>
  deploy(spec: TeamSpec, config: unknown): Promise<DeployResult>
  undeploy(spec: TeamSpec, config: unknown): Promise<void>
  getStatus(config: unknown): Promise<EnvironmentStatus>
  generateManifests(spec: TeamSpec, config: unknown): Manifest[]
}
```

Built-in environments: `gke`.
Adding AWS EKS later = one new file implementing `DeploymentEnvironment`, registered in `src/environments/index.ts`. Zero changes to core.

### Local backend

A lightweight local Express server (Node.js/TypeScript) that:
- Stores GitHub OAuth tokens and GKE credentials in the OS keychain (`keytar`)
- Manages team specs via GitHub API (`octokit`)
- Proxies requests to deployed team gateways (injects Google ID token header)
- Loads provider and environment modules at startup via registries
- Runs only while the Mac app is open

### Frontend

- **Framework**: React
- **Styling**: Tailwind CSS
- **Component reference**: https://component.gallery/
- **State management**: Zustand (local) + React Query (server/API state)
- **Config forms**: Schema-driven — each module's `configSchema` drives form rendering; no per-provider or per-environment form code in the frontend

### Data storage

| Data | Storage |
|------|---------|
| GitHub OAuth token | OS keychain (`keytar`) |
| GKE credentials | OS keychain (`keytar`) |
| Team configs | GitHub repo (source of truth) |
| Local cache | SQLite (via `better-sqlite3`) |

---

## Team Interaction Model

```
Human
  │
  ▼ (default)
Lead Agent  ←──── orchestrates ────→  Agent B, Agent C, ...
  │
  └── OpenClaw gateway (port 18789, exposed via GKE Ingress)
```

- All human→team communication routes to the lead agent by default
- Admin can bypass the lead and talk directly to any agent
- Inter-agent communication is handled by OpenClaw's internal routing
- Admin can view any agent's full OpenClaw workspace (read-only file browser) at any time

---

## MVP Scope

**In scope for v1:**
- Team CRUD (create, edit, delete)
- Agent configuration form (all fields above)
- Model Provider management
- GitHub repo connection and auto-commit
- GKE deployment environment (add, deploy, undeploy)
- Chat with lead agent
- Chat with any agent directly
- Full OpenClaw workspace file browser (all files, read-only, with Preview/Source toggle)
- AI enhancement for skills and soul description

**Explicitly out of scope for v1:**
- Multiple deployment environment types (AWS EKS, Azure AKS, Docker Compose)
- Agent-to-agent communication visualization
- Custom skill authoring via UI (skill browsing from ClawHub only)
- Agent logs / observability dashboard
- Team templates / agent templates marketplace
- Multi-cluster environments
- GitLab / Bitbucket support

---

---

## Research Files

- [`research/01-openclaw-framework.md`](research/01-openclaw-framework.md) — OpenClaw architecture, config files, gateway, K8s operator, skills, LLM providers
- [`research/02-deployment-patterns.md`](research/02-deployment-patterns.md) — GKE StatefulSets, PVCs, Ingress, Helm + Terraform patterns
- [`research/03-multi-agent-orchestration.md`](research/03-multi-agent-orchestration.md) — AutoGen, CrewAI, LangGraph, OpenAI Swarm, lead agent pattern synthesis
- [`research/04-ui-patterns.md`](research/04-ui-patterns.md) — Component Gallery reference, form-driven UX, AI enhancement patterns
- [`research/gke_auth_compare.md`](research/gke_auth_compare.md) — GKE auth options comparison (OAuth vs service account JSON) + IAP gateway architecture
- [`research/05-architecture.md`](research/05-architecture.md) — Module system, Registry pattern, interface definitions, schema-driven forms, source tree layout
