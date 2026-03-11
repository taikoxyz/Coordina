# SSE Schema Contract — GET /api/v1/events

**Status:** PROPOSED | **Phase:** 4 | **Owner:** Bob Li | **Reviewer:** Ripley

---

## Overview

This document defines the Server-Sent Events (SSE) schema contract for the Project API real-time event stream. This is a **hard dependency** for Phase 4 Livewire integration work.

---

## Endpoint

```
GET http://<host>:19876/api/v1/events
```

**Current Implementation Status:** ✅ Implemented in `server.js`

---

## Authentication

| Option | Status | Notes |
|--------|--------|-------|
| No Auth (Open) | ✅ Current | Endpoint is open, no token required |
| Bearer Token | ❌ Not Implemented | Could be added if needed |

**Recommendation:** Keep open for now. If needed in future, add middleware.

---

## Event Types

### Project Events

| Event | Payload | Description |
|-------|---------|-------------|
| `project:created` | `{ id, slug, name, status, createdAt }` | New project created |
| `project:updated` | `{ id, slug, name, status, updatedAt }` | Project updated |
| `project:deleted` | `{ id, slug }` | Project deleted |

### Task Events

| Event | Payload | Description |
|-------|---------|-------------|
| `task:created` | `{ id, title, status, priority, assignedTo, projectId, createdAt }` | New task created |
| `task:updated` | `{ id, title, status, priority, assignedTo, projectId, updatedAt }` | Task updated |
| `task:deleted` | `{ id, title, projectId }` | Task deleted |

### Agent Events

| Event | Payload | Description |
|-------|---------|-------------|
| `agent:status_changed` | `{ id, name, status, currentTask }` | Agent status changed |

---

## Connection Behavior

### Reconnection

- **Last-Event-ID Header:** Clients can send `Last-Event-ID` header to replay missed events
- **Event Buffer:** Server keeps last 100 events in buffer for replay

### Heartbeat

- **Keep-Alive:** Every 15 seconds, server sends `: keepalive\n\n`
- **Purpose:** Prevent connection timeout, detect stale connections

### Event Format (SSE Specification)

```
id: <event_id>
type: <event_type>
data: <json_payload>

```

Example:
```
id: 42
type: task:created
data: {"id":"task-abc123","title":"Fix bug","status":"unclaimed","priority":"high","assignedTo":null,"projectId":"proj-xyz","createdAt":"2026-03-11T01:40:00.000Z"}

```

---

## Client Implementation Notes

1. **Parse events** by splitting on `\n\n` delimiter
2. **Extract event type** from `type:` field
3. **Parse JSON** from `data:` field
4. **Handle keep-alive** (lines starting with `:`) - ignore
5. **Store last event ID** for reconnection

---

## Open Questions

- [ ] Should we add authentication to SSE endpoint?
- [ ] Any additional event types for Phase 4 Livewire integration?
- [ ] Should we add `project:progress_changed` or similar derived events?

---

## Agreement

- [ ] **Bob Li:** _Proposed_
- [ ] **Ripley:** _Pending review_

---

**Created:** 2026-03-11
**Timeline:** Schema agreed within 24 hours, implementation starts immediately after
