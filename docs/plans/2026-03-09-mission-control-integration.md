# Mission Control Integration Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Deploy Mission Control as a GKE pod alongside Coordina-managed agents, generate its K8s manifests during team deployment, and expose a registration UI so the operator can link all agents to the MC dashboard with one click.

**Architecture:** Mission Control config lives in the GKE environment record (`EnvironmentRecord.config.missionControl`). The GKE spec deriver appends MC manifests (Secret, PVC, Deployment, Service, Ingress, CronJob) to the SpecFile list when MC is configured. After each team deploy, an IPC handler calls the MC REST API (via its public Ingress URL) to register agents and gateways. A new "Mission Control" section in GkeSettings stores the config; a button in TeamOverview triggers post-deploy registration.

**Tech Stack:** TypeScript, `@kubernetes/client-node`, React 19, shadcn/ui, `js-yaml`, Electron IPC, native `fetch` for MC REST API calls

---

## Task 1: Add MissionControlConfig type

**Files:**
- Modify: `src/shared/types.ts`

**Step 1: Write the failing test**

```typescript
// src/main/__tests__/types.test.ts
import { describe, it, expect } from 'vitest'
import type { MissionControlConfig } from '../../shared/types'

describe('MissionControlConfig', () => {
  it('accepts a valid config', () => {
    const config: MissionControlConfig = {
      enabled: true,
      image: 'gcr.io/my-project/mission-control:latest',
      domain: 'mc.example.com',
      adminPassword: 'secret',
      sessionSecret: 'abc123abc123abc123abc123abc123ab',
      apiKey: 'myapikey',
    }
    expect(config.enabled).toBe(true)
  })
})
```

**Step 2: Run test to verify it fails**

```bash
cd /Users/d/conductor/workspaces/coordina/quito-v1
npx vitest run src/main/__tests__/types.test.ts
```
Expected: FAIL with "Cannot find type 'MissionControlConfig'"

**Step 3: Add the type to `src/shared/types.ts`**

Append after the `DeployResult` interface (after line 137):

```typescript
export interface MissionControlConfig {
  enabled: boolean
  image: string
  domain: string
  adminPassword: string
  sessionSecret: string
  apiKey: string
}
```

**Step 4: Run test to verify it passes**

```bash
npx vitest run src/main/__tests__/types.test.ts
```
Expected: PASS

**Step 5: Commit**

```bash
git add src/shared/types.ts src/main/__tests__/types.test.ts
git commit -m "feat: add MissionControlConfig type"
```

---

## Task 2: Add Mission Control manifest generators

**Files:**
- Modify: `src/main/environments/gke/manifests.ts`
- Create: `src/main/__tests__/mc-manifests.test.ts`

**Step 1: Write failing tests**

