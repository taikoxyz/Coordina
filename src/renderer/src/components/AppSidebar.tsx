import { ChevronRight, ChevronDown, Crown, Loader2, Plus, Send, Settings } from 'lucide-react'
import { useNav } from '../store/nav'
import { useTeams, useSaveTeam } from '../hooks/useTeams'
import { useSettings } from '../hooks/useSettings'
import { cn } from '../lib/utils'
import { AgentAvatar } from './AgentAvatar'
import type { AgentSpec } from '../../../shared/types'
import { DEFAULT_AGENT_NAME_THEME, generateAutoAgentIdentities } from '../../../shared/agentNames'

export function AppSidebar() {
  const { selectedItem, selectItem, expandedTeams, toggleTeam, openSettings, setCreateDialogOpen, deployingTeamSlug, deployingAgentSlug } = useNav()
  const { data: teams } = useTeams()
  const saveTeam = useSaveTeam()
  const { data: settings } = useSettings()

  const addAgent = async (teamSlug: string) => {
    const team = (teams ?? []).find((t) => t.slug === teamSlug)
    if (!team) return
    const generated = generateAutoAgentIdentities(
      team.agents,
      1,
      settings?.agentNameTheme ?? DEFAULT_AGENT_NAME_THEME,
    )
    if (!generated.length) return
    const identity = generated[0]
    const newAgent: AgentSpec = {
      slug: identity.slug,
      name: identity.name,
      role: '',
      models: ['moonshotai/kimi-k2.5'],
      skills: [],
      persona: '',
    }
    const updated = { ...team, agents: [...team.agents, newAgent], leadAgent: team.agents[0]?.slug || newAgent.slug }
    await saveTeam.mutateAsync(updated)
    // Auto-expand and select the new agent
    if (!expandedTeams.includes(teamSlug)) toggleTeam(teamSlug)
    selectItem({ type: 'agent', teamSlug, agentSlug: newAgent.slug })
  }

  const isTeamSelected = (slug: string) =>
    selectedItem?.type === 'team' && selectedItem.slug === slug
  const isAgentSelected = (teamSlug: string, agentSlug: string) =>
    selectedItem?.type === 'agent' && selectedItem.teamSlug === teamSlug && selectedItem.agentSlug === agentSlug
  const isTeamActive = (slug: string) =>
    isTeamSelected(slug) || (selectedItem?.type === 'agent' && selectedItem.teamSlug === slug)

  return (
    <aside className="w-56 shrink-0 bg-sidebar border-r border-gray-100 h-full flex flex-col">
      <div className="px-4 py-3 shrink-0">
        <span className="text-sm font-semibold tracking-tight select-none">Coordina</span>
      </div>

      <div className="flex-1 overflow-y-auto py-1">
        {(teams ?? []).length === 0 && (
          <p className="px-4 py-2 text-xs text-gray-400">No teams yet</p>
        )}
        {(teams ?? []).map((team) => {
          const isExpanded = expandedTeams.includes(team.slug)
          return (
            <div key={team.slug}>
              {/* Team row */}
              <div
                className={cn(
                  'flex items-center gap-1 px-2 py-2 transition-colors',
                  isTeamSelected(team.slug)
                    ? 'bg-white/80 text-gray-900'
                    : isTeamActive(team.slug)
                      ? 'text-gray-700'
                      : 'text-gray-600 hover:bg-white/50 hover:text-gray-900',
                )}
              >
                <button
                  onClick={() => toggleTeam(team.slug)}
                  className="shrink-0 p-0.5 rounded text-gray-400 hover:text-gray-600"
                >
                  {isExpanded ? (
                    <ChevronDown className="w-3.5 h-3.5" />
                  ) : (
                    <ChevronRight className="w-3.5 h-3.5" />
                  )}
                </button>
                <button
                  onClick={() => selectItem({ type: 'team', slug: team.slug })}
                  className="flex-1 text-left text-sm font-medium truncate min-w-0"
                >
                  {team.slug}
                </button>
                {deployingTeamSlug === team.slug && !deployingAgentSlug ? (
                  <Loader2 className="w-3.5 h-3.5 text-blue-500 animate-spin shrink-0" />
                ) : (
                  <span className="text-xs text-gray-400 shrink-0">{team.agents.length}</span>
                )}
                <button
                  onClick={() => void addAgent(team.slug)}
                  className="shrink-0 p-0.5 rounded text-gray-400 hover:text-gray-600 hover:bg-white"
                  title="Add agent"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Agent list (when expanded) */}
              {isExpanded && team.agents.map((agent, i) => {
                const isLead = agent.slug === (team.leadAgent ?? team.agents[0]?.slug)
                return (
                  <button
                    key={agent.slug}
                    onClick={() => selectItem({ type: 'agent', teamSlug: team.slug, agentSlug: agent.slug })}
                    className={cn(
                      'w-full pl-8 pr-3 py-1.5 text-left transition-colors flex items-center gap-2',
                      isAgentSelected(team.slug, agent.slug)
                        ? 'bg-white/80 text-gray-900'
                        : 'text-gray-500 hover:bg-white/50 hover:text-gray-900',
                    )}
                  >
                    <AgentAvatar slug={agent.slug} colorIndex={i} size={24} />
                    <span className="text-xs truncate min-w-0 flex-1">{agent.name || agent.slug}</span>
                    {deployingTeamSlug === team.slug && deployingAgentSlug === agent.slug && (
                      <Loader2 className="w-3 h-3 text-blue-500 animate-spin shrink-0" />
                    )}
                    {isLead && <Crown className="w-3 h-3 text-amber-500 shrink-0" />}
                    {agent.telegramBot && <Send className="w-3 h-3 text-green-500 shrink-0" />}
                  </button>
                )
              })}
            </div>
          )
        })}
      </div>

      <div className="shrink-0 border-t border-gray-100 px-3 py-2 flex items-center justify-between">
        <button
          onClick={() => setCreateDialogOpen('teams')}
          className="flex items-center gap-2 text-sm text-gray-500 transition-colors hover:text-gray-700"
        >
          Add team
        </button>
        <button
          onClick={() => openSettings()}
          className={cn(
            'rounded-md p-1.5 transition-colors',
            selectedItem?.type === 'settings'
              ? 'bg-white text-gray-900'
              : 'text-gray-400 hover:bg-white hover:text-gray-700',
          )}
        >
          <Settings className="h-4 w-4" />
        </button>
      </div>
    </aside>
  )
}
