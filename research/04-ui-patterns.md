# Research: UI Patterns

> Status: Initial research — March 2026
> Covers: Component Gallery reference, form-driven config UX, AI-enhancement patterns

---

## Component Gallery

**URL**: https://component.gallery/

Component Gallery is a curated reference documenting how 95+ real-world design systems implement 60+ UI components. It is not a component library — it's an **empirical pattern reference** showing how established teams (Elastic, Red Hat, Morningstar, Sainsbury's, Axis Bank, etc.) solve common UI problems.

### Why use it

- Shows industry-standard patterns and their variations, not theoretical ideals
- Surfaces accessibility considerations baked into real implementations
- Provides multiple implementation approaches for the same component
- Avoids cargo-culting from a single design system

### Relevant component categories for our product

| Component | Use case in our product |
|-----------|------------------------|
| **Form** | Agent configuration, model provider setup, team creation |
| **Button** | Primary actions, AI-enhance trigger, deploy/undeploy |
| **Tabs** | Agent detail panel (Config / Memory / Logs) |
| **Modal / Dialog** | Confirmation dialogs (undeploy, delete team) |
| **Badge / Tag** | Skills list on agent cards, status indicators |
| **Card** | Agent cards in team overview, environment cards |
| **Select / Dropdown** | Model provider picker, role selector |
| **Text area** | Soul description input, skills input |
| **Notification / Toast** | Deploy success/failure feedback |
| **Breadcrumb** | Navigation: Teams → Team → Agent |
| **Empty state** | "No agents yet", "No environments configured" |
| **Progress indicator** | Deploy progress, AI enhancement loading |
| **Disclosure / Accordion** | Advanced agent settings, collapsed config sections |

---

## Form-Driven Configuration UX

Our product's core interaction paradigm is **form-driven configuration with no raw file editing**. Key patterns from tools that do this well (Vercel, Railway, Linear, Retool):

### 1. Progressive disclosure

Show simple fields first; reveal advanced configuration on demand.

```
Basic config (always visible):
  Name, Role, Model Provider

Advanced config (expandable):
  Identity fields (email, Slack, GitHub ID)
  Skill list
  Soul description
```

### 2. Inline validation with meaningful feedback

- Slug preview shown as user types the name: `"Alice Chen" → alice-chen`
- Slug locked after creation with a lock icon and tooltip: "Slug cannot be changed after creation"
- Skills: validate against known ClawHub slugs, show warning for unknown skills

### 3. Save state awareness

Unsaved changes:
- Form has a "Save changes" button enabled only when there are unsaved changes
- Unsaved changes indicator in nav: "alice-chen •" (dot = unsaved)
- Before navigating away: "You have unsaved changes. Save or discard?"

After saving:
- Changes are committed to GitHub automatically
- "Committed to main: abc1234 — Updated alice-chen skills" confirmation

---

## AI Enhancement UX Pattern

The "enhance then merge" pattern is a specific, opinionated UX. Key principles:

### The enhance button

```
┌─────────────────────────────────────────┐
│ Soul Description                        │
│ ┌─────────────────────────────────────┐ │
│ │ Alice is a pragmatic engineer who   │ │
│ │ values simplicity and clear docs.   │ │
│ └─────────────────────────────────────┘ │
│                         [✨ Enhance]    │
└─────────────────────────────────────────┘
```

- The enhance button is secondary — it's an option, not required
- Shows a loading state while AI processes ("Enhancing…")
- On completion, shows a **diff view** or **before/after** preview

### The merge preview

After enhancement, show the user what will be merged into the OpenClaw file:

```
┌── Before (your input) ──────────────────┐
│ Alice is a pragmatic engineer who       │
│ values simplicity and clear docs.       │
└─────────────────────────────────────────┘

┌── Enhanced (AI-improved) ───────────────┐
│ Alice approaches engineering with a     │
│ pragmatic mindset, prioritizing         │
│ simplicity over cleverness. She         │
│ believes documentation is a first-class │
│ deliverable, not an afterthought.       │
└─────────────────────────────────────────┘

[ Use enhanced version ]  [ Keep original ]
```

The merge preview shows only the **user-provided portion**. The OpenClaw default template content is shown separately, greyed out, marked "Default template — not modified."

### What can and cannot be enhanced

| Field | Enhanceable? | Notes |
|-------|-------------|-------|
| Name | No | Taken as-is |
| Slug | No | Derived from name, locked after creation |
| Role | No | Selected from list |
| Email / Slack / GitHub ID | No | Identity data, taken as-is |
| Skills list | Yes | AI can suggest additional skills based on role |
| Soul description | Yes | AI expands/refines user's intent |
| AGENTS.md additions | Yes (future) | Custom operational rules |

---

## Team Overview UI

The team overview is the home screen for a configured team. Design principles:

### Agent cards

```
┌──────────────────────────────────┐
│ 👤 Alice Chen          [Lead]   │
│ Software Engineer                │
│                                  │
│ Skills: git  typescript  testing │
│ Model: Claude Sonnet             │
│                                  │
│ Status: ● Deployed               │
│                                  │
│ [Chat]  [View Memory]  [Edit]   │
└──────────────────────────────────┘
```

- Lead agent is visually distinct (badge, position at top)
- Status indicator: Deployed (green), Stopped (yellow), Undeployed (grey), Error (red)
- Quick actions: Chat, View Memory, Edit config

### Team-level actions

```
[+ Add Agent]    [Deploy Team]    [Undeploy]    [View GitHub Repo ↗]
```