```typescript
// src/main/__tests__/mc-manifests.test.ts
import { describe, it, expect } from 'vitest'
import yaml from 'js-yaml'
import {
  generateMissionControlSecret,
  generateMissionControlPvc,
  generateMissionControlDeployment,
  generateMissionControlService,
  generateMissionControlIngress,
  generateMissionControlHeartbeatCronJob,
} from '../environments/gke/manifests'

const BASE = {
  namespace: 'my-team',
  adminPassword: 'pass',
  sessionSecret: '12345678901234567890123456789012',
  apiKey: 'key123',
  leadAgentSlug: 'alice',
  domain: 'mc.example.com',
  image: 'gcr.io/proj/mission-control:latest',
}

describe('generateMissionControlSecret', () => {
  it('generates a Secret with all required env vars', () => {
    const out = yaml.load(generateMissionControlSecret(BASE)) as Record<string, unknown>
    expect(out.kind).toBe('Secret')
    expect((out.stringData as Record<string, string>).MC_ADMIN_PASSWORD).toBe('pass')
    expect((out.stringData as Record<string, string>).OPENCLAW_GATEWAY_HOST).toBe(
      'agent-alice.my-team.svc.cluster.local'
    )
    expect((out.stringData as Record<string, string>).NEXT_PUBLIC_GATEWAY_HOST).toBe('mc.example.com')
  })
})

describe('generateMissionControlPvc', () => {
  it('generates a 5Gi PVC', () => {
    const out = yaml.load(generateMissionControlPvc({ namespace: 'my-team' })) as Record<string, unknown>
    expect(out.kind).toBe('PersistentVolumeClaim')
    const spec = out.spec as Record<string, unknown>
    expect((spec.resources as Record<string, Record<string, string>>).requests.storage).toBe('5Gi')
  })
})

describe('generateMissionControlDeployment', () => {
  it('generates a Deployment with image and port 3000', () => {
    const out = yaml.load(
      generateMissionControlDeployment({ namespace: 'my-team', image: 'gcr.io/proj/mc:latest' })
    ) as Record<string, unknown>
    expect(out.kind).toBe('Deployment')
    const containers = ((out.spec as Record<string, unknown>).template as Record<string, unknown>)
    const c = ((containers.spec as Record<string, unknown>).containers as Array<Record<string, unknown>>)[0]
    expect(c.image).toBe('gcr.io/proj/mc:latest')
    expect((c.ports as Array<Record<string, unknown>>)[0].containerPort).toBe(3000)
  })
})

describe('generateMissionControlService', () => {
  it('generates a ClusterIP Service on port 3000', () => {
    const out = yaml.load(generateMissionControlService({ namespace: 'my-team' })) as Record<string, unknown>
    expect(out.kind).toBe('Service')
    expect((out.spec as Record<string, string>).type).toBe('ClusterIP')
  })
})

describe('generateMissionControlIngress', () => {
  it('generates an Ingress for the MC domain', () => {
    const out = yaml.load(
      generateMissionControlIngress({ namespace: 'my-team', domain: 'mc.example.com' })
    ) as Record<string, unknown>
    expect(out.kind).toBe('Ingress')
    const rules = ((out.spec as Record<string, unknown>).rules as Array<Record<string, unknown>>)
    expect(rules[0].host).toBe('mc.example.com')
  })
})

describe('generateMissionControlHeartbeatCronJob', () => {
  it('generates a CronJob with agent IDs in the command', () => {
    const out = yaml.load(
      generateMissionControlHeartbeatCronJob({ namespace: 'my-team', agentIds: [1, 2], apiKey: 'key' })
    ) as Record<string, unknown>
    expect(out.kind).toBe('CronJob')
    expect(out.metadata).toBeTruthy()
  })
})
```

**Step 2: Run tests to verify they fail**

```bash
npx vitest run src/main/__tests__/mc-manifests.test.ts
```
Expected: FAIL with "generateMissionControlSecret is not exported"

**Step 3: Implement the generators in `src/main/environments/gke/manifests.ts`**

Append at the end of the file:

