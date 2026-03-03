# Local Storage Persistence Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Persist all user-editable form state to localStorage so a restart resumes from the last entered values, not a blank form.

**Architecture:** Two mechanisms: (1) Zustand `persist` middleware for the nav store, (2) a `useDraft` hook applied to each form/wizard component. Drafts clear on successful save. Edit flows (existing records) are not drafted — they pull from the DB.

**Tech Stack:** Zustand 5 `persist` middleware, React `useState`/`useEffect`, browser `localStorage`

---

### Task 1: Persist the nav store

Restart currently drops the user back on the Teams page. This makes the nav store survive restarts.

**Files:**
- Modify: `src/renderer/src/store/nav.ts`

**Step 1: Update the store to use persist middleware**

Replace the file contents:

```ts
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type Page = 'teams' | 'providers' | 'environments' | 'settings'

interface NavStore {
  page: Page
  teamSlug: string | null
  setPage: (page: Page, teamSlug?: string | null) => void
}

export const useNav = create<NavStore>()(
  persist(
    (set) => ({
      page: 'teams',
      teamSlug: null,
      setPage: (page, teamSlug = null) => set({ page, teamSlug }),
    }),
    { name: 'coordina-nav' }
  )
)
```

**Step 2: Verify it compiles**

```bash
cd /Users/d/conductor/workspaces/coordina/baku && npm run typecheck 2>&1 | tail -5
```
Expected: no errors

**Step 3: Commit**

```bash
git add src/renderer/src/store/nav.ts
git commit -m "feat: persist nav state across restarts"
```

---

### Task 2: Create the `useDraft` hook

A single reusable hook for persisting any form value to localStorage.

**Files:**
- Create: `src/renderer/src/hooks/useDraft.ts`
- Create: `src/renderer/src/hooks/useDraft.test.ts`

**Step 1: Write the failing test**

```ts
// src/renderer/src/hooks/useDraft.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useDraft } from './useDraft'

beforeEach(() => localStorage.clear())

describe('useDraft', () => {
  it('returns initial value when no draft exists', () => {
    const { result } = renderHook(() => useDraft('test-key', { name: '' }))
    expect(result.current[0]).toEqual({ name: '' })
  })

  it('persists value to localStorage on change', () => {
    const { result } = renderHook(() => useDraft('test-key', { name: '' }))
    act(() => result.current[1]({ name: 'Alice' }))
    expect(JSON.parse(localStorage.getItem('test-key')!)).toEqual({ name: 'Alice' })
  })

  it('loads existing draft from localStorage on mount', () => {
    localStorage.setItem('test-key', JSON.stringify({ name: 'Alice' }))
    const { result } = renderHook(() => useDraft('test-key', { name: '' }))
    expect(result.current[0]).toEqual({ name: 'Alice' })
  })

  it('clearDraft resets to initial and removes from localStorage', () => {
    const { result } = renderHook(() => useDraft('test-key', { name: '' }))
    act(() => result.current[1]({ name: 'Alice' }))
    act(() => result.current[2]())
    expect(result.current[0]).toEqual({ name: '' })
    expect(localStorage.getItem('test-key')).toBeNull()
  })
})
```

**Step 2: Run to confirm failure**

```bash
cd /Users/d/conductor/workspaces/coordina/baku && npm run test -- src/renderer/src/hooks/useDraft.test.ts 2>&1 | tail -10
```
Expected: FAIL — useDraft not found

**Step 3: Implement the hook**

```ts
// src/renderer/src/hooks/useDraft.ts
import { useState, useEffect } from 'react'

export function useDraft<T>(key: string, initial: T): [T, (v: T) => void, () => void] {
  const [value, setValue] = useState<T>(() => {
    try {
      const stored = localStorage.getItem(key)
      return stored ? (JSON.parse(stored) as T) : initial
    } catch {
      return initial
    }
  })

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value))
    } catch {}
  }, [key, value])

  function clearDraft() {
    localStorage.removeItem(key)
    setValue(initial)
  }

  return [value, setValue, clearDraft]
}
```

**Step 4: Run tests to confirm pass**

```bash
cd /Users/d/conductor/workspaces/coordina/baku && npm run test -- src/renderer/src/hooks/useDraft.test.ts 2>&1 | tail -10
```
Expected: 4 passed

**Step 5: Commit**

```bash
git add src/renderer/src/hooks/useDraft.ts src/renderer/src/hooks/useDraft.test.ts
git commit -m "feat: add useDraft hook for localStorage form persistence"
```

---

### Task 3: Persist CreateTeamWizard draft

**Files:**
- Modify: `src/renderer/src/components/teams/CreateTeamWizard.tsx`

**Step 1: Replace individual useState calls with useDraft**

The draft key is `draft:create-team`. The draft stores `{ teamName, slug, slugManual, step, createRepo }`. Clear draft on success.

Replace the import block and all state declarations:

