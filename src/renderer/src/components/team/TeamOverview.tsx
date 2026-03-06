import { useCallback, useEffect, useMemo, useState } from 'react'
import type { AgentSpec, TeamSpec } from '../../../../shared/types'

interface Props {
  spec: TeamSpec
  onSpecChange: (spec: TeamSpec) => void
  isEditing: boolean
  onEdit: () => void
  onSave: () => Promise<void>
  isSaving: boolean
}

const inputCls = 'w-full rounded-md border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent'
const monoInputCls = inputCls + ' font-mono'
const labelCls = 'block text-xs font-medium text-gray-600 mb-1'
const valueCls = 'min-h-10 rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700'
const emptyValueCls = 'text-gray-400'

function updateAgent(spec: TeamSpec, agentSlug: string, updater: (agent: AgentSpec) => AgentSpec): TeamSpec {
  let nextLeadAgent = spec.leadAgent
  const agents = spec.agents.map(agent => {
    if (agent.slug !== agentSlug) return agent
    const updatedAgent = updater(agent)
    if (spec.leadAgent === agentSlug) nextLeadAgent = updatedAgent.slug
    return updatedAgent
  })

  return {
    ...spec,
    agents,
    leadAgent: nextLeadAgent,
  }
}

function ReadField({ label, value, monospace = false }: { label: string; value?: string | number; monospace?: boolean }) {
  const hasValue = value !== undefined && value !== null && `${value}`.trim().length > 0
  return (
    <div>
      <label className={labelCls}>{label}</label>
      <div className={`${valueCls} ${monospace ? 'font-mono text-xs' : ''} ${hasValue ? '' : emptyValueCls}`}>
        {hasValue ? value : 'Not set'}
      </div>
    </div>
  )
}