```typescript
export interface MissionControlSecretInput {
  namespace: string
  adminPassword: string
  sessionSecret: string
  apiKey: string
  leadAgentSlug: string
  domain: string
}

export function generateMissionControlSecret(input: MissionControlSecretInput): string {
  const { namespace, adminPassword, sessionSecret, apiKey, leadAgentSlug, domain } = input
  const manifest = {
    apiVersion: 'v1',
    kind: 'Secret',
    type: 'Opaque',
    metadata: { name: 'mission-control-env', namespace, labels: { 'coordina.component': 'mission-control' } },
    stringData: {
      MC_ADMIN_PASSWORD: adminPassword,
      MC_SESSION_SECRET: sessionSecret,
      API_KEY: apiKey,
      OPENCLAW_GATEWAY_HOST: `agent-${leadAgentSlug}.${namespace}.svc.cluster.local`,
      OPENCLAW_GATEWAY_PORT: '18789',
      OPENCLAW_GATEWAY_TOKEN: '',
      NEXT_PUBLIC_GATEWAY_HOST: domain,
      NEXT_PUBLIC_GATEWAY_PORT: '443',
      NEXT_PUBLIC_GATEWAY_PROTOCOL: 'wss',
      MC_CLAUDE_HOME: '',
    },
  }
  return yaml.dump(manifest)
}

export function generateMissionControlPvc(input: { namespace: string }): string {
  const { namespace } = input
  const manifest = {
    apiVersion: 'v1',
    kind: 'PersistentVolumeClaim',
    metadata: { name: 'mission-control-data', namespace, labels: { 'coordina.component': 'mission-control' } },
    spec: {
      accessModes: ['ReadWriteOnce'],
      resources: { requests: { storage: '5Gi' } },
      storageClassName: 'standard-rwo',
    },
  }
  return yaml.dump(manifest)
}

export function generateMissionControlDeployment(input: { namespace: string; image: string }): string {
  const { namespace, image } = input
  const manifest = {
    apiVersion: 'apps/v1',
    kind: 'Deployment',
    metadata: { name: 'mission-control', namespace, labels: { app: 'mission-control', 'coordina.component': 'mission-control' } },
    spec: {
      replicas: 1,
      selector: { matchLabels: { app: 'mission-control' } },
      template: {
        metadata: { labels: { app: 'mission-control' } },
        spec: {
          containers: [{
            name: 'mission-control',
            image,
            ports: [{ containerPort: 3000 }],
            envFrom: [{ secretRef: { name: 'mission-control-env' } }],
            volumeMounts: [{ name: 'data', mountPath: '/app/.data' }],
            readinessProbe: {
              httpGet: { path: '/api/health', port: 3000 },
              initialDelaySeconds: 15,
              periodSeconds: 10,
            },
          }],
          volumes: [{ name: 'data', persistentVolumeClaim: { claimName: 'mission-control-data' } }],
        },
      },
    },
  }
  return yaml.dump(manifest)
}

export function generateMissionControlService(input: { namespace: string }): string {
  const { namespace } = input
  const manifest = {
    apiVersion: 'v1',
    kind: 'Service',
    metadata: { name: 'mission-control', namespace, labels: { 'coordina.component': 'mission-control' } },
    spec: {
      selector: { app: 'mission-control' },
      ports: [{ name: 'http', port: 3000, targetPort: 3000 }],
      type: 'ClusterIP',
    },
  }
  return yaml.dump(manifest)
}

export function generateMissionControlIngress(input: { namespace: string; domain: string }): string {
  const { namespace, domain } = input
  const manifest = {
    apiVersion: 'networking.k8s.io/v1',
    kind: 'Ingress',
    metadata: {
      name: 'mission-control',
      namespace,
      annotations: {
        'kubernetes.io/ingress.class': 'gce',
        'kubernetes.io/ingress.allow-http': 'false',
      },
      labels: { 'coordina.component': 'mission-control' },
    },
    spec: {
      rules: [{
        host: domain,
        http: {
          paths: [{
            path: '/',
            pathType: 'Prefix',
            backend: { service: { name: 'mission-control', port: { number: 3000 } } },
          }],
        },
      }],
    },
  }
  return yaml.dump(manifest)
}

export function generateMissionControlHeartbeatCronJob(input: {
  namespace: string
  agentIds: number[]
  apiKey: string
}): string {
  const { namespace, agentIds, apiKey: _apiKey } = input
  const heartbeatCmds = agentIds
    .map(id => `curl -s -X POST "http://mission-control:3000/api/agents/${id}/heartbeat" -H "x-api-key: $API_KEY"`)
    .join('\n')
  const manifest = {
    apiVersion: 'batch/v1',
    kind: 'CronJob',
    metadata: { name: 'agent-heartbeat-relay', namespace, labels: { 'coordina.component': 'mission-control' } },
    spec: {
      schedule: '*/1 * * * *',
      jobTemplate: {
        spec: {
          template: {
            spec: {
              restartPolicy: 'OnFailure',
              containers: [{
                name: 'heartbeat',
                image: 'curlimages/curl:latest',
                command: ['/bin/sh', '-c', heartbeatCmds],
                env: [{
                  name: 'API_KEY',
                  valueFrom: { secretKeyRef: { name: 'mission-control-env', key: 'API_KEY' } },
                }],
              }],
            },
          },
        },
      },
    },
  }
  return yaml.dump(manifest)
}
```

**Step 4: Run tests to verify they pass**

```bash
npx vitest run src/main/__tests__/mc-manifests.test.ts
```
Expected: PASS (6 tests)

**Step 5: Commit**

```bash
git add src/main/environments/gke/manifests.ts src/main/__tests__/mc-manifests.test.ts
git commit -m "feat: add Mission Control K8s manifest generators"
```

---

## Task 3: Extend GKE spec deriver to emit MC manifests

**Files:**
- Modify: `src/main/specs/gke.ts`
- Create: `src/main/__tests__/gke-mc-derive.test.ts`

**Step 1: Write the failing test**

