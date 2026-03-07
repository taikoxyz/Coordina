import { useEffect, useState } from 'react'
import { useSettings } from '../../hooks/useSettings'
import { ChatPane } from '../chat/ChatPane'
import { FileBrowser } from '../files/FileBrowser'
import { Plus } from 'lucide-react'
import { cn } from '../../lib/utils'
import type { TeamSpec, AgentSpec } from '../../../../shared/types'
import {
  DEFAULT_AGENT_NAME_THEME,
  generateAutoAgentIdentities,
} from '../../../../shared/agentNames'

interface Props {
  spec: TeamSpec
  onSpecChange: (spec: TeamSpec) => void
  onSaveSpec: (spec: TeamSpec) => Promise<void>
  envSlug?: string
}

const modes = [
  { id: 'chat', label: 'Chat' },
  { id: 'files', label: 'Files' },
] as const
type PanelMode = 'chat' | 'files'

export function ChatTab({ spec, onSpecChange, onSaveSpec, envSlug }: Props) {
  const { data: settings } = useSettings()
  const [selectedAgentSlug, setSelectedAgentSlug] = useState(
    spec.agents[0]?.slug ?? '',
  )
  const [panelMode, setPanelMode] = useState<PanelMode>('chat')

  const addAutoAgents = (count: number) => {
    const generated = generateAutoAgentIdentities(
      spec.agents,
      count,
      settings?.agentNameTheme ?? DEFAULT_AGENT_NAME_THEME,
    )
    if (!generated.length) return
    const newAgents: AgentSpec[] = generated.map((identity) => ({
      slug: identity.slug,
      name: identity.name,
      role: '',
      provider: '',
      skills: [],
      persona: '',
    }))
    const updated = [...spec.agents, ...newAgents]
    const newSpec = { ...spec, agents: updated, leadAgent: updated[0]?.slug || undefined }
    onSpecChange(newSpec)
    void onSaveSpec(newSpec)
  }

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
              <div className="min-w-0">
                <div className="text-base font-medium truncate">
                  {agent.name || agent.slug}
                  {index === 0 && <span className="text-gray-400 font-normal"> (Lead)</span>}
                </div>
                {agent.role && (
                  <div className="text-sm text-gray-400 truncate">
                    {agent.role}
                  </div>
                )}
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 min-w-0 overflow-hidden flex flex-col bg-white">
        <div className="border-b border-gray-100 shrink-0">
          <div className="flex justify-center gap-6 px-6 py-2">
            {modes.map((mode) => (
              <button
                key={mode.id}
                onClick={() => setPanelMode(mode.id)}
                className={cn(
                  'text-base font-medium py-1.5 transition-colors relative',
                  panelMode === mode.id
                    ? 'text-gray-900'
                    : 'text-gray-400 hover:text-gray-600',
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
            <div className="py-6 px-6 max-w-2xl space-y-4 h-full overflow-y-auto">
              <div className="rounded-lg border border-dashed border-gray-200 p-8 text-center">
                <p className="text-base text-gray-500">
                  No agents yet. Add agents to get started.
                </p>
              </div>
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
