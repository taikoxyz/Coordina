import { useEffect, useMemo, useState } from 'react'
import { MessageSquare, FolderOpen, Plus } from 'lucide-react'
import { useNav } from '../store/nav'
import { useTeam, useSaveTeam } from '../hooks/useTeams'
import { useProviders } from '../hooks/useProviders'
import { useSettings } from '../hooks/useSettings'
import { SpecEditor } from './SpecEditor'
import { AgentCard } from './team/AgentCard'
import { DeployPanel } from './DeployPanel'
import { ChatPane } from './chat/ChatPane'
import { FileBrowser } from './files/FileBrowser'
import { cn } from '../lib/utils'
import type { TeamSpec, AgentSpec } from '../../../shared/types'
import type { TeamTab } from '../store/nav'
import {
  DEFAULT_AGENT_NAME_THEME,
  generateAutoAgentIdentities,
} from '../../../shared/agentNames'

const tabs: { id: TeamTab; label: string }[] = [
  { id: 'specs', label: 'Specs' },
  { id: 'deployment', label: 'Deployment' },
  { id: 'chat', label: 'Chat' },
]

type ChatSubPanel = 'chat' | 'files'

export function TeamContent({ slug }: { slug: string }) {
  const { teamTab, setTeamTab, agentSlug, selectAgent } = useNav()
  const { data: savedSpec } = useTeam(slug)
  const saveTeam = useSaveTeam()

  const { data: providers } = useProviders()
  const { data: settings } = useSettings()
  const providerSlugs = (providers ?? []).map((p) => p.slug)

  const [localSpec, setLocalSpec] = useState<TeamSpec | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [editingAgentSlug, setEditingAgentSlug] = useState<string | null>(null)
  const [chatSubPanel, setChatSubPanel] = useState<ChatSubPanel>('chat')

  useEffect(() => {
    if (savedSpec) {
      setLocalSpec(savedSpec)
      setIsEditing(false)
    }
  }, [savedSpec])

  const agents = localSpec?.agents ?? []
  const selectedAgent = useMemo(
    () => agents.find((a) => a.slug === agentSlug) ?? null,
    [agents, agentSlug],
  )

  useEffect(() => {
    if (agents.length > 0 && !selectedAgent) {
      selectAgent(agents[0].slug)
    }
  }, [agents, selectedAgent, selectAgent])

  const handleSave = async () => {
    if (!localSpec) return
    await saveTeam.mutateAsync(localSpec)
  }

  const handleSaveSpec = async (spec: TeamSpec) => {
    await saveTeam.mutateAsync(spec)
  }

  const applyAgents = (agents: AgentSpec[]) => {
    setLocalSpec((s) => s ? { ...s, agents, leadAgent: agents[0]?.slug || undefined } : s)
  }

  const addAgent = () => {
    if (!localSpec) return
    const generated = generateAutoAgentIdentities(
      localSpec.agents,
      1,
      settings?.agentNameTheme ?? DEFAULT_AGENT_NAME_THEME,
    )
    if (!generated.length) return
    const identity = generated[0]
    const newAgent: AgentSpec = {
      slug: identity.slug,
      name: identity.name,
      role: '',
      provider: '',
      skills: [],
      persona: '',
    }
    applyAgents([...localSpec.agents, newAgent])
    setEditingAgentSlug(newAgent.slug)
  }

  const updateAgent = (i: number, updated: AgentSpec) => {
    if (!localSpec) return
    const agents = [...localSpec.agents]
    agents[i] = updated
    applyAgents(agents)
  }

  const deleteAgent = (i: number) => {
    if (!localSpec) return
    const newAgents = localSpec.agents.filter((_, j) => j !== i)
    const newSpec = { ...localSpec, agents: newAgents, leadAgent: newAgents[0]?.slug || undefined }
    setLocalSpec(newSpec)
    void handleSaveSpec(newSpec)
    if (editingAgentSlug === localSpec.agents[i]?.slug) {
      setEditingAgentSlug(null)
    }
  }

  if (!localSpec) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-gray-400">
        Loading team...
      </div>
    )
  }

  const isLead = selectedAgent && agents.length > 0 && selectedAgent.slug === agents[0].slug

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="border-b border-gray-200 shrink-0">
        <div className="flex items-center px-5">
          <div className="flex gap-6">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setTeamTab(tab.id)}
                className={cn(
                  'text-[13px] font-medium py-3 transition-colors relative',
                  teamTab === tab.id
                    ? 'text-gray-900'
                    : 'text-gray-400 hover:text-gray-600',
                )}
              >
                {tab.label}
                {teamTab === tab.id && (
                  <span className="absolute -bottom-[1px] left-0 right-0 h-[2px] bg-gray-900 rounded-t" />
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
        {teamTab === 'specs' && (
          <div className="flex-1 overflow-y-auto">
            <SpecEditor
              spec={localSpec}
              onSpecChange={setLocalSpec}
              isEditing={isEditing}
              onEdit={() => setIsEditing(true)}
              onSave={async () => {
                await handleSave()
                setIsEditing(false)
              }}
              isSaving={saveTeam.isPending}
            />

            <div className="border-t border-gray-200 px-6 py-5 max-w-2xl space-y-4">
              <div className="flex items-center justify-between">
                <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-gray-400">
                  Agents ({localSpec.agents.length})
                </div>
                <button
                  onClick={addAgent}
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md text-gray-600 hover:bg-gray-100 transition-colors"
                  title="Add agent"
                >
                  <Plus className="w-3.5 h-3.5" /> Add
                </button>
              </div>

              {localSpec.agents.length === 0 && (
                <div className="rounded-lg border border-dashed border-gray-200 p-8 text-center">
                  <p className="text-sm text-gray-500">No agents yet. Add agents to get started.</p>
                </div>
              )}

              {localSpec.agents.map((agent, index) => (
                <AgentCard
                  key={agent.slug}
                  teamSlug={localSpec.slug}
                  agent={agent}
                  isFirst={index === 0}
                  providerSlugs={providerSlugs}
                  isEditing={editingAgentSlug === agent.slug}
                  onEdit={() => setEditingAgentSlug(agent.slug)}
                  onSave={async () => {
                    await handleSave()
                    setEditingAgentSlug(null)
                  }}
                  isSaving={saveTeam.isPending}
                  onChange={(updated) => updateAgent(index, updated)}
                  onDelete={() => deleteAgent(index)}
                />
              ))}
            </div>
          </div>
        )}

        {teamTab === 'deployment' && (
          <DeployPanel
            spec={localSpec}
            onSave={handleSave}
            isSaving={saveTeam.isPending}
          />
        )}

        {teamTab === 'chat' && (
          <div className="flex flex-1 min-h-0 overflow-hidden">
            <div className="w-52 shrink-0 border-r border-gray-200 bg-[#f6f5f3] flex flex-col">
              <div className="flex-1 overflow-y-auto py-1">
                {agents.map((agent, i) => (
                  <button
                    key={agent.slug}
                    onClick={() => selectAgent(agent.slug)}
                    className={cn(
                      'w-full text-left px-3 py-2 text-[13px] transition-colors flex items-center gap-2',
                      agentSlug === agent.slug
                        ? 'bg-gray-200/70 text-gray-900 font-medium'
                        : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900',
                    )}
                  >
                    {agent.emoji && <span className="text-sm">{agent.emoji}</span>}
                    <span className="truncate">{agent.name}</span>
                    {i === 0 && (
                      <span className="ml-auto text-[10px] text-gray-400 font-normal shrink-0">
                        (Lead)
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
              <div className="border-b border-gray-200 shrink-0">
                <div className="flex items-center px-5">
                  <div className="flex gap-6">
                    {([
                      { id: 'chat' as const, label: 'Chat', icon: MessageSquare },
                      { id: 'files' as const, label: 'Files', icon: FolderOpen },
                    ]).map((tab) => (
                      <button
                        key={tab.id}
                        onClick={() => setChatSubPanel(tab.id)}
                        className={cn(
                          'text-[13px] font-medium py-3 transition-colors relative flex items-center gap-1.5',
                          chatSubPanel === tab.id
                            ? 'text-gray-900'
                            : 'text-gray-400 hover:text-gray-600',
                        )}
                      >
                        <tab.icon className="h-3.5 w-3.5" />
                        {tab.label}
                        {chatSubPanel === tab.id && (
                          <span className="absolute -bottom-[1px] left-0 right-0 h-[2px] bg-gray-900 rounded-t" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex-1 min-h-0 overflow-hidden">
                {chatSubPanel === 'chat' && (
                  <ChatPane
                    teamSlug={localSpec.slug}
                    envSlug={localSpec.deployedEnvSlug}
                    agentSlug={isLead ? undefined : selectedAgent?.slug}
                    agentName={selectedAgent?.name}
                  />
                )}
                {chatSubPanel === 'files' && selectedAgent && (
                  <FileBrowser
                    teamSlug={localSpec.slug}
                    agentSlug={selectedAgent.slug}
                    agentName={selectedAgent.name}
                  />
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