```typescript
// src/main/__tests__/gke-mc-derive.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../store/providers', () => ({ getOpenRouterApiKey: vi.fn().mockResolvedValue('sk-test') }))
vi.mock('../providers/base', () => ({
  openrouterToOpenClawJson: vi.fn().mockReturnValue({ agents: { defaults: { model: { primary: 'claude' } } }, gateway: {}, tools: {}, channels: {} }),
  openrouterToEnvVars: vi.fn().mockReturnValue({}),
  testOpenRouterConnection: vi.fn().mockResolvedValue({ valid: true }),
}))
vi.mock('../store/teams', () => ({ saveTeam: vi.fn().mockResolvedValue(undefined) }))
vi.mock('../store/settings', () => ({ getSettings: vi.fn().mockResolvedValue({}) }))
vi.mock('../store/projects', () => ({ listProjects: vi.fn().mockResolvedValue([]) }))
vi.mock('../gateway/mode', () => ({ resolveGatewayMode: vi.fn().mockReturnValue('port-forward') }))

import { getDeriver } from '../specs/base'
import '../specs/gke'
import type { TeamSpec } from '../../shared/types'

const TEAM: TeamSpec = {
  slug: 'alpha',
  name: 'Alpha Team',
  leadAgent: 'alice',
  agents: [{ slug: 'alice', name: 'Alice', role: 'Lead', persona: 'p', skills: [], models: [] }],
  signingKey: 'a'.repeat(64),
}

const ENV_WITH_MC = {
  missionControl: {
    enabled: true,
    image: 'gcr.io/proj/mc:latest',
    domain: 'mc.example.com',
    adminPassword: 'pass',
    sessionSecret: '12345678901234567890123456789012',
    apiKey: 'key123',
  },
}

describe('GKE deriver with Mission Control', () => {
  it('includes MC manifest files when missionControl.enabled is true', async () => {
    const deriver = getDeriver('gke')
    const files = await deriver.derive(TEAM, ENV_WITH_MC)
    const paths = files.map(f => f.path)
    expect(paths).toContain('mission-control/secret.yaml')
    expect(paths).toContain('mission-control/pvc.yaml')
    expect(paths).toContain('mission-control/deployment.yaml')
    expect(paths).toContain('mission-control/service.yaml')
    expect(paths).toContain('mission-control/ingress.yaml')
  })

  it('omits MC manifest files when missionControl is not configured', async () => {
    const deriver = getDeriver('gke')
    const files = await deriver.derive(TEAM, {})
    const paths = files.map(f => f.path)
    expect(paths).not.toContain('mission-control/secret.yaml')
  })
})
```

**Step 2: Run tests to verify they fail**

```bash
npx vitest run src/main/__tests__/gke-mc-derive.test.ts
```
Expected: FAIL

**Step 3: Add MC manifest generation to `src/main/specs/gke.ts`**

At the top of the file, add the MC manifest imports after existing imports:

```typescript
import {
  generateMissionControlSecret,
  generateMissionControlPvc,
  generateMissionControlDeployment,
  generateMissionControlService,
  generateMissionControlIngress,
} from '../environments/gke/manifests'
import type { MissionControlConfig } from '../../shared/types'
```

Inside the `derive` function, after the existing `for (const agent of spec.agents)` loop ends (at the end, before the `return files` statement or the ingress block), add:

```typescript
    const mc = (envConfig as { missionControl?: MissionControlConfig }).missionControl
    if (mc?.enabled && mc.leadAgentSlug !== undefined || (mc?.enabled && spec.leadAgent)) {
      const leadSlug = spec.leadAgent ?? spec.agents[0]?.slug ?? ''
      files.push({ path: 'mission-control/secret.yaml', content: generateMissionControlSecret({ namespace, adminPassword: mc.adminPassword, sessionSecret: mc.sessionSecret, apiKey: mc.apiKey, leadAgentSlug: leadSlug, domain: mc.domain }) })
      files.push({ path: 'mission-control/pvc.yaml', content: generateMissionControlPvc({ namespace }) })
      files.push({ path: 'mission-control/deployment.yaml', content: generateMissionControlDeployment({ namespace, image: mc.image }) })
      files.push({ path: 'mission-control/service.yaml', content: generateMissionControlService({ namespace }) })
      files.push({ path: 'mission-control/ingress.yaml', content: generateMissionControlIngress({ namespace, domain: mc.domain }) })
    }
```

