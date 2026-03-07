# Team Detail Tabs Restructure Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Restructure `TeamDetailPage` from 2 tabs (Overview, Agents) to 3 tabs (Team Specifications, Deployments, Chat) following a Define → Deploy → Use mental model.

**Architecture:** `SpecsTab` is a new two-column Finder-style component (team config + agent list on the left, selected agent detail on the right). `DeployTab` is promoted from dormant to primary with richer controls and a persistent derived-files/log panel. `AgentsTab` is slimmed down into `ChatTab` (removes Details sub-tab). `TeamOverview` is deleted entirely.

**Tech Stack:** React 18, TypeScript, Tailwind CSS v4, Zustand (nav store), Electron IPC via `window.api`

---

### Task 1: Update the nav store

**Files:**
- Modify: `src/renderer/src/store/nav.ts`

**Step 1: Update `TeamTab` type and reset defaults**

Change line 4:
```ts
export type TeamTab = 'specs' | 'deployments' | 'chat'
```

Change all three occurrences of `teamTab: 'overview'` (lines 23, 29, 35) to:
```ts
teamTab: 'specs'
```

**Step 2: Verify TypeScript compiles**

```bash
cd /Users/d/conductor/workspaces/coordina/sao-paulo-v1 && npx tsc --noEmit 2>&1 | head -40
```

