# Review Findings

## High

### 1. Unsaved edits can still be deployed, so the app can deploy a different spec than the one on screen

- Evidence:
  - `src/renderer/src/pages/TeamDetailPage.tsx:28-29` keeps a local editable copy of the team spec.
  - `src/renderer/src/components/team/DeployTab.tsx:66-72` deploys by `spec.slug` only and never saves before deploying.
  - `src/main/ipc/deploy.ts:45-47` reloads the spec from disk before deployment.
  - `src/renderer/src/hooks/useSpecStatus.ts:22-50` derives readiness only from file-based pipeline events, not local unsaved edits.
- Impact:
  - After a successful save/derive, a user can change agents, providers, or deployment settings in the UI and still have `Deploy` enabled.
  - The deploy request then uses the previously saved JSON, not the current in-memory edits.
- Fix direction:
  - Track dirty state in the editor and disable deploy while dirty, or make deploy run `save -> derive -> deploy` atomically from the current in-memory spec.

### 2. Editing a team slug creates duplicate teams instead of renaming the existing record

- Evidence:
  - `src/renderer/src/components/team/TeamOverview.tsx:27-30` allows editing `spec.slug`.
  - `src/main/store/teams.ts:62-67` saves to `~/.coordina/teams/<slug>.json` using the new slug only.
  - No code removes or renames the old file after a slug change.
- Impact:
  - Renaming `alpha` to `beta` creates `beta.json` and leaves `alpha.json` behind.
  - Navigation is still keyed by the original `teamSlug`, so the UI can remain attached to stale data while the teams list now shows duplicates.
- Fix direction:
  - Either make team slugs immutable after creation, or add an explicit rename path that moves the old file and updates navigation/query keys.

### 3. Custom Ollama hosts cannot be persisted, so saved providers silently fall back to localhost

- Evidence:
  - `src/renderer/src/components/settings/ProvidersSettings.tsx:38-41` tests Ollama with `{ type, baseUrl }`.
  - `src/renderer/src/components/settings/ProvidersSettings.tsx:61-64` drops that base URL when saving and only persists `{ slug, type, name, model }`.
  - `src/shared/types.ts:48-53` has no `baseUrl` field on `ProviderRecord`.
  - `src/main/ipc/providers.ts:36-47` only handles `apiKey`, so there is no persistence path for `baseUrl`.
  - `src/main/providers/ollama.ts:32` falls back to `http://localhost:11434` when no base URL is present.
- Impact:
  - The UI can successfully validate a remote Ollama instance, show a saved provider, and still deploy agents against the default local Ollama endpoint.
- Fix direction:
  - Extend the provider record/schema to persist non-secret connection fields like `baseUrl`, and validate/save Ollama providers through that path.

## Medium

### 4. GKE OAuth client secrets are written to plaintext environment JSON instead of staying in keychain-backed storage

- Evidence:
  - `src/renderer/src/components/settings/EnvironmentsSettings.tsx:84-92` includes `clientSecret` in the saved environment record.
  - `src/main/store/environments.ts:32-35` writes the full record to `~/.coordina/environments/<slug>.json`.
  - `src/main/store/environments.ts:70-83` later reads `clientSecret` back from that JSON to refresh OAuth credentials.
- Impact:
  - GKE auth depends on a secret that is stored outside the OS keychain, which contradicts the product/security docs and leaves credential material on disk.
- Fix direction:
  - Move `clientSecret` into keychain-backed storage alongside the token material, or switch to a flow that does not require persisting it in the environment JSON.

### 5. Provider slug generation can overwrite an existing provider after deletions

- Evidence:
  - `src/renderer/src/components/settings/ProvidersSettings.tsx:16-19` generates a new slug from the count of providers of that type.
  - `src/main/store/providers.ts:31-34` saves directly to `<slug>.json` with no collision check.
- Impact:
  - Example: if `openai`, `openai-2`, and `openai-3` exist, then `openai-2` is deleted, the next created OpenAI provider gets slug `openai-3` and overwrites the existing one.
- Fix direction:
  - Generate slugs from the next available suffix or reject collisions before saving.

### 6. The agents list uses array indexes as React keys, so editor state can jump to the wrong agent after deletes/reorders

- Evidence:
  - `src/renderer/src/components/team/AgentsTab.tsx:115-123` renders `AgentCard` with `key={i}`.
  - `src/renderer/src/components/team/AgentCard.tsx:20-24` keeps local UI state like expansion, token loading, and token errors.
- Impact:
  - Deleting or reordering agents can cause the expanded panel, loaded Telegram-token badge, or in-progress input state to appear on the wrong card.
- Fix direction:
  - Use a stable key such as `agent.slug`.

## Verification Notes

- `npm run typecheck`: passes.
- `npm run test`: fails before running tests because `vitest` picks `vitest.config.ts`, which does not load correctly in the current module setup.
- `npx vitest --config vitest.config.mts run`: starts successfully, then reports:
  - 3 failing tests
  - 2 suites blocked by local native/runtime dependencies (`keytar`, `electron`)
- `npx eslint . --quiet`: reports 137 current lint errors, mostly `explicit-function-return-type` plus several `react-hooks/set-state-in-effect` violations in renderer components.

## Additional Notes

- I used the installed `typescript-react-reviewer` skill as the renderer checklist for hooks, dynamic lists, and state-management issues.
- I also checked the new sidebar/tabbed renderer flows against the product spec and the requested UI reference (`https://component.gallery/`). The blocking issues were state and persistence problems, not visual design problems.
