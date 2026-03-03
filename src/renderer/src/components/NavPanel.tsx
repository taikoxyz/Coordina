import { useState } from 'react'
import { useTeams, useAgents } from '../hooks/useTeams'
import { useEnvironments } from '../hooks/useEnvironments'
import { useNav } from '../store/nav'
import type { AgentRecord } from '../hooks/useTeams'

function TeamAgentRows({ teamSlug, activeTeamSlug }: { teamSlug: string; activeTeamSlug: string | null }) {
  const { data: agents } = useAgents(teamSlug)

  if (!agents || agents.length === 0) return null

  return (
    <>
      {agents.map((agent: AgentRecord) => (
        <div
          key={agent.slug}
          className={`pl-6 py-0.5 text-xs flex items-center gap-1.5 ${
            activeTeamSlug === teamSlug
              ? 'text-blue-200/70'
              : 'text-gray-500'
          }`}
        >
          <span className="shrink-0">{agent.isLead ? '●' : '·'}</span>
          <span className="truncate">{agent.name}</span>
        </div>
      ))}
    </>
  )
}

export function NavPanel() {
  const { data: teams } = useTeams()
  const { data: environments } = useEnvironments()
  const { page, teamSlug: activeSlug, setPage } = useNav()

  const [teamsGroupOpen, setTeamsGroupOpen] = useState(true)
  const [envsGroupOpen, setEnvsGroupOpen] = useState(false)
  const [expandedSlugs, setExpandedSlugs] = useState<Set<string>>(new Set())

  function handleTeamClick(slug: string) {
    setPage('teams', slug)
    setExpandedSlugs(prev => new Set(prev).add(slug))
  }

  function toggleExpand(slug: string, e: React.MouseEvent) {
    e.stopPropagation()
    setExpandedSlugs(prev => {
      const next = new Set(prev)
      next.has(slug) ? next.delete(slug) : next.add(slug)
      return next
    })
  }

  return (
    <aside className="w-56 shrink-0 bg-gray-900 border-r border-gray-700 h-full flex flex-col">
      <div className="px-4 py-5 border-b border-gray-700">
        <span className="text-lg font-bold text-gray-100">Coordina</span>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-0.5">
        {/* Teams group */}
        <button
          onClick={() => setTeamsGroupOpen(o => !o)}
          className="w-full flex items-center justify-between px-3 py-1 text-xs font-medium text-gray-500 uppercase hover:text-gray-400 transition-colors"
        >
          <span>Teams</span>
          <span className="text-gray-600">{teamsGroupOpen ? '▼' : '▶'}</span>
        </button>

        {teamsGroupOpen && (
          <div className="space-y-0.5">
            {(teams ?? []).map(team => {
              const isActive = page === 'teams' && activeSlug === team.slug
              const isExpanded = expandedSlugs.has(team.slug)

              return (
                <div key={team.slug}>
                  <div
                    className={`flex items-center rounded-md ${
                      isActive ? 'bg-blue-900/40' : 'hover:bg-gray-800'
                    }`}
                  >
                    <button
                      onClick={() => handleTeamClick(team.slug)}
                      className={`flex-1 min-w-0 flex items-center px-3 py-1.5 text-sm text-left transition-colors ${
                        isActive
                          ? 'text-blue-300 font-medium'
                          : 'text-gray-300 hover:text-white'
                      }`}
                    >
                      <span className="truncate">{team.name}</span>
                    </button>
                    <button
                      onClick={(e) => toggleExpand(team.slug, e)}
                      className="shrink-0 px-2 py-1.5 text-gray-500 hover:text-gray-300 transition-colors"
                    >
                      {isExpanded ? '▼' : '▶'}
                    </button>
                  </div>

                  {isExpanded && (
                    <TeamAgentRows teamSlug={team.slug} activeTeamSlug={activeSlug} />
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* Environments group */}
        <div className="pt-2">
          <button
            onClick={() => setEnvsGroupOpen(o => !o)}
            className="w-full flex items-center justify-between px-3 py-1 text-xs font-medium text-gray-500 uppercase hover:text-gray-400 transition-colors"
          >
            <span>Environments</span>
            <span className="text-gray-600">{envsGroupOpen ? '▼' : '▶'}</span>
          </button>

          {envsGroupOpen && (
            <div className="space-y-0.5 mt-0.5">
              {(environments ?? []).map(env => (
                <button
                  key={env.id}
                  onClick={() => setPage('environments')}
                  className={`w-full flex items-center px-3 py-1.5 text-sm rounded-md text-left transition-colors ${
                    page === 'environments'
                      ? 'bg-blue-900/40 text-blue-300 font-medium'
                      : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                  }`}
                >
                  <span className="truncate">{env.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </nav>

      {/* Footer nav */}
      <div className="px-2 py-3 border-t border-gray-700 space-y-0.5">
        <button
          onClick={() => setPage('providers')}
          className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm rounded-md text-left transition-colors ${
            page === 'providers'
              ? 'bg-blue-900/40 text-blue-300 font-medium'
              : 'text-gray-400 hover:bg-gray-800 hover:text-gray-100'
          }`}
        >
          <span>Model Providers</span>
        </button>
        <button
          onClick={() => setPage('settings')}
          className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm rounded-md text-left transition-colors ${
            page === 'settings'
              ? 'bg-blue-900/40 text-blue-300 font-medium'
              : 'text-gray-400 hover:bg-gray-800 hover:text-gray-100'
          }`}
        >
          <span>Settings</span>
        </button>
      </div>
    </aside>
  )
}