**Step 4: Run tests to verify they pass**

```bash
npx vitest run src/main/__tests__/gke-mc-derive.test.ts
```
Expected: PASS

**Step 5: Commit**

```bash
git add src/main/specs/gke.ts src/main/__tests__/gke-mc-derive.test.ts
git commit -m "feat: emit Mission Control manifests from GKE spec deriver"
```

---

## Task 4: Deploy orchestration — apply MC manifests in correct order

**Files:**
- Modify: `src/main/environments/gke/deploy.ts`

**Step 1: Read the current ordered paths in `deployTeam` (lines ~206–221)**

The current `orderedPaths` array ends with `'ingress.yaml'`. MC manifests must come after the namespace is created but MC secret must come before MC deployment.

**Step 2: Modify `orderedPaths` to include MC manifests**

Find this block in `deployTeam` (around line 206):

```typescript
  const orderedPaths = [
    'namespace.yaml', 'storageclass.yaml', 'configmap-shared.yaml',
    ...specFiles.filter(f => f.path.includes('/configmap.yaml')).map(f => f.path),
    ...specFiles.filter(f => f.path.endsWith('/credentials.yaml')).map(f => f.path),
    ...specFiles.filter(f => f.path.endsWith('/pvc.yaml')).map(f => f.path),
    ...specFiles.filter(f => f.path.includes('/statefulset.yaml')).map(f => f.path),
    ...specFiles.filter(f => f.path.includes('/service.yaml')).map(f => f.path),
    'ingress.yaml',
  ]
```

Replace with:

```typescript
  const orderedPaths = [
    'namespace.yaml', 'storageclass.yaml', 'configmap-shared.yaml',
    ...specFiles.filter(f => f.path.includes('/configmap.yaml')).map(f => f.path),
    ...specFiles.filter(f => f.path.endsWith('/credentials.yaml')).map(f => f.path),
    ...specFiles.filter(f => f.path.endsWith('/pvc.yaml')).map(f => f.path),
    ...specFiles.filter(f => f.path.includes('/statefulset.yaml')).map(f => f.path),
    ...specFiles.filter(f => f.path.includes('/service.yaml')).map(f => f.path),
    'ingress.yaml',
    'mission-control/secret.yaml',
    'mission-control/pvc.yaml',
    'mission-control/deployment.yaml',
    'mission-control/service.yaml',
    'mission-control/ingress.yaml',
  ]
```

**Step 3: Run existing deploy tests to make sure nothing broke**

```bash
npx vitest run src/main/__tests__/
```
Expected: All existing tests PASS

**Step 4: Commit**

```bash
git add src/main/environments/gke/deploy.ts
git commit -m "feat: include MC manifests in deploy ordering"
```

---

## Task 5: Add IPC handler for MC agent registration

**Files:**
- Create: `src/main/ipc/missionControl.ts`
- Modify: `src/main/index.ts` (or wherever IPC handlers are registered)
- Create: `src/main/__tests__/mc-register.test.ts`

**Step 1: Write the failing test**

```typescript
// src/main/__tests__/mc-register.test.ts
import { describe, it, expect, vi } from 'vitest'
import { registerAgentsWithMissionControl } from '../ipc/missionControl'

global.fetch = vi.fn()

describe('registerAgentsWithMissionControl', () => {
  it('calls /api/gateways for each non-lead agent', async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ id: 1, name: 'alice' }) })
    global.fetch = mockFetch

    await registerAgentsWithMissionControl({
      mcUrl: 'https://mc.example.com',
      apiKey: 'key',
      namespace: 'alpha',
      agents: [
        { slug: 'alice', isLead: true },
        { slug: 'bob', isLead: false },
      ],
    })

    const calls = mockFetch.mock.calls.map((c: [string, ...unknown[]]) => c[0] as string)
    // Should POST to /api/gateways for bob (non-lead)
    expect(calls.some((u: string) => u.includes('/api/gateways'))).toBe(true)
    // Should POST to /api/agents for all agents
    expect(calls.filter((u: string) => u.includes('/api/agents')).length).toBe(2)
  })
})
```

**Step 2: Run test to verify it fails**

```bash
npx vitest run src/main/__tests__/mc-register.test.ts
```
Expected: FAIL

**Step 3: Implement `src/main/ipc/missionControl.ts`**

