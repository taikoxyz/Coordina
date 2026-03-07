// Single-panel layout with dynamic Finder-style split when an agent is selected
// FEATURE: Team specifications tab with overview, members list, and agent detail panel
import { useCallback, useState } from 'react'
import { cn } from '../../lib/utils'
import type { AgentSpec, TeamSpec } from '../../../../shared/types'
import { generateAutoAgentIdentities, DEFAULT_AGENT_NAME_THEME } from '../../../../shared/agentNames'
import { useProviders } from '../../hooks/useProviders'
import { useSettings } from '../../hooks/useSettings'
import { AgentCard } from './AgentCard'

interface Props {
  spec: TeamSpec
  onSpecChange: (spec: TeamSpec) => void
  onSave: () => Promise<void>
  onSaveSpec: (spec: TeamSpec) => Promise<void>
  isSaving: boolean
}

const inputCls =
  'w-full rounded-md border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent'
const monoInputCls = inputCls + ' font-mono'
const textareaCls =
  'w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none font-mono'
const labelCls = 'block text-xs font-medium text-gray-600 mb-1'

export function SpecsTab({ spec, onSpecChange, onSave, onSaveSpec, isSaving }: Props) {
  const [isEditing, setIsEditing] = useState(false)
  const [selectedAgentSlug, setSelectedAgentSlug] = useState<string | null>(null)
  const [isEditingAgent, setIsEditingAgent] = useState(false)

  const { data: providers } = useProviders()
  const { data: settings } = useSettings()
  const providerSlugs = (providers ?? []).map((p) => p.slug)

  const set = useCallback(
    <K extends keyof TeamSpec>(key: K) => (value: TeamSpec[K]) =>
      onSpecChange({ ...spec, [key]: value }),
    [spec, onSpecChange],
  )

  const handleStartEdit = () => {
    setIsEditing(true)
    setSelectedAgentSlug(null)
  }

  const handleDoneEdit = async () => {
    await onSave()
    setIsEditing(false)
  }

  const handleAgentClick = (slug: string) => {
    setSelectedAgentSlug(slug)
    setIsEditingAgent(false)
  }

  const handleAddAgent = () => {
    const theme = settings?.agentNameTheme ?? DEFAULT_AGENT_NAME_THEME
    const [identity] = generateAutoAgentIdentities(spec.agents, 1, theme)
    const newAgent: AgentSpec = {
      slug: identity.slug,
      name: identity.name,
      role: '',
      skills: [],
      persona: '',
      provider: providerSlugs[0] ?? '',
    }
    onSpecChange({ ...spec, agents: [...spec.agents, newAgent] })
    setSelectedAgentSlug(identity.slug)
    setIsEditingAgent(true)
  }

  const handleAgentChange = (updated: AgentSpec) => {
    const agents = spec.agents.map((a) => (a.slug === selectedAgentSlug ? updated : a))
    onSpecChange({ ...spec, agents })
    if (updated.slug !== selectedAgentSlug) setSelectedAgentSlug(updated.slug)
  }

  const handleAgentSave = useCallback(async () => {
    await onSaveSpec(spec)
    setIsEditingAgent(false)
  }, [onSaveSpec, spec])

  const handleAgentDelete = () => {
    const agents = spec.agents.filter((a) => a.slug !== selectedAgentSlug)
    onSpecChange({ ...spec, agents })
    setSelectedAgentSlug(null)
  }

  const selectedAgent = selectedAgentSlug
    ? spec.agents.find((a) => a.slug === selectedAgentSlug)
    : undefined
  const showRightPanel = !isEditing && selectedAgentSlug !== null

  return (
    <div className="flex flex-1 min-h-0 overflow-hidden">
      {/* Main panel */}
      <div
        className={cn(
          'flex flex-col overflow-y-auto bg-[#f6f5f3]',
          showRightPanel ? 'w-80 shrink-0 border-r border-gray-200' : 'flex-1',
        )}
      >
        {isEditing ? (
          /* Edit form — full panel, members hidden */
          <div className="max-w-2xl mx-auto w-full space-y-5 py-6 px-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-gray-900">Edit team</h3>
                <p className="text-sm text-gray-500 mt-1">Update the team configuration and save when finished.</p>
              </div>
              <button
                onClick={() => void handleDoneEdit()}
                disabled={isSaving}
                className="px-3 py-1.5 text-sm font-medium rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {isSaving ? 'Saving...' : 'Save'}
              </button>
            </div>

            <div>
              <h4 className="text-xs font-semibold text-gray-700 uppercase tracking-wider mb-3">Team details</h4>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Name</label>
                  <input className={inputCls} value={spec.name} onChange={(e) => set('name')(e.target.value)} placeholder="My Team" />
                </div>
                <div>
                  <label className={labelCls}>Slug</label>
                  <input className={monoInputCls} value={spec.slug} onChange={(e) => set('slug')(e.target.value)} placeholder="my-team" />
                </div>
              </div>
            </div>

            <div>
              <h4 className="text-xs font-semibold text-gray-700 uppercase tracking-wider mb-3">Telegram integration</h4>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Group ID</label>
                  <input className={monoInputCls} value={spec.telegramGroupId ?? ''} onChange={(e) => set('telegramGroupId')(e.target.value || undefined)} placeholder="-1001234567890" />
                </div>
                <div>
                  <label className={labelCls}>Admin ID</label>
                  <input className={monoInputCls} value={spec.telegramAdminId ?? ''} onChange={(e) => set('telegramAdminId')(e.target.value || undefined)} placeholder="123456789" />
                </div>
              </div>
            </div>

            <div>
              <h4 className="text-xs font-semibold text-gray-700 uppercase tracking-wider mb-3">Infrastructure defaults</h4>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Default container image</label>
                  <input className={monoInputCls} value={spec.defaultImage ?? ''} onChange={(e) => set('defaultImage')(e.target.value || undefined)} placeholder="ghcr.io/org/openclaw:latest" />
                </div>
                <div>
                  <label className={labelCls}>Storage (Gi)</label>
                  <input type="number" min={1} className={inputCls} value={spec.defaultDiskGi ?? ''} onChange={(e) => set('defaultDiskGi')(e.target.value ? parseInt(e.target.value, 10) : undefined)} placeholder="100" />
                </div>
              </div>
            </div>

            <div>
              <label className={labelCls}>Startup instructions</label>
              <textarea className={textareaCls} rows={4} value={spec.startupInstructions ?? ''} onChange={(e) => set('startupInstructions')(e.target.value || undefined)} placeholder="Custom startup instructions..." />
            </div>
          </div>
        ) : (
          /* Read view — Overview + Members */
          <div className={cn('py-4 px-4 space-y-5', !showRightPanel && 'max-w-xl mx-auto w-full')}>

            {/* Overview section */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">Overview</span>
                <button
                  onClick={handleStartEdit}
                  className="text-[11px] font-medium text-blue-600 hover:text-blue-700 transition-colors"
                >
                  Edit
                </button>
              </div>
              <div className="rounded-lg border border-gray-200 bg-white px-3 py-2.5">
                <div className="flex items-baseline gap-2 flex-wrap">
                  <span className="text-sm font-semibold text-gray-900">{spec.name || 'Unnamed team'}</span>
                  <span className="text-[11px] font-mono text-gray-400">{spec.slug}</span>
                </div>
                {spec.telegramGroupId && (
                  <div className="text-[11px] font-mono text-gray-400 mt-0.5">TG {spec.telegramGroupId}</div>
                )}
              </div>
            </div>

            {/* Members section */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">Members</span>
                <button
                  onClick={handleAddAgent}
                  className="text-[13px] font-medium text-blue-600 hover:text-blue-700 leading-none transition-colors"
                  title="Add agent"
                >
                  +
                </button>
              </div>
              {spec.agents.length === 0 ? (
                <div className="text-xs text-gray-400 py-1">No agents yet. Click + to add one.</div>
              ) : (
                <div className="space-y-0.5">
                  {spec.agents.map((agent) => {
                    const isSelected = agent.slug === selectedAgentSlug
                    return (
                      <div
                        key={agent.slug}
                        onClick={() => handleAgentClick(agent.slug)}
                        className={cn(
                          'flex items-center gap-2.5 rounded-lg px-2.5 py-2 cursor-pointer transition-colors',
                          isSelected ? 'bg-blue-50 ring-1 ring-blue-200' : 'hover:bg-black/5',
                        )}
                      >
                        {agent.emoji ? (
                          <span className="text-lg shrink-0">{agent.emoji}</span>
                        ) : (
                          <div className="w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center text-[11px] font-semibold text-gray-500 shrink-0">
                            {(agent.name || '?').charAt(0).toUpperCase()}
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm font-medium text-gray-900 truncate">{agent.name || 'Unnamed'}</span>
                            {agent.slug === spec.agents[0]?.slug && (
                              <span className="text-[10px] text-blue-500 shrink-0">· Lead</span>
                            )}
                          </div>
                          {agent.role && (
                            <div className="text-[11px] text-gray-400 truncate">{agent.role}</div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Right panel — agent detail */}
      {showRightPanel && (
        <div className="flex-1 bg-white overflow-y-auto min-h-0">
          {selectedAgent ? (
            <div className="max-w-2xl mx-auto py-6 px-6">
              <AgentCard
                teamSlug={spec.slug}
                agent={selectedAgent}
                isFirst={spec.agents[0]?.slug === selectedAgent.slug}
                providerSlugs={providerSlugs}
                isEditing={isEditingAgent}
                onEdit={() => setIsEditingAgent(true)}
                onSave={handleAgentSave}
                isSaving={isSaving}
                onChange={handleAgentChange}
                onDelete={handleAgentDelete}
              />
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center h-full">
              <p className="text-sm text-gray-400">Agent not found</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
