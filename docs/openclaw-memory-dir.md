# OpenClaw Memory File Directory Configuration

> Status: Research complete — March 2026
> Question: When using the OpenClaw Docker image, can you specify the directory of memory files?

---

## Short Answer

Yes, but only indirectly. You can redirect the **entire workspace directory**, which moves memory files along with it. There is no dedicated config key or env var that points exclusively at the `memory/` subdirectory or `MEMORY.md` filename — those paths are hardcoded relative to the workspace root.

---

## Where Memory Files Live

Memory files always live at fixed relative paths inside the active workspace directory:

| File | Path |
|------|------|
| Long-term memory | `{workspace}/MEMORY.md` |
| Daily logs | `{workspace}/memory/YYYY-MM-DD.md` |

The default workspace is `~/.openclaw/workspace`.

Inside a Docker container:
- **Docker Compose**: `/home/node/.openclaw/workspace/`
- **K8s operator**: `/home/openclaw/.openclaw/workspace/`

---

## Methods to Change the Memory File Location

### 1. Docker Compose: `OPENCLAW_WORKSPACE_DIR` (primary method)

The Docker Compose setup has two separate volume mounts:

```yaml
volumes:
  - ${OPENCLAW_CONFIG_DIR}:/home/node/.openclaw
  - ${OPENCLAW_WORKSPACE_DIR}:/home/node/.openclaw/workspace
```

Set these in your `.env` file:

```
OPENCLAW_CONFIG_DIR=/your/host/openclaw-config
OPENCLAW_WORKSPACE_DIR=/your/host/workspace
```

`MEMORY.md` and `memory/YYYY-MM-DD.md` land inside whatever `OPENCLAW_WORKSPACE_DIR` points to on the host.

### 2. `openclaw.json`: `agents.defaults.workspace`

```json
{
  "agents": {
    "defaults": {
      "workspace": "/custom/path/to/workspace"
    }
  }
}
```

### 3. `OPENCLAW_STATE_DIR` env var

Moves the entire state root. The workspace default becomes `$OPENCLAW_STATE_DIR/workspace`.

```bash
OPENCLAW_STATE_DIR=/custom/state openclaw gateway
```

### 4. `OPENCLAW_PROFILE` env var

Creates a named workspace variant: `~/.openclaw/workspace-<profile>`.

```bash
OPENCLAW_PROFILE=work openclaw gateway
```

---

## Method Comparison

| Method | What it changes | Affects memory files? |
|--------|----------------|-----------------------|
| `OPENCLAW_WORKSPACE_DIR` (Docker Compose `.env`) | Host path mounted as workspace | **Yes — primary method** |
| `agents.defaults.workspace` in `openclaw.json` | Workspace directory path | **Yes** |
| `OPENCLAW_STATE_DIR` env var | Entire state root | **Yes, indirectly** |
| `OPENCLAW_PROFILE` env var | Workspace becomes `workspace-<profile>` | **Yes, separate workspace** |
| `OPENCLAW_AGENT_DIR` / `PI_CODING_AGENT_DIR` | Agent process directory only | **No** — unrelated to memory files |
| `agents.defaults.memorySearch.store.path` | SQLite embedding index path | **No** — index only, not Markdown files |

---

## K8s Operator (GKE)

The operator mounts the PVC at `/home/openclaw/.openclaw`. Memory files land at:

```
/home/openclaw/.openclaw/workspace/MEMORY.md
/home/openclaw/.openclaw/workspace/memory/YYYY-MM-DD.md
```

To configure a custom workspace path, use `spec.config.raw` in the `OpenClawInstance` CRD:

```yaml
spec:
  config:
    raw:
      agents:
        defaults:
          workspace: "/home/openclaw/.openclaw/workspace"
```

---

## Limitations

- The `memory/` subdirectory name and `MEMORY.md` filename are hardcoded in the source (`DEFAULT_MEMORY_FILENAME = "MEMORY.md"` in `src/agents/workspace.ts`). They cannot be renamed via configuration — only the workspace that contains them can be moved.
- There is no way to split memory files from other workspace files (e.g., `SOUL.md`, `IDENTITY.md`) into a separate directory.

---

## Implication for Coordina

Coordina's PVC strategy is correct as-is. The PVC captures `/home/openclaw/.openclaw` (the full state root, including the workspace), so all memory files survive pod restarts and redeployments automatically without any special configuration.

The deterministic PVC naming (`workspace-<team-slug>-<agent-slug>-0`) ensures the same disk reattaches on redeploy — agent memory persists across the full pod lifecycle.
