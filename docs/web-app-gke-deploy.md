# Plan: Convert Coordina to a Web App with Shared GKE Backend

## Context

Coordina is currently an Electron desktop app for deploying teams of AI agents to GKE. We want to convert it to a web app hosted on a domain where taiko.xyz employees can log in with Google, manage up to 2 teams each, and deploy/undeploy to a shared GKE cluster owned by the backend.

### Key Simplifications vs. Original Desktop App
- **No user-managed GCP**: The backend owns one GKE project + cluster. Users never touch GCP.
- **Domain-restricted login**: Only `*@taiko.xyz` Google accounts allowed.
- **2 teams per user**: Each user gets a K8s namespace named after their username (e.g., `abc` for `abc@taiko.xyz`). Both teams deploy into that namespace.
- **User-provided OpenRouter key**: Each user brings their own API key.

---

## Architecture

```
Browser (React)  →  Next.js API Routes  →  Shared GKE Cluster
                         ↓
                    PostgreSQL DB
                  (users, teams, secrets)
```

| Layer | Tech | Notes |
|-------|------|-------|
| Framework | Next.js 15 (App Router) | API routes replace IPC |
| Auth | NextAuth.js v5 + Google | `hd: 'taiko.xyz'` restriction |
| Database | Google Cloud SQL (PostgreSQL) + Drizzle ORM | Replaces `~/.coordina/` JSON files |
| Secrets | AES-256-GCM encrypted DB columns | Replaces `keytar` |
| GKE Auth | Service account key (backend-owned) | NOT user OAuth — backend controls cluster |
| Hosting | Google Cloud Run | No timeout limits, GCP-native |
| Deploy streaming | Server-Sent Events (SSE) | Replaces `win.webContents.send()` |

---

## Phase 1: Project Setup & Auth

### 1.1 Initialize Next.js Project
- Create Next.js 15 app with App Router, TypeScript, Tailwind CSS 4
- Copy over: `src/renderer/src/components/ui/*` (shadcn), `src/shared/types.ts`, `src/shared/agentNames.ts`
- **Replace Electron code in-place** — remove Electron deps, restructure to Next.js
- Install: `next-auth@5`, `drizzle-orm`, `pg`, `zod`
- Remove: `electron`, `electron-vite`, `electron-builder`, `@electron-toolkit/*`, `keytar`

### 1.2 Google Auth (taiko.xyz only)
- NextAuth.js v5 with Google provider
- Scopes: `openid email profile` (no `cloud-platform` — backend owns GKE)
- Restrict to `hd: 'taiko.xyz'` in Google provider config
- Extract username from email: `abc@taiko.xyz` → `abc`
- Session includes `userId`, `username`, `email`

### 1.3 Database Schema (Drizzle)

```sql
users (
  id uuid PK,
  email text UNIQUE NOT NULL,        -- abc@taiko.xyz
  username text UNIQUE NOT NULL,      -- abc (derived from email)
  name text,
  image text,
  openrouterKey text,                 -- AES-256-GCM encrypted
  createdAt timestamp
)

teams (
  id uuid PK,
  userId uuid FK → users,
  slug text UNIQUE NOT NULL,          -- e.g. "my-research-team"
  spec jsonb NOT NULL,                -- full TeamSpec object
  deployedAt timestamp,
  createdAt timestamp,
  CONSTRAINT max_2_teams CHECK via app logic
  -- K8s namespace = users.username (not team slug)
)

team_secrets (
  id uuid PK,
  teamId uuid FK → teams,
  secretType text NOT NULL,           -- telegram-token:{agentSlug}, github-token, email-password
  encryptedValue text NOT NULL,
  UNIQUE(teamId, secretType)
)

deployments (
  id uuid PK,
  teamId uuid FK → teams,
  gatewayUrl text,
  deployedAt timestamp
)

deploy_logs (
  id uuid PK,
  teamId uuid FK → teams,
  entries jsonb,
  createdAt timestamp
)

chat_messages (
  id uuid PK,
  teamId uuid FK → teams,
  agentSlug text,
  role text NOT NULL,
  content text NOT NULL,
  timestamp bigint
)
```

### 1.4 Encryption Utility
- `lib/crypto.ts`: AES-256-GCM encrypt/decrypt using `ENCRYPTION_KEY` env var
- Replaces `keytar` for all secret storage

---

## Phase 2: Backend API Routes

Convert IPC handlers → Next.js API routes. Backend authenticates to GKE using a **service account** (not user tokens).

