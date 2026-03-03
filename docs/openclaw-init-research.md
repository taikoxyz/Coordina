# Research: OpenClaw Container Initialization

> Status: March 2026
> Question: How to install tools and modify workspace files (e.g. MEMORY.md) on first container start — for Docker Compose and Kubernetes

---

## Docker Compose

### The core mechanic: bind-mounted workspace

Everything important lives in the workspace directory, bind-mounted from the host:

```
Host:      ~/.openclaw/workspace/
Container: /home/node/.openclaw/workspace/
```

Since it's a bind mount, you can **write files on the host before `docker compose up`** and the container sees them immediately. This is the simplest approach for seeding `MEMORY.md` and other workspace files.

### Installing a tool

**Option A — Build-time packages (official image, no Dockerfile needed)**

Set `OPENCLAW_DOCKER_APT_PACKAGES` before running `docker-setup.sh`. The official `Dockerfile` expands it in an `apt-get install` step:

```bash
OPENCLAW_DOCKER_APT_PACKAGES="ripgrep fd-find jq" ./docker-setup.sh
```

This bakes the tool into the image. You must re-run when you change the list.

**Option B — Custom Dockerfile (extending the official image)**

```dockerfile
FROM ghcr.io/openclaw/openclaw:latest

USER root
RUN apt-get update && apt-get install -y --no-install-recommends ripgrep jq \
    && rm -rf /var/lib/apt/lists/*
USER node
```

Set `OPENCLAW_IMAGE=my-openclaw:local` in your `.env`. OpenClaw runs commands with `sh -lc` (login shell), which sources `/etc/profile.d/` — so if you need a custom bin on PATH, add it there.

**Option C — `coollabsio/openclaw` init script hook**

The community `coollabsio/openclaw` image (not the official one) exposes `OPENCLAW_DOCKER_INIT_SCRIPT` — an executable script that runs on every container start before the gateway:

```yaml
# docker-compose.yml
services:
  openclaw:
    image: ghcr.io/coollabsio/openclaw:latest
    environment:
      OPENCLAW_DOCKER_INIT_SCRIPT: /init/init.sh
    volumes:
      - ./init.sh:/init/init.sh:ro
      - openclaw_data:/data
```

```bash
# init.sh
#!/bin/bash
set -e

# Idempotency: only run once
[ -f /data/.init_done ] && exit 0

npm install -g @some/tool

touch /data/.init_done
```

> **Note:** The official `ghcr.io/openclaw/openclaw` image does **not** have this hook. It is specific to the coollabsio variant.

### Modifying MEMORY.md on first start

Pre-populate on the host before starting:

```bash
mkdir -p ~/.openclaw/workspace/memory

cat > ~/.openclaw/workspace/MEMORY.md <<'EOF'
# Persistent Memory

## Project Context
- Repo: my-project
- Stack: TypeScript, Node.js

## Preferences
- Always run tests before committing
- Use conventional commits
EOF
```

Then `docker compose up`. The bind mount means the container sees this immediately.

**Prevent the bootstrap wizard from overwriting your files** — add to `~/.openclaw/openclaw.json`:

```json
{ "agent": { "skipBootstrap": true } }
```

Without this, the first-run Q&A ritual (`BOOTSTRAP.md`) may prompt the agent to regenerate workspace files.

---

## Kubernetes

### Key constraints (different from Docker Compose)

1. **No host bind mount** — the workspace lives on a PVC (PersistentVolumeClaim). Files can't be pre-written from the host.
2. **Root filesystem is read-only** — tools cannot be installed to system paths like `/usr/local/bin`. They must go to the PVC (`/home/node/.openclaw/`).
3. **`MEMORY.md` must stay on the PVC** — it cannot be a ConfigMap mount because OpenClaw writes to it during operation (memory flush before compaction). A read-only mount would break the memory system.
4. **Init container pattern** — seeding and tool installation happen in init containers before the main OpenClaw container starts.

### Option 1: Official k8s operator (`openclaw-rocks/k8s-operator`)

The operator has first-class support for all of this via `spec.workspace`, `spec.runtimeDeps`, and `spec.skills`.

**Seeding MEMORY.md and other workspace files (write-once):**