```tsx
import React from 'react'
import { deriveSlug } from '../../../../shared/slug'
import { useCreateTeam } from '../../hooks/useTeams'
import { useNav } from '../../store/nav'
import { useDraft } from '../../hooks/useDraft'

interface CreateTeamWizardProps {
  onClose: () => void
}

type Step = 'name' | 'repo'

interface WizardDraft {
  step: Step
  teamName: string
  slug: string
  slugManual: boolean
  createRepo: boolean
}

const INITIAL: WizardDraft = { step: 'name', teamName: '', slug: '', slugManual: false, createRepo: true }

export function CreateTeamWizard({ onClose }: CreateTeamWizardProps) {
  const [draft, setDraft, clearDraft] = useDraft<WizardDraft>('draft:create-team', INITIAL)
  const [errors, setErrors] = React.useState<string[]>([])

  const createTeam = useCreateTeam()
  const { setPage } = useNav()

  const { step, teamName, slug, slugManual, createRepo } = draft
  const update = (fields: Partial<WizardDraft>) => setDraft({ ...draft, ...fields })

  function handleNameChange(val: string) {
    update({ teamName: val, ...(!slugManual ? { slug: deriveSlug(val) } : {}) })
  }

  function handleSlugChange(val: string) {
    update({ slug: val, slugManual: true })
  }

  async function handleCreate() {
    setErrors([])
    if (!teamName.trim()) { setErrors(['Team name is required']); return }
    if (!slug.trim()) { setErrors(['Slug is required']); return }

    const result = await createTeam.mutateAsync({ slug, name: teamName, createRepo })
    if (!result.ok) { setErrors(result.errors ?? ['Failed to create team']); return }

    clearDraft()
    onClose()
    setPage('teams', result.slug)
  }
```

Then replace all `step`, `teamName`, `slug`, `createRepo` references in the JSX to use the destructured draft values, and replace `setStep(...)` calls with `update({ step: ... })`.

Full replacement of `setStep('repo')` → `update({ step: 'repo' })`, `setStep('name')` → `update({ step: 'name' })`, `setCreateRepo(...)` → `update({ createRepo: ... })`.

**Step 2: Typecheck**

```bash
cd /Users/d/conductor/workspaces/coordina/baku && npm run typecheck 2>&1 | tail -5
```

**Step 3: Commit**

```bash
git add src/renderer/src/components/teams/CreateTeamWizard.tsx
git commit -m "feat: persist CreateTeamWizard draft across restarts"
```

---

### Task 4: Persist AgentForm draft (new agents only)

Editing an existing agent prefills from the DB record — no draft needed. Only new agents get a draft.

**Files:**
- Modify: `src/renderer/src/components/agents/AgentForm.tsx`

**Step 1: Add useDraft for new-agent state**

Draft key: `draft:agent-new:${teamSlug}` (one draft per team, so adding a second agent doesn't clobber the first team's draft).

The draft stores all form fields. When `agent` prop is provided (edit mode), the draft is not used — state is initialised directly from `agent`.

Replace the state declarations at the top of the function:

```tsx
import { useDraft } from '../../hooks/useDraft'

interface AgentDraft {
  name: string
  slug: string
  slugLocked: boolean
  role: string
  email: string
  slackHandle: string
  githubId: string
  skills: string[]
  skillInput: string
  soul: string
  providerId: string
  model: string
}
```

Inside the component, before existing useState calls, add:

```tsx
const isNew = !agent
const draftKey = `draft:agent-new:${teamSlug}`
const initialDraft: AgentDraft = {
  name: '', slug: '', slugLocked: false, role: '', email: '',
  slackHandle: '', githubId: '', skills: [], skillInput: '', soul: '', providerId: '', model: '',
}
const [draft, setDraft, clearDraft] = useDraft<AgentDraft>(draftKey, initialDraft)
```

Replace all individual `useState` calls with getters from draft when `isNew`, or from `agent` when editing:

```tsx
const name = isNew ? draft.name : (agent?.name ?? '')
const slug = isNew ? draft.slug : (agent?.slug ?? '')
// ... etc
```

Since the existing code uses individual setters like `setName`, replace them with a single `update` helper:

```tsx
const [editState, setEditState] = React.useState<AgentDraft>(() => ({
  name: agent?.name ?? '',
  slug: agent?.slug ?? '',
  slugLocked: !!agent,
  role: agent?.role ?? '',
  email: agent?.email ?? '',
  slackHandle: agent?.slackHandle ?? '',
  githubId: agent?.githubId ?? '',
  skills: agent?.skills ?? [],
  skillInput: '',
  soul: agent?.soul ?? '',
  providerId: agent?.providerId ?? '',
  model: agent?.model ?? '',
}))

const state = isNew ? draft : editState
const update = isNew
  ? (fields: Partial<AgentDraft>) => setDraft({ ...draft, ...fields })
  : (fields: Partial<AgentDraft>) => setEditState(s => ({ ...s, ...fields }))
```

