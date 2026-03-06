import { useState, useEffect } from 'react'
import { useTeam, useSaveTeam } from '../hooks/useTeams'
import { useNav, type TeamTab } from '../store/nav'
import { TeamToolbar } from '../components/team/TeamToolbar'
import { TeamOverview } from '../components/team/TeamOverview'
import { AgentsTab } from '../components/team/AgentsTab'
import { DeployTab } from '../components/team/DeployTab'
import { ChatPane } from '../components/chat/ChatPane'
import { FileBrowser } from '../components/files/FileBrowser'
import { useEnvironments } from '../hooks/useEnvironments'
import { cn } from '../lib/utils'
import type { TeamSpec } from '../../../shared/types'

interface Props {
  teamSlug: string
}

const tabs: { id: TeamTab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'agents', label: 'Agents' },
  { id: 'deploy', label: 'Deploy' },
  { id: 'chat', label: 'Chat' },
  { id: 'files', label: 'Files' },
]

export function TeamDetailPage({ teamSlug }: Props) {
  const { data: savedSpec, isLoading } = useTeam(teamSlug)
  const [localSpec, setLocalSpec] = useState<TeamSpec | null>(null)
  const [isEditingOverview, setIsEditingOverview] = useState(false)
  const { teamTab, setTeamTab } = useNav()
  const saveTeam = useSaveTeam()
  const { data: environments } = useEnvironments()

  const [selectedAgentSlug, setSelectedAgentSlug] = useState<string>('')
  const [selectedEnvSlug, setSelectedEnvSlug] = useState('')

  useEffect(() => {
    if (savedSpec) {
      setLocalSpec(savedSpec)
      setIsEditingOverview(false)
    }
  }, [savedSpec])

  useEffect(() => {
    if (!localSpec?.agents.length) return
    if (!selectedAgentSlug || !localSpec.agents.some(a => a.slug === selectedAgentSlug)) {
      setSelectedAgentSlug(localSpec.agents[0].slug)
    }
  }, [localSpec?.agents, selectedAgentSlug])

  useEffect(() => {
    if (environments?.length && !selectedEnvSlug) setSelectedEnvSlug(environments[0].slug)
  }, [environments, selectedEnvSlug])

  if (isLoading) return <div className="p-6 text-sm text-gray-500">Loading...</div>
  if (!localSpec) return <div className="p-6 text-sm text-gray-500">Team not found.</div>

  const handleSave = () => saveTeam.mutateAsync(localSpec).then(() => undefined)
  const handleOverviewSave = async () => {
    await handleSave()
    setIsEditingOverview(false)
  }
  const activeAgent = localSpec.agents.find(a => a.slug === selectedAgentSlug) || localSpec.agents[0]

  return (
    <div className="h-full flex flex-col bg-white">
      <TeamToolbar
        spec={localSpec}
        showSaveButton={teamTab !== 'overview'}
        onSave={handleSave}
        isSaving={saveTeam.isPending}
      />

      {/* Tab bar */}
      <div className="flex gap-1 px-6 border-b border-gray-200 shrink-0">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setTeamTab(tab.id)}
            className={cn(
              'px-3 py-2 text-sm font-medium transition-colors relative',
              teamTab === tab.id
                ? 'text-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            )}
          >
            {tab.label}
            {tab.id === 'agents' && ` (${localSpec.agents.length})`}
            {teamTab === tab.id && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 rounded-t" />
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {teamTab === 'overview' && (
          <TeamOverview
            spec={localSpec}
            onSpecChange={setLocalSpec}
            isEditing={isEditingOverview}
            onEdit={() => setIsEditingOverview(true)}
            onSave={handleOverviewSave}
            isSaving={saveTeam.isPending}
            deployEnvSlug={selectedEnvSlug || undefined}
            deployEnvName={environments?.find(env => env.slug === selectedEnvSlug)?.name}
          />
        )}

        {teamTab === 'agents' && (
          <AgentsTab spec={localSpec} onSpecChange={setLocalSpec} />
        )}

        {teamTab === 'deploy' && (
          <DeployTab spec={localSpec} onSave={handleSave} isSaving={saveTeam.isPending} />
        )}

        {teamTab === 'chat' && (
          <div className="flex h-full overflow-hidden">
            {/* Agent selector sidebar */}
            <div className="w-48 shrink-0 border-r border-gray-200 overflow-y-auto p-2 space-y-1 bg-gray-50">
              {localSpec.agents.map((agent, index) => (
                <button
                  key={agent.slug}
                  onClick={() => setSelectedAgentSlug(agent.slug)}
                  className={cn(
                    'w-full text-left rounded-md px-2.5 py-2 transition-colors',
                    selectedAgentSlug === agent.slug
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-600 hover:bg-white hover:text-gray-900'
                  )}
                >
                  <div className="flex items-center gap-2">
                    {agent.emoji ? (
                      <span className="text-sm">{agent.emoji}</span>
                    ) : (
                      <div className="w-6 h-6 rounded-full bg-blue-50 flex items-center justify-center text-xs font-semibold text-blue-600">
                        {(agent.name || '?').charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">{agent.name || agent.slug}</div>
                      <div className="text-xs text-gray-400 truncate">
                        {index === 0 ? 'Lead' : 'Direct'} · {agent.slug}
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
            {/* Chat pane */}
            <div className="flex-1 min-w-0">
              {localSpec.agents.length > 0 && (
                <ChatPane
                  teamSlug={localSpec.slug}
                  envSlug={selectedEnvSlug || undefined}
                  agentSlug={selectedAgentSlug === localSpec.agents[0]?.slug ? undefined : selectedAgentSlug}
                  agentName={activeAgent?.name}
                />
              )}
            </div>
          </div>
        )}

        {teamTab === 'files' && (
          <div className="flex h-full overflow-hidden">
            {/* Agent selector sidebar */}
            <div className="w-48 shrink-0 border-r border-gray-200 overflow-y-auto p-2 space-y-1 bg-gray-50">
              {localSpec.agents.map((agent) => (
                <button
                  key={agent.slug}
                  onClick={() => setSelectedAgentSlug(agent.slug)}
                  className={cn(
                    'w-full text-left rounded-md px-2.5 py-2 transition-colors',
                    selectedAgentSlug === agent.slug
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-600 hover:bg-white hover:text-gray-900'
                  )}
                >
                  <div className="flex items-center gap-2">
                    {agent.emoji ? (
                      <span className="text-sm">{agent.emoji}</span>
                    ) : (
                      <div className="w-6 h-6 rounded-full bg-blue-50 flex items-center justify-center text-xs font-semibold text-blue-600">
                        {(agent.name || '?').charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div className="text-sm font-medium truncate">{agent.name || agent.slug}</div>
                  </div>
                </button>
              ))}
            </div>
            {/* File browser */}
            <div className="flex-1 min-w-0">
              {activeAgent && (
                <FileBrowser
                  key={`${teamSlug}:${activeAgent.slug}`}
                  teamSlug={teamSlug}
                  agentSlug={activeAgent.slug}
                  agentName={activeAgent.name}
                />
              )}
            </div>
          </div>
        )}
      </div>

      {/* Save error */}
      {saveTeam.error && (
        <div className="px-6 py-2 border-t border-red-200 bg-red-50 text-xs text-red-700 shrink-0">
          {(saveTeam.error as Error).message}
        </div>
      )}
    </div>
  )
}
