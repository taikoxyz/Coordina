# OpenClaw Container File Layout

> Status: Verified in production — March 2026
> Reflects: Coordina's StatefulSet manifest (plain K8s, no operator)

---

## Volume Map

| Volume | Type | Mount path | Persists? |
|--------|------|------------|-----------|
| `workspace` (PVC) | PersistentVolumeClaim | `/workspace` | ✓ survives restarts and redeployments |
| `openclaw-state` | emptyDir | `/openclaw-state` | ✗ reset on every pod restart |
| `shared-config` (ConfigMap) | ConfigMap | `/config/shared` | readOnly — always reflects latest deploy |
| `agent-config` (ConfigMap) | ConfigMap | `/config/agent` | readOnly — always reflects latest deploy |
| `agent-credentials` (Secret) | Secret | `/credentials` | readOnly — always reflects latest deploy |

---

## Full File Layout After First Boot

```
/workspace/                        ← PVC (persists across restarts and redeployments)
  BOOTSTRAP.md                     ← seeded from ConfigMap on first boot only (test -f guard)
  TEAM.md                          ← seeded from ConfigMap on first boot only
  IDENTITY.md                      ← seeded from ConfigMap on first boot only
  SOUL.md                          ← seeded from ConfigMap on first boot only
  SKILLS.md                        ← seeded from ConfigMap on first boot only
  MEMORY.md                        ← written by OpenClaw (long-term memory distillation)
  memory/
    YYYY-MM-DD.md                  ← daily logs, written by OpenClaw
  (agent work files accumulate here over time)

/openclaw-state/                   ← emptyDir (wiped on every pod restart)
  openclaw.json                    ← copied from Secret by init container on every boot

/config/shared/                    ← ConfigMap (readOnly, always current after redeploy)
  TEAM.md
  BOOTSTRAP.md

/config/agent/                     ← ConfigMap (readOnly, always current after redeploy)
  IDENTITY.md
  SOUL.md
  SKILLS.md

/credentials/                      ← Secret (readOnly)
  openclaw.json
```

---

## Init Container Seeding (bootstrap-init, busybox:1.36)

Runs before the main `openclaw` container on every pod start. Seeds files to `/workspace` using write-once guards (`test -f ... || cp`). On first boot all files are copied; on subsequent boots they are skipped.

Additionally copies `/credentials/openclaw.json` → `/openclaw-state/openclaw.json` on every boot (no guard — emptyDir is always empty at pod start).

---

## Which Files OpenClaw Actually Reads

| File | Who reads it | Notes |
|------|-------------|-------|
| `/openclaw-state/openclaw.json` | OpenClaw runtime | Provider credentials + model config (`OPENCLAW_STATE_DIR`) |
| `/workspace/BOOTSTRAP.md` | OpenClaw agent (AI) | Triggers first-run bootstrap ritual; agent deletes it when done |
| `/workspace/MEMORY.md` | OpenClaw runtime | Injected into every session prompt |
| `/workspace/SOUL.md` | OpenClaw runtime | Injected into every session prompt |
| `/workspace/IDENTITY.md` | OpenClaw runtime | Injected into every session prompt |
| `/workspace/memory/YYYY-MM-DD.md` | OpenClaw runtime | Today + yesterday injected into prompt |
| `/config/shared/*`, `/config/agent/*` | Agent (AI) only | Not read by OpenClaw runtime — available for agent to `cat` if needed |

---

## Key Constraints

- **`MEMORY.md` must be on the PVC** — OpenClaw writes to it during operation (memory flush before compaction). A read-only ConfigMap mount would break the memory system.
- **`/workspace/SOUL.md`, `IDENTITY.md`** — seeded copies on PVC are what OpenClaw injects into prompts. The `/config/agent/` ConfigMap copies are read-only and only useful for the agent to reference directly.
- **Stale workspace files on redeploy** — if soul/identity/skills are updated in the spec and redeployed, `/workspace/` copies are NOT refreshed (write-once guard). Updated content is visible at `/config/agent/` immediately. To force a refresh, delete the files on the PVC or redeploy with `keepDisks: false`.
- **`openclaw.json` is re-seeded every boot** — because emptyDir resets, the init container always copies the latest credential Secret. Provider or model changes take effect on the next pod restart without needing a full redeploy.

---

## Log Locations

```
/workspace/memory/YYYY-MM-DD.md   ← daily agent logs (PVC, persists ✓)
/workspace/MEMORY.md              ← long-term distilled memory (PVC, persists ✓)
kubectl logs <pod> -c openclaw    ← runtime stdout/stderr (Kubernetes log buffer)
```
