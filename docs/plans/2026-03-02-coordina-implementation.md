# Coordina Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build Coordina — a macOS Electron app that lets admins compose, configure, and deploy teams of OpenClaw AI agents to GKE via a form-driven UI, with no YAML editing or Kubernetes knowledge required.

**Architecture:** Electron shell with a React+Tailwind renderer; a local Express server in the main process handles GitHub/GKE API calls, OS keychain access, and proxying to deployed agent gateways. Model Providers and Deployment Environments are independent plug-in modules registered at startup. Team specs live in GitHub; agent runtime state lives in named GCP persistent disks.

**Tech Stack:** Electron 30, React 18, TypeScript 5, Vite 5, Tailwind CSS 4, Express, octokit, @google-cloud/container, keytar, better-sqlite3, Zustand, TanStack Query, Zod, js-yaml, Vitest

---

## Pre-work: Fix PRODUCT.md

### Task 0: Patch stale content in PRODUCT.md

**Files:**
- Modify: `PRODUCT.md`

**Step 1:** Update User Flow #5 "Undeploy a Team" — replace the old "permanently delete runtime data" description with the current soft-undeploy semantics (pods deleted, PVCs kept).

Old text to replace:
```
2. Confirmation dialog: "This will destroy all agent pods and permanently delete their runtime data. This cannot be undone. The team spec remains in GitHub."
3. Confirm → app tears down all pods and PVCs in the environment
4. Team is now undeployed and can be redeployed to any environment
```

New text:
```
2. Confirmation dialog: "This will stop all agent pods. Their memory and runtime data will be preserved on disk. The team can be redeployed to the same environment to resume where it left off."
3. Confirm → app deletes StatefulSets, Services, and Ingress; PVCs and GCP disks are kept
4. Team is now undeployed; redeploy to same environment reattaches existing disks
```

**Step 2:** Remove the duplicate `---` separator before "Research Files" (lines 422–424 currently show `---\n\n---`).

**Step 3:** Commit
```bash
git add PRODUCT.md
git commit -m "fix: update undeploy flow to reflect soft-undeploy (keep PVCs)"
```

---

## Phase 1: Project Scaffold

### Task 1: Initialize Electron + Vite + React + TypeScript project

**Files:**
- Create: `package.json`
- Create: `vite.config.ts`
- Create: `electron-builder.yml`
- Create: `tsconfig.json`
- Create: `tsconfig.main.json`
- Create: `src/main/index.ts`
- Create: `src/renderer/index.html`
- Create: `src/renderer/main.tsx`
- Create: `src/renderer/App.tsx`
- Create: `src/shared/types.ts`

**Step 1:** Scaffold with electron-vite template
```bash
npm create @quick-start/electron@latest coordina -- --template react-ts
cd coordina
npm install
```

**Step 2:** Add core dependencies
```bash
npm install express better-sqlite3 keytar js-yaml zod @octokit/rest @google-cloud/container zustand @tanstack/react-query @anthropic-ai/sdk
npm install -D @types/express @types/better-sqlite3 @types/js-yaml vitest @vitest/ui happy-dom
```

**Step 3:** Verify dev mode starts
```bash
npm run dev
```
Expected: Electron window opens showing "Hello World"

**Step 4:** Commit
```bash
git add .
git commit -m "feat: initialize Electron+Vite+React+TypeScript project scaffold"
```

---

### Task 2: IPC bridge + local Express server skeleton

**Files:**
- Create: `src/main/server.ts`
- Create: `src/main/ipc/index.ts`
- Create: `src/preload/index.ts`
- Modify: `src/main/index.ts`

**Step 1:** Write test for server startup
```typescript
// src/main/server.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import { createServer } from './server'

describe('local server', () => {
  let app: ReturnType<typeof createServer>
  beforeAll(() => { app = createServer() })

  it('GET /health returns 200', async () => {
    const res = await request(app).get('/health')
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
  })
})
```

**Step 2:** Run test — expect FAIL
```bash
npx vitest run src/main/server.test.ts
```

**Step 3:** Implement minimal server
```typescript
// src/main/server.ts
import express from 'express'

export function createServer() {
  const app = express()
  app.use(express.json())
  app.get('/health', (_req, res) => res.json({ ok: true }))
  return app
}
```

**Step 4:** Run test — expect PASS
```bash
npx vitest run src/main/server.test.ts
```

**Step 5:** Wire server into Electron main process and expose IPC bridge in preload

```typescript
// src/main/index.ts (additions)
import { createServer } from './server'
const server = createServer()
server.listen(19876, '127.0.0.1')
```