- "Deploy Team" disabled if there are uncommitted changes
- "Undeploy" shows a confirmation dialog with consequences ("This will destroy all agent pods and delete their runtime files")

---

## Deployment Environment UX

### Adding an environment

Step-by-step wizard:

1. **Name the environment**: "Production GKE", "Staging"
2. **Choose type**: GKE (only option in v1)
3. **Authenticate**: Google OAuth or service account JSON upload
4. **Select cluster**: Dropdown populated from authenticated Google project
5. **Review & confirm**: Summary of what will be created

### Environment list

```
┌─────────────────────────────────────────────────────────┐
│ Environments                                            │
│                                                         │
│ ● Production GKE          [Team: Engineering Alpha]    │
│   google-cloud / us-central1 / cluster-prod            │
│   Status: 3 agents running                             │
│                                                [View]  │
│                                                         │
│ ○ Staging GKE             [No team deployed]           │
│   google-cloud / us-west1 / cluster-staging            │
│                               [Deploy a team here →]  │
└─────────────────────────────────────────────────────────┘
```

- Used environments are visually distinct from empty ones
- Cannot delete a used environment (delete button hidden / shows tooltip: "Undeploy the team first")

---

## Navigation Structure

```
Sidebar:
  ├── Teams
  │   ├── Engineering Alpha      ← active
  │   │   ├── Overview
  │   │   ├── Agents
  │   │   │   ├── alice-chen
  │   │   │   └── bob-smith
  │   │   └── Settings
  │   └── Design Team
  ├── Model Providers
  ├── Environments
  └── Settings
```

---

---

## Agent File Browser (MiniMax-inspired)

### Reference

MiniMax's chat UI exposes a file browser panel for viewing the agent's full workspace. This is the reference design for Coordina's agent file browser.

**What MiniMax shows:**
- Two-tab panel: "Current Process" (tool use log) | "Files" (workspace browser)
- Left sidebar: file tree with file names and sizes (`MEMORY.md 449 B`, `SOUL.md 1.9 KB`)
- Tab bar: multiple files open simultaneously (`AGENTS.md × HEARTBEAT.md × MEMORY.md`)
- Right pane: rendered markdown (Preview) or raw source toggle
- Search box: "Search Files..."
- Panel presented as a closeable drawer (× button top right)

### Coordina's File Browser — Design

```
┌─ Agent: alice-chen ──────────────────────────────── [×] ─┐
│  [Current Process]  [Files]                               │
│                                                           │
│ ┌─ Files ──────────────┐  ┌─ MEMORY.md ──────────────┐  │
│ │ Search Files...      │  │              [Edit][Preview]│  │
│ │                      │  │                             │  │
│ │ ▸ .openclaw/         │  │  # MEMORY.md — Long-Term   │  │
│ │   AGENTS.md   12.1KB │  │  Memory                    │  │
│ │   HEARTBEAT.md  168B │  │                             │  │
│ │   IDENTITY.md   167B │  │  ## About Alice             │  │
│ │ ● MEMORY.md    449B  │  │  - Role: Senior Engineer    │  │
│ │   SOUL.md      1.9KB │  │  - Skills: TypeScript, git  │  │
│ │   TOOLS.md     860B  │  │  ...                        │  │
│ │   USER.md      955B  │  │                             │  │
│ │ ▸ skills/            │  │                             │  │
│ │ ▸ memory/            │  │                             │  │
│ │   └ 2026-03-01.md   │  │                             │  │
│ │   └ 2026-03-02.md   │  │                             │  │
│ └──────────────────────┘  └─────────────────────────────┘  │
│                                          [↻ Refresh]       │
└───────────────────────────────────────────────────────────┘
```

### Behaviour rules

| Rule | Detail |
|------|--------|
| **Read-only** | All files are view-only. No inline editing. Admins configure agents through forms, not file edits. |
| **Preview default** | Markdown files open in Preview (rendered) mode by default. Source mode available via toggle. |
| **Tab persistence** | Open tabs persist while the panel is open; closing the panel resets tabs. |
| **Live data** | Files are fetched from the running pod's filesystem via the OpenClaw gateway API. |
| **Refresh** | Manual refresh button + optional auto-refresh every 30s when panel is open. |
| **Offline state** | If the team is undeployed, files are served from the last committed team spec repo (static, clearly labelled "Showing last committed state — team is not deployed"). |
| **File sizes** | Shown in the sidebar next to each filename. |
| **Folders** | `.openclaw/`, `skills/`, `memory/` are collapsible; expanded by default. |

### How files are fetched

The OpenClaw gateway exposes filesystem access via its API. Coordina's local backend:
1. Authenticates to the gateway via IAP (same Google ID token)
2. Calls the gateway's file list and file content endpoints
3. Streams content to the frontend

This is read-only — no write operations to the gateway filesystem from Coordina.

### Component Gallery references

- [Tree view](https://component.gallery/components/tree-view/) — file sidebar
- [Tabs](https://component.gallery/components/tabs/) — multi-file tab bar
- [Code block / Prose](https://component.gallery/components/prose/) — rendered markdown pane

---

## Key Sources

- [Component Gallery](https://component.gallery/)
- [Component Gallery — Forms](https://component.gallery/components/form/)
- [Component Gallery — Buttons](https://component.gallery/components/button/)
- [Component Gallery — Cards](https://component.gallery/components/card/)
- Vercel dashboard UX (form-driven config patterns)
- Railway dashboard UX (deployment lifecycle patterns)
- Linear (team/member management patterns)