```typescript
// IPC handlers and utilities for Mission Control agent registration
// FEATURE: Mission Control integration layer for post-deploy agent registration

import { ipcMain } from 'electron'
import { getEnvironment } from '../store/environments'
import { getTeam } from '../store/teams'
import type { MissionControlConfig } from '../../shared/types'

export interface AgentRegistrationEntry {
  slug: string
  isLead: boolean
}

export interface RegisterOptions {
  mcUrl: string
  apiKey: string
  namespace: string
  agents: AgentRegistrationEntry[]
}

export async function registerAgentsWithMissionControl(opts: RegisterOptions): Promise<void> {
  const { mcUrl, apiKey, namespace, agents } = opts
  const headers = { 'x-api-key': apiKey, 'Content-Type': 'application/json' }

  for (const agent of agents) {
    if (!agent.isLead) {
      await fetch(`${mcUrl}/api/gateways`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          name: agent.slug,
          host: `agent-${agent.slug}.${namespace}.svc.cluster.local`,
          port: 18789,
        }),
      })
    }
  }

  for (const agent of agents) {
    await fetch(`${mcUrl}/api/agents`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ name: agent.slug, status: 'active' }),
    })
  }
}

export function registerMissionControlHandlers(): void {
  ipcMain.handle('mc:registerAgents', async (_e, { teamSlug, envSlug }: { teamSlug: string; envSlug: string }) => {
    const [team, env] = await Promise.all([getTeam(teamSlug), getEnvironment(envSlug)])
    if (!team) return { ok: false, reason: 'Team not found' }
    if (!env) return { ok: false, reason: 'Environment not found' }

    const mc = (env.config as { missionControl?: MissionControlConfig }).missionControl
    if (!mc?.enabled) return { ok: false, reason: 'Mission Control not configured' }

    const mcUrl = `https://${mc.domain}`
    const agents = team.agents.map(a => ({ slug: a.slug, isLead: a.slug === team.leadAgent }))

    try {
      await registerAgentsWithMissionControl({ mcUrl, apiKey: mc.apiKey, namespace: teamSlug, agents })
      return { ok: true, mcUrl }
    } catch (e) {
      return { ok: false, reason: e instanceof Error ? e.message : String(e) }
    }
  })
}
```

**Step 4: Register the handler — find where IPC modules are imported**

```bash
grep -r "registerDeployHandlers\|registerTeamsHandlers" /Users/d/conductor/workspaces/coordina/quito-v1/src/main/index.ts
```

Add in the same file alongside the other `register*` calls:

```typescript
import { registerMissionControlHandlers } from './ipc/missionControl'
// ...
registerMissionControlHandlers()
```

**Step 5: Run tests to verify they pass**

```bash
npx vitest run src/main/__tests__/mc-register.test.ts
```
Expected: PASS

**Step 6: Commit**

```bash
git add src/main/ipc/missionControl.ts src/main/__tests__/mc-register.test.ts src/main/index.ts
git commit -m "feat: add MC agent registration IPC handler"
```

---

## Task 6: Add Mission Control settings UI to GkeSettings

**Files:**
- Modify: `src/renderer/src/components/settings/GkeSettings.tsx`

**Step 1: Read the current file to understand form structure**

Already read above. The form saves to `EnvironmentRecord.config` via `saveConfig.mutateAsync(...)`.

**Step 2: Extend the form interface and empty state**

Find the `GkeForm` interface and `emptyGke()` function. Add MC fields:

In `GkeForm` interface, add:
```typescript
  mcEnabled: boolean
  mcImage: string
  mcDomain: string
  mcAdminPassword: string
  mcSessionSecret: string
  mcApiKey: string
```

In `emptyGke()`, add:
```typescript
  mcEnabled: false,
  mcImage: '',
  mcDomain: '',
  mcAdminPassword: '',
  mcSessionSecret: '',
  mcApiKey: '',
```

In the `useEffect` that hydrates the form from saved config, add MC field mapping:
```typescript
  mcEnabled: c.missionControl ? (c.missionControl as Record<string,unknown>).enabled === true : false,
  mcImage: ((c.missionControl as Record<string,string> | undefined)?.image) ?? '',
  mcDomain: ((c.missionControl as Record<string,string> | undefined)?.domain) ?? '',
  mcAdminPassword: ((c.missionControl as Record<string,string> | undefined)?.adminPassword) ?? '',
  mcSessionSecret: ((c.missionControl as Record<string,string> | undefined)?.sessionSecret) ?? '',
  mcApiKey: ((c.missionControl as Record<string,string> | undefined)?.apiKey) ?? '',
