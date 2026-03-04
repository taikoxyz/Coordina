# Research: Application Architecture

> Status: March 2026
> Covers: Module system, plugin pattern, source tree, interface definitions, schema-driven forms

---

## Core Principle: Registry + Interface Pattern

Both Model Providers and Deployment Environments follow the same architectural pattern:

1. **Define an interface** — the contract every module must satisfy
2. **Implement the interface** — one file per provider or environment type
3. **Register in a registry** — modules declare themselves at startup
4. **Core reads from registry** — the app never imports modules directly; it looks them up by ID

This means the core application logic has **zero knowledge** of specific providers or environments. Adding or removing a provider/environment is surgical — one file, one registry entry, done.

---

## Source Tree

```
src/
├── main/                        # Electron main process (Node.js)
│   ├── index.ts                 # App entry point
│   ├── ipc/                     # IPC handlers (bridge to renderer)
│   │   ├── providers.ts
│   │   ├── environments.ts
│   │   ├── teams.ts
│   │   └── agents.ts
│   ├── providers/               # Model Provider modules
│   │   ├── base.ts              # ModelProvider interface + registry
│   │   ├── anthropic.ts
│   │   ├── openai.ts
│   │   ├── deepseek.ts
│   │   ├── ollama.ts
│   │   ├── openrouter.ts
│   │   └── index.ts             # Registers all providers
│   ├── environments/            # Deployment Environment modules
│   │   ├── base.ts              # DeploymentEnvironment interface + registry
│   │   ├── gke/
│   │   │   ├── index.ts         # GKE module entry (implements interface)
│   │   │   ├── auth.ts          # Google OAuth + service account JSON
│   │   │   ├── deploy.ts        # Helm + K8s operator invocation
│   │   │   ├── ingress.ts       # Ingress + IAP BackendConfig generation
│   │   │   └── manifests.ts     # Kubernetes manifest generation
│   │   └── index.ts             # Registers all environments
│   ├── github/                  # GitHub integration (team spec git ops)
│   │   ├── client.ts            # Octokit wrapper
│   │   ├── repo.ts              # Repo creation, commit, push
│   │   └── auth.ts              # GitHub OAuth flow
│   ├── gateway/                 # Agent gateway proxy
│   │   ├── proxy.ts             # HTTP/WebSocket proxy with auth injection
│   │   └── auth.ts              # Google ID token refresh logic
│   ├── keychain.ts              # OS keychain wrapper (keytar)
│   ├── db.ts                    # SQLite local cache (better-sqlite3)
│   └── server.ts                # Local Express server
│
├── renderer/                    # React frontend
│   ├── components/
│   │   ├── forms/
│   │   │   ├── SchemaForm.tsx   # Generic schema-driven form renderer
│   │   │   └── fields/          # Individual field components
│   │   ├── teams/
│   │   ├── agents/
│   │   ├── providers/
│   │   └── environments/
│   ├── pages/
│   ├── store/                   # Zustand stores
│   └── hooks/                   # React Query hooks
│
└── shared/                      # Types shared between main + renderer
    ├── types.ts
    └── schemas.ts
```

---

## Interface: ModelProvider

```typescript
// src/main/providers/base.ts

export interface ValidationResult {
  valid: boolean
  errors?: string[]
}

export interface OpenClawModelConfig {
  provider: string
  model: string
  apiKey?: string
  baseUrl?: string
  [key: string]: unknown
}

export interface ModelProvider {
  /** Unique identifier, e.g. "anthropic" */
  id: string

  /** Human-readable name shown in the UI */
  displayName: string

  /**
   * JSON Schema for the provider's configuration form.
   * The frontend SchemaForm component renders this automatically.
   * No provider-specific form code in the frontend.
   */
  configSchema: object

  /** Models the user can select for this provider */
  supportedModels: { id: string; displayName: string }[]

  /** Validate the provider config before saving */
  validate(config: unknown): ValidationResult

  /**
   * Convert Coordina's config shape to the openclaw.json format
   * that gets written into the agent's workspace.
   */
  toOpenClawJson(config: unknown): OpenClawModelConfig
}

// Registry
const registry = new Map<string, ModelProvider>()

export function registerProvider(p: ModelProvider): void {
  registry.set(p.id, p)
}

export function getProvider(id: string): ModelProvider {
  const p = registry.get(id)
  if (!p) throw new Error(`Unknown model provider: ${id}`)
  return p
}

export function listProviders(): ModelProvider[] {
  return [...registry.values()]
}
```