```typescript
// src/preload/index.ts
import { contextBridge, ipcRenderer } from 'electron'
contextBridge.exposeInMainWorld('api', {
  invoke: (channel: string, ...args: unknown[]) => ipcRenderer.invoke(channel, ...args),
})
```

**Step 6:** Commit
```bash
git add .
git commit -m "feat: add local Express server and IPC preload bridge"
```

---

### Task 3: SQLite database setup

**Files:**
- Create: `src/main/db.ts`
- Create: `src/main/db.test.ts`

**Step 1:** Write test
```typescript
// src/main/db.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { openDb } from './db'

describe('database', () => {
  it('opens and runs migrations', () => {
    const db = openDb(':memory:')
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all()
    const names = tables.map((t: any) => t.name)
    expect(names).toContain('app_settings')
    expect(names).toContain('providers')
    expect(names).toContain('environments')
    expect(names).toContain('teams')
  })
})
```

**Step 2:** Run test — expect FAIL

**Step 3:** Implement
```typescript
// src/main/db.ts
import Database from 'better-sqlite3'

export function openDb(path: string) {
  const db = new Database(path)
  db.exec(`
    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL  -- JSON
    );
    CREATE TABLE IF NOT EXISTS providers (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      name TEXT NOT NULL,
      config TEXT NOT NULL  -- JSON
    );
    CREATE TABLE IF NOT EXISTS environments (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      name TEXT NOT NULL,
      config TEXT NOT NULL,  -- JSON (non-secret)
      used INTEGER DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS teams (
      slug TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      github_repo TEXT,
      lead_agent_slug TEXT,
      config TEXT NOT NULL  -- JSON
    );
  `)
  return db
}
```

**Step 4:** Run test — expect PASS

**Step 5:** Commit
```bash
git add .
git commit -m "feat: add SQLite database with schema migrations"
```

---

### Task 4: Keychain wrapper

**Files:**
- Create: `src/main/keychain.ts`
- Create: `src/main/keychain.test.ts`

**Step 1:** Write test
```typescript
// src/main/keychain.test.ts
import { describe, it, expect } from 'vitest'
import { setSecret, getSecret, deleteSecret } from './keychain'

describe('keychain', () => {
  it('stores and retrieves a secret', async () => {
    await setSecret('test-service', 'test-key', 'secret-value')
    const val = await getSecret('test-service', 'test-key')
    expect(val).toBe('secret-value')
    await deleteSecret('test-service', 'test-key')
  })
})
```

**Step 2:** Run test — expect FAIL

**Step 3:** Implement
```typescript
// src/main/keychain.ts
import keytar from 'keytar'
const SERVICE = 'coordina'

export const setSecret = (account: string, key: string, value: string) =>
  keytar.setPassword(`${SERVICE}:${key}`, account, value)

export const getSecret = (account: string, key: string) =>
  keytar.getPassword(`${SERVICE}:${key}`, account)

export const deleteSecret = (account: string, key: string) =>
  keytar.deletePassword(`${SERVICE}:${key}`, account)
```

**Step 4:** Run test — expect PASS

**Step 5:** Commit
```bash
git add .
git commit -m "feat: add OS keychain wrapper for secrets storage"
```

---

### Task 5: Basic app shell with navigation

**Files:**
- Create: `src/renderer/components/Sidebar.tsx`
- Create: `src/renderer/pages/TeamsPage.tsx`
- Create: `src/renderer/pages/ProvidersPage.tsx`
- Create: `src/renderer/pages/EnvironmentsPage.tsx`
- Create: `src/renderer/pages/SettingsPage.tsx`
- Modify: `src/renderer/App.tsx`

**Step 1:** Implement navigation shell with Zustand router
```typescript
// src/renderer/store/nav.ts
import { create } from 'zustand'
type Page = 'teams' | 'providers' | 'environments' | 'settings'
interface NavStore { page: Page; setPage: (p: Page) => void }
export const useNav = create<NavStore>(set => ({
  page: 'teams',
  setPage: page => set({ page }),
}))
```

**Step 2:** Build sidebar and page stubs, wire up in App.tsx

**Step 3:** Run dev and verify navigation works visually
```bash
npm run dev
```

**Step 4:** Commit
```bash
git add .
git commit -m "feat: add navigation shell with sidebar and page stubs"
```

---

## Phase 2: Module Registry (Providers + Environments)

### Task 6: ModelProvider interface and registry

**Files:**
- Create: `src/main/providers/base.ts`
- Create: `src/main/providers/base.test.ts`

**Step 1:** Write test
```typescript
// src/main/providers/base.test.ts
import { describe, it, expect } from 'vitest'
import { registerProvider, getProvider, listProviders } from './base'

describe('provider registry', () => {
  it('registers and retrieves a provider', () => {
    registerProvider({ id: 'test', displayName: 'Test', configSchema: {}, supportedModels: [],
      validate: () => ({ valid: true }),
      toOpenClawJson: (c: any) => ({ provider: 'test', model: c.model }) })
    expect(getProvider('test').displayName).toBe('Test')
    expect(listProviders().some(p => p.id === 'test')).toBe(true)
  })

  it('throws on unknown provider', () => {
    expect(() => getProvider('nonexistent')).toThrow('Unknown model provider: nonexistent')
  })
})
```

**Step 2:** Run test — expect FAIL

**Step 3:** Implement interface + registry (see `research/05-architecture.md` for full interface definition)

**Step 4:** Run test — expect PASS

**Step 5:** Commit
```bash
git add .
git commit -m "feat: add ModelProvider interface and registry"
```

---

### Task 7: Built-in provider implementations

**Files:**
- Create: `src/main/providers/anthropic.ts`
- Create: `src/main/providers/openai.ts`
- Create: `src/main/providers/deepseek.ts`
- Create: `src/main/providers/ollama.ts`
- Create: `src/main/providers/openrouter.ts`
- Create: `src/main/providers/index.ts`
- Create: `src/main/providers/providers.test.ts`

**Step 1:** Write tests for each provider's validate() and toOpenClawJson()
```typescript
// src/main/providers/providers.test.ts
import './index'  // registers all providers
import { getProvider } from './base'

it('anthropic validates API key prefix', () => {
  const p = getProvider('anthropic')
  expect(p.validate({ apiKey: 'sk-ant-abc', model: 'claude-sonnet-4-6' }).valid).toBe(true)
  expect(p.validate({ apiKey: 'wrong', model: 'claude-sonnet-4-6' }).valid).toBe(false)
})

it('anthropic toOpenClawJson maps correctly', () => {
  const p = getProvider('anthropic')
  const out = p.toOpenClawJson({ apiKey: 'sk-ant-abc', model: 'claude-sonnet-4-6' })
  expect(out).toEqual({ provider: 'anthropic', model: 'claude-sonnet-4-6', apiKey: 'sk-ant-abc' })
})
```

**Step 2:** Run tests — expect FAIL

**Step 3:** Implement all 5 providers following the Anthropic pattern in `research/05-architecture.md`

**Step 4:** Run tests — expect PASS

**Step 5:** Commit
```bash
git add .
git commit -m "feat: add Anthropic, OpenAI, DeepSeek, Ollama, OpenRouter provider modules"
```

---

### Task 8: DeploymentEnvironment interface and registry

**Files:**
- Create: `src/main/environments/base.ts`
- Create: `src/main/environments/base.test.ts`

Same pattern as Task 6. Interface definition in `research/05-architecture.md`.

Tests: register a mock environment, retrieve it, verify throws on unknown.

**Step 5:** Commit
```bash
git add .
git commit -m "feat: add DeploymentEnvironment interface and registry"
```

---

### Task 9: Schema-driven form component

**Files:**
- Create: `src/renderer/components/forms/SchemaForm.tsx`
- Create: `src/renderer/components/forms/SchemaForm.test.tsx`

**Step 1:** Write test (using @testing-library/react + happy-dom)
```typescript
// renders a text field from schema property type:string
it('renders text input for string property', () => {
  const schema = { type: 'object', properties: { name: { type: 'string', title: 'Name' } } }
  const { getByLabelText } = render(<SchemaForm schema={schema} value={{}} onChange={() => {}} />)
  expect(getByLabelText('Name')).toBeInTheDocument()
})

// renders select for enum
it('renders select for enum property', () => {
  const schema = { type: 'object', properties: { model: { type: 'string', enum: ['a', 'b'] } } }
  const { getByRole } = render(<SchemaForm schema={schema} value={{}} onChange={() => {}} />)
  expect(getByRole('combobox')).toBeInTheDocument()
})
```

**Step 2:** Run tests — expect FAIL

**Step 3:** Implement SchemaForm:
- `type: string` → `<input type="text">`
- `type: string, format: password` → `<input type="password">`
- `type: string, enum: [...]` → `<select>`
- `type: boolean` → `<input type="checkbox">`
- Labels from `title`; required from `required` array

**Step 4:** Run tests — expect PASS

**Step 5:** Commit
```bash
git add .
git commit -m "feat: add schema-driven form component (text, password, select, checkbox)"
```

---

## Phase 3: Model Provider Management

### Task 10: Provider IPC handlers

**Files:**
- Create: `src/main/ipc/providers.ts`
- Create: `src/main/ipc/providers.test.ts`

**Step 1:** Write tests for CRUD handlers:
- `providers:list` → returns all from DB
- `providers:create` → validates + saves to DB, stores API key in keychain
- `providers:update` → updates DB record
- `providers:delete` → removes from DB + keychain

**Step 2:** Run tests — expect FAIL

**Step 3:** Implement IPC handlers. Secrets (API keys) stored in keychain under `provider:<id>`, non-secret config in SQLite.

**Step 4:** Run tests — expect PASS

**Step 5:** Commit
```bash
git add .
git commit -m "feat: add provider CRUD IPC handlers with keychain secret storage"
```

---

### Task 11: Provider management UI

**Files:**
- Modify: `src/renderer/pages/ProvidersPage.tsx`
- Create: `src/renderer/components/providers/ProviderCard.tsx`
- Create: `src/renderer/components/providers/ProviderModal.tsx`

**Step 1:** Implement provider list page showing cards with provider name, type, model, and edit/delete actions

**Step 2:** Implement add/edit modal using `SchemaForm` with the provider's `configSchema` — no per-provider form code

**Step 3:** Wire TanStack Query hooks: `useProviders()`, `useCreateProvider()`, `useDeleteProvider()`

**Step 4:** Run dev and manually verify: add Anthropic provider, edit it, delete it
```bash
npm run dev
```

**Step 5:** Commit
```bash
git add .
git commit -m "feat: add provider management UI (list, add, edit, delete)"
```

---

## Phase 4: GitHub Integration + Team Spec

### Task 12: GitHub OAuth (device flow)

**Files:**
- Create: `src/main/github/auth.ts`
- Create: `src/main/github/auth.test.ts`

**Step 1:** Write test for token storage/retrieval (mock the GitHub API call)
```typescript
it('stores GitHub token in keychain', async () => {
  const mock = vi.fn().mockResolvedValue({ token: 'ghp_test123' })
  const token = await storeGitHubToken('ghp_test123')
  const retrieved = await getStoredGitHubToken()
  expect(retrieved).toBe('ghp_test123')
})
```

**Step 2:** Run test — expect FAIL

**Step 3:** Implement GitHub Device OAuth flow:
- Use GitHub's device flow (no redirect URI needed — works in Electron)
- `POST https://github.com/login/device/code` → get `device_code` + `user_code`
- Open browser to `https://github.com/login/device/login` with the code
- Poll `POST https://github.com/login/oauth/access_token` until authorized
- Store token in keychain under `github:oauth`

**Step 4:** Run test — expect PASS

**Step 5:** Commit
```bash
git add .
git commit -m "feat: add GitHub device OAuth flow with keychain token storage"
```

---

### Task 13: Team spec file generation

**Files:**
- Create: `src/main/github/spec.ts`
- Create: `src/main/github/spec.test.ts`

**Step 1:** Write tests for each file generator:
```typescript
it('generates IDENTITY.md from agent config', () => {
  const md = generateIdentityMd({ name: 'Alice Chen', slug: 'alice', role: 'Engineer', email: 'alice@co.com', slackHandle: '@alice', githubId: 'alice-dev' })
  expect(md).toContain('# Alice Chen')
  expect(md).toContain('alice@co.com')
})

it('generates SOUL.md merging user input with default template', () => {
  const md = generateSoulMd({ userInput: 'Alice is pragmatic.', enhanced: 'Alice approaches engineering pragmatically.' })
  expect(md).toContain('Alice approaches engineering pragmatically.')
  // Default template sections preserved
  expect(md).toContain('## Core Values')  // from default template
})

it('generates openclaw.json for anthropic provider', () => {
  const json = generateOpenClawJson({ provider: 'anthropic', model: 'claude-sonnet-4-6', apiKey: 'sk-ant-xxx' })
  expect(JSON.parse(json)).toMatchObject({ provider: 'anthropic', model: 'claude-sonnet-4-6' })
})
```

**Step 2:** Run tests — expect FAIL

**Step 3:** Implement generators. SOUL.md and IDENTITY.md use OpenClaw's default template structure as the base, with user-provided sections merged in (enhance then merge, never merge then enhance).

**Step 4:** Run tests — expect PASS

**Step 5:** Commit
```bash
git add .
git commit -m "feat: add team spec file generators (IDENTITY.md, SOUL.md, openclaw.json)"
```

---

### Task 14: GitHub repo management + auto-commit

**Files:**
- Create: `src/main/github/repo.ts`
- Create: `src/main/github/repo.test.ts`

**Step 1:** Write tests (mock octokit):
```typescript
it('createRepo creates repo and returns full name', async () => { ... })
it('commitSpecFiles commits all generated spec files to main', async () => { ... })
it('isSpecDirty returns true when local spec differs from remote', async () => { ... })
```

**Step 2:** Run tests — expect FAIL

**Step 3:** Implement using `@octokit/rest`:
- `createRepo(org, name)` — creates repo under user/org
- `commitSpecFiles(repo, teamSpec)` — generates all files and commits to `main` in a single API call (use `createOrUpdateFileContents` per file or GitHub's tree API for atomic multi-file commits)
- `isSpecDirty(repo, teamSpec)` — checks SHA of current committed files vs locally generated ones

**Step 4:** Run tests — expect PASS

**Step 5:** Commit
```bash
git add .
git commit -m "feat: add GitHub repo creation, spec file commit, and dirty-check"
```

---

### Task 15: App Settings IPC + AI Enhancement (skills + soul)

**Context:** Coordina uses Claude (via the admin's Anthropic subscription API key) for its own AI enhancement features. This key is stored as an app-level setting — completely separate from per-agent model provider configs. The admin enters it once in the Settings page and it is stored in the OS keychain.

**Files:**
- Create: `src/main/ipc/settings.ts`
- Create: `src/main/ipc/settings.test.ts`
- Create: `src/main/ai/enhance.ts`
- Create: `src/main/ai/enhance.test.ts`
- Modify: `src/main/ipc/enhance.ts` (thin IPC wrapper)

**Step 1:** Write tests for settings IPC handlers:
```typescript
// src/main/ipc/settings.test.ts
it('settings:setAnthropicKey stores key in keychain', async () => {
  await handleSetAnthropicKey('sk-ant-test123')
  const val = await getSecret('app', 'anthropic-key')
  expect(val).toBe('sk-ant-test123')
})

it('settings:getAnthropicKey retrieves key from keychain', async () => {
  await handleSetAnthropicKey('sk-ant-test123')
  const result = await handleGetAnthropicKey()
  expect(result).toBe('sk-ant-test123')
})
```

**Step 2:** Run tests — expect FAIL

**Step 3:** Implement settings IPC handlers in `src/main/ipc/settings.ts`:
- `settings:setAnthropicKey(key)` — validates starts with `sk-ant-`, stores in keychain under `app:anthropic-key`
- `settings:getAnthropicKey()` — retrieves from keychain (returns null if not set)
- `settings:hasAnthropicKey()` — returns boolean (used by frontend to show/hide Enhance buttons)

**Step 4:** Write tests for enhancement (mock Anthropic API):
```typescript
it('enhanceSkills returns expanded skill list for role', async () => {
  const result = await enhanceSkills({ role: 'Engineer', skills: ['git', 'typescript'], apiKey: 'sk-ant-test' })
  expect(result).toBeInstanceOf(Array)
  expect(result.length).toBeGreaterThan(2)
})

it('enhanceSoul returns richer soul description', async () => {
  const result = await enhanceSoul({ role: 'Engineer', userInput: 'Alice is pragmatic.', apiKey: 'sk-ant-test' })
  expect(typeof result).toBe('string')
  expect(result.length).toBeGreaterThan('Alice is pragmatic.'.length)
})

it('throws if no Anthropic key configured', async () => {
  // mock getSecret returns null
  await expect(enhanceSoul({ role: 'Engineer', userInput: 'x', apiKey: null }))
    .rejects.toThrow('Anthropic API key not configured')
})
```

**Step 5:** Run tests — expect FAIL

**Step 6:** Implement `src/main/ai/enhance.ts` using Anthropic SDK (`@anthropic-ai/sdk`). The key is fetched from keychain via `getSecret('app', 'anthropic-key')` at call time. Use `claude-sonnet-4-6` as the model. Prompt for soul: "You are helping write an AI agent's SOUL.md personality description. The admin provided: [input]. The agent's role is [role]. Expand this into a richer, more detailed description that captures their personality, working style, and values. Return only the enhanced description text."

**Step 7:** Run tests — expect PASS

**Step 8:** The `SettingsPage.tsx` (created in Task 5 as a stub) gets its implementation here:
- Single "Coordina AI" section with an API key input (password field, `sk-ant-...` placeholder)
- Save button + validation (must start with `sk-ant-`)
- On success: "API key saved. AI enhancement features are now available."
- ✨ Enhance buttons in the agent form are hidden when no key is configured; shown when key is present (check via `settings:hasAnthropicKey` on mount)

**Step 9:** Commit
```bash
git add .
git commit -m "feat: add app settings IPC and AI enhancement powered by admin's Anthropic key"
```

---

## Phase 5: Team & Agent Management UI

### Task 16: Team CRUD IPC handlers

**Files:**
- Create: `src/main/ipc/teams.ts`
- Create: `src/main/ipc/teams.test.ts`

Tests and handlers for: `teams:list`, `teams:create`, `teams:update`, `teams:delete`, `teams:getSpec` (returns dirty status).

Commit: `feat: add team CRUD IPC handlers`

---

### Task 17: Agent CRUD + spec commit IPC handlers

**Files:**
- Create: `src/main/ipc/agents.ts`
- Create: `src/main/ipc/agents.test.ts`

Tests and handlers for: `agents:list(teamSlug)`, `agents:create`, `agents:update`, `agents:delete`. On any create/update/delete, generate spec files and commit to GitHub.

Commit: `feat: add agent CRUD IPC handlers with auto-commit to GitHub`

---

### Task 18: Slug derivation logic

**Files:**
- Create: `src/shared/slug.ts`
- Create: `src/shared/slug.test.ts`

```typescript
it('derives slug from name', () => {
  expect(deriveSlug('Alice Chen')) .toBe('alice-chen')
  expect(deriveSlug('Engineering Alpha!')).toBe('engineering-alpha')
})
it('handles unicode and special chars', () => {
  expect(deriveSlug('José García')).toBe('jose-garcia')
})
```

Implement: lowercase, remove non-alphanumeric (except spaces), replace spaces with `-`.

Commit: `feat: add slug derivation utility`

---

### Task 19: Team creation wizard UI

**Files:**
- Create: `src/renderer/components/teams/CreateTeamWizard.tsx`
- Modify: `src/renderer/pages/TeamsPage.tsx`

Steps in wizard:
1. Team name → slug preview shown live
2. GitHub repo (create new / connect existing) — triggers GitHub OAuth if not already connected
3. Redirects to new team overview with lead agent form pre-opened

Commit: `feat: add team creation wizard with GitHub repo connection`

---

### Task 20: Agent configuration form

**Files:**
- Create: `src/renderer/components/agents/AgentForm.tsx`
- Create: `src/renderer/components/agents/EnhanceButton.tsx`
- Create: `src/renderer/components/agents/BeforeAfterPreview.tsx`

Fields from PRODUCT.md Agent Configuration Model. Key behaviours:
- Name field: slug preview updates live below input; slug locked icon appears after first save
- Model Provider: select from configured providers list
- Skills: tag input (free text, press Enter to add, × to remove) + EnhanceButton
- Soul: textarea + EnhanceButton
- EnhanceButton: shows spinner while enhancing, then opens BeforeAfterPreview modal with "Use enhanced" / "Keep original"

Commit: `feat: add agent configuration form with AI enhancement UI`

---

### Task 21: Team overview page with agent cards

**Files:**
- Create: `src/renderer/components/teams/AgentCard.tsx`
- Create: `src/renderer/pages/TeamDetailPage.tsx`

Agent card shows: name, role, model provider, skills (as tags), deployment status badge, [Chat] [Files] [Edit] buttons. Lead agent has a visual "Lead" badge and appears first.

Team-level actions: [+ Add Agent] [Deploy Team] [Undeploy] [View on GitHub ↗]. "Deploy Team" disabled with tooltip when spec has uncommitted changes.

Commit: `feat: add team detail page with agent cards`

---

## Phase 6: GKE Deployment Environment

### Task 22: Google OAuth for GKE

**Files:**
- Create: `src/main/environments/gke/auth.ts`
- Create: `src/main/environments/gke/auth.test.ts`

Two auth methods:
1. **Google OAuth** — open browser to Google's OAuth consent, receive token via loopback redirect (`http://localhost:PORT/oauth/callback`), use `gke-gcloud-auth-plugin` pattern for kubeconfig, store refresh token in keychain
2. **Service Account JSON** — receive file path, extract private key, store in keychain, generate short-lived access tokens on demand

Tests: `getGkeAccessToken()` returns a token string for both auth methods (mock HTTP calls).

Commit: `feat: add GKE auth module (Google OAuth + service account JSON)`

---

### Task 23: Helm values generation

**Files:**
- Create: `src/main/environments/gke/manifests.ts`
- Create: `src/main/environments/gke/manifests.test.ts`

**Step 1:** Tests for manifest generation:
```typescript
it('generates StatefulSet manifest with deterministic PVC name', () => {
  const manifest = generateAgentStatefulSet({ teamSlug: 'eng-alpha', agentSlug: 'alice', image: 'openclaw/openclaw:latest', storageGi: 10 })
  expect(manifest).toContain('name: alice')
  expect(manifest).toContain('workspace-eng-alpha-alice')  // PVC name
  expect(manifest).toContain('containerPort: 18789')
})

it('generates IAP BackendConfig for lead agent', () => {
  const manifest = generateIapBackendConfig({ teamSlug: 'eng-alpha' })
  expect(manifest).toContain('kind: BackendConfig')
  expect(manifest).toContain('iap:')
  expect(manifest).toContain('enabled: true')
})
```

**Step 2:** Run tests — expect FAIL

**Step 3:** Implement using `js-yaml` for YAML generation. Per-agent manifests: StatefulSet (using OpenClaw K8s operator `OpenClawInstance` CRD), Service (ClusterIP). Per-team manifests: Ingress, BackendConfig (IAP), ManagedCertificate, NetworkPolicy.

PVC naming: `workspace-<team-slug>-<agent-slug>-0` — matches K8s StatefulSet volumeClaimTemplate convention.

**Step 4:** Run tests — expect PASS

**Step 5:** Commit
```bash
git add .
git commit -m "feat: add GKE manifest generation (StatefulSet, Service, Ingress, IAP)"
```

---

### Task 24: GKE deploy + undeploy + status

**Files:**
- Create: `src/main/environments/gke/deploy.ts`
- Create: `src/main/environments/gke/deploy.test.ts`
- Create: `src/main/environments/gke/index.ts` (registers GKE module)
- Create: `src/main/environments/index.ts`

**Step 1:** Tests (mock `@google-cloud/container` and kubectl calls):
```typescript
it('deploy applies manifests and returns gateway URL', async () => { ... })
it('undeploy (soft) deletes StatefulSets but NOT PVCs', async () => { ... })
it('getStatus returns running/pending/crashed per agent', async () => { ... })
```

**Step 2:** Run tests — expect FAIL

**Step 3:** Implement:
- `deploy()`: generate manifests → apply via kubectl (shell out: `kubectl apply -f -`) → return Ingress URL
- `undeploy()`: `kubectl delete statefulset,service,ingress` for the team namespace — explicitly does NOT delete PVCs
- `getStatus()`: use `@google-cloud/container` API or kubectl to get pod status per agent

**Step 4:** Run tests — expect PASS

**Step 5:** Commit
```bash
git add .
git commit -m "feat: add GKE deploy/undeploy/status module (soft undeploy keeps PVCs)"
```

---

### Task 25: Environment management UI

**Files:**
- Modify: `src/renderer/pages/EnvironmentsPage.tsx`
- Create: `src/renderer/components/environments/AddEnvironmentWizard.tsx`

Wizard steps:
1. Name the environment
2. Type selector (GKE only in v1, others greyed/future)
3. Auth: "Sign in with Google" button (OAuth) or "Upload service account JSON" (with security warning banner)
4. Select GCP project + cluster (populated from API after auth)
5. Confirm — Coordina sets up IAP (one-time per cluster)

Environment list: shows name, type, cluster, deployed team (if any), status dot. Cannot delete if team deployed (delete button disabled with tooltip).

Commit: `feat: add environment management UI with GKE setup wizard`

---

### Task 26: Deploy/Undeploy flow with deploy gate

**Files:**
- Create: `src/main/ipc/deploy.ts`
- Create: `src/main/ipc/deploy.test.ts`

**Step 1:** Tests:
```typescript
it('deploy fails if spec has uncommitted changes', async () => {
  const result = await handleDeploy({ teamSlug: 'eng-alpha', envId: 'prod' })
  // when isSpecDirty returns true:
  expect(result.ok).toBe(false)
  expect(result.reason).toContain('uncommitted changes')
})

it('deploy proceeds when spec is clean', async () => { ... })
it('undeploy deletes pods but preserves PVCs', async () => { ... })
```

**Step 2:** Run tests — expect FAIL

**Step 3:** Implement IPC handlers. Deploy gate: call `isSpecDirty()` before deploying; if dirty, return error with link to commit.

**Step 4:** Run tests — expect PASS

**Step 5:** Commit
```bash
git add .
git commit -m "feat: add deploy/undeploy IPC with deploy gate (spec must be committed)"
```

---

## Phase 7: Agent Interaction

### Task 27: Gateway proxy server

**Files:**
- Create: `src/main/gateway/proxy.ts`
- Create: `src/main/gateway/proxy.test.ts`
- Modify: `src/main/server.ts`

The local Express server proxies all `/proxy/:teamSlug/*` requests to the team's deployed gateway URL, injecting the Google ID token as a Bearer header. This handles both HTTP and WebSocket (use `http-proxy-middleware`).

```typescript
it('proxy injects Authorization header', async () => {
  const mockToken = 'ya29.test-token'
  // mock getGoogleIdToken() to return mockToken
  // mock the upstream gateway
  // verify request arrives at upstream with Authorization: Bearer ya29.test-token
})
```

Commit: `feat: add gateway proxy with IAP token injection`

---

### Task 28: Chat UI

**Files:**
- Create: `src/renderer/components/chat/ChatPane.tsx`
- Create: `src/renderer/components/chat/ChatMessage.tsx`
- Create: `src/renderer/hooks/useGatewayChat.ts`

`useGatewayChat(teamSlug, agentSlug?)` — opens WebSocket to `ws://localhost:19876/proxy/<teamSlug>/ws` (routed to lead agent if no agentSlug, or to specific agent if provided). Maintains message list in local state.

Lead agent chat: accessed from team detail page [Chat] button.
Direct agent chat: accessed from individual agent card, shows banner "Talking directly to [name], bypassing the lead agent".

Commit: `feat: add chat UI with WebSocket gateway connection`

---

### Task 29: Agent file browser

**Files:**
- Create: `src/renderer/components/files/FileBrowser.tsx`
- Create: `src/renderer/components/files/FileTree.tsx`
- Create: `src/renderer/components/files/FileTab.tsx`
- Create: `src/renderer/components/files/MarkdownViewer.tsx`
- Create: `src/main/ipc/files.ts`

IPC handler `files:list(teamSlug, agentSlug)` — fetches file tree from agent gateway via proxy.
IPC handler `files:get(teamSlug, agentSlug, path)` — fetches file content.

FileBrowser layout (MiniMax-inspired, see `research/04-ui-patterns.md`):
- Left: `FileTree` with search input + collapsible folders + file sizes
- Top: `FileTab` bar (open multiple files, × to close)
- Right: `MarkdownViewer` with Preview/Source toggle, read-only

Offline fallback: when team is undeployed, show files from last committed GitHub spec with a banner "Showing last committed state — team is not deployed".

Commit: `feat: add agent file browser with tree, tabs, and markdown preview`

---

## Phase 8: Polish + Packaging

### Task 30: Version bump and PRODUCT.md update

Update `PRODUCT.md` version to 1.0, last updated date. Verify all open questions are resolved (they are — checked in earlier sessions).

Commit: `docs: bump PRODUCT.md to version 1.0`

---

### Task 31: Electron app packaging

**Files:**
- Modify: `electron-builder.yml`

Configure macOS DMG packaging:
```yaml
appId: xyz.coordina.app
productName: Coordina
mac:
  category: public.app-category.developer-tools
  target: dmg
  hardenedRuntime: true
  entitlements: build/entitlements.mac.plist
  entitlementsInherit: build/entitlements.mac.plist
```

```bash
npm run build
npm run package
```
Expected: `dist/Coordina-1.0.0.dmg` created.

Commit: `chore: configure Electron macOS DMG packaging`

---

### Task 32: End-to-end smoke test checklist

Manual test flow (no automated E2E in v1):

1. [ ] Launch app, see Teams sidebar with empty state
2. [ ] Add Anthropic model provider — verify saved and listed
3. [ ] Create team "Test Team" — slug `test-team` previewed, GitHub repo created
4. [ ] Lead agent auto-created, open agent form, fill name/role/skills/soul
5. [ ] Click "✨ Enhance" on soul — before/after preview shown, select enhanced
6. [ ] Save agent — verify GitHub repo has `agents/lead/` with generated files
7. [ ] Add GKE environment via wizard (Google OAuth)
8. [ ] Deploy team — verify pods appear in GKE cluster
9. [ ] Chat with lead agent — verify response
10. [ ] Open file browser for lead agent — verify MEMORY.md, SOUL.md visible
11. [ ] Undeploy team — verify pods deleted, PVCs still present in GKE
12. [ ] Redeploy to same env — verify pods reattach existing PVCs

---

## Dependency Map

```
Phase 1 (scaffold)
  └─► Phase 2 (module registry)
        ├─► Phase 3 (provider UI)          ← can parallel with Phase 4
        └─► Phase 4 (GitHub + spec)
              └─► Phase 5 (team/agent UI)
                    └─► Phase 6 (GKE env)
                          └─► Phase 7 (interaction)
                                └─► Phase 8 (polish)
```

Phases 3 and 4 can be developed in parallel once Phase 2 is complete.

---

## Save location for implementation plan

After approval, save this plan to:
`docs/plans/2026-03-02-coordina-implementation.md`

and commit:
```bash
mkdir -p docs/plans
git add docs/plans/2026-03-02-coordina-implementation.md
git commit -m "docs: add Coordina implementation plan"
```
