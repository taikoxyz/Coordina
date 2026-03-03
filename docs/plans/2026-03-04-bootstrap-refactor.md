# Bootstrap Feature + Type Consolidation + Fixes

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

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