### Example implementation: Anthropic

```typescript
// src/main/providers/anthropic.ts

import { ModelProvider, registerProvider } from './base'

const anthropic: ModelProvider = {
  id: 'anthropic',
  displayName: 'Anthropic',

  configSchema: {
    type: 'object',
    required: ['apiKey', 'model'],
    properties: {
      apiKey: {
        type: 'string',
        title: 'API Key',
        description: 'Your Anthropic API key (sk-ant-...)',
        format: 'password',
      },
      model: {
        type: 'string',
        title: 'Model',
        enum: ['claude-opus-4-6', 'claude-sonnet-4-6', 'claude-haiku-4-5-20251001'],
        default: 'claude-sonnet-4-6',
      },
    },
  },

  supportedModels: [
    { id: 'claude-opus-4-6', displayName: 'Claude Opus 4.6' },
    { id: 'claude-sonnet-4-6', displayName: 'Claude Sonnet 4.6' },
    { id: 'claude-haiku-4-5-20251001', displayName: 'Claude Haiku 4.5' },
  ],

  validate(config) {
    const c = config as { apiKey?: string; model?: string }
    if (!c.apiKey?.startsWith('sk-ant-')) {
      return { valid: false, errors: ['API key must start with sk-ant-'] }
    }
    return { valid: true }
  },

  toOpenClawJson(config) {
    const c = config as { apiKey: string; model: string }
    return { provider: 'anthropic', model: c.model, apiKey: c.apiKey }
  },
}

registerProvider(anthropic)
```

Adding OpenAI = copy the file, change id/displayName/schema/models/toOpenClawJson. Zero changes elsewhere.

---

## Interface: DeploymentEnvironment

```typescript
// src/main/environments/base.ts

export interface AuthCredential {
  type: 'oauth' | 'serviceaccount'
  token?: string
  refreshToken?: string
  keyJson?: string
  projectId: string
  clusterName: string
  clusterRegion: string
}

export interface DeployResult {
  success: boolean
  gatewayUrl: string
  errors?: string[]
}

export interface EnvironmentStatus {
  state: 'deployed' | 'deploying' | 'undeployed' | 'error'
  agentStatuses: { slug: string; state: 'running' | 'pending' | 'crashed' }[]
}

export interface Manifest {
  filename: string
  content: string  // YAML string
}

export interface TeamSpec {
  slug: string
  agents: AgentSpec[]
  leadAgentSlug: string
}

export interface DeploymentEnvironment {
  /** Unique identifier, e.g. "gke" */
  id: string

  /** Human-readable name shown in the UI */
  displayName: string

  /**
   * JSON Schema for the environment's setup wizard.
   * SchemaForm renders this automatically — no env-specific form code.
   */
  configSchema: object

  /** Available authentication methods for this environment type */
  authMethods: { id: string; displayName: string }[]

  validate(config: unknown): ValidationResult

  /** Run the auth flow (OAuth redirect or file upload) and return credential */
  setupAuth(config: unknown): Promise<AuthCredential>

  /** Apply the team spec to the environment */
  deploy(spec: TeamSpec, credential: AuthCredential): Promise<DeployResult>

  /** Tear down all pods and PVCs */
  undeploy(spec: TeamSpec, credential: AuthCredential): Promise<void>

  /** Poll current deployment status */
  getStatus(credential: AuthCredential): Promise<EnvironmentStatus>

  /**
   * Generate all Kubernetes manifests (StatefulSets, Services, Ingress,
   * IAP BackendConfig, etc.) for the team spec.
   * These are committed to the team spec repo under deploy/helm/
   */
  generateManifests(spec: TeamSpec, config: unknown): Manifest[]
}

// Registry
const registry = new Map<string, DeploymentEnvironment>()

export function registerEnvironment(e: DeploymentEnvironment): void {
  registry.set(e.id, e)
}

export function getEnvironment(id: string): DeploymentEnvironment {
  const e = registry.get(id)
  if (!e) throw new Error(`Unknown environment type: ${id}`)
  return e
}

export function listEnvironments(): DeploymentEnvironment[] {
  return [...registry.values()]
}
```