```yaml
apiVersion: openclaw.rocks/v1alpha1
kind: OpenClawInstance
metadata:
  name: my-agent
  namespace: openclaw
spec:
  workspace:
    initialDirectories:
      - memory
      - tools
    initialFiles:
      MEMORY.md: |
        # Long-Term Memory

        ## Context
        Agent initialized via Kubernetes operator.

        ## User Preferences
        - Timezone: UTC
      AGENTS.md: |
        # Operating Instructions
        - Be concise
        - Always check existing tests before modifying code
```

Files in `spec.workspace.initialFiles` are **write-once**: copied to the PVC on first boot only, never overwritten. Agent writes to `MEMORY.md` survive pod restarts.

**Installing tools:**

```yaml
spec:
  # Built-in: installs pnpm and Python/uv to the PVC via init containers
  runtimeDeps:
    pnpm: true
    python: true

  # ClawHub skills (installed to PVC by the init-skills init container)
  skills:
    - "@anthropic/mcp-server-fetch"
    - "@anthropic/mcp-server-filesystem"
```

**Adding a custom init container** (runs after the operator's own pipeline):

```yaml
spec:
  initContainers:
    - name: extra-setup
      image: curlimages/curl:8.5.0
      command:
        - sh
        - -c
        - |
          WORKSPACE=/home/openclaw/.openclaw/workspace
          if [ ! -f "${WORKSPACE}/data/seed.json" ]; then
            mkdir -p "${WORKSPACE}/data"
            curl -fsSL -o "${WORKSPACE}/data/seed.json" https://example.com/seed.json
          fi
      volumeMounts:
        - name: data
          mountPath: /home/openclaw/.openclaw
```

**Mounting a read-only file from a ConfigMap** (for files the agent should never overwrite, like a static instructions file):

```yaml
spec:
  extraVolumes:
    - name: instructions
      configMap:
        name: openclaw-instructions
  extraVolumeMounts:
    - name: instructions
      mountPath: /home/openclaw/.openclaw/workspace/INSTRUCTIONS.md
      subPath: INSTRUCTIONS.md
      readOnly: true
```

### Option 2: Plain StatefulSet (no operator)

Use an init container that writes to the PVC using a ConfigMap as the seed source:

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: openclaw-workspace-seed
  namespace: openclaw
data:
  MEMORY.md: |
    # Long-Term Memory

    ## User Preferences
    - Timezone: UTC
  AGENTS.md: |
    # Operating Instructions
    - Be concise
---
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: openclaw
  namespace: openclaw
spec:
  serviceName: openclaw
  replicas: 1
  selector:
    matchLabels:
      app: openclaw
  template:
    spec:
      initContainers:
        - name: seed-workspace
          image: busybox:1.36
          command:
            - sh
            - -c
            - |
              WORKSPACE=/home/node/.openclaw/workspace
              mkdir -p "${WORKSPACE}/memory"

              # Write-once: skip if file already exists
              for f in MEMORY.md AGENTS.md; do
                if [ ! -f "${WORKSPACE}/${f}" ]; then
                  cp "/seed/${f}" "${WORKSPACE}/${f}"
                  echo "Seeded ${f}"
                fi
              done
          volumeMounts:
            - name: data
              mountPath: /home/node/.openclaw
            - name: seed
              mountPath: /seed
              readOnly: true
      containers:
        - name: openclaw
          image: ghcr.io/openclaw/openclaw:latest
          ports:
            - containerPort: 18789
          volumeMounts:
            - name: data
              mountPath: /home/node/.openclaw
            - name: tmp
              mountPath: /tmp
      volumes:
        - name: seed
          configMap:
            name: openclaw-workspace-seed
        - name: tmp
          emptyDir: {}
  volumeClaimTemplates:
    - metadata:
        name: data
      spec:
        accessModes: [ReadWriteOnce]
        resources:
          requests:
            storage: 10Gi
```

**Installing tools to the PVC** (in the init container, since root FS is read-only):

```yaml
initContainers:
  - name: install-tools
    image: ghcr.io/openclaw/openclaw:latest
    command:
      - sh
      - -c
      - |
        PNPM_HOME=/home/node/.openclaw/pnpm
        mkdir -p "$PNPM_HOME"
        if [ ! -f "$PNPM_HOME/pnpm" ]; then
          curl -fsSL https://get.pnpm.io/install.sh \
            | env PNPM_HOME="$PNPM_HOME" SHELL=/bin/sh sh -
        fi
    volumeMounts:
      - name: data
        mountPath: /home/node/.openclaw
```

Then add the PVC bin path to `PATH` on the main container:

```yaml
containers:
  - name: openclaw
    env:
      - name: PATH
        value: /home/node/.openclaw/pnpm:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
      - name: PNPM_HOME
        value: /home/node/.openclaw/pnpm
```

### ConfigMap mounts: what's safe and what's not

| Use case | Safe to mount as ConfigMap? | Why |
|---|---|---|
| `MEMORY.md` | **No** | OpenClaw writes to it during operation; read-only mount breaks memory system |
| `AGENTS.md`, `SOUL.md` | **No** (if agent should be able to update them) | Same reason |
| `AGENTS.md`, `SOUL.md` | **Yes** (if you want to enforce them as read-only from the platform) | The agent won't be able to overwrite them; suitable for operator-controlled config |
| Static `INSTRUCTIONS.md` or similar | **Yes** | The agent only reads it |
| `openclaw.json` | **Yes** (as a merge source) | The operator's `init-config` init container merges it into the PVC copy |

### Option 3: Agent-driven bootstrap via BOOTSTRAP-INSTRUCTIONS.md (k8s-friendly)

Instead of using init containers to install tools and seed files, you can let the OpenClaw agent do it itself on first run — driven by a ConfigMap.

**How it works:**

1. Mount a ConfigMap as `BOOTSTRAP-INSTRUCTIONS.md` (read-only) — this is the stable, versionable spec for what the agent should set up
2. Seed `BOOTSTRAP.md` on the PVC (via init container or operator `initialFiles`) — one line: "follow the instructions file"
3. On first start, OpenClaw reads `BOOTSTRAP.md`, reads `BOOTSTRAP-INSTRUCTIONS.md`, executes the steps (installing tools, writing `MEMORY.md`, etc.), then deletes `BOOTSTRAP.md`
4. On every subsequent restart, `BOOTSTRAP.md` is gone — bootstrap never runs again

**Key constraint:** `BOOTSTRAP.md` must be on the PVC (writable), because the agent deletes it when the ritual completes. If you mount it as a ConfigMap it becomes read-only, the agent can't delete it, and bootstrap re-runs on every restart. Only `BOOTSTRAP-INSTRUCTIONS.md` is a ConfigMap.

**ConfigMap — the instruction source:**

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: openclaw-bootstrap-instructions
  namespace: openclaw
data:
  BOOTSTRAP-INSTRUCTIONS.md: |
    # Bootstrap Instructions

    Follow each step in order. When all steps are complete, confirm done.

    ## 1. Install tools
    Run the following shell commands:
    ```
    npm install -g @anthropic-ai/sdk
    curl -fsSL https://astral.sh/uv/install.sh | sh
    ```

    ## 2. Seed MEMORY.md
    Write the following content to `MEMORY.md` in the workspace:
    ```
    # Long-Term Memory

    ## Project Context
    - Deployment: Kubernetes
    - Stack: TypeScript, Node.js

    ## Preferences
    - Always run tests before committing
    - Use conventional commits
    ```

    ## 3. Set up workspace directories
    Create the following directories if they don't exist:
    - memory/
    - tools/
    - notes/
```

**StatefulSet — mount the ConfigMap and seed BOOTSTRAP.md:**

```yaml
apiVersion: apps/v1
kind: StatefulSet
spec:
  template:
    spec:
      initContainers:
        - name: seed-bootstrap
          image: busybox:1.36
          command:
            - sh
            - -c
            - |
              WORKSPACE=/home/node/.openclaw/workspace
              mkdir -p "$WORKSPACE"
              # Only write if bootstrap hasn't already run
              if [ ! -f "${WORKSPACE}/.bootstrap_done" ] && [ ! -f "${WORKSPACE}/BOOTSTRAP.md" ]; then
                cat > "${WORKSPACE}/BOOTSTRAP.md" <<'EOF'
              # First-Run Bootstrap

              Read the file `BOOTSTRAP-INSTRUCTIONS.md` in this workspace directory.
              Follow every step in it exactly.
              When all steps are complete, delete this file (BOOTSTRAP.md).
              EOF
              fi
          volumeMounts:
            - name: data
              mountPath: /home/node/.openclaw
      containers:
        - name: openclaw
          volumeMounts:
            - name: data
              mountPath: /home/node/.openclaw
            - name: bootstrap-instructions
              mountPath: /home/node/.openclaw/workspace/BOOTSTRAP-INSTRUCTIONS.md
              subPath: BOOTSTRAP-INSTRUCTIONS.md
              readOnly: true
      volumes:
        - name: bootstrap-instructions
          configMap:
            name: openclaw-bootstrap-instructions
```

**With the official operator:**

```yaml
spec:
  workspace:
    initialFiles:
      BOOTSTRAP.md: |
        # First-Run Bootstrap

        Read the file `BOOTSTRAP-INSTRUCTIONS.md` in this workspace directory.
        Follow every step in it exactly.
        When all steps are complete, delete this file (BOOTSTRAP.md).
  extraVolumes:
    - name: bootstrap-instructions
      configMap:
        name: openclaw-bootstrap-instructions
  extraVolumeMounts:
    - name: bootstrap-instructions
      mountPath: /home/openclaw/.openclaw/workspace/BOOTSTRAP-INSTRUCTIONS.md
      subPath: BOOTSTRAP-INSTRUCTIONS.md
      readOnly: true
```

**Trade-offs vs. init containers:**

| | Init container | Agent-driven (this pattern) |
|---|---|---|
| Determinism | High — shell script, predictable | Lower — LLM executes, may interpret loosely |
| Tool install timing | Before agent starts | After agent starts (gap window) |
| Instruction updates | Requires redeploying init container | Update the ConfigMap only |
| Complexity | More YAML | Less YAML, more prompt engineering |
| Writable files (MEMORY.md) | Init container writes directly | Agent writes in correct format |
| Re-triggering | Re-seed the PVC manually | Re-seed BOOTSTRAP.md only |

Use init containers when you need guaranteed, deterministic setup. Use the agent-driven pattern when the instructions are more dynamic or you want the agent to interpret and adapt them (e.g., "install the tools you need to work with TypeScript").

---

## Workspace file catalog

All files live in the workspace directory (`~/.openclaw/workspace/` on Docker, PVC on k8s):

| File | Purpose | When injected |
|------|---------|---------------|
| `MEMORY.md` | Long-term curated memory | Primary sessions only |
| `AGENTS.md` | Operating instructions | Every session |
| `SOUL.md` | Personality, tone, values | Every session |
| `IDENTITY.md` | Agent name, emoji, quirks | Every session |
| `USER.md` | User preferences | Every session |
| `TOOLS.md` | Tool usage conventions | Every session |
| `BOOT.md` | Startup checklist on gateway restart | Every session |
| `HEARTBEAT.md` | Lightweight checklist for heartbeat runs | Every session |
| `BOOTSTRAP.md` | First-run ritual (auto-deletes after completion) | First run only |
| `memory/YYYY-MM-DD.md` | Daily logs | Today + yesterday |

File injection is truncated at 20,000 chars each, 150,000 chars total (configurable via `bootstrapMaxChars` / `bootstrapTotalMaxChars` in `openclaw.json`).

---

## Recommended pattern for Coordina (k8s)

Coordina already generates `SOUL.md`, `IDENTITY.md`, `AGENTS.md`, and `openclaw.json` per agent. On k8s, the cleanest flow is:

1. Store generated workspace files in the team spec repo under `agents/<slug>/`
2. On deploy, create a ConfigMap per agent containing these files
3. The init container seeds each file to the PVC (write-once, skips if already present)
4. Set `skipBootstrap: true` in `openclaw.json` to skip the first-run Q&A
5. Bake any required system tools into a custom image, or use the operator's `runtimeDeps`

If using the official k8s operator, `spec.workspace.initialFiles` handles steps 2–4 natively — no manual init container needed.

---

## Sources

- [OpenClaw Docker docs](https://docs.openclaw.ai/install/docker)
- [OpenClaw Agent Workspace](https://docs.openclaw.ai/concepts/agent-workspace)
- [OpenClaw k8s Operator](https://github.com/openclaw-rocks/k8s-operator)
- [coollabsio/openclaw GitHub](https://github.com/coollabsio/openclaw)
- [openclaw/openclaw Dockerfile](https://github.com/openclaw/openclaw/blob/main/Dockerfile)
- [Simon Willison's OpenClaw Docker TIL](https://til.simonwillison.net/llms/openclaw-docker)
