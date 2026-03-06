import { useState, useMemo } from 'react'
import { useProviders } from '../../hooks/useProviders'
import { AgentCard } from './AgentCard'
import { Plus } from 'lucide-react'
import type { TeamSpec, AgentSpec } from '../../../../shared/types'
import { generateAutoAgentIdentities, type AgentNameTheme } from '../../../../shared/agentNames'

interface Props {
  spec: TeamSpec
  onSpecChange: (spec: TeamSpec) => void
}

const nameThemeOptions: Array<{ value: AgentNameTheme; label: string }> = [
  { value: 'sci-fi', label: 'Sci-Fi' },
  { value: 'movies', label: 'Movies' },
  { value: 'mixed', label: 'Mixed' },
]

export function AgentsTab({ spec, onSpecChange }: Props) {
  const { data: providers } = useProviders()
  const providerSlugs = (providers ?? []).map(p => p.slug)
  const [nameTheme, setNameTheme] = useState<AgentNameTheme>('sci-fi')

  const applyAgents = (agents: AgentSpec[]) => {
    onSpecChange({ ...spec, agents, leadAgent: agents[0]?.slug || undefined })
  }

  const addAutoAgents = (count: number) => {
    const generated = generateAutoAgentIdentities(spec.agents, count, nameTheme)
    if (!generated.length) return
    const newAgents: AgentSpec[] = generated.map((identity) => ({
      slug: identity.slug,
      name: identity.name,
      role: '',
      provider: '',
      skills: [],
      persona: '',
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

  const [nextAutoName] = useMemo(
    () => generateAutoAgentIdentities(spec.agents, 1, nameTheme),
    [spec.agents, nameTheme]
  )

  return (
    <div className="py-6 px-6 max-w-2xl space-y-4">
      {/* Controls bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold text-gray-900">
            Agents ({spec.agents.length})
          </span>
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-gray-400">Name pack</span>
            <div className="inline-flex rounded-md border border-gray-200 bg-gray-50 p-0.5">
              {nameThemeOptions.map((option) => {
                const active = nameTheme === option.value
                return (
                  <button
                    key={option.value}
                    onClick={() => setNameTheme(option.value)}
                    className={`text-xs px-2 py-0.5 rounded transition-colors ${
                      active
                        ? 'bg-white text-gray-900 shadow-sm'
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    {option.label}
                  </button>
                )
              })}
            </div>
            {nextAutoName && (
              <span className="text-xs text-gray-400 truncate">
                next: {nextAutoName.name}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => addAutoAgents(1)}
            className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-md bg-blue-600 text-white hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-3 h-3" /> Add 1
          </button>
          <button
            onClick={() => addAutoAgents(10)}
            className="px-2.5 py-1.5 text-xs font-medium rounded-md bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
          >
            + 10
          </button>
        </div>
      </div>

      {/* Agent cards */}
      {spec.agents.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-200 p-8 text-center">
          <p className="text-sm text-gray-500">No agents yet. Add agents to get started.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {spec.agents.map((agent, i) => (
            <AgentCard
              key={i}
              teamSlug={spec.slug}
              agent={agent}
              isFirst={i === 0}
              providerSlugs={providerSlugs}
              onChange={updated => updateAgent(i, updated)}
              onDelete={() => deleteAgent(i)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