### GKE Backend Config
- Store GCP service account JSON key as env var `GCP_SERVICE_ACCOUNT_KEY`
- `lib/gke-auth.ts`: Build `KubeConfig` from service account credentials
- Single shared cluster: `projectId`, `clusterName`, `clusterZone` from env vars
- This replaces the per-user OAuth flow in `src/main/environments/gke/auth.ts`

### API Route Map

| Route | Method | Replaces IPC | Notes |
|-------|--------|-------------|-------|
| `/api/auth/[...nextauth]` | * | `gke:auth` | NextAuth catch-all |
| `/api/teams` | GET | `teams:list` | Filtered to current user's teams |
| `/api/teams` | POST | `teams:save` | Enforce 2-team limit |
| `/api/teams/[slug]` | GET | `teams:get` | Auth check: user owns team |
| `/api/teams/[slug]` | PUT | `teams:save` | Update team spec |
| `/api/teams/[slug]` | DELETE | `teams:delete` | Also undeploys |
| `/api/teams/[slug]/secrets/[type]` | GET/PUT | `teams:get*Masked`, `teams:set*` | Telegram, GitHub, email secrets |
| `/api/teams/[slug]/derive` | POST | `teams:derive` | Derive deployment specs |
| `/api/deploy/[teamSlug]` | POST | `deploy:team` | Deploy to shared cluster |
| `/api/deploy/[teamSlug]` | DELETE | `undeploy:team` | Undeploy from cluster |
| `/api/deploy/[teamSlug]/stream` | GET (SSE) | `deploy:status` events | Stream deploy status |
| `/api/deploy/[teamSlug]/status` | GET | `deploy:getStatus` | Pod statuses |
| `/api/deploy/[teamSlug]/logs` | GET | `deploy:getLogs` | Deploy logs |
| `/api/agents/[teamSlug]/[agentSlug]/logs` | GET | `agent:getLogs` | Pod logs |
| `/api/providers/openrouter` | GET/PUT/DELETE | `openrouter:*` | Per-user OpenRouter key |
| `/api/providers/models` | GET | `providers:models` | Model list |
| `/api/settings` | GET/PUT | `settings:*` | User settings |
| `/api/chat/[teamSlug]` | POST | `chat:send` | Send message to agent |
| `/api/chat/[teamSlug]/history` | GET | `chat:history:*` | Chat history |
| `/api/ai/enhance` | POST | `ai:enhance*` | AI enhancement |
| `/api/files/[teamSlug]/[agentSlug]` | GET | `files:list`, `files:get` | Pod file access |

### Team Creation Enforcement
```typescript
// POST /api/teams
// 1. Count user's existing teams — reject if >= 2
// 2. Validate team slug: ^[a-z0-9][a-z0-9-]{1,40}[a-z0-9]$ (no system names)
// 3. Normalize + validate team spec
// 4. Save to DB
```

### Deploy Flow (SSE)
```typescript
// POST /api/deploy/[teamSlug] — kicks off deployment
// GET /api/deploy/[teamSlug]/stream — SSE endpoint
//
// Backend uses service account KubeConfig (not user OAuth)
// Namespace = user's username (e.g., "abc"), NOT the team slug
// Both of a user's teams deploy into their single namespace
// Stream DeployStatus objects as SSE events
```

---

## Phase 3: Frontend Migration

### 3.1 API Client Layer
Create `lib/api.ts` replacing `window.api.invoke`:
```typescript
// Before (Electron IPC):
window.api.invoke('teams:list')
// After (fetch):
api.teams.list() → fetch('/api/teams')
```

### 3.2 Hook Migration
Each hook changes from `window.api.invoke('channel')` to `fetch('/api/...')`. React Query structure stays identical.

**Files to migrate** (all in `src/renderer/src/hooks/`):
- `useTeams.ts` — IPC → fetch
- `useEnvironments.ts` — **Remove** (no user environments)
- `useProviders.ts` — IPC → fetch
- `useSettings.ts` — IPC → fetch
- `useModels.ts` — IPC → fetch
- `useAgentStatuses.ts` — IPC → fetch
- `useGatewayChat.ts` — Proxy through API instead of local Express
- `useSpecStatus.ts` — IPC → fetch

### 3.3 Component Migration
**Copy directly** (no Electron deps):
- All `components/ui/*` — shadcn components
- `AgentAvatar.tsx`, `AgentSpecPanel.tsx`, `TeamSpecPanel.tsx`
- `AppSidebar.tsx`, `MainContent.tsx`, `EmptyState.tsx`
- `SpecEditor.tsx`, form components, chat components