Replace all setter calls (`setName(x)` → `update({ name: x })`, etc.).

On save, call `clearDraft()` before `onSave(...)` when `isNew`.

The `onSave` call becomes:
```tsx
onClick={() => {
  if (isNew) clearDraft()
  onSave({ slug: state.slug, name: state.name, role: state.role, email: state.email,
    slackHandle: state.slackHandle, githubId: state.githubId, skills: state.skills,
    soul: state.soul, providerId: state.providerId, model: state.model, isLead: agent?.isLead ?? false })
}}
```

**Step 2: Typecheck**

```bash
cd /Users/d/conductor/workspaces/coordina/baku && npm run typecheck 2>&1 | tail -5
```

**Step 3: Commit**

```bash
git add src/renderer/src/components/agents/AgentForm.tsx
git commit -m "feat: persist new-agent form draft across restarts"
```

---

### Task 5: Persist ProviderModal draft (new providers only)

**Files:**
- Modify: `src/renderer/src/components/providers/ProviderModal.tsx`

**Step 1: Add useDraft for new-provider state**

Draft key: `draft:provider-new`. Clear on successful save.

```tsx
import { useDraft } from '../../hooks/useDraft'

interface ProviderDraft {
  type: string
  name: string
  config: Record<string, unknown>
}
```

Inside the component:

```tsx
const isNew = !provider
const [draft, setDraft, clearDraft] = useDraft<ProviderDraft>(
  'draft:provider-new',
  { type: 'anthropic', name: '', config: {} }
)

const type = isNew ? draft.type : (provider?.type ?? 'anthropic')
const name = isNew ? draft.name : (provider?.name ?? '')
const config = isNew ? draft.config : (provider?.config ?? {})

const update = isNew
  ? (fields: Partial<ProviderDraft>) => setDraft({ ...draft, ...fields })
  : undefined  // edit mode: use local useState as before
```

For edit mode keep the original `useState` for `name` and `config` (they're scoped to the modal session only — provider edits are short-lived and pull from DB).

Replace `setType`, `setName`, `setConfig` with `update({ type: x })` etc. when `isNew`.

On the Save button click:
```tsx
onClick={() => {
  if (isNew) clearDraft()
  onSave({ type, name, config })
}}
```

Also reset config when type changes (existing `useEffect`) but only for new providers:
```tsx
useEffect(() => {
  if (isNew) update({ config: {} })
}, [type])
```

**Step 2: Typecheck**

```bash
cd /Users/d/conductor/workspaces/coordina/baku && npm run typecheck 2>&1 | tail -5
```

**Step 3: Commit**

```bash
git add src/renderer/src/components/providers/ProviderModal.tsx
git commit -m "feat: persist new-provider form draft across restarts"
```

---

### Task 6: Persist AddEnvironmentWizard draft

**Files:**
- Modify: `src/renderer/src/pages/EnvironmentsPage.tsx`

**Step 1: Add useDraft**

Draft key: `draft:environment-new`. The draft stores `step` plus all `WizardState` fields.

```tsx
import { useDraft } from '../hooks/useDraft'

interface WizardDraft extends WizardState {
  step: WizardStep
}

const INITIAL_DRAFT: WizardDraft = {
  step: 'name',
  name: '', type: 'gke', projectId: '', clusterName: '',
  clusterZone: '', domain: '', authMethod: 'oauth',
}
```

Inside `AddEnvironmentWizard`:

```tsx
const [draft, setDraft, clearDraft] = useDraft<WizardDraft>('draft:environment-new', INITIAL_DRAFT)
const { step, ...state } = draft
const update = (fields: Partial<WizardDraft>) => setDraft({ ...draft, ...fields })
```

Replace `setStep(x)` → `update({ step: x })`, `setState(...)` → `update(...)`. The existing `setState` calls used `s => ({ ...s, ...fields })` — replace with `update(fields)`.

On success in `handleConfirm`:
```tsx
async function handleConfirm() {
  const config = { ... } // same as before
  await createEnv.mutateAsync({ type: state.type, name: state.name, config })
  clearDraft()
  onClose()
}
```

**Step 2: Typecheck**

```bash
cd /Users/d/conductor/workspaces/coordina/baku && npm run typecheck 2>&1 | tail -5
```

**Step 3: Run all tests**

```bash
cd /Users/d/conductor/workspaces/coordina/baku && npm run test 2>&1 | tail -15
```
Expected: all passing

**Step 4: Commit**

```bash
git add src/renderer/src/pages/EnvironmentsPage.tsx
git commit -m "feat: persist AddEnvironmentWizard draft across restarts"
```

---

### Task 7: Final typecheck + test run

```bash
cd /Users/d/conductor/workspaces/coordina/baku && npm run typecheck && npm run test 2>&1 | tail -20
```
Expected: no type errors, all tests pass
