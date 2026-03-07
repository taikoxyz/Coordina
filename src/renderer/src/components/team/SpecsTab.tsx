// Two-column Finder-style layout for team and agent spec editing
// FEATURE: Team specifications tab with sidebar navigation and detail panel
import { useCallback, useState } from 'react'
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

type RightPanel = { kind: 'none' } | { kind: 'team-edit' } | { kind: 'agent'; slug: string }

const inputCls =
  'w-full rounded-md border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent'
const monoInputCls = inputCls + ' font-mono'
const labelCls = 'block text-xs font-medium text-gray-600 mb-1'

export function SpecsTab({ spec, onSpecChange, onSave, onSaveSpec, isSaving }: Props) {
  const [panel, setPanel] = useState<RightPanel>({ kind: 'none' })
  const [isEditingAgent, setIsEditingAgent] = useState(false)

  const { data: providers } = useProviders()
  const { data: settings } = useSettings()

  const providerSlugs = (providers ?? []).map((p) => p.slug)

  const set = useCallback(
    (key: keyof TeamSpec) => (value: unknown) => onSpecChange({ ...spec, [key]: value }),
    [spec, onSpecChange],
  )

  const handleTeamEditToggle = () => {
    setPanel((prev) => (prev.kind === 'team-edit' ? { kind: 'none' } : { kind: 'team-edit' }))
  }

  const handleAgentClick = (agentSlug: string) => {
    setPanel({ kind: 'agent', slug: agentSlug })
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
    const updated = { ...spec, agents: [...spec.agents, newAgent] }
    onSpecChange(updated)
    setPanel({ kind: 'agent', slug: identity.slug })
    setIsEditingAgent(true)
  }

  const handleAgentChange = (updated: AgentSpec) => {
    const agents = spec.agents.map((a) =>
      a.slug === (panel.kind === 'agent' ? panel.slug : '') ? updated : a,
    )
    onSpecChange({ ...spec, agents })
    if (panel.kind === 'agent' && updated.slug !== panel.slug) {
      setPanel({ kind: 'agent', slug: updated.slug })
    }
  }

  const handleAgentDelete = () => {
    if (panel.kind !== 'agent') return
    const agents = spec.agents.filter((a) => a.slug !== panel.slug)
    onSpecChange({ ...spec, agents })
    setPanel({ kind: 'none' })
  }

  const selectedAgent =
    panel.kind === 'agent' ? spec.agents.find((a) => a.slug === panel.slug) : undefined

  return (
    <div className="flex flex-1 min-h-0 overflow-hidden">
      {/* Left sidebar */}
      <div className="w-80 shrink-0 flex flex-col border-r border-gray-200 overflow-hidden" style={{ background: '#f6f5f3' }}>

        {/* Team section */}
        <div className="px-3 pt-3 pb-1">
          <div className="flex items-center justify-between mb-1 px-1">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">
              Team
            </span>
            <button
              onClick={handleTeamEditToggle}
              className="text-[11px] font-medium text-blue-600 hover:text-blue-700 transition-colors"
            >
              {panel.kind === 'team-edit' ? 'Done' : 'Edit'}
            </button>
          </div>

          <div
            className={`rounded-md px-2 py-1.5 cursor-pointer transition-colors ${panel.kind === 'team-edit' ? 'bg-blue-50 ring-1 ring-blue-200' : 'hover:bg-black/5'}`}
            onClick={handleTeamEditToggle}
          >
            <div className="flex items-baseline gap-2">
              <span className="text-sm font-medium text-gray-900 truncate">{spec.name || 'Unnamed team'}</span>
              <span className="text-[11px] font-mono text-gray-400 truncate">{spec.slug}</span>
            </div>
            {spec.telegramGroupId && (
              <div className="text-[11px] text-gray-400 font-mono mt-0.5 truncate">
                TG {spec.telegramGroupId}
              </div>
            )}
          </div>
        </div>

        <div className="mx-4 my-2 h-px bg-gray-200" />

        {/* Agents section */}
        <div className="px-3 pb-1 shrink-0">
          <div className="flex items-center justify-between mb-1 px-1">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">
              Agents
            </span>
            <button
              onClick={handleAddAgent}
              className="text-[13px] font-medium text-blue-600 hover:text-blue-700 leading-none transition-colors"
              title="Add agent"
            >
              +
            </button>
          </div>
        </div>

        {/* Agent list */}
        <div className="flex-1 overflow-y-auto px-3 pb-3 space-y-0.5">
          {spec.agents.length === 0 ? (
            <div className="px-1 py-2 text-xs text-gray-400">No agents yet. Click + to add one.</div>
          ) : (
            spec.agents.map((agent, index) => {
              const isSelected = panel.kind === 'agent' && panel.slug === agent.slug
              return (
                <div
                  key={agent.slug}
                  onClick={() => handleAgentClick(agent.slug)}
                  className={`flex items-center gap-2 rounded-md px-2 py-1.5 cursor-pointer transition-colors ${isSelected ? 'bg-blue-50 ring-1 ring-blue-200' : 'hover:bg-black/5'}`}
                >
                  {agent.emoji ? (
                    <span className="text-base shrink-0">{agent.emoji}</span>
                  ) : (
                    <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center text-[10px] font-semibold text-gray-500 shrink-0">
                      {(agent.name || '?').charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-medium text-gray-900 truncate">
                        {agent.name || 'Unnamed'}
                      </span>
                      {index === 0 && (
                        <span className="text-[10px] text-blue-500 shrink-0">· Lead</span>
                      )}
                    </div>
                    {agent.role && (
                      <div className="text-[11px] text-gray-400 truncate">{agent.role}</div>
                    )}
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* Right panel */}
      <div className="flex-1 bg-white flex flex-col min-h-0 overflow-hidden">
        {panel.kind === 'none' && (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-sm text-gray-400">Select an item to view details</p>
          </div>
        )}

        {panel.kind === 'team-edit' && (
          <div className="flex-1 overflow-y-auto min-h-0">
            <div className="max-w-2xl mx-auto space-y-5 py-6 px-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-gray-900">Edit team</h3>
                  <p className="text-sm text-gray-500 mt-1">
                    Update the base team configuration and save when finished.
                  </p>
                </div>
                <button
                  onClick={() => void onSave()}
                  disabled={isSaving}
                  className="px-3 py-1.5 text-sm font-medium rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  {isSaving ? 'Saving...' : 'Save'}
                </button>
              </div>

              <div>
                <h4 className="text-xs font-semibold text-gray-700 uppercase tracking-wider mb-3">
                  Team details
                </h4>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>Name</label>
                    <input
                      className={inputCls}
                      value={spec.name}
                      onChange={(e) => set('name')(e.target.value)}
                      placeholder="My Team"
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Slug</label>
                    <input
                      className={monoInputCls}
                      value={spec.slug}
                      onChange={(e) => set('slug')(e.target.value)}
                      placeholder="my-team"
                    />
                  </div>
                </div>
              </div>

              <div>
                <h4 className="text-xs font-semibold text-gray-700 uppercase tracking-wider mb-3">
                  Telegram integration
                </h4>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>Group ID</label>
                    <input
                      className={monoInputCls}
                      value={spec.telegramGroupId ?? ''}
                      onChange={(e) => set('telegramGroupId')(e.target.value || undefined)}
                      placeholder="-1001234567890"
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Admin ID</label>
                    <input
                      className={monoInputCls}
                      value={spec.telegramAdminId ?? ''}
                      onChange={(e) => set('telegramAdminId')(e.target.value || undefined)}
                      placeholder="123456789"
                    />
                  </div>
                </div>
              </div>

              <div>
                <h4 className="text-xs font-semibold text-gray-700 uppercase tracking-wider mb-3">
                  Infrastructure defaults
                </h4>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>Default container image</label>
                    <input
                      className={monoInputCls}
                      value={spec.defaultImage ?? ''}
                      onChange={(e) => set('defaultImage')(e.target.value || undefined)}
                      placeholder="ghcr.io/org/openclaw:latest"
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Storage (Gi)</label>
                    <input
                      type="number"
                      min={1}
                      className={inputCls}
                      value={spec.defaultDiskGi ?? ''}
                      onChange={(e) =>
                        set('defaultDiskGi')(e.target.value ? parseInt(e.target.value, 10) : undefined)
                      }
                      placeholder="100"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className={labelCls}>Startup instructions</label>
                <textarea
                  className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none font-mono"
                  rows={4}
                  value={spec.startupInstructions ?? ''}
                  onChange={(e) => set('startupInstructions')(e.target.value || undefined)}
                  placeholder="Custom startup instructions..."
                />
              </div>
            </div>
          </div>
        )}

        {panel.kind === 'agent' && selectedAgent && (
          <div className="flex-1 overflow-y-auto min-h-0">
            <div className="max-w-2xl mx-auto py-6 px-6">
              <AgentCard
                teamSlug={spec.slug}
                agent={selectedAgent}
                isFirst={spec.agents[0]?.slug === selectedAgent.slug}
                providerSlugs={providerSlugs}
                isEditing={isEditingAgent}
                onEdit={() => setIsEditingAgent(true)}
                onSave={async () => {
                  await onSaveSpec(spec)
                  setIsEditingAgent(false)
                }}
                isSaving={isSaving}
                onChange={handleAgentChange}
                onDelete={handleAgentDelete}
              />
            </div>
          </div>
        )}

        {panel.kind === 'agent' && !selectedAgent && (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-sm text-gray-400">Agent not found</p>
          </div>
        )}
      </div>
    </div>
  )
}