**Modify**:
- `DeployPanel.tsx` — Replace `window.api.on('deploy:status')` with `EventSource` (SSE)
- `SettingsPage.tsx` — Remove GKE config section (backend-owned)
- `CreateTeamDialog.tsx` — Add 2-team limit validation

**Remove**:
- GKE environment config UI (backend owns this)
- Port-forward mode UI (ingress only)

### 3.4 New Pages
- `/login` — "Sign in with Google" (taiko.xyz accounts only)
- `/` — Dashboard (team list, deploy status)
- `/teams/[slug]` — Team editor (existing MainContent adapted)

---

## Phase 4: GKE Integration (Backend-Owned)

### Service Account Auth
```typescript
// lib/gke-auth.ts
// - Loads GCP_SERVICE_ACCOUNT_KEY from env
// - Builds OAuth2Client from service account
// - Builds KubeConfig for shared cluster
// - No user OAuth tokens needed
```

**Reusable modules** (copy with auth refactor):
| File | Change |
|------|--------|
| `src/main/environments/gke/deploy.ts` | `buildKubeConfig()` → use service account instead of user OAuth |
| `src/main/environments/gke/manifests.ts` | 100% reusable, no changes |
| `src/main/environments/gke/gcloud.ts` | Disk labeling functions → use service account |
| `src/main/specs/gke.ts`, `base.ts`, `bootstrap.ts` | 100% reusable |
| `src/main/validation/*` | 100% reusable |
| `src/main/ai/enhance.ts`, `provider.ts` | 95% reusable |

### Namespace Isolation
- Each user gets one K8s namespace named after their username (e.g., `abc`)
- Both of a user's teams deploy into that single namespace
- Backend creates namespace on first deploy if it doesn't exist
- No cluster creation needed — cluster is pre-provisioned

### Gateway Proxy
- Ingress-only mode (no port-forward)
- API route `/api/chat/[teamSlug]` proxies to GKE ingress URL
- Domain pattern: `{teamSlug}.{shared-domain}`

---

## Phase 5: Deployment & Hosting

### Environment Variables
```
DATABASE_URL=postgres://...
ENCRYPTION_KEY=<32-byte-hex>
NEXTAUTH_SECRET=<random>
NEXTAUTH_URL=https://coordina.taiko.xyz
GOOGLE_CLIENT_ID=<oauth-client-id>
GOOGLE_CLIENT_SECRET=<oauth-client-secret>
GCP_SERVICE_ACCOUNT_KEY=<json-key>
GKE_PROJECT_ID=<project>
GKE_CLUSTER_NAME=<cluster>
GKE_CLUSTER_ZONE=<zone>
GKE_DOMAIN=<shared-ingress-domain>
```

### Hosting: Google Cloud Run
- Dockerfile: multi-stage build (Node.js 22 → Next.js standalone output)
- Cloud Run service with min 0, max N instances
- Connect to Cloud SQL via private IP / Unix socket
- No timeout limits — deploy ops can run as long as needed

### Domain
- `coordina.taiko.xyz` (or similar subdomain)
- Cloud Run domain mapping or Cloud Load Balancer

### Directory Restructure (in-place replacement)
```
# Remove Electron structure:
rm -rf src/main/ src/preload/ src/renderer/ electron.vite.config.ts electron-builder.yml build/

# New Next.js structure:
app/                          # Next.js App Router pages
  layout.tsx
  page.tsx                    # Dashboard
  login/page.tsx
  teams/[slug]/page.tsx
  api/
    auth/[...nextauth]/route.ts
    teams/route.ts
    teams/[slug]/route.ts
    deploy/[teamSlug]/route.ts
    ...
components/                   # React components (from renderer)
  ui/                         # shadcn (copied from src/renderer/src/components/ui/)
  AppSidebar.tsx
  DeployPanel.tsx
  ...
lib/                          # Server utilities
  db/schema.ts                # Drizzle schema
  db/index.ts                 # DB connection
  crypto.ts                   # AES encryption
  gke-auth.ts                 # Service account auth
  api.ts                      # Client-side fetch wrapper
hooks/                        # React hooks (from renderer)
server/                       # Server-side business logic
  deploy.ts                   # From environments/gke/deploy.ts
  manifests.ts                # From environments/gke/manifests.ts
  gcloud.ts                   # From environments/gke/gcloud.ts
  specs/                      # From specs/
  validation/                 # From validation/
  ai/                         # From ai/
shared/                       # Shared types (kept as-is)
  types.ts
  agentNames.ts
```

---

## Reusability Summary

