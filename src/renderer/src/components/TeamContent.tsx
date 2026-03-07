import { useEffect, useMemo, useState } from 'react'
import { MessageSquare, FolderOpen, Plus, X, Crown } from 'lucide-react'
import { useNav } from '../store/nav'
import { useTeam, useSaveTeam } from '../hooks/useTeams'
import { useProviders } from '../hooks/useProviders'
import { useSettings } from '../hooks/useSettings'
import { useAgentStatuses } from '../hooks/useAgentStatuses'
import { SpecEditor } from './SpecEditor'
import { AgentCard } from './team/AgentCard'
import { DeployPanel } from './DeployPanel'
import { ChatPane } from './chat/ChatPane'
import { FileBrowser } from './files/FileBrowser'
import { agentColor } from '../lib/agentColors'
import { highlightJson } from '../lib/highlight'
import { cn } from '../lib/utils'
import { Button } from './ui'
import type { TeamSpec, AgentSpec } from '../../../shared/types'
import type { TeamTab } from '../store/nav'
import {
  DEFAULT_AGENT_NAME_THEME,
  generateAutoAgentIdentities,
} from '../../../shared/agentNames'

const tabs: { id: TeamTab; label: string }[] = [
  { id: 'specs', label: 'Specs' },
  { id: 'deployment', label: 'Deployment' },
  { id: 'chat', label: 'Agents' },
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
  const [showJson, setShowJson] = useState(false)

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

  const { statuses: agentStatuses } = useAgentStatuses(
    localSpec?.slug ?? '',
    localSpec?.deployedEnvSlug,
  )

  if (!localSpec) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-gray-400">
        Loading team...
      </div>
    )
  }

  const isLead = selectedAgent && agents.length > 0 && selectedAgent.slug === agents[0].slug

  const selectedAgentStatus = selectedAgent ? agentStatuses.get(selectedAgent.slug) : undefined
  const isDeployed = !!localSpec.deployedEnvSlug
  const isSelectedAgentReady = !isDeployed || selectedAgentStatus === 'running'

  const statusDotClass = (status: string | undefined) => {
    if (status === 'running') return 'bg-green-500'
    if (status === 'pending') return 'bg-amber-400'
    if (status === 'crashed') return 'bg-red-500'
    return 'bg-gray-300'
  }

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
                  'text-sm font-medium py-3 transition-colors relative',
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
          <div className="flex-1 flex min-h-0">
            <div className={`flex flex-col min-h-0 ${showJson ? 'w-1/2 border-r border-gray-200' : 'flex-1'}`}>
              <div className="flex-1 overflow-y-auto min-h-0">
            <SpecEditor
              spec={localSpec}
              onSpecChange={setLocalSpec}
              isEditing={isEditing}
              onEdit={() => setIsEditing(true)}
              onCancel={() => {
                setLocalSpec(savedSpec ?? null)
                setIsEditing(false)
              }}
              onSave={async () => {
                await handleSave()
                setIsEditing(false)
              }}
              isSaving={saveTeam.isPending}
              onShowJson={() => setShowJson(true)}
            />

            {localSpec.agents.map((agent, index) => (
              <div key={agent.slug} className="border-t border-gray-200">
                <div className="px-6 py-5 max-w-2xl mx-auto space-y-4">
                  <AgentCard
                    teamSlug={localSpec.slug}
                    agent={agent}
                    index={index}
                    isFirst={index === 0}
                    providerSlugs={providerSlugs}
                    isEditing={editingAgentSlug === agent.slug}
                    onEdit={() => setEditingAgentSlug(agent.slug)}
                    onCancel={() => {
                      setLocalSpec(savedSpec ?? null)
                      setEditingAgentSlug(null)
                    }}
                    onSave={async () => {
                      await handleSave()
                      setEditingAgentSlug(null)
                    }}
                    isSaving={saveTeam.isPending}
                    onChange={(updated) => updateAgent(index, updated)}
                    onDelete={() => deleteAgent(index)}
                  />
                </div>
              </div>
            ))}

            <div className="border-t border-gray-200">
              <div className="px-6 py-5 max-w-2xl mx-auto">
                <Button variant="primary" size="sm" onClick={addAgent}>
                  <Plus className="w-3.5 h-3.5" /> Add agent
                </Button>
              </div>
            </div>
              </div>
            </div>

            {showJson && (
              <div className="w-1/2 flex flex-col min-h-0">
                <div className="flex items-center justify-between px-4 py-2 border-b border-gray-200 shrink-0 bg-gray-50">
                  <span className="text-xs font-semibold text-gray-700 font-mono truncate">
                    team-spec.json
                  </span>
                  <button
                    onClick={() => setShowJson(false)}
                    className="rounded-md p-1 text-gray-400 hover:bg-gray-200 hover:text-gray-600 transition-colors shrink-0"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="flex-1 overflow-auto p-4 min-h-0">
                  <pre className="text-xs font-mono text-gray-700 whitespace-pre-wrap break-words">
                    {highlightJson(JSON.stringify(localSpec, null, 2))}
                  </pre>
                </div>
              </div>
            )}
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
            <div className="w-52 shrink-0 border-r border-gray-200 flex flex-col">
              <div className="flex-1 overflow-y-auto py-1">
                {agents.map((agent, i) => (
                  <button
                    key={agent.slug}
                    onClick={() => selectAgent(agent.slug)}
                    className={cn(
                      'w-full text-left px-3 py-2 text-sm transition-colors flex items-center gap-2',
                      agentSlug === agent.slug
                        ? 'bg-sidebar text-gray-900 font-medium'
                        : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900',
                    )}
                  >
                    <span className={`flex items-center justify-center w-6 h-6 rounded-full text-[10px] font-semibold uppercase shrink-0 ${agentColor(i)}`}>
                      {(agent.name || '?').charAt(0)}
                    </span>
                    <span className="truncate">{agent.name}</span>
                    <span className="ml-auto flex items-center gap-1 shrink-0">
                      {isDeployed && (
                        <span className={`w-1.5 h-1.5 rounded-full ${statusDotClass(agentStatuses.get(agent.slug))}`} />
                      )}
                      {i === 0 && (
                        <span className="text-gray-400">
                          <Crown className="w-3 h-3" />
                        </span>
                      )}
                    </span>
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
                        onClick={() => isSelectedAgentReady && setChatSubPanel(tab.id)}
                        className={cn(
                          'text-sm font-medium py-3 transition-colors relative flex items-center gap-1.5',
                          !isSelectedAgentReady
                            ? 'text-gray-300 cursor-default'
                            : chatSubPanel === tab.id
                              ? 'text-gray-900'
                              : 'text-gray-400 hover:text-gray-600',
                        )}
                      >
                        <tab.icon className="h-3.5 w-3.5" />
                        {tab.label}
                        {isSelectedAgentReady && chatSubPanel === tab.id && (
                          <span className="absolute -bottom-[1px] left-0 right-0 h-[2px] bg-gray-900 rounded-t" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex-1 min-h-0 overflow-hidden">
                {!isSelectedAgentReady ? (
                  <div className="flex flex-col items-center justify-center h-full gap-2 text-sm text-gray-400">
                    <span className={`w-2.5 h-2.5 rounded-full ${statusDotClass(selectedAgentStatus)}`} />
                    <span className="font-medium text-gray-500">{selectedAgent?.name} is not ready</span>
                    <span>Chat and file browsing are disabled until the agent is running.</span>
                  </div>
                ) : (
                  <>
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
                        envSlug={localSpec.deployedEnvSlug}
                      />
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
