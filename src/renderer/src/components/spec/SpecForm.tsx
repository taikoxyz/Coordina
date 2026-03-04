// Structured form for editing team spec fields inline without dialogs
// FEATURE: Team spec editor left panel with agents list and inline field editing
import { useCallback, useMemo, useState } from 'react'
import { useSaveTeam } from '../../hooks/useTeams'
import { useProviders } from '../../hooks/useProviders'
import { AgentRow } from './AgentRow'
import type { TeamSpec, AgentSpec } from '../../../../shared/types'
import { generateAutoAgentIdentities, type AgentNameTheme } from '../../../../shared/agentNames'

interface Props {
  spec: TeamSpec
  onSpecChange: (spec: TeamSpec) => void
}

const inputCls = 'bg-gray-800 border border-gray-700 rounded px-1.5 py-0.5 text-[11px] text-gray-200 focus:outline-none focus:border-blue-600 w-full font-mono'
const labelCls = 'text-[10px] text-gray-500 block mb-0.5'
const nameThemeOptions: Array<{ value: AgentNameTheme; label: string }> = [
  { value: 'sci-fi', label: 'Sci-Fi' },
  { value: 'movies', label: 'Movies' },
  { value: 'mixed', label: 'Mixed' }
]

export function SpecForm({ spec, onSpecChange }: Props) {
  const saveTeam = useSaveTeam()
  const { data: providers } = useProviders()
  const providerSlugs = (providers ?? []).map(p => p.slug)
  const [nameTheme, setNameTheme] = useState<AgentNameTheme>('sci-fi')

  const set = useCallback((key: keyof TeamSpec) => (value: unknown) => {
    onSpecChange({ ...spec, [key]: value })
  }, [spec, onSpecChange])

  const applyAgents = (agents: AgentSpec[]) => {
    const normalized = agents.map((agent, i) => ({ ...agent, isLead: i === 0 }))
    onSpecChange({ ...spec, agents: normalized, leadAgentSlug: normalized[0]?.slug || undefined })
  }

  const addAutoAgents = (count: number) => {
    const generated = generateAutoAgentIdentities(spec.agents, count, nameTheme)
    if (!generated.length) return

    const newAgents: AgentSpec[] = generated.map((identity) => ({
      slug: identity.slug,
      name: identity.name,
      role: '',
      providerSlug: '',
      skills: [],
      soul: '',
      isLead: false
    }))

    applyAgents([...spec.agents, ...newAgents])
  }

  const updateAgent = (i: number, updated: AgentSpec) => {
    const agents = [...spec.agents]
    agents[i] = updated
    applyAgents(agents)
  }

  const deleteAgent = (i: number) => {
    applyAgents(spec.agents.filter((_, j) => j !== i))
  }

  const handleSave = () => saveTeam.mutate(spec)
  const [nextAutoName] = useMemo(() => generateAutoAgentIdentities(spec.agents, 1, nameTheme), [spec.agents, nameTheme])

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="px-3 py-2 border-b border-gray-700/60 flex items-center justify-between">
        <span className="text-[11px] text-gray-400 font-medium">Team Spec</span>
        <button
          onClick={handleSave}
          disabled={saveTeam.isPending}
          className="text-[10px] px-2 py-0.5 bg-blue-700 hover:bg-blue-600 disabled:bg-gray-700 text-white rounded transition-colors"
        >
          {saveTeam.isPending ? 'Saving…' : 'Save'}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-2.5">
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className={labelCls}>name</label>
            <input className={inputCls} value={spec.name} onChange={e => set('name')(e.target.value)} placeholder="My Team" />
          </div>
          <div>
            <label className={labelCls}>slug</label>
            <input className={inputCls} value={spec.slug} onChange={e => set('slug')(e.target.value)} placeholder="my-team" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className={labelCls}>default image</label>
            <input className={inputCls} value={spec.image ?? ''} onChange={e => set('image')(e.target.value || undefined)} placeholder="ghcr.io/org/openclaw:latest" />
          </div>
          <div>
            <label className={labelCls}>storage (Gi)</label>
            <input
              type="number"
              min={1}
              className={inputCls}
              value={spec.storageGi ?? ''}
              onChange={e => set('storageGi')(e.target.value ? parseInt(e.target.value, 10) : undefined)}
              placeholder="100"
            />
          </div>
        </div>

        <div>
          <label className={labelCls}>bootstrap instructions</label>
          <textarea
            className="bg-gray-800 border border-gray-700 rounded px-1.5 py-0.5 text-[11px] text-gray-200 focus:outline-none focus:border-blue-600 w-full resize-none font-mono"
            rows={3}
            value={spec.bootstrapInstructions ?? ''}
            onChange={e => set('bootstrapInstructions')(e.target.value || undefined)}
            placeholder="Custom startup instructions..."
          />
        </div>

        <div>
          <div className="mb-1.5 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-gray-500 uppercase tracking-wider">Agents ({spec.agents.length})</span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => addAutoAgents(1)}
                  className="text-[10px] px-1.5 py-0.5 rounded border border-blue-600/60 text-blue-300 hover:border-blue-500 hover:text-blue-200 transition-colors"
                >
                  +1 auto
                </button>
                <button
                  onClick={() => addAutoAgents(10)}
                  className="text-[10px] px-1.5 py-0.5 rounded border border-blue-600/60 text-blue-300 hover:border-blue-500 hover:text-blue-200 transition-colors"
                >
                  +10 auto
                </button>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-gray-600">name pack</span>
              <div role="tablist" aria-label="Agent name pack" className="inline-flex rounded-md border border-gray-700 bg-gray-900/40 p-0.5">
                {nameThemeOptions.map((option) => {
                  const active = nameTheme === option.value
                  return (
                    <button
                      key={option.value}
                      role="tab"
                      aria-selected={active}
                      onClick={() => setNameTheme(option.value)}
                      className={`text-[10px] px-2 py-0.5 rounded transition-colors ${active ? 'bg-gray-700 text-gray-100' : 'text-gray-500 hover:text-gray-300'}`}
                    >
                      {option.label}
                    </button>
                  )
                })}
              </div>
              {nextAutoName && (
                <span className="text-[10px] text-gray-600 truncate">next: {nextAutoName.name}</span>
              )}
            </div>
          </div>
          <div className="space-y-1">
            {spec.agents.map((agent, i) => (
              <AgentRow
                key={i}
                agent={agent}
                isFirst={i === 0}
                providerSlugs={providerSlugs}
                onChange={updated => updateAgent(i, updated)}
                onDelete={() => deleteAgent(i)}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