export function TeamOverview({ spec, onSpecChange, isEditing, onEdit, onSave, isSaving }: Props) {
  const [selectedAgentSlug, setSelectedAgentSlug] = useState(spec.agents[0]?.slug ?? '')
  const [isEditingMember, setIsEditingMember] = useState(false)

  const set = useCallback((key: keyof TeamSpec) => (value: unknown) => {
    onSpecChange({ ...spec, [key]: value })
  }, [spec, onSpecChange])

  const selectedAgent = useMemo(
    () => spec.agents.find(agent => agent.slug === selectedAgentSlug) ?? spec.agents[0],
    [spec.agents, selectedAgentSlug]
  )

  useEffect(() => {
    if (!spec.agents.length) {
      setSelectedAgentSlug('')
      setIsEditingMember(false)
      return
    }
    if (!selectedAgentSlug || !spec.agents.some(agent => agent.slug === selectedAgentSlug)) {
      setSelectedAgentSlug(spec.agents[0].slug)
    }
  }, [spec.agents, selectedAgentSlug])

  const setSelectedAgentField = useCallback((key: keyof AgentSpec) => (value: unknown) => {
    if (!selectedAgent) return
    if (key === 'slug' && typeof value === 'string') {
      setSelectedAgentSlug(value)
    }
    onSpecChange(updateAgent(spec, selectedAgent.slug, agent => ({ ...agent, [key]: value })))
  }, [onSpecChange, selectedAgent, spec])

  const handleSaveMember = async () => {
    await onSave()
    setIsEditingMember(false)
  }

  if (!isEditing) {
    return (
      <div className="max-w-3xl space-y-5 py-6 px-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Team overview</h3>
            <p className="text-sm text-gray-500 mt-1">Review the current team configuration before making changes.</p>
          </div>
          <button
            onClick={onEdit}
            className="px-3 py-1.5 text-xs font-medium rounded-md bg-blue-600 text-white hover:bg-blue-700 transition-colors"
          >
            Edit team
          </button>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-5 space-y-5">
          <div>
            <h4 className="text-sm font-semibold text-gray-900 mb-3">Team details</h4>
            <div className="grid grid-cols-2 gap-3">
              <ReadField label="Name" value={spec.name} />
              <ReadField label="Slug" value={spec.slug} monospace />
            </div>
          </div>

          <div>
            <h4 className="text-sm font-semibold text-gray-900 mb-3">Telegram integration</h4>
            <div className="grid grid-cols-2 gap-3">
              <ReadField label="Group ID" value={spec.telegramGroupId} monospace />
              <ReadField label="Admin ID" value={spec.telegramAdminId} monospace />
            </div>
          </div>

          <div>
            <h4 className="text-sm font-semibold text-gray-900 mb-3">Infrastructure defaults</h4>
            <div className="grid grid-cols-2 gap-3">
              <ReadField label="Default container image" value={spec.defaultImage} monospace />
              <ReadField label="Storage (Gi)" value={spec.defaultDiskGi} />
            </div>
          </div>

          <div>
            <label className={labelCls}>Startup instructions</label>
            <div className={`${valueCls} min-h-28 whitespace-pre-wrap font-mono text-xs ${spec.startupInstructions?.trim() ? '' : emptyValueCls}`}>
              {spec.startupInstructions?.trim() || 'Not set'}
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h4 className="text-sm font-semibold text-gray-900">Team members</h4>
              <p className="text-sm text-gray-500 mt-1">Select a member to inspect their current configuration.</p>
            </div>
            <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">
              {spec.agents.length} total
            </span>
          </div>

          {spec.agents.length === 0 ? (
            <div className="rounded-lg border border-dashed border-gray-200 p-6 text-sm text-gray-500">
              No team members configured.
            </div>
          ) : (
            <div className="grid grid-cols-[220px_minmax(0,1fr)] gap-4">
              <div className="space-y-1">
                {spec.agents.map((agent) => {
                  const active = agent.slug === selectedAgent?.slug
                  const isLead = agent.slug === spec.leadAgent
                  return (
                    <button
                      key={agent.slug}
                      onClick={() => {
                        setSelectedAgentSlug(agent.slug)
                        setIsEditingMember(false)
                      }}
                      className={`w-full rounded-lg border px-3 py-2 text-left transition-colors ${
                        active
                          ? 'border-blue-200 bg-blue-50'
                          : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-medium text-gray-900 truncate">{agent.name || agent.slug}</span>
                        {isLead && (
                          <span className="rounded-full bg-gray-900 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-white">
                            Lead
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-gray-500 font-mono mt-1 truncate">{agent.slug}</div>
                      <div className="text-xs text-gray-400 mt-1 truncate">{agent.role || 'No role set'}</div>
                    </button>
                  )
                })}
              </div>

              {selectedAgent && (
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 space-y-4 min-w-0">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h5 className="text-base font-semibold text-gray-900 truncate">{selectedAgent.name || selectedAgent.slug}</h5>
                        {selectedAgent.slug === spec.leadAgent && (
                          <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-blue-700">
                            Lead
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 font-mono mt-1">{selectedAgent.slug}</p>
                    </div>
                    {isEditingMember ? (
                      <button
                        onClick={handleSaveMember}
                        disabled={isSaving}
                        className="px-3 py-1.5 text-xs font-medium rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
                      >
                        {isSaving ? 'Saving...' : 'Save'}
                      </button>
                    ) : (
                      <button
                        onClick={() => setIsEditingMember(true)}
                        className="px-3 py-1.5 text-xs font-medium rounded-md bg-white text-gray-700 border border-gray-200 hover:bg-gray-100 transition-colors"
                      >
                        Edit member
                      </button>
                    )}
                  </div>

                  {isEditingMember ? (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className={labelCls}>Name</label>
                          <input className={inputCls} value={selectedAgent.name} onChange={e => setSelectedAgentField('name')(e.target.value)} />
                        </div>
                        <div>
                          <label className={labelCls}>Slug</label>
                          <input className={monoInputCls} value={selectedAgent.slug} onChange={e => setSelectedAgentField('slug')(e.target.value)} />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className={labelCls}>Role</label>
                          <input className={inputCls} value={selectedAgent.role} onChange={e => setSelectedAgentField('role')(e.target.value)} />
                        </div>
                        <div>
                          <label className={labelCls}>Provider</label>
                          <input className={monoInputCls} value={selectedAgent.provider} onChange={e => setSelectedAgentField('provider')(e.target.value)} />
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <label className={labelCls}>Telegram Bot</label>
                          <input className={monoInputCls} value={selectedAgent.telegramBot ?? ''} onChange={e => setSelectedAgentField('telegramBot')(e.target.value || undefined)} />
                        </div>
                        <div>
                          <label className={labelCls}>Email</label>
                          <input className={inputCls} value={selectedAgent.email ?? ''} onChange={e => setSelectedAgentField('email')(e.target.value || undefined)} />
                        </div>
                        <div>
                          <label className={labelCls}>Slack</label>
                          <input className={inputCls} value={selectedAgent.slack ?? ''} onChange={e => setSelectedAgentField('slack')(e.target.value || undefined)} />
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <label className={labelCls}>GitHub</label>
                          <input className={inputCls} value={selectedAgent.githubUsername ?? ''} onChange={e => setSelectedAgentField('githubUsername')(e.target.value || undefined)} />
                        </div>
                        <div>
                          <label className={labelCls}>Container image</label>
                          <input className={monoInputCls} value={selectedAgent.image ?? ''} onChange={e => setSelectedAgentField('image')(e.target.value || undefined)} />
                        </div>
                        <div>
                          <label className={labelCls}>Emoji</label>
                          <input className={inputCls} value={selectedAgent.emoji ?? ''} onChange={e => setSelectedAgentField('emoji')(e.target.value || undefined)} />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className={labelCls}>CPU (cores)</label>
                          <input
                            type="number"
                            min={0.1}
                            step={0.5}
                            className={inputCls}
                            value={selectedAgent.cpu ?? ''}
                            onChange={e => setSelectedAgentField('cpu')(e.target.value ? parseFloat(e.target.value) : undefined)}
                          />
                        </div>
                        <div>
                          <label className={labelCls}>Disk (Gi)</label>
                          <input
                            type="number"
                            min={1}
                            step={1}
                            className={inputCls}
                            value={selectedAgent.diskGi ?? ''}
                            onChange={e => setSelectedAgentField('diskGi')(e.target.value ? parseInt(e.target.value, 10) : undefined)}
                          />
                        </div>
                      </div>

                      <div>
                        <label className={labelCls}>Skills</label>
                        <input
                          className={inputCls}
                          value={selectedAgent.skills.join(', ')}
                          onChange={e => setSelectedAgentField('skills')(
                            e.target.value
                              .split(',')
                              .map(skill => skill.trim())
                              .filter(Boolean)
                          )}
                          placeholder="research, coding, design"
                        />
                      </div>

                      <div>
                        <label className={labelCls}>Persona</label>
                        <textarea
                          className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                          rows={5}
                          value={selectedAgent.persona}
                          onChange={e => setSelectedAgentField('persona')(e.target.value)}
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-3">
                        <ReadField label="Name" value={selectedAgent.name} />
                        <ReadField label="Slug" value={selectedAgent.slug} monospace />
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <ReadField label="Role" value={selectedAgent.role} />
                        <ReadField label="Provider" value={selectedAgent.provider} monospace />
                      </div>

                      <div className="grid grid-cols-3 gap-3">
                        <ReadField label="Telegram Bot" value={selectedAgent.telegramBot} monospace />
                        <ReadField label="Email" value={selectedAgent.email} />
                        <ReadField label="Slack" value={selectedAgent.slack} />
                      </div>

                      <div className="grid grid-cols-3 gap-3">
                        <ReadField label="GitHub" value={selectedAgent.githubUsername} />
                        <ReadField label="Container image" value={selectedAgent.image} monospace />
                        <ReadField label="Emoji" value={selectedAgent.emoji} />
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <ReadField label="CPU (cores)" value={selectedAgent.cpu} />
                        <ReadField label="Disk (Gi)" value={selectedAgent.diskGi} />
                      </div>

                      <ReadField label="Skills" value={selectedAgent.skills.join(', ')} />

                      <div>
                        <label className={labelCls}>Persona</label>
                        <div className={`${valueCls} min-h-28 whitespace-pre-wrap ${selectedAgent.persona?.trim() ? '' : emptyValueCls}`}>
                          {selectedAgent.persona?.trim() || 'Not set'}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-xl space-y-5 py-6 px-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">Edit team</h3>
          <p className="text-sm text-gray-500 mt-1">Update the base team configuration and save when finished.</p>
        </div>
        <button
          onClick={onSave}
          disabled={isSaving}
          className="px-3 py-1.5 text-xs font-medium rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
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
            <input
              className={monoInputCls}
              value={spec.telegramGroupId ?? ''}
              onChange={e => set('telegramGroupId')(e.target.value || undefined)}
              placeholder="-1001234567890"
            />
          </div>
          <div>
            <label className={labelCls}>Admin ID</label>
            <input
              className={monoInputCls}
              value={spec.telegramAdminId ?? ''}
              onChange={e => set('telegramAdminId')(e.target.value || undefined)}
              placeholder="123456789"
            />
          </div>
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Infrastructure defaults</h3>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Default container image</label>
            <input
              className={monoInputCls}
              value={spec.defaultImage ?? ''}
              onChange={e => set('defaultImage')(e.target.value || undefined)}
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
              onChange={e => set('defaultDiskGi')(e.target.value ? parseInt(e.target.value, 10) : undefined)}
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
          onChange={e => set('startupInstructions')(e.target.value || undefined)}
          placeholder="Custom startup instructions..."
        />
      </div>
    </div>
  )
}
