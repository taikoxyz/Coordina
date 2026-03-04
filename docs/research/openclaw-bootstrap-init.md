# OpenClaw Bootstrap & Container Initialization

> Status: March 2026
> Covers: Container init patterns (Docker Compose + Kubernetes), and the implementation plan for Coordina's bootstrap feature

---

## Part 1 — Research: OpenClaw Container Initialization

> Original question: How to install tools and modify workspace files (e.g. MEMORY.md) on first container start — for Docker Compose and Kubernetes

### Docker Compose

#### The core mechanic: bind-mounted workspace

Everything important lives in the workspace directory, bind-mounted from the host:

```
Host:      ~/.openclaw/workspace/
Container: /home/node/.openclaw/workspace/
```

Since it's a bind mount, you can **write files on the host before `docker compose up`** and the container sees them immediately. This is the simplest approach for seeding `MEMORY.md` and other workspace files.

#### Installing a tool

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

#### Modifying MEMORY.md on first start

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

### Kubernetes

#### Key constraints (different from Docker Compose)

1. **No host bind mount** — the workspace lives on a PVC (PersistentVolumeClaim). Files can't be pre-written from the host.
2. **Root filesystem is read-only** — tools cannot be installed to system paths like `/usr/local/bin`. They must go to the PVC (`/home/node/.openclaw/`).
3. **`MEMORY.md` must stay on the PVC** — it cannot be a ConfigMap mount because OpenClaw writes to it during operation (memory flush before compaction). A read-only mount would break the memory system.
4. **Init container pattern** — seeding and tool installation happen in init containers before the main OpenClaw container starts.

#### Option 1: Official k8s operator (`openclaw-rocks/k8s-operator`)

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

#### Option 2: Plain StatefulSet (no operator)

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

#### Option 3: Agent-driven bootstrap via BOOTSTRAP-INSTRUCTIONS.md (k8s-friendly)

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

#### ConfigMap mounts: what's safe and what's not

| Use case | Safe to mount as ConfigMap? | Why |
|---|---|---|
| `MEMORY.md` | **No** | OpenClaw writes to it during operation; read-only mount breaks memory system |
| `AGENTS.md`, `SOUL.md` | **No** (if agent should be able to update them) | Same reason |
| `AGENTS.md`, `SOUL.md` | **Yes** (if you want to enforce them as read-only from the platform) | The agent won't be able to overwrite them; suitable for operator-controlled config |
| Static `INSTRUCTIONS.md` or similar | **Yes** | The agent only reads it |
| `openclaw.json` | **Yes** (as a merge source) | The operator's `init-config` init container merges it into the PVC copy |

---

### Workspace file catalog

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

### Recommended pattern for Coordina (k8s)

Coordina already generates `SOUL.md`, `IDENTITY.md`, `AGENTS.md`, and `openclaw.json` per agent. On k8s, the cleanest flow is:

1. Store generated workspace files in the team spec repo under `agents/<slug>/`
2. On deploy, create a ConfigMap per agent containing these files
3. The init container seeds each file to the PVC (write-once, skips if already present)
4. Set `skipBootstrap: true` in `openclaw.json` to skip the first-run Q&A
5. Bake any required system tools into a custom image, or use the operator's `runtimeDeps`

If using the official k8s operator, `spec.workspace.initialFiles` handles steps 2–4 natively — no manual init container needed.

---

### Sources