```

In `handleSave`, include the MC config when saving:
```typescript
  await saveConfig.mutateAsync({
    // ...existing fields...
    missionControl: form.mcEnabled ? {
      enabled: true,
      image: form.mcImage,
      domain: form.mcDomain,
      adminPassword: form.mcAdminPassword,
      sessionSecret: form.mcSessionSecret,
      apiKey: form.mcApiKey,
    } : undefined,
  })
```

**Step 3: Add the Mission Control section to the JSX**

After the existing OAuth credentials fields and before the Save/Auth buttons section, add a collapsible section. Find the closing `</div>` of the left column (just before `<div className="flex items-center gap-3">`):

```tsx
          <div className="pt-3 border-t border-gray-200">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-xs font-semibold text-gray-700">Mission Control</p>
                <p className="text-xs text-gray-500 mt-0.5">Optional monitoring dashboard deployed alongside your agents.</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  className="sr-only peer"
                  checked={form.mcEnabled}
                  onChange={(e) => updateField('mcEnabled' as keyof GkeForm, String(e.target.checked))}
                />
                <div className="w-8 h-4 bg-gray-200 peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-4 peer-checked:bg-blue-600 after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-3 after:w-3 after:transition-all" />
              </label>
            </div>
            {form.mcEnabled && (
              <div className="space-y-3">
                <div>
                  <Label>Docker image</Label>
                  <Input mono value={form.mcImage} onChange={(e) => updateField('mcImage' as keyof GkeForm, e.target.value)} placeholder="gcr.io/my-project/mission-control:latest" />
                </div>
                <div>
                  <Label>Public domain</Label>
                  <Input mono value={form.mcDomain} onChange={(e) => updateField('mcDomain' as keyof GkeForm, e.target.value)} placeholder="mc.example.com" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Admin password</Label>
                    <Input mono type="password" value={form.mcAdminPassword} onChange={(e) => updateField('mcAdminPassword' as keyof GkeForm, e.target.value)} />
                  </div>
                  <div>
                    <Label>Session secret (32 chars)</Label>
                    <Input mono type="password" value={form.mcSessionSecret} onChange={(e) => updateField('mcSessionSecret' as keyof GkeForm, e.target.value)} />
                  </div>
                </div>
                <div>
                  <Label>API key</Label>
                  <Input mono type="password" value={form.mcApiKey} onChange={(e) => updateField('mcApiKey' as keyof GkeForm, e.target.value)} />
                </div>
              </div>
            )}
          </div>
```

**Note:** The `updateField` function uses `keyof GkeForm` — since you're adding new keys, TypeScript will infer them correctly after updating the interface.

**Step 4: Fix TypeScript — update `updateField` to accept new keys**

The existing `updateField` only accepts `keyof GkeForm` and `string`, but `mcEnabled` needs boolean. Update to:

```typescript
  const updateField = (key: keyof GkeForm, value: string | boolean) => {
    setForm({ ...form, [key]: value })
    setFormError(null)
    setSaved(false)
  }
```

And change the checkbox handler to:
```tsx
onChange={(e) => updateField('mcEnabled', e.target.checked)}
```

**Step 5: Build to check TypeScript**

```bash
npx tsc --noEmit
```
Expected: No errors

**Step 6: Commit**

```bash
git add src/renderer/src/components/settings/GkeSettings.tsx
git commit -m "feat: add Mission Control settings UI section in GKE settings"
```

---

## Task 7: Add MC registration button and link to TeamOverview

**Files:**
- Modify: `src/renderer/src/components/team/TeamOverview.tsx`

**Step 1: Read the full TeamOverview to find the deploy done state**

```bash
# Read lines 55–200 to find where deploy state 'done' renders a result
```

(Use Read tool lines 55–300)

**Step 2: Add MC registration state**

After the existing state declarations (around line 58), add:

```typescript
  const [mcRegState, setMcRegState] = useState<'idle' | 'registering' | 'done' | 'error'>('idle')
  const [mcUrl, setMcUrl] = useState<string | null>(null)