Expected: errors pointing to `TeamDetailPage.tsx` (it still uses old tab ids — that's fine, we fix it next).

**Step 3: Commit**

```bash
git add src/renderer/src/store/nav.ts
git commit -m "refactor: update TeamTab type to specs/deployments/chat"
```

---

### Task 2: Create SpecsTab component

**Files:**
- Create: `src/renderer/src/components/team/SpecsTab.tsx`

**Step 1: Write the component**

```tsx
import { useState } from 'react'
import { Plus } from 'lucide-react'
import { cn } from '../../lib/utils'
import { useProviders } from '../../hooks/useProviders'
import { InfoGroup, InfoRow, InfoBlock } from '../ui/InfoGroup'
import { AgentCard } from './AgentCard'
import type { TeamSpec, AgentSpec } from '../../../../shared/types'
import { DEFAULT_AGENT_NAME_THEME, generateAutoAgentIdentities } from '../../../../shared/agentNames'
import { useSettings } from '../../hooks/useSettings'
import { deriveSlug } from '../../../../shared/slug'

interface Props {
  spec: TeamSpec
  onSpecChange: (spec: TeamSpec) => void
  onSave: () => Promise<void>
  onSaveSpec: (spec: TeamSpec) => Promise<void>
  isSaving: boolean
}

type RightPanel = { kind: 'none' } | { kind: 'team-edit' } | { kind: 'agent'; slug: string }

const inputCls = 'w-full rounded-md border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent'
const monoInputCls = inputCls + ' font-mono'
const labelCls = 'block text-xs font-medium text-gray-600 mb-1'

export function SpecsTab({ spec, onSpecChange, onSave, onSaveSpec, isSaving }: Props) {
  const [panel, setPanel] = useState<RightPanel>({ kind: 'none' })
  const [isEditingAgent, setIsEditingAgent] = useState(false)
  const { data: providers } = useProviders()
  const { data: settings } = useSettings()
  const providerSlugs = (providers ?? []).map(p => p.slug)

  const set = (key: keyof TeamSpec) => (value: unknown) =>
    onSpecChange({ ...spec, [key]: value })

  const addAutoAgent = () => {
    const generated = generateAutoAgentIdentities(
      spec.agents,
      1,
      settings?.agentNameTheme ?? DEFAULT_AGENT_NAME_THEME,
    )
    if (!generated.length) return
    const newAgent: AgentSpec = {
      slug: generated[0].slug,
      name: generated[0].name,
      role: '',
      provider: '',
      skills: [],
      persona: '',
    }
    const newAgents = [...spec.agents, newAgent]
    const newSpec = { ...spec, agents: newAgents, leadAgent: newAgents[0]?.slug || undefined }
    onSpecChange(newSpec)
    setPanel({ kind: 'agent', slug: newAgent.slug })
    setIsEditingAgent(true)
  }

  const updateAgent = (index: number, updated: AgentSpec) => {
    const agents = [...spec.agents]
    agents[index] = updated
    onSpecChange({ ...spec, agents, leadAgent: agents[0]?.slug || undefined })
    setPanel({ kind: 'agent', slug: updated.slug })
  }

  const deleteAgent = (index: number) => {
    const newAgents = spec.agents.filter((_, j) => j !== index)
    const newSpec = { ...spec, agents: newAgents, leadAgent: newAgents[0]?.slug || undefined }
    onSpecChange(newSpec)
    void onSaveSpec(newSpec)
    setPanel({ kind: 'none' })
    setIsEditingAgent(false)
  }

  const selectedAgentIndex = panel.kind === 'agent'
    ? spec.agents.findIndex(a => a.slug === panel.slug)
    : -1
  const activeAgent = selectedAgentIndex >= 0 ? spec.agents[selectedAgentIndex] : null

  return (
    <div className="flex h-full overflow-hidden">
      {/* Left column */}
      <div className="w-80 shrink-0 border-r border-gray-100 overflow-y-auto flex flex-col bg-[#f6f5f3]">

        {/* Team config section */}
        <div className="px-4 py-4 border-b border-gray-100">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-[10px] font-semibold uppercase tracking-[0.16em] text-gray-400">Team</h3>
            <button
              onClick={() => setPanel(p => p.kind === 'team-edit' ? { kind: 'none' } : { kind: 'team-edit' })}
              className={cn(
                'text-xs font-medium px-2 py-1 rounded-md transition-colors',
                panel.kind === 'team-edit'
                  ? 'bg-blue-50 text-blue-600'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-white'
              )}
            >
              {panel.kind === 'team-edit' ? 'Done' : 'Edit'}
            </button>
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-400 text-xs">Name</span>
              <span className="text-gray-800 font-medium text-xs truncate ml-2">{spec.name || '—'}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-400 text-xs">Slug</span>
              <span className="text-gray-500 font-mono text-xs truncate ml-2">{spec.slug || '—'}</span>
            </div>
            {spec.telegramGroupId && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-400 text-xs">TG Group</span>
                <span className="text-gray-500 font-mono text-xs truncate ml-2">{spec.telegramGroupId}</span>
              </div>
            )}
          </div>
        </div>

        {/* Agents list section */}
        <div className="flex-1 flex flex-col">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100">
            <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-gray-400">
              Agents
            </span>
            <button
              onClick={addAutoAgent}
              className="inline-flex h-6 w-6 items-center justify-center rounded-md text-gray-400 transition-colors hover:bg-white hover:text-gray-700"
              title="Add agent"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto">
            {spec.agents.length === 0 ? (
              <div className="px-4 py-6 text-xs text-gray-400 text-center">
                No agents yet. Add one to get started.
              </div>
            ) : (
              spec.agents.map((agent, index) => (
                <button
                  key={agent.slug}
                  onClick={() => {
                    setPanel({ kind: 'agent', slug: agent.slug })
                    setIsEditingAgent(false)
                  }}
                  className={cn(
                    'w-full border-b border-gray-100 px-4 py-2.5 text-left transition-colors',
                    panel.kind === 'agent' && panel.slug === agent.slug
                      ? 'bg-white text-gray-900'
                      : 'text-gray-600 hover:bg-white/80 hover:text-gray-900',
                  )}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {agent.emoji ? (
                      <span className="text-base shrink-0">{agent.emoji}</span>
                    ) : (
                      <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center text-[10px] font-semibold text-gray-500 shrink-0">
                        {(agent.name || '?').charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">
                        {agent.name || agent.slug}
                        {index === 0 && <span className="text-gray-400 font-normal text-xs"> · Lead</span>}
                      </div>
                      {agent.role && (
                        <div className="text-xs text-gray-400 truncate">{agent.role}</div>
                      )}
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Right column */}
      <div className="flex-1 min-w-0 overflow-hidden flex flex-col bg-white">
        {panel.kind === 'none' && (
          <div className="flex-1 flex items-center justify-center text-sm text-gray-400">
            Select an item to view details
          </div>
        )}

        {panel.kind === 'team-edit' && (
          <div className="flex-1 overflow-y-auto">
            <div className="max-w-2xl mx-auto space-y-5 py-6 px-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-gray-900">Edit team</h3>
                  <p className="text-sm text-gray-500 mt-1">Update the base team configuration and save when finished.</p>
                </div>
                <button
                  onClick={onSave}
                  disabled={isSaving}
                  className="px-3 py-1.5 text-base font-medium rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  {isSaving ? 'Saving...' : 'Save'}
                </button>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-gray-900 mb-3">Team details</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>Name</label>
                    <input className={inputCls} value={spec.name} onChange={e => set('name')(e.target.value)} placeholder="My Team" />
                  </div>
                  <div>
                    <label className={labelCls}>Slug</label>
                    <input className={monoInputCls} value={spec.slug} onChange={e => set('slug')(e.target.value)} placeholder="my-team" />
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-gray-900 mb-3">Telegram integration</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>Group ID</label>
                    <input className={monoInputCls} value={spec.telegramGroupId ?? ''} onChange={e => set('telegramGroupId')(e.target.value || undefined)} placeholder="-1001234567890" />
                  </div>
                  <div>
                    <label className={labelCls}>Admin ID</label>
                    <input className={monoInputCls} value={spec.telegramAdminId ?? ''} onChange={e => set('telegramAdminId')(e.target.value || undefined)} placeholder="123456789" />
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-gray-900 mb-3">Infrastructure defaults</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>Default container image</label>
                    <input className={monoInputCls} value={spec.defaultImage ?? ''} onChange={e => set('defaultImage')(e.target.value || undefined)} placeholder="ghcr.io/org/openclaw:latest" />
                  </div>
                  <div>
                    <label className={labelCls}>Storage (Gi)</label>
                    <input type="number" min={1} className={inputCls} value={spec.defaultDiskGi ?? ''} onChange={e => set('defaultDiskGi')(e.target.value ? parseInt(e.target.value, 10) : undefined)} placeholder="100" />
                  </div>
                </div>
              </div>

              <div>
                <label className={labelCls}>Startup instructions</label>
                <textarea
                  className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none font-mono"
                  rows={4}
                  value={spec.startupInstructions ?? ''}
                  onChange={e => set('startupInstructions')(e.target.value || undefined)}
                  placeholder="Custom startup instructions..."
                />
              </div>

              <div>
                <h3 className="text-sm font-semibold text-gray-900 mb-3">Read view</h3>
                <InfoGroup title="Team details">
                  <InfoRow label="Name" value={spec.name} />
                  <InfoRow label="Slug" value={spec.slug} />
                </InfoGroup>
                <InfoGroup title="Telegram integration">
                  <InfoRow label="Group ID" value={spec.telegramGroupId} />
                  <InfoRow label="Admin ID" value={spec.telegramAdminId} />
                </InfoGroup>
                <InfoGroup title="Infrastructure defaults">
                  <InfoRow label="Container image" value={spec.defaultImage} />
                  <InfoRow label="Storage (Gi)" value={spec.defaultDiskGi} />
                </InfoGroup>
                <InfoGroup title="Startup instructions">
                  <InfoBlock value={spec.startupInstructions} />
                </InfoGroup>
              </div>
            </div>
          </div>
        )}

        {panel.kind === 'agent' && activeAgent && (
          <div className="flex-1 overflow-y-auto">
            <div className="py-6 px-6 max-w-2xl space-y-4">
              <AgentCard
                key={activeAgent.slug}
                teamSlug={spec.slug}
                agent={activeAgent}
                isFirst={selectedAgentIndex === 0}
                providerSlugs={providerSlugs}
                isEditing={isEditingAgent}
                onEdit={() => setIsEditingAgent(true)}
                onSave={async () => {
                  await onSave()
                  setIsEditingAgent(false)
                }}
                isSaving={isSaving}
                onChange={updated => updateAgent(selectedAgentIndex, updated)}
                onDelete={() => deleteAgent(selectedAgentIndex)}
              />
            </div>
          </div>
        )}

        {panel.kind === 'agent' && !activeAgent && (
          <div className="flex-1 flex items-center justify-center text-sm text-gray-400">
            Agent not found
          </div>
        )}
      </div>
    </div>
  )
}
```

**Step 2: Verify no TypeScript errors in the new file**

```bash
cd /Users/d/conductor/workspaces/coordina/sao-paulo-v1 && npx tsc --noEmit 2>&1 | grep SpecsTab
```

Expected: no output (no errors in SpecsTab).

**Step 3: Commit**

```bash
git add src/renderer/src/components/team/SpecsTab.tsx
git commit -m "feat: add SpecsTab with Finder-style two-column layout"
```

---

### Task 3: Promote DeployTab with preview + persistent output panel

**Files:**
- Modify: `src/renderer/src/components/team/DeployTab.tsx`

**Step 1: Replace the component**

Replace the full contents of `DeployTab.tsx` with:

```tsx
import { useState, useEffect } from 'react'
import { useEnvironments } from '../../hooks/useEnvironments'
import { useSpecStatus } from '../../hooks/useSpecStatus'
import { Rocket, GitCommit, AlertCircle, Check, Loader2 } from 'lucide-react'
import { cn } from '../../lib/utils'
import type { TeamSpec } from '../../../../shared/types'

interface Props {
  spec: TeamSpec
  onSave: () => Promise<void>
  isSaving: boolean
}

type DeployState = 'idle' | 'preparing' | 'deploying' | 'done' | 'error'

export function DeployTab({ spec, onSave, isSaving }: Props) {
  const status = useSpecStatus(spec.slug)
  const { data: environments } = useEnvironments()
  const [selectedEnvSlug, setSelectedEnvSlug] = useState('')
  const [keepDisks, setKeepDisks] = useState(true)
  const [forceRecreate, setForceRecreate] = useState(false)
  const [deployState, setDeployState] = useState<DeployState>('idle')
  const [deployFiles, setDeployFiles] = useState<string[]>([])
  const [deployLogs, setDeployLogs] = useState<string[]>([])
  const [gitMessage, setGitMessage] = useState('')
  const [gitStatus, setGitStatus] = useState<{ dirty: boolean; files: string[] }>({ dirty: false, files: [] })

  useEffect(() => {
    if (environments?.length && !selectedEnvSlug) setSelectedEnvSlug(environments[0].slug)
  }, [environments, selectedEnvSlug])

  useEffect(() => {
    window.api.invoke('git:status').then((s: unknown) => {
      const gs = s as { enabled: boolean; dirty: boolean; files: string[] }
      if (gs.enabled) setGitStatus({ dirty: gs.dirty, files: gs.files })
    })
  }, [spec])

  useEffect(() => {
    return window.api.on?.('deploy:status', (data: unknown) => {
      const d = data as { resource: string; status: string; message?: string }
      const line = `${d.status.toUpperCase().padEnd(8)} ${d.resource}${d.message ? ` — ${d.message}` : ''}`
      setDeployLogs(prev => [...prev, line])
    })
  }, [])

  const handleDeploy = async () => {
    if (!selectedEnvSlug) return
    setDeployState('preparing')
    setDeployFiles([])
    setDeployLogs([])

    try {
      await onSave()
      const preview = await window.api.invoke('deploy:preview', {
        teamSlug: spec.slug,
        envSlug: selectedEnvSlug,
      }) as { ok: boolean; reason?: string; files?: Array<{ path: string }> }

      if (!preview.ok) {
        setDeployState('error')
        setDeployLogs([`ERROR: ${preview.reason}`])
        return
      }

      setDeployFiles((preview.files ?? []).map(f => f.path))
      setDeployState('deploying')

      const result = await window.api.invoke('deploy:team', {
        teamSlug: spec.slug,
        envSlug: selectedEnvSlug,
        options: { keepDisks, forceRecreate },
      }) as { ok: boolean; reason?: string }

      setDeployState(result.ok ? 'done' : 'error')
      if (!result.ok) setDeployLogs(prev => [...prev, `ERROR: ${result.reason}`])
    } catch (error) {
      setDeployState('error')
      setDeployLogs([`ERROR: ${error instanceof Error ? error.message : String(error)}`])
    }
  }

  const handleCommit = async () => {
    if (!gitMessage.trim()) return
    await window.api.invoke('git:commit', gitMessage)
    setGitMessage('')
    const gs = await window.api.invoke('git:status') as { enabled: boolean; dirty: boolean; files: string[] }
    if (gs.enabled) setGitStatus({ dirty: gs.dirty, files: gs.files })
  }

  const inputCls = 'w-full rounded-md border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent'
  const labelCls = 'block text-xs font-medium text-gray-600 mb-1'
  const showOutput = deployState !== 'idle'

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex-1 overflow-y-auto min-h-0">
        <div className="py-6 px-6 max-w-2xl space-y-6">

          {/* Validation status */}
          {status.validationErrors.length > 0 && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 space-y-1">
              <div className="flex items-center gap-1.5 text-sm font-medium text-red-700">
                <AlertCircle className="w-4 h-4" />
                Validation errors ({status.validationErrors.length})
              </div>
              {status.validationErrors.map((e, i) => (
                <div key={i} className="text-xs text-red-600 font-mono pl-5">
                  {e.field}: {e.message}
                </div>
              ))}
            </div>
          )}

          {/* Environment */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Environment</h3>
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-1">
                <label className={labelCls}>Target</label>
                <select value={selectedEnvSlug} onChange={e => setSelectedEnvSlug(e.target.value)} className={inputCls}>
                  {(environments ?? []).map(e => <option key={e.slug} value={e.slug}>{e.name}</option>)}
                </select>
              </div>
              <div className="col-span-2 flex items-end gap-4 pb-0.5">
                <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                  <input type="checkbox" checked={keepDisks} onChange={e => setKeepDisks(e.target.checked)} className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                  Keep disks
                </label>
                <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                  <input type="checkbox" checked={forceRecreate} onChange={e => setForceRecreate(e.target.checked)} className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                  Force recreate
                </label>
              </div>
            </div>
          </div>

          {/* Git commit */}
          {gitStatus.dirty && (
            <div>
              <h3 className="text-sm font-semibold text-gray-900 mb-3">
                <span className="flex items-center gap-1.5">
                  <GitCommit className="w-4 h-4" />
                  Git ({gitStatus.files.length} changes)
                </span>
              </h3>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={gitMessage}
                  onChange={e => setGitMessage(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleCommit()}
                  placeholder="Commit message..."
                  className={inputCls + ' font-mono'}
                />
                <button
                  onClick={handleCommit}
                  disabled={!gitMessage.trim()}
                  className="px-4 py-1.5 text-sm font-medium rounded-md bg-gray-800 text-white hover:bg-gray-700 disabled:opacity-50 shrink-0 transition-colors"
                >
                  Commit
                </button>
              </div>
              <div className="mt-2 space-y-0.5">
                {gitStatus.files.slice(0, 10).map(f => (
                  <div key={f} className="text-xs text-gray-500 font-mono truncate">{f}</div>
                ))}
                {gitStatus.files.length > 10 && (
                  <div className="text-xs text-gray-400">...and {gitStatus.files.length - 10} more</div>
                )}
              </div>
            </div>
          )}

          {/* Pipeline */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Deployment pipeline</h3>
            <div className="flex items-center gap-2">
              <button
                onClick={onSave}
                disabled={isSaving}
                className="px-4 py-2 text-sm font-medium rounded-md bg-gray-100 text-gray-700 hover:bg-gray-200 disabled:opacity-50 transition-colors"
              >
                {isSaving ? 'Saving...' : 'Save'}
              </button>
              <span className="text-gray-300">→</span>
              <button
                onClick={handleDeploy}
                disabled={!status.isValid || !selectedEnvSlug || deployState === 'preparing' || deployState === 'deploying' || isSaving}
                className={cn(
                  'px-4 py-2 text-sm font-medium rounded-md transition-colors',
                  deployState === 'done' ? 'bg-green-600 text-white hover:bg-green-700' :
                  deployState === 'error' ? 'bg-red-600 text-white hover:bg-red-700' :
                  deployState === 'preparing' || deployState === 'deploying' ? 'bg-yellow-500 text-white' :
                  status.isValid ? 'bg-blue-600 text-white hover:bg-blue-700' :
                  'bg-gray-200 text-gray-400 cursor-not-allowed'
                )}
              >
                <span className="flex items-center gap-1.5">
                  {(deployState === 'preparing' || deployState === 'deploying') && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  {deployState === 'done' && <Check className="w-3.5 h-3.5" />}
                  {deployState === 'error' && <AlertCircle className="w-3.5 h-3.5" />}
                  {deployState !== 'preparing' && deployState !== 'deploying' && deployState !== 'done' && deployState !== 'error' && <Rocket className="w-3.5 h-3.5" />}
                  {deployState === 'preparing' ? 'Preparing...' :
                   deployState === 'deploying' ? 'Deploying...' :
                   deployState === 'done' ? 'Redeploy' :
                   deployState === 'error' ? 'Deploy failed' : 'Deploy'}
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Persistent output panel — shown once deploy is triggered */}
      {showOutput && (
        <div className="shrink-0 border-t border-gray-200 bg-white h-72 flex flex-col">
          <div className="flex items-center gap-2 border-b border-gray-200 px-5 py-2.5 shrink-0">
            <h4 className="text-sm font-semibold text-gray-900">Deploy output</h4>
            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-gray-500">
              {environments?.find(e => e.slug === selectedEnvSlug)?.name ?? selectedEnvSlug}
            </span>
            <span className={cn(
              'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider',
              deployState === 'done' ? 'bg-green-50 text-green-700' :
              deployState === 'error' ? 'bg-red-50 text-red-700' :
              'bg-yellow-50 text-yellow-700'
            )}>
              {(deployState === 'preparing' || deployState === 'deploying') && <Loader2 className="w-3 h-3 animate-spin" />}
              {deployState === 'done' && <Check className="w-3 h-3" />}
              {deployState === 'error' && <AlertCircle className="w-3 h-3" />}
              {deployState === 'preparing' ? 'Preparing' :
               deployState === 'deploying' ? 'Deploying' :
               deployState === 'done' ? 'Deployed' : 'Failed'}
            </span>
          </div>
          <div className="flex flex-1 min-h-0 divide-x divide-gray-100">
            <div className="w-64 shrink-0 flex flex-col p-3 min-h-0">
              <div className="flex items-center justify-between mb-2 shrink-0">
                <h5 className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">Files</h5>
                <span className="text-[10px] text-gray-400">{deployFiles.length}</span>
              </div>
              <div className="flex-1 overflow-y-auto min-h-0 space-y-0.5">
                {deployFiles.length === 0 ? (
                  <div className="text-xs text-gray-400">
                    {deployState === 'preparing' ? 'Deriving files…' : 'No files yet'}
                  </div>
                ) : (
                  deployFiles.map(path => (
                    <div key={path} className="text-xs font-mono text-gray-600 truncate">{path}</div>
                  ))
                )}
              </div>
            </div>
            <div className="flex-1 flex flex-col p-3 min-h-0">
              <h5 className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-2 shrink-0">Log</h5>
              <div className="flex-1 overflow-y-auto min-h-0 space-y-0.5">
                {deployLogs.length === 0 ? (
                  <div className="text-xs text-gray-400">
                    {deployState === 'preparing' ? 'Waiting for deploy to start…' :
                     deployState === 'deploying' ? 'Collecting logs…' : 'No logs yet'}
                  </div>
                ) : (
                  deployLogs.map((line, index) => (
                    <div
                      key={`${index}:${line}`}
                      className={cn(
                        'text-xs font-mono',
                        line.startsWith('ERROR') ? 'text-red-600' :
                        line.startsWith('CREATED') ? 'text-green-600' :
                        line.startsWith('EXISTS') ? 'text-yellow-600' :
                        'text-gray-600'
                      )}
                    >
                      {line}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
```

**Step 2: Verify**

```bash
cd /Users/d/conductor/workspaces/coordina/sao-paulo-v1 && npx tsc --noEmit 2>&1 | grep DeployTab
```

Expected: no output.

**Step 3: Commit**

```bash
git add src/renderer/src/components/team/DeployTab.tsx
git commit -m "feat: promote DeployTab with deploy:preview, persistent output panel, preparing state"
```

---

### Task 4: Create ChatTab (rename from AgentsTab, remove Details sub-tab)

**Files:**
- Create: `src/renderer/src/components/team/ChatTab.tsx`

**Step 1: Write the component**

Copy `AgentsTab.tsx` as the base. Remove all `details` references from `panelMode`. The new component:

```tsx
import { useEffect, useState } from 'react'
import { useProviders } from '../../hooks/useProviders'
import { ChatPane } from '../chat/ChatPane'
import { FileBrowser } from '../files/FileBrowser'
import { Plus } from 'lucide-react'
import { cn } from '../../lib/utils'
import type { TeamSpec, AgentSpec } from '../../../../shared/types'
import { DEFAULT_AGENT_NAME_THEME, generateAutoAgentIdentities } from '../../../../shared/agentNames'
import { useSettings } from '../../hooks/useSettings'

interface Props {
  spec: TeamSpec
  onSpecChange: (spec: TeamSpec) => void
  onSaveSpec: (spec: TeamSpec) => Promise<void>
  envSlug?: string
}

export function ChatTab({ spec, onSpecChange, onSaveSpec, envSlug }: Props) {
  const { data: providers } = useProviders()
  const { data: settings } = useSettings()
  const providerSlugs = (providers ?? []).map(p => p.slug)
  void providerSlugs
  const [selectedAgentSlug, setSelectedAgentSlug] = useState(spec.agents[0]?.slug ?? '')
  const [panelMode, setPanelMode] = useState<'chat' | 'files'>('chat')

  const addAutoAgent = () => {
    const generated = generateAutoAgentIdentities(
      spec.agents,
      1,
      settings?.agentNameTheme ?? DEFAULT_AGENT_NAME_THEME,
    )
    if (!generated.length) return
    const newAgent: AgentSpec = {
      slug: generated[0].slug,
      name: generated[0].name,
      role: '',
      provider: '',
      skills: [],
      persona: '',
    }
    const newAgents = [...spec.agents, newAgent]
    const newSpec = { ...spec, agents: newAgents, leadAgent: newAgents[0]?.slug || undefined }
    onSpecChange(newSpec)
    void onSaveSpec(newSpec)
  }

  useEffect(() => {
    if (!spec.agents.length) { setSelectedAgentSlug(''); return }
    if (!selectedAgentSlug || !spec.agents.some(a => a.slug === selectedAgentSlug)) {
      setSelectedAgentSlug(spec.agents[0].slug)
    }
  }, [spec.agents, selectedAgentSlug])

  const selectedAgentIndex = spec.agents.findIndex(a => a.slug === selectedAgentSlug)
  const activeAgent = spec.agents[selectedAgentIndex] ?? spec.agents[0]
  const modes = [
    { id: 'chat', label: 'Chat' },
    { id: 'files', label: 'Files' },
  ] as const

  return (
    <div className="flex h-full overflow-hidden">
      <div className="w-52 shrink-0 border-r border-gray-100 bg-[#f6f5f3] flex flex-col">
        <div className="px-3 py-3 border-b border-gray-100">
          <div className="flex items-center justify-between gap-2">
            <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-gray-400">Agents</div>
            <button
              onClick={addAutoAgent}
              className="inline-flex h-6 w-6 items-center justify-center rounded-md text-gray-400 transition-colors hover:bg-white hover:text-gray-700"
              title="Add agent"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {spec.agents.map((agent, index) => (
            <button
              key={agent.slug}
              onClick={() => setSelectedAgentSlug(agent.slug)}
              className={cn(
                'w-full border-b border-gray-100 px-3 py-2.5 text-left transition-colors',
                selectedAgentSlug === agent.slug
                  ? 'bg-white text-gray-900'
                  : 'text-gray-600 hover:bg-white/80 hover:text-gray-900',
              )}
            >
              <div className="min-w-0">
                <div className="text-base font-medium truncate">
                  {agent.name || agent.slug}
                  {index === 0 && <span className="text-gray-400 font-normal"> (Lead)</span>}
                </div>
                {agent.role && <div className="text-sm text-gray-400 truncate">{agent.role}</div>}
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 min-w-0 overflow-hidden flex flex-col bg-white">
        <div className="border-b border-gray-100 shrink-0">
          <div className="flex justify-center gap-6 px-6 py-2">
            {modes.map(mode => (
              <button
                key={mode.id}
                onClick={() => setPanelMode(mode.id)}
                className={cn(
                  'text-base font-medium py-1.5 transition-colors relative',
                  panelMode === mode.id ? 'text-gray-900' : 'text-gray-400 hover:text-gray-600',
                )}
              >
                {mode.label}
                {panelMode === mode.id && (
                  <span className="absolute -bottom-2 left-0 right-0 h-[2px] bg-gray-900 rounded-t" />
                )}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-hidden">
          {!activeAgent ? (
            <div className="py-6 px-6 h-full overflow-y-auto flex items-center justify-center">
              <p className="text-base text-gray-500">No agents yet. Add agents to get started.</p>
            </div>
          ) : panelMode === 'chat' ? (
            <ChatPane
              teamSlug={spec.slug}
              envSlug={envSlug}
              agentSlug={selectedAgentSlug === spec.agents[0]?.slug ? undefined : selectedAgentSlug}
              agentName={activeAgent.name}
            />
          ) : (
            <FileBrowser
              key={`${spec.slug}:${activeAgent.slug}`}
              teamSlug={spec.slug}
              agentSlug={activeAgent.slug}
              agentName={activeAgent.name}
            />
          )}
        </div>
      </div>
    </div>
  )
}
```

**Step 2: Verify**

```bash
cd /Users/d/conductor/workspaces/coordina/sao-paulo-v1 && npx tsc --noEmit 2>&1 | grep ChatTab
```

Expected: no output.

**Step 3: Commit**

```bash
git add src/renderer/src/components/team/ChatTab.tsx
git commit -m "feat: add ChatTab (AgentsTab without Details sub-tab)"
```

---

### Task 5: Rewrite TeamDetailPage with 3 tabs

**Files:**
- Modify: `src/renderer/src/pages/TeamDetailPage.tsx`

**Step 1: Replace the full file contents**

```tsx
import { useState, useEffect } from 'react'
import { useTeam, useSaveTeam } from '../hooks/useTeams'
import { useNav, type TeamTab } from '../store/nav'
import { SpecsTab } from '../components/team/SpecsTab'
import { DeployTab } from '../components/team/DeployTab'
import { ChatTab } from '../components/team/ChatTab'
import { useEnvironments } from '../hooks/useEnvironments'
import { cn } from '../lib/utils'
import type { TeamSpec } from '../../../shared/types'

interface Props {
  teamSlug: string
}

const tabs: { id: TeamTab; label: string }[] = [
  { id: 'specs', label: 'Team Specifications' },
  { id: 'deployments', label: 'Deployments' },
  { id: 'chat', label: 'Chat' },
]

export function TeamDetailPage({ teamSlug }: Props) {
  const { data: savedSpec, isLoading } = useTeam(teamSlug)
  const [localSpec, setLocalSpec] = useState<TeamSpec | null>(null)
  const { teamTab, setTeamTab } = useNav()
  const saveTeam = useSaveTeam()
  const { data: environments } = useEnvironments()
  const [selectedEnvSlug, setSelectedEnvSlug] = useState('')

  useEffect(() => {
    if (savedSpec) setLocalSpec(savedSpec)
  }, [savedSpec])

  useEffect(() => {
    if (environments?.length && !selectedEnvSlug) setSelectedEnvSlug(environments[0].slug)
  }, [environments, selectedEnvSlug])

  if (isLoading) return <div className="p-6 text-sm text-gray-500">Loading...</div>
  if (!localSpec) return <div className="p-6 text-sm text-gray-500">Team not found.</div>

  const handleSave = () => saveTeam.mutateAsync(localSpec).then(() => undefined)
  const handleSaveSpec = (specToSave: TeamSpec) => saveTeam.mutateAsync(specToSave).then(() => undefined)

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Tab bar */}
      <div className="flex gap-1 px-6 border-b border-gray-200 shrink-0">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setTeamTab(tab.id)}
            className={cn(
              'px-3 py-2 text-sm font-medium transition-colors relative',
              teamTab === tab.id ? 'text-blue-600' : 'text-gray-500 hover:text-gray-700'
            )}
          >
            {tab.label}
            {tab.id === 'chat' && ` (${localSpec.agents.length})`}
            {teamTab === tab.id && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 rounded-t" />
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        {teamTab === 'specs' && (
          <SpecsTab
            spec={localSpec}
            onSpecChange={setLocalSpec}
            onSave={handleSave}
            onSaveSpec={handleSaveSpec}
            isSaving={saveTeam.isPending}
          />
        )}
        {teamTab === 'deployments' && (
          <DeployTab
            spec={localSpec}
            onSave={handleSave}
            isSaving={saveTeam.isPending}
          />
        )}
        {teamTab === 'chat' && (
          <ChatTab
            spec={localSpec}
            onSpecChange={setLocalSpec}
            onSaveSpec={handleSaveSpec}
            envSlug={selectedEnvSlug || undefined}
          />
        )}
      </div>

      {saveTeam.error && (
        <div className="px-6 py-2 border-t border-red-200 bg-red-50 text-xs text-red-700 shrink-0">
          {(saveTeam.error as Error).message}
        </div>
      )}
    </div>
  )
}
```

**Step 2: Verify TypeScript compiles cleanly**

```bash
cd /Users/d/conductor/workspaces/coordina/sao-paulo-v1 && npx tsc --noEmit 2>&1
```

Expected: no errors (or only pre-existing unrelated errors).

**Step 3: Commit**

```bash
git add src/renderer/src/pages/TeamDetailPage.tsx
git commit -m "feat: restructure TeamDetailPage to 3 tabs (specs/deployments/chat)"
```

---

### Task 6: Delete TeamOverview and AgentsTab

**Files:**
- Delete: `src/renderer/src/components/team/TeamOverview.tsx`
- Delete: `src/renderer/src/components/team/AgentsTab.tsx`

**Step 1: Verify nothing still imports them**

```bash
cd /Users/d/conductor/workspaces/coordina/sao-paulo-v1 && grep -r "TeamOverview\|AgentsTab" src/ --include="*.tsx" --include="*.ts"
```

Expected: no output (both were only used in TeamDetailPage which now uses SpecsTab/ChatTab).

**Step 2: Delete the files**

```bash
rm /Users/d/conductor/workspaces/coordina/sao-paulo-v1/src/renderer/src/components/team/TeamOverview.tsx
rm /Users/d/conductor/workspaces/coordina/sao-paulo-v1/src/renderer/src/components/team/AgentsTab.tsx
```

**Step 3: Final TypeScript check**

```bash
cd /Users/d/conductor/workspaces/coordina/sao-paulo-v1 && npx tsc --noEmit 2>&1
```

Expected: no errors.

**Step 4: Commit**

```bash
git add -A
git commit -m "chore: remove TeamOverview and AgentsTab (replaced by SpecsTab and ChatTab)"
```

---

### Task 7: Manual smoke test checklist

Open the app and verify:

- [ ] Team detail page shows 3 tabs: "Team Specifications", "Deployments", "Chat (N)"
- [ ] **Specs tab**: Left column shows team name/slug/TG group compactly; agents listed below
- [ ] **Specs tab**: Clicking "Edit" in team section → right column shows team edit form; saving works
- [ ] **Specs tab**: Clicking an agent row → right column shows AgentCard; Edit/Save/Delete work
- [ ] **Specs tab**: Adding agent via `+` button → new agent appears in list and is selected
- [ ] **Deployments tab**: env dropdown, keepDisks, forceRecreate checkboxes visible
- [ ] **Deployments tab**: Git section appears only when repo is dirty
- [ ] **Deployments tab**: Clicking Deploy → output panel slides up with Files + Log columns
- [ ] **Deployments tab**: `preparing` state shows "Deriving files…" in Files column
- [ ] **Chat tab**: Agent sidebar, Chat/Files sub-tabs, no Details sub-tab
- [ ] **Chat tab**: Selecting an agent and chatting works
- [ ] Navigating away and back to a team resets to "Team Specifications" tab
