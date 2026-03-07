import { useEffect, useMemo } from 'react'
import { MessageSquare, FolderOpen, Radio } from 'lucide-react'
import { useNav } from '../store/nav'
import { useTeams } from '../hooks/useTeams'
import { ChatPane } from '../components/chat/ChatPane'
import { FileBrowser } from '../components/files/FileBrowser'
import { EmptyState } from '../components/EmptyState'
import { cn } from '../lib/utils'
import type { RuntimePanel } from '../store/nav'

const tabs: { id: RuntimePanel; label: string; icon: typeof MessageSquare }[] = [
  { id: 'chat', label: 'Chat', icon: MessageSquare },
  { id: 'files', label: 'Files', icon: FolderOpen },
]

export function RuntimeView() {
  const { teamSlug, agentSlug, runtimePanel, selectTeam, selectAgent, setRuntimePanel } = useNav()
  const { data: teams } = useTeams()

  const deployedTeams = useMemo(() => (teams ?? []).filter((t) => !!t.lastDeployedAt), [teams])

  const selectedTeam = useMemo(
    () => deployedTeams.find((t) => t.slug === teamSlug) ?? null,
    [deployedTeams, teamSlug],
  )

  const agents = selectedTeam?.agents ?? []
  const selectedAgent = agents.find((a) => a.slug === agentSlug) ?? null

  useEffect(() => {
    if (deployedTeams.length > 0 && !selectedTeam) {
      selectTeam(deployedTeams[0].slug)
    }
  }, [deployedTeams, selectedTeam, selectTeam])

  useEffect(() => {
    if (agents.length > 0 && !selectedAgent) {
      selectAgent(agents[0].slug)
    }
  }, [agents, selectedAgent, selectAgent])

  if (deployedTeams.length === 0) {
    return (
      <EmptyState
        icon={<Radio className="h-12 w-12" />}
        title="No deployed teams"
        description="Deploy a team from the Workspace to start chatting."
      />
    )
  }

  const isLead = selectedAgent && agents.length > 0 && selectedAgent.slug === agents[0].slug

  return (
    <div className="flex h-full overflow-hidden">
      <div className="w-52 shrink-0 border-r border-gray-200 bg-[#f6f5f3] flex flex-col">
        <div className="p-3 border-b border-gray-200">
          <select
            value={teamSlug ?? ''}
            onChange={(e) => selectTeam(e.target.value)}
            className="w-full rounded-md border border-gray-200 bg-white px-2.5 py-1.5 text-[13px] font-medium text-gray-900 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400"
          >
            {deployedTeams.map((t) => (
              <option key={t.slug} value={t.slug}>
                {t.name}
              </option>
            ))}
          </select>
        </div>

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
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setRuntimePanel(tab.id)}
                  className={cn(
                    'text-[13px] font-medium py-3 transition-colors relative flex items-center gap-1.5',
                    runtimePanel === tab.id
                      ? 'text-gray-900'
                      : 'text-gray-400 hover:text-gray-600',
                  )}
                >
                  <tab.icon className="h-3.5 w-3.5" />
                  {tab.label}
                  {runtimePanel === tab.id && (
                    <span className="absolute -bottom-[1px] left-0 right-0 h-[2px] bg-gray-900 rounded-t" />
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-hidden">
          {runtimePanel === 'chat' && selectedTeam && (
            <ChatPane
              teamSlug={selectedTeam.slug}
              envSlug={selectedTeam.deployedEnvSlug}
              agentSlug={isLead ? undefined : selectedAgent?.slug}
              agentName={selectedAgent?.name}
            />
          )}
          {runtimePanel === 'files' && selectedTeam && selectedAgent && (
            <FileBrowser
              teamSlug={selectedTeam.slug}
              agentSlug={selectedAgent.slug}
              agentName={selectedAgent.name}
            />
          )}
        </div>
      </div>
    </div>
  )
}