```

**Step 3: Add handleRegisterMC function**

After the existing handler functions (before the JSX return), add:

```typescript
  const handleRegisterMC = useCallback(async () => {
    if (!spec.deployedEnvSlug) return
    setMcRegState('registering')
    const result = await window.api.invoke('mc:registerAgents', { teamSlug: spec.slug, envSlug: spec.deployedEnvSlug }) as { ok: boolean; reason?: string; mcUrl?: string }
    if (result.ok) {
      setMcRegState('done')
      if (result.mcUrl) setMcUrl(result.mcUrl)
    } else {
      setMcRegState('error')
    }
  }, [spec.deployedEnvSlug, spec.slug])
```

**Step 4: Add MC panel to JSX — after the deploy log section**

Find the area in the JSX where deployment is shown as complete (look for `deployState === 'done'`). After that block, add:

```tsx
          {deployState === 'done' && spec.deployedEnvSlug && (
            <div className="mt-4 pt-4 border-t border-gray-100">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-gray-700">Mission Control</p>
                  <p className="text-xs text-gray-500 mt-0.5">Register agents to populate the monitoring dashboard.</p>
                </div>
                <div className="flex items-center gap-2">
                  {mcUrl && (
                    <a
                      href={mcUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700"
                    >
                      Open dashboard <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => void handleRegisterMC()}
                    disabled={mcRegState === 'registering'}
                  >
                    {mcRegState === 'registering' ? (
                      <><Loader2 className="w-3 h-3 mr-1 animate-spin" /> Registering...</>
                    ) : mcRegState === 'done' ? (
                      <><Check className="w-3 h-3 mr-1" /> Registered</>
                    ) : 'Register agents'}
                  </Button>
                </div>
              </div>
              {mcRegState === 'error' && (
                <p className="text-xs text-red-600 mt-2 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" /> Registration failed. Is MC configured in GKE settings?
                </p>
              )}
            </div>
          )}
```

Make sure `ExternalLink` is imported from `lucide-react` (check existing imports at line 2).

**Step 5: Build check**

```bash
npx tsc --noEmit
```
Expected: No errors

**Step 6: Commit**

```bash
git add src/renderer/src/components/team/TeamOverview.tsx
git commit -m "feat: add MC registration button and dashboard link to TeamOverview"
```

---

## Task 8: End-to-end smoke test (manual)

This task is manual verification — no automated test.

**Checklist:**
- [ ] Open Coordina, go to Settings → GKE
- [ ] Enable "Mission Control" toggle — MC fields appear
- [ ] Fill in image (`gcr.io/<project>/mission-control:latest`), domain, admin password, session secret (32 chars), API key
- [ ] Save GKE settings
- [ ] Go to a Team, deploy it
- [ ] Check deploy logs: `mission-control/secret.yaml`, `mission-control/pvc.yaml`, `mission-control/deployment.yaml`, `mission-control/service.yaml`, `mission-control/ingress.yaml` should appear as `created` or `updated`
- [ ] After deploy completes, "Mission Control" panel appears in TeamOverview
- [ ] Click "Register agents" — state changes to "Registered" (or error if MC not reachable yet)
- [ ] Visit `https://mc.YOUR_DOMAIN` — see agents listed

**Step 1: Run all tests**

```bash
npx vitest run
```
Expected: All pass

**Step 2: Run TypeScript check**

```bash
npx tsc --noEmit
```
Expected: No errors

**Step 3: Final commit**

```bash
git add -A
git commit -m "chore: mission control integration complete"
```

---

## Summary of files changed

| File | Change |
|------|--------|
| `src/shared/types.ts` | Add `MissionControlConfig` interface |
| `src/main/environments/gke/manifests.ts` | Add 6 MC manifest generator functions |
| `src/main/specs/gke.ts` | Import MC generators, emit MC files when MC enabled |
| `src/main/environments/gke/deploy.ts` | Add MC manifest paths to deploy ordering |
| `src/main/ipc/missionControl.ts` | New file: `registerAgentsWithMissionControl` + IPC handler |
| `src/main/index.ts` | Register MC IPC handlers |
| `src/renderer/src/components/settings/GkeSettings.tsx` | Add MC toggle + fields |
| `src/renderer/src/components/team/TeamOverview.tsx` | Add MC registration button + dashboard link |