- [OpenClaw Docker docs](https://docs.openclaw.ai/install/docker)
- [OpenClaw Agent Workspace](https://docs.openclaw.ai/concepts/agent-workspace)
- [OpenClaw k8s Operator](https://github.com/openclaw-rocks/k8s-operator)
- [coollabsio/openclaw GitHub](https://github.com/coollabsio/openclaw)
- [openclaw/openclaw Dockerfile](https://github.com/openclaw/openclaw/blob/main/Dockerfile)
- [Simon Willison's OpenClaw Docker TIL](https://til.simonwillison.net/llms/openclaw-docker)

---

## Part 2 — Implementation Plan: Bootstrap Feature + Type Consolidation + Fixes

**Goal:** Add BOOTSTRAP-INSTRUCTIONS.md ConfigMap + init container, consolidate all duplicated types into shared/types.ts, fix model defaults per provider, and strip SOUL.md template scaffolding.

**Architecture:** Four workstreams: (1) Consolidate all domain types into src/shared/types.ts and update all importers, (2) Fix provider-aware model defaults in specs/index.ts, (3) Strip SOUL.md empty template sections, (4) Add bootstrap_instructions column + DEFAULT_BOOTSTRAP_INSTRUCTIONS constant + ConfigMap key + init container + UI textarea.

**Tech Stack:** TypeScript, Electron IPC, React 19, TanStack Query, better-sqlite3, js-yaml, Tailwind CSS

---

### Task 1: Consolidate types into shared/types.ts

**Files:**
- Modify: `src/shared/types.ts`
- Modify: `src/main/ipc/teams.ts` (remove TeamRecord, import from shared)
- Modify: `src/main/ipc/agents.ts` (remove AgentRecord, import from shared)
- Modify: `src/main/ipc/providers.ts` (remove ProviderRecord, import from shared)
- Modify: `src/main/ipc/deploy.ts` (import from shared)
- Modify: `src/main/ipc/specs.ts` (import from shared)
- Modify: `src/main/specs/index.ts` (import from shared, remove re-exports)
- Modify: `src/renderer/src/hooks/useTeams.ts` (remove TeamRecord + AgentRecord, import from shared)
- Modify: `src/renderer/src/hooks/useEnvironments.ts` (remove EnvironmentRecord, import from shared)
- Modify: `src/renderer/src/hooks/useProviders.ts` (remove ProviderRecord, import from shared)
- Modify: `src/renderer/src/hooks/useSpecs.ts` (remove SpecFile, import from shared)
- Modify: `src/renderer/src/hooks/useModels.ts` (remove ModelInfo, import from shared)

**Step 1: Rewrite shared/types.ts as the single source of truth**

Merge all type variants into one canonical definition per domain type. The superset of fields across all layers:

```typescript
export interface TeamRecord {
  slug: string
  name: string
  githubRepo?: string
  leadAgentSlug?: string
  config: Record<string, unknown>
  gatewayUrl?: string
  deployedEnvId?: string
  domain?: string
  image?: string
  deployedSpecHash?: string
}

export interface AgentRecord {
  slug: string
  teamSlug: string
  name: string
  role: string
  email?: string
  slackHandle?: string
  githubId?: string
  skills: string[]
  soul: string
  providerId?: string
  model?: string
  image?: string
  isLead: boolean
}

export interface ProviderRecord {
  id: string
  type: string
  name: string
  config: Record<string, unknown>
  maskedApiKey?: string
}

export interface EnvironmentRecord {
  id: string
  type: string
  name: string
  config: Record<string, unknown>
}

export interface SpecFile {
  path: string
  content: string
}

export interface ModelInfo {
  id: string
  name: string
  contextWindow?: number
}

export interface AgentStatus {
  agentSlug: string
  status: 'running' | 'pending' | 'crashed' | 'unknown'
}

export interface DeployResult {
  ok: boolean
  gatewayUrl?: string
  reason?: string
}
```

Remove the old `AgentSpec`, `TeamSpec` interfaces (unused or superseded).

**Step 2: Update all main process imports**

In each IPC handler file, remove the local type definition and add:
```typescript
import type { TeamRecord } from '../../shared/types'
```
(Adjust relative path per file location.)

In `src/main/specs/index.ts`, remove `export type { AgentRecord }` re-export, import `TeamRecord`, `AgentRecord`, `ProviderRecord` from shared. Remove `import type { TeamRecord } from '../ipc/teams'` etc.

**Step 3: Update all renderer imports**

In each hook file, remove the local type definition and add:
```typescript
import type { TeamRecord, AgentRecord } from '../../../../shared/types'
```
Keep exporting the types from hooks for component convenience:
```typescript
export type { TeamRecord, AgentRecord } from '../../../../shared/types'
```

**Step 4: Run typecheck**

Run: `npx tsc --noEmit -p tsconfig.node.json && npx tsc --noEmit -p tsconfig.web.json`
Expected: Clean (0 errors)

**Step 5: Run tests**

Run: `npx vitest run --config vitest.config.mts`
Expected: All 73 tests pass

**Step 6: Commit**

```
feat: consolidate all domain types into shared/types.ts
```

---

### Task 2: Fix model defaults per provider type

**Files:**
- Modify: `src/main/specs/index.ts` (line ~109)
- Modify: `src/main/providers/base.ts` (add defaultModel to ModelProvider)
- Modify: `src/main/providers/anthropic.ts`
- Modify: `src/main/providers/openai.ts`
- Modify: `src/main/providers/deepseek.ts`
- Modify: `src/main/providers/ollama.ts`
- Modify: `src/main/providers/openrouter.ts`

**Step 1: Add defaultModel to provider registry**

In `src/main/providers/base.ts`, add `defaultModel: string` to the `ModelProvider` interface.

In each provider implementation, set:
- anthropic: `defaultModel: 'claude-sonnet-4-6'`
- openai: `defaultModel: 'gpt-4o'`
- deepseek: `defaultModel: 'deepseek-chat'`
- ollama: `defaultModel: 'llama3.2'`
- openrouter: `defaultModel: 'anthropic/claude-sonnet-4-6'`

**Step 2: Use provider defaultModel in specs**

In `src/main/specs/index.ts`, replace the hardcoded fallback:

```typescript
// Before:
let modelConfig = { provider: 'anthropic', model: agent.model || 'claude-sonnet-4-6' }
if (agent.providerId) {
  const provider = providers.get(agent.providerId)
  if (provider) {
    modelConfig = {
      ...provider.config,
      provider: provider.type,
      model: agent.model || (provider.config.model as string | undefined) || 'claude-sonnet-4-6',
    }
  }
}

// After:
const providerEntry = agent.providerId ? providers.get(agent.providerId) : undefined
const providerType = providerEntry?.type ?? 'anthropic'
const registeredProvider = getProvider(providerType)
const defaultModel = registeredProvider?.defaultModel ?? 'claude-sonnet-4-6'

let modelConfig: Record<string, unknown> = { provider: providerType, model: agent.model || defaultModel }

if (providerEntry) {
  modelConfig = {
    ...providerEntry.config,
    provider: providerType,
    model: agent.model || (providerEntry.config.model as string | undefined) || defaultModel,
  }
}
```

Import `getProvider` from `../providers/base`.

**Step 3: Run tests**

Run: `npx vitest run --config vitest.config.mts`
Expected: Pass (may need to update spec test expectations for model defaults)

**Step 4: Commit**

```
fix: use provider-specific default models instead of hardcoded claude-sonnet-4-6
```

---

### Task 3: Strip SOUL.md empty template scaffolding

**Files:**
- Modify: `src/main/github/spec.ts` (generateSoulMd function, ~line 53)

**Step 1: Remove SOUL_TEMPLATE constant and scaffolding**

Replace:
```typescript
const SOUL_TEMPLATE = `## Core Values
...
`

export function generateSoulMd(soul: SoulInput): string {
  const description = soul.enhanced ?? soul.userInput
  return `# Soul\n\n${description}\n\n${SOUL_TEMPLATE}`
}
```

With:
```typescript
export function generateSoulMd(soul: SoulInput): string {
  const description = soul.enhanced ?? soul.userInput
  return `# Soul\n\n${description}\n`
}
```

**Step 2: Run tests**

Run: `npx vitest run --config vitest.config.mts`
Expected: Pass (update any test that asserts SOUL_TEMPLATE content)

**Step 3: Commit**

```
fix: strip empty template scaffolding from SOUL.md generation
```

---

### Task 4: Bootstrap feature — DB + constant + ConfigMap + init container

**Files:**
- Modify: `src/main/db.ts` (add bootstrap_instructions column)
- Modify: `src/shared/types.ts` (add bootstrapInstructions to TeamRecord)
- Create: `src/main/specs/bootstrap.ts` (DEFAULT_BOOTSTRAP_INSTRUCTIONS constant)
- Modify: `src/main/specs/index.ts` (resolve bootstrap content, pass to ConfigMap)
- Modify: `src/main/environments/gke/manifests.ts` (add bootstrapInstructionsMd to generateTeamConfigMap, add init container to StatefulSet)
- Modify: `src/main/ipc/teams.ts` (handle bootstrapInstructions in create/update)
- Modify: `src/renderer/src/pages/TeamDetailPage.tsx` (or team settings — add textarea)

**Step 1: Add DB column**

In `src/main/db.ts`, add after the existing ALTER TABLE migrations:
```typescript
try { db.exec('ALTER TABLE teams ADD COLUMN bootstrap_instructions TEXT') } catch { /* column already exists */ }
```

**Step 2: Update TeamRecord in shared/types.ts**

Add `bootstrapInstructions?: string` to TeamRecord.

**Step 3: Create bootstrap constant**

Create `src/main/specs/bootstrap.ts`:
```typescript
export const DEFAULT_BOOTSTRAP_INSTRUCTIONS = `# Bootstrap Instructions

## Environment Setup
- Verify network connectivity and DNS resolution
- Check available disk space on /workspace

## Tool Installation
- Install project dependencies as defined in the team configuration
- Configure git with the agent's identity (name and email from IDENTITY.md)

## Workspace Initialization
- Clone or pull the team repository if configured
- Create working directories under /workspace

## Verification
- Confirm all tools are accessible
- Log bootstrap completion status

## Cleanup
- Remove temporary installation artifacts
- Delete /workspace/BOOTSTRAP.md to signal bootstrap complete
`
```

**Step 4: Update generateTeamConfigMap in manifests.ts**

Add `bootstrapInstructionsMd: string` to the input interface and include it as a ConfigMap key:

Current input:
```typescript
{ teamSlug, namespace, teamJson, agentsMd }
```

New input:
```typescript
{ teamSlug, namespace, teamJson, agentsMd, bootstrapInstructionsMd }
```

Add to the ConfigMap data:
```typescript
'BOOTSTRAP-INSTRUCTIONS.md': bootstrapInstructionsMd
```

**Step 5: Add init container to generateAgentStatefulSet**

Add an `initContainers` array to the pod spec:
```typescript
initContainers: [{
  name: 'bootstrap-init',
  image: 'busybox:1.36',
  command: ['sh', '-c', 'test -f /workspace/BOOTSTRAP.md || cp /config/shared/BOOTSTRAP-INSTRUCTIONS.md /workspace/BOOTSTRAP.md'],
  volumeMounts: [
    { name: 'workspace', mountPath: '/workspace' },
    { name: 'shared-config', mountPath: '/config/shared', readOnly: true },
  ],
}],
```

**Step 6: Wire bootstrap content in specs/index.ts**

In `generateDeploySpecs`, resolve the bootstrap content:
```typescript
import { DEFAULT_BOOTSTRAP_INSTRUCTIONS } from './bootstrap'

// Inside generateDeploySpecs, before the ConfigMap generation:
const bootstrapInstructions = team.bootstrapInstructions || DEFAULT_BOOTSTRAP_INSTRUCTIONS
```

Pass to `generateTeamConfigMap`:
```typescript
files.push({
  path: 'configmap-shared.yaml',
  content: generateTeamConfigMap({
    teamSlug: team.slug,
    namespace,
    teamJson: getContent('team.json'),
    agentsMd: getContent('AGENTS.md'),
    bootstrapInstructionsMd: bootstrapInstructions,
  }),
})
```

**Step 7: Update mapTeamRow in specs/index.ts**

Add:
```typescript
bootstrapInstructions: r.bootstrap_instructions as string | undefined,
```

**Step 8: Update teams IPC handlers**

In `teams:create` and `teams:update`, handle the `bootstrapInstructions` field — store it in the DB column.

**Step 9: Add UI textarea**

In `TeamDetailPage.tsx`, add a "Bootstrap Instructions" section — a textarea that shows the current value (or placeholder showing the default will be used), with a save button that calls `teams:update`.

**Step 10: Run tests**

Run: `npx vitest run --config vitest.config.mts`
Fix any failures from the new ConfigMap key or init container changes.

**Step 11: Commit**

```
feat: add BOOTSTRAP-INSTRUCTIONS.md ConfigMap + init container for agent bootstrapping
```

---

### Task 5: Update existing tests for all changes

**Files:**
- Modify: `src/main/environments/gke/manifests.test.ts`
- Modify: `src/main/github/spec.test.ts`
- Modify: `src/main/ipc/teams.test.ts`
- Modify: `src/main/ipc/deploy.test.ts`

**Step 1: Update manifests tests**

- `generateTeamConfigMap` tests: add `bootstrapInstructionsMd` param
- `generateAgentStatefulSet` tests: assert init container exists with correct command
- Assert `BOOTSTRAP-INSTRUCTIONS.md` key in shared ConfigMap

**Step 2: Update spec.test.ts**

- `generateSoulMd` test: assert no template scaffolding, just `# Soul\n\n{text}\n`

**Step 3: Update teams.test.ts**

- Add test for `bootstrapInstructions` in create and update handlers

**Step 4: Update deploy.test.ts**

- Ensure ConfigMap generation mock includes `bootstrapInstructionsMd`

**Step 5: Run full suite**

Run: `npx vitest run --config vitest.config.mts`
Expected: All pass

**Step 6: Commit**

```
test: update tests for bootstrap feature, model defaults, SOUL.md cleanup
```

---

### Task 6: Clean up .dsquad-specs/ preview directory

**Step 1: Remove preview files**

```bash
rm -rf .dsquad-specs/
```

**Step 2: Verify .gitignore**

Ensure `.dsquad-specs/` won't be committed if recreated.

**Step 3: Final typecheck + test**

Run: `npx tsc --noEmit -p tsconfig.node.json && npx tsc --noEmit -p tsconfig.web.json`
Run: `npx vitest run --config vitest.config.mts`
Expected: All clean

**Step 4: Commit (if .gitignore changed)**

```
chore: clean up preview files
```
