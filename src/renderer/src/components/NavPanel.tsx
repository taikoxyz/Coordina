// Dense sidebar with Teams, Providers, Environments as sections; Settings as icon
// FEATURE: Navigation panel with small fonts and no dialogs for space efficiency
import { useState } from 'react'
import { useTeams } from '../hooks/useTeams'
import { useProviders } from '../hooks/useProviders'
import { useEnvironments } from '../hooks/useEnvironments'
import { useNav } from '../store/nav'
import type { TeamSpec } from '../../../shared/types'

function TeamRow({ team, isActive }: { team: TeamSpec; isActive: boolean }) {
  const [expanded, setExpanded] = useState(false)
  const { setPage } = useNav()

  return (
    <div>
      <div className={`flex items-center rounded ${isActive ? 'bg-blue-900/40' : 'hover:bg-gray-800'}`}>
        <button
          onClick={() => setPage('teams', team.slug)}
          className={`flex-1 min-w-0 flex items-center px-2 py-0.5 text-left ${isActive ? 'text-blue-300' : 'text-gray-300 hover:text-white'}`}
        >
          <span className="truncate text-[11px]">{team.name}</span>
        </button>
        {team.agents.length > 0 && (
          <button
            onClick={() => setExpanded(e => !e)}
            className="shrink-0 px-1.5 py-0.5 text-gray-600 hover:text-gray-400 text-[9px]"
          >
            {expanded ? '▼' : '▶'}
          </button>
        )}
      </div>
      {expanded && team.agents.map(a => (
        <div key={a.slug} className={`pl-4 py-0.5 text-[10px] flex items-center gap-1 ${isActive ? 'text-blue-200/60' : 'text-gray-600'}`}>
          <span>{a.isLead ? '●' : '·'}</span>
          <span className="truncate">{a.name}</span>
        </div>
      ))}
    </div>
  )
}

function SectionHeader({ label, open, onToggle }: { label: string; open: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      className="w-full flex items-center justify-between px-2 py-0.5 text-[10px] font-medium text-gray-600 uppercase tracking-wider hover:text-gray-500"
    >
      <span>{label}</span>
      <span>{open ? '▼' : '▶'}</span>
    </button>
  )
}

export function NavPanel() {
  const { data: teams } = useTeams()
  const { data: providers } = useProviders()
  const { data: environments } = useEnvironments()
  const { page, teamSlug: activeSlug, setPage } = useNav()

  const [teamsOpen, setTeamsOpen] = useState(true)
  const [providersOpen, setProvidersOpen] = useState(true)
  const [envsOpen, setEnvsOpen] = useState(true)

  return (
    <aside className="w-48 shrink-0 bg-gray-900 border-r border-gray-700/60 h-full flex flex-col">
      <div className="px-3 py-2.5 border-b border-gray-700/60 shrink-0">
        <span className="text-[12px] font-semibold text-gray-100 tracking-tight">Coordina</span>
      </div>

      <nav className="flex-1 overflow-y-auto px-1.5 py-1.5 space-y-px min-h-0">
        {/* Teams */}
        <SectionHeader label="Teams" open={teamsOpen} onToggle={() => setTeamsOpen(o => !o)} />
        {teamsOpen && (
          <div className="space-y-px mb-1">
            {(teams ?? []).map(team => (
              <TeamRow key={team.slug} team={team} isActive={page === 'teams' && activeSlug === team.slug} />
            ))}
            <button
              onClick={() => setPage('teams')}
              className="w-full text-left px-2 py-0.5 text-[10px] text-gray-600 hover:text-blue-400 transition-colors"
            >
              + new team
            </button>
          </div>
        )}

        {/* Providers */}
        <SectionHeader label="Providers" open={providersOpen} onToggle={() => setProvidersOpen(o => !o)} />
        {providersOpen && (
          <div className="space-y-px mb-1">
            {(providers ?? []).map(p => (
              <button
                key={p.slug}
                onClick={() => setPage('providers')}
                className={`w-full text-left px-2 py-0.5 rounded text-[11px] truncate transition-colors ${page === 'providers' ? 'text-blue-300 hover:bg-blue-900/20' : 'text-gray-300 hover:text-white hover:bg-gray-800'}`}
              >
                {p.name}
                <span className="text-[9px] text-gray-600 ml-1 font-mono">{p.type}</span>
              </button>
            ))}
            <button
              onClick={() => setPage('providers')}
              className="w-full text-left px-2 py-0.5 text-[10px] text-gray-600 hover:text-blue-400 transition-colors"
            >
              + add
            </button>
          </div>
        )}

        {/* Environments */}
        <SectionHeader label="Environments" open={envsOpen} onToggle={() => setEnvsOpen(o => !o)} />
        {envsOpen && (
          <div className="space-y-px mb-1">
            {(environments ?? []).map(env => (
              <button
                key={env.slug}
                onClick={() => setPage('environments')}
                className={`w-full text-left px-2 py-0.5 rounded text-[11px] truncate transition-colors ${page === 'environments' ? 'text-blue-300 hover:bg-blue-900/20' : 'text-gray-300 hover:text-white hover:bg-gray-800'}`}
              >
                {env.name}
                <span className="text-[9px] text-gray-600 ml-1 font-mono">{(env.config as { projectId?: string }).projectId}</span>
              </button>
            ))}
            {!environments?.some(e => e.type === 'gke') && (
              <button
                onClick={() => setPage('environments')}
                className="w-full text-left px-2 py-0.5 text-[10px] text-gray-600 hover:text-blue-400 transition-colors"
              >
                + add GKE
              </button>
            )}
          </div>
        )}
      </nav>

      <div className="shrink-0 border-t border-gray-700/60 px-2 py-1.5 flex justify-end">
        <button
          onClick={() => setPage('settings')}
          title="Settings"
          className={`text-[15px] px-1.5 py-0.5 rounded transition-colors ${page === 'settings' ? 'text-blue-400' : 'text-gray-600 hover:text-gray-400'}`}
        >
          ⚙
        </button>
      </div>
    </aside>
  )
}
