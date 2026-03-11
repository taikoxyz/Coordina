# Knowledge Distillation — Web Dev Agent (Ripley-Equivalent)

> **Purpose:** What BOOTSTRAP.md and SOUL.md should include for a freshly deployed web development agent  
> **Author:** Agent Ripley@team-d-squad  
> **Context:** Assignment from Alice Wong, 2026-03-11

---

## What a Fresh Ripley Needs on Day 1

### 1. Repo Locations and Branch Rules
- Dashboard repo: `dsquadteam/dsquad-dashboard`, branch `d-squad`
- Coordina repo: `taikoxyz/Coordina`, branch `d-squad`
- NEVER push to `main` — Daniel controls that merge
- See `specs/github-workflow.md` for full policy

### 2. Stack Knowledge
- **Laravel 11** — PHP framework, routes in `routes/web.php`
- **Livewire 3** — Server-driven reactive components in `app/Livewire/`
- **FluxUI** — Premium Blade component library (modals, forms, buttons)
- **Alpine.js** — Client-side interactivity, listens for SSE-dispatched events
- **Tailwind CSS** — Utility-first CSS with dark theme support

### 3. Dashboard Architecture
- Read `specs/dashboard-architecture.md` for the primary→fallback API pattern
- The mock data layer is PERMANENT (not temporary) — it's the dev/test fallback
- Bob's API is the primary data source when cross-pod connectivity works
- SSE uses DOT notation — this was a hard-won lesson, don't switch back to COLON

### 4. Critical Gotchas (Lessons Learned)
1. **SSE event notation**: Bob's server emits DOT (`task.created`), not COLON (`task:created`). EventSource `.addEventListener()` must use DOT.
2. **Status enum alignment**: Use `unclaimed`, `in_progress`, `on_hold`, `completed` everywhere. NOT `review`/`done`.
3. **Port 19876 cross-pod**: Requires K8s Service + Coordina redeploy. Check `specs/project-api.yaml`.
4. **Shared GitHub account**: Can't self-approve PRs. Use COMMENT reviews with APPROVED marker.
5. **Bob's response shapes differ from mock**: Messages use `message` not `content`, token-usage wraps in `{usage: [...]}`, budget/status has `{configured, usage, alert}` structure.
6. **Orphaned HTML**: Watch for unclosed tags in Blade templates when components are refactored — causes hydration errors in Livewire.
7. **Cache TTL**: Keep at 5s when SSE is active, not the default 15s.

### 5. Bob's API Quirks
- Mixed URL patterns (see architecture doc)
- No `project.deleted` SSE event
- `token-usage/summary` uses `period` query param, not windowed
- `budget/status` has NO per-agent/per-model breakdown — cross-reference with `token-usage/summary`

### 6. SOUL.md Essentials for Web Dev Agent
```
Creative, detail-oriented, and innovation-driven.
Brings pattern recognition from many premium builds,
knowing the difference between basic and luxury implementation.
Remembers what works and avoids common pitfalls.

Language Rules: Chinese or English with Daniel, English everywhere else.
Orchestrator mindset: spawn subagents, don't do the work yourself.
Repo is truth, memory is cache.
```

### 7. Tool Priorities
- `gh` CLI for all GitHub operations (pre-authenticated)
- `curl` for API testing and inter-agent communication
- Subagents for any implementation work longer than a quick fix
- Always test with mock data first, then verify against Bob's live API

### 8. Who To Ask
- **Alice Wong** (lead): Task assignments, priority decisions, escalations
- **Bob Li**: API questions, SSE schema, backend data issues
- **Aeryn**: Social media, external communications
- **Deckard**: Market intelligence, config research
- **Daniel**: Infrastructure, deploys, main branch merges
