# SSE Schema Contract

**Date:** 2026-03-11
**Status:** Active
**Owner:** D Squad

## Overview

This document defines the Server-Sent Events (SSE) contract for real-time event streaming in the D Squad coordination system. All event types use dot notation (e.g., `task.created`) for consistency and clarity.

> **Note:** The server does NOT emit `project.deleted` events. Only the events defined below are supported.

---

## Event Types

### 1. `connected`

Sent on initial connection to confirm stream is active.

```json
{
  "type": "connected",
  "timestamp": "2026-03-11T01:00:00Z"
}
```

---

### 2. `heartbeat`

Sent every 15 seconds to keep the connection alive. Clients should not treat this as a meaningful event—it's solely for connection maintenance.

```json
{
  "type": "heartbeat",
  "timestamp": "2026-03-11T01:00:00Z",
  "payload": {}
}
```

---

### 3. `task.created`

Emitted when a new task is created via `POST /api/v1/tasks`

```json
{
  "type": "task.created",
  "timestamp": "2026-03-11T01:00:00Z",
  "payload": {
    "id": "task-abc123",
    "title": "New task",
    "assignedTo": "bob-li",
    "status": "unclaimed",
    "priority": "high",
    "dueDate": "2026-03-15T00:00:00Z",
    "blockers": [],
    "projectId": "proj-dashboard",
    "description": "Task description",
    "createdAt": "2026-03-11T01:00:00Z",
    "updatedAt": "2026-03-11T01:00:00Z"
  }
}
```

---

### 4. `task.updated`

Emitted when a task is modified via `PATCH /api/v1/tasks/:id`

```json
{
  "type": "task.updated",
  "timestamp": "2026-03-11T01:00:00Z",
  "payload": {
    "id": "task-001",
    "title": "Updated title",
    "assignedTo": "ripley",
    "status": "in_progress",
    "priority": "high",
    "dueDate": "2026-03-15T00:00:00Z",
    "blockers": [],
    "projectId": "proj-dashboard",
    "description": "Task description",
    "createdAt": "2026-03-11T01:00:00Z",
    "updatedAt": "2026-03-11T02:00:00Z"
  }
}
```

---

### 5. `task.deleted`

Emitted when a task is deleted via `DELETE /api/v1/tasks/:id`

```json
{
  "type": "task.deleted",
  "timestamp": "2026-03-11T01:00:00Z",
  "payload": {
    "id": "task-001"
  }
}
```

---

### 6. `agent.status_changed`

Emitted when agent status or currentTask changes via `PATCH /api/v1/agents/:id`

```json
{
  "type": "agent.status_changed",
  "timestamp": "2026-03-11T01:00:00Z",
  "payload": {
    "id": "bob-li",
    "name": "Bob Li",
    "role": "AI/ML engineer",
    "status": "busy",
    "currentTask": "Building SSE endpoint",
    "lastActivity": "2026-03-11T01:00:00Z"
  }
}
```

---

### 7. `project.created`

Emitted when a new project is created via `POST /api/v1/projects`

```json
{
  "type": "project.created",
  "timestamp": "2026-03-11T01:00:00Z",
  "payload": {
    "id": "proj-abc123",
    "name": "New Project",
    "description": "Project description",
    "status": "active",
    "progress": 0,
    "tasks": [],
    "createdAt": "2026-03-11T01:00:00Z",
    "updatedAt": "2026-03-11T01:00:00Z"
  }
}
```

---

### 8. `project.updated`

Emitted when a project is modified via `PATCH /api/v1/projects/:id`

```json
{
  "type": "project.updated",
  "timestamp": "2026-03-11T01:00:00Z",
  "payload": {
    "id": "proj-dashboard",
    "name": "D Squad Coordination Dashboard",
    "description": "Real-time coordination dashboard",
    "status": "active",
    "progress": 50,
    "tasks": ["task-001", "task-002"],
    "createdAt": "2026-03-10T09:00:00Z",
    "updatedAt": "2026-03-11T01:00:00Z"
  }
}
```

---

## Unsupported Events

The following event types are NOT emitted by the server:

- `project.deleted` — Project deletion events are not supported

---

## Connection Details

- **Endpoint:** `GET /api/v1/events`
- **Content-Type:** `text/event-stream`
- **Cache-Control:** `no-cache`
- **Connection:** `keep-alive`
- **Reconnection:** Clients should send `Last-Event-ID` header on reconnect
- **Keep-alive:** Server sends `heartbeat` event every 15 seconds

---

## Status Values Reference

| Entity | Valid Values |
|--------|--------------|
| Task Status | `unclaimed`, `in_progress`, `on_hold`, `completed` |
| Task Priority | `low`, `medium`, `high`, `critical` |
| Agent Status | `online`, `busy`, `offline` |
| Project Status | `planning`, `active`, `on_hold`, `completed` |

---

## Implementation

- **Server:** `dsquad-dashboard/server.cjs` (Node.js/Express)
- **Port:** 19876
- **Framework:** Express.js with SSE support
- **Data Store:** In-memory (can be swapped for SQLite in production)