| Category | Files | Reuse % |
|----------|-------|---------|
| Shared types | `src/shared/types.ts`, `agentNames.ts` | 100% |
| UI components | `src/renderer/src/components/ui/*` | 100% |
| App components | `src/renderer/src/components/*.tsx` | 90% (remove IPC refs) |
| Zustand store | `src/renderer/src/store/nav.ts` | 100% |
| K8s manifests | `environments/gke/manifests.ts` | 100% |
| Spec derivation | `specs/gke.ts`, `base.ts`, `bootstrap.ts` | 100% |
| Validation | `validation/*` | 100% |
| AI enhancement | `ai/enhance.ts`, `provider.ts` | 95% |
| Deploy logic | `environments/gke/deploy.ts` | 80% (auth refactor) |
| GCP disk ops | `environments/gke/gcloud.ts` | 80% (auth refactor) |

**Must rewrite**: IPC handlers (→ API routes), store modules (→ DB queries), auth (→ NextAuth + service account), preload bridge (eliminated).

---

## Security Hardening

### S1. Server-side `hd` claim verification
The Google OAuth `hd` parameter only controls the consent screen — it doesn't guarantee the token's domain. The NextAuth `signIn` callback must verify the `hd` claim in the decoded ID token:
```typescript
// auth.ts signIn callback
if (profile?.hd !== 'taiko.xyz') return false
```

### S2. Authorization middleware
Create `lib/auth-guard.ts` used by every API route:
```typescript
// 1. Verify session exists (authn)
// 2. For team routes: verify team.userId === session.userId (authz)
// 3. Return 401/403 on failure
```
All team/deploy/chat/files routes must call this. No route should trust the `[teamSlug]` param without ownership check.

### S3. K8s namespace scoping via RBAC
The GCP service account should NOT have cluster-admin. Instead:
- On first user login, create a K8s `Namespace` named after username
- Create a `RoleBinding` scoping the service account to that namespace
- Or: use impersonation — service account impersonates a per-namespace service account
- **Blocklist**: Reject usernames matching system namespaces (`kube-system`, `kube-public`, `default`, `kube-node-lease`, `gke-*`)

### S4. Team slug validation
Team slugs must not collide with other users' resources or K8s system names:
```typescript
const SLUG_RE = /^[a-z0-9][a-z0-9-]{1,40}[a-z0-9]$/
const BLOCKED = ['kube-system', 'default', 'kube-public', 'istio-system']
// Validate slug matches regex AND is not in blocklist
// Uniqueness enforced by DB UNIQUE constraint
```

### S5. Envelope encryption for secrets
Instead of a single `ENCRYPTION_KEY` for all secrets:
- Use **Google Cloud KMS** as the key-encryption-key (KEK)
- Generate a random data-encryption-key (DEK) per secret
- Encrypt the DEK with KMS, store encrypted DEK alongside ciphertext
- Key rotation: re-wrap DEKs with new KEK version (no re-encryption of data)

### S6. Chat proxy SSRF prevention
The `/api/chat/[teamSlug]` proxy must:
- Resolve the target URL server-side from the DB deployment record (never from user input)
- Validate target matches `https://{slug}.{GKE_DOMAIN}` pattern exactly
- Block redirects
- Set a timeout (30s)

### S7. Files API command injection prevention
The `/api/files` endpoint must:
- Hardcode the commands server-side (`ls -la`, `cat <path>`)
- Validate file paths: no `..`, no absolute paths, no shell metacharacters
- Never pass user input directly to `execInPod`

### S8. Rate limiting
- Deploy/undeploy: max 3 per user per hour
- Chat: max 60 requests per user per minute
- Team creation: max 5 per user per day
- Use Cloud Run's built-in rate limiting or a Redis-based limiter (Upstash)

### S9. SSE authentication
`EventSource` doesn't support custom headers. Options:
- Use a short-lived signed token in the SSE URL query param: `/api/deploy/stream?token=<jwt>`
- Token issued by the POST deploy endpoint, valid for 15 minutes
- Log the route path but redact the token param from logs

---

## Verification Plan

1. **Auth**: Login with `@taiko.xyz` → session created. Non-taiko.xyz → rejected. Verify `hd` claim server-side.
2. **Team limit**: Create 2 teams → success. Create 3rd → rejected.
3. **OpenRouter**: Set API key → encrypted in DB. Retrieve → masked correctly.
4. **Deploy**: Deploy team → SSE streams status → pods running in user's namespace.
5. **Undeploy + Redeploy**: Delete deployment → pods removed. Redeploy → pods recreated.
6. **Isolation**: User A cannot see/modify/deploy to User B's namespace.
7. **Security**: Attempt SSRF via chat proxy → blocked. Attempt path traversal via files API → blocked. Attempt slug `kube-system` → rejected.