### GKE module structure

The GKE module is the most complex — it's split across several files within `src/main/environments/gke/`, all composed in `index.ts`:

```typescript
// src/main/environments/gke/index.ts

import { DeploymentEnvironment, registerEnvironment } from '../base'
import { setupGoogleOAuth, setupServiceAccount } from './auth'
import { deployTeam, undeployTeam, getDeploymentStatus } from './deploy'
import { generateGkeManifests } from './manifests'

const gke: DeploymentEnvironment = {
  id: 'gke',
  displayName: 'Google Kubernetes Engine',
  authMethods: [
    { id: 'oauth', displayName: 'Google OAuth (recommended)' },
    { id: 'serviceaccount', displayName: 'Service Account JSON' },
  ],
  configSchema: { /* project, cluster, region, authMethod */ },
  validate: (c) => { /* ... */ },
  setupAuth: (c) => c.authMethod === 'oauth' ? setupGoogleOAuth(c) : setupServiceAccount(c),
  deploy: deployTeam,
  undeploy: undeployTeam,
  getStatus: getDeploymentStatus,
  generateManifests: generateGkeManifests,
}

registerEnvironment(gke)
```

Adding AWS EKS later:
```
src/main/environments/
  ├── base.ts
  ├── gke/
  │   └── ...
  ├── eks/                 ← NEW: one directory, one registration
  │   ├── index.ts
  │   ├── auth.ts          # AWS IAM / OIDC
  │   ├── deploy.ts        # eksctl / AWS SDK
  │   └── manifests.ts
  └── index.ts             # add: import './eks'
```

Zero changes to `base.ts`, forms, routing, or any other module.

---

## Schema-Driven Forms

The frontend `SchemaForm` component accepts a JSON Schema and renders the appropriate form fields. No provider or environment has its own React component.

```
ModelProvider.configSchema  ──►  SchemaForm  ──►  rendered form
DeploymentEnvironment.configSchema  ──►  SchemaForm  ──►  wizard steps
```

Field types are derived from the JSON Schema:
- `type: string` → `<input type="text">`
- `type: string, format: password` → `<input type="password">`
- `type: string, enum: [...]` → `<select>`
- `type: boolean` → `<input type="checkbox">`
- `type: string, format: file` → file picker

This means the form UI automatically adapts when a new module is added — no frontend code required.

---

## Adding a New Provider (Checklist)

1. Create `src/main/providers/<name>.ts`
2. Implement `ModelProvider` interface
3. Call `registerProvider(...)` at the bottom
4. Add `import './<name>'` to `src/main/providers/index.ts`
5. Done — UI picks it up automatically

## Adding a New Deployment Environment (Checklist)

1. Create `src/main/environments/<name>/` directory
2. Implement `DeploymentEnvironment` interface in `index.ts`
3. Split auth, deploy, undeploy, manifest generation into separate files as needed
4. Call `registerEnvironment(...)` in `index.ts`
5. Add `import './<name>'` to `src/main/environments/index.ts`
6. Done — wizard, forms, and deployment flow pick it up automatically

---

## Key Libraries

| Purpose | Library |
|---------|---------|
| GKE API | `@google-cloud/container` |
| GitHub API | `octokit` |
| OS keychain | `keytar` |
| SQLite | `better-sqlite3` |
| HTTP proxy | `http-proxy-middleware` |
| JSON Schema forms | `react-jsonschema-form` or custom `SchemaForm` |
| State (client) | `zustand` |
| State (server) | `@tanstack/react-query` |
| Kubernetes YAML | `js-yaml` |
| Helm | shell out to `helm` CLI |
