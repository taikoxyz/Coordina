import { useEffect, useMemo, useState } from 'react'
import { useProviders } from '../../hooks/useProviders'
import { AgentCard } from './AgentCard'
import { ChatPane } from '../chat/ChatPane'
import { FileBrowser } from '../files/FileBrowser'
import {
  FileText,
  MessageSquareText,
  Plus,
  SlidersHorizontal,
} from 'lucide-react'
import { cn } from '../../lib/utils'
import type { TeamSpec, AgentSpec } from '../../../../shared/types'
import {
  generateAutoAgentIdentities,
  type AgentNameTheme,
} from '../../../../shared/agentNames'

interface Props {
  spec: TeamSpec
  onSpecChange: (spec: TeamSpec) => void
  envSlug?: string
}

const nameThemeOptions: Array<{ value: AgentNameTheme; label: string }> = [
  { value: 'sci-fi', label: 'Sci-Fi' },
  { value: 'movies', label: 'Movies' },
  { value: 'mixed', label: 'Mixed' },
]

export function AgentsTab({ spec, onSpecChange, envSlug }: Props) {
  const { data: providers } = useProviders()
  const providerSlugs = (providers ?? []).map((p) => p.slug)
  const [nameTheme, setNameTheme] = useState<AgentNameTheme>('sci-fi')
  const [selectedAgentSlug, setSelectedAgentSlug] = useState(
    spec.agents[0]?.slug ?? '',
  )
  const [panelMode, setPanelMode] = useState<'details' | 'chat' | 'files'>(
    'details',
  )

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
    [spec.agents, nameTheme],
  )

  useEffect(() => {
    if (!spec.agents.length) {
      setSelectedAgentSlug('')
      return
    }
    if (
      !selectedAgentSlug ||
      !spec.agents.some((agent) => agent.slug === selectedAgentSlug)
    ) {
      setSelectedAgentSlug(spec.agents[0].slug)
    }
  }, [spec.agents, selectedAgentSlug])

  const selectedAgentIndex = spec.agents.findIndex(
    (agent) => agent.slug === selectedAgentSlug,
  )
  const activeAgent = spec.agents[selectedAgentIndex] ?? spec.agents[0]
  const compactModes = [
    { id: 'details', label: 'Details', icon: SlidersHorizontal },
    { id: 'chat', label: 'Chat', icon: MessageSquareText },
    { id: 'files', label: 'Files', icon: FileText },
  ] as const

  return (
    <div className="flex h-full overflow-hidden">
      <div className="w-52 shrink-0 border-r border-gray-100 bg-[#f6f5f3] flex flex-col">
        <div className="px-3 py-3 border-b border-gray-100">
          <div className="flex items-center justify-between gap-2">
            <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-gray-400">
              Agents
            </div>
            <button
              onClick={() => addAutoAgents(1)}
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
              <div className="flex items-center gap-2">
                {agent.emoji ? (
                  <span className="text-[13px]">{agent.emoji}</span>
                ) : (
                  <div className="w-5 h-5 rounded-full bg-blue-50 flex items-center justify-center text-[10px] font-semibold text-blue-600">
                    {(agent.name || '?').charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="min-w-0">
                  <div className="text-[12px] font-medium truncate">
                    {agent.name || agent.slug}
                  </div>
                  <div className="text-[10px] text-gray-400 truncate font-mono">
                    {index === 0 ? 'Lead' : 'Direct'} · {agent.slug}
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 min-w-0 overflow-hidden flex flex-col bg-white">
        <div className="border-b border-gray-100 px-6 py-3 shrink-0">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <div className="text-sm font-semibold text-gray-900 truncate">
                {activeAgent?.name || 'Agent details'}
              </div>
              <div className="text-[11px] text-gray-400 font-mono truncate">
                {activeAgent ? activeAgent.slug : 'Select an agent'}
              </div>
            </div>
            <div className="inline-flex rounded-xl border border-gray-200 bg-gray-50 p-1">
              {compactModes.map((mode) => {
                const Icon = mode.icon
                return (
                  <button
                    key={mode.id}
                    onClick={() => setPanelMode(mode.id)}
                    className={cn(
                      'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-medium transition-colors',
                      panelMode === mode.id
                        ? 'bg-white text-gray-900 shadow-sm'
                        : 'text-gray-500 hover:text-gray-700',
                    )}
                  >
                    <Icon className="w-3.5 h-3.5 shrink-0" />
                    {mode.label}
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-hidden">
          {!activeAgent ? (
            <div className="py-6 px-6 max-w-2xl space-y-4 h-full overflow-y-auto">
              <div className="rounded-lg border border-dashed border-gray-200 p-8 text-center">
                <p className="text-sm text-gray-500">
                  No agents yet. Add agents to get started.
                </p>
              </div>
            </div>
          ) : panelMode === 'details' ? (
            <div className="py-6 px-6 max-w-2xl space-y-4 h-full overflow-y-auto">
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
              </div>

              <AgentCard
                key={activeAgent.slug}
                teamSlug={spec.slug}
                agent={activeAgent}
                isFirst={selectedAgentIndex <= 0}
                providerSlugs={providerSlugs}
                onChange={(updated) => {
                  setSelectedAgentSlug(updated.slug)
                  updateAgent(selectedAgentIndex, updated)
                }}
                onDelete={() => deleteAgent(selectedAgentIndex)}
              />
            </div>
          ) : panelMode === 'chat' ? (
            <ChatPane
              teamSlug={spec.slug}
              envSlug={envSlug}
              agentSlug={
                selectedAgentSlug === spec.agents[0]?.slug
                  ? undefined
                  : selectedAgentSlug
              }
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
