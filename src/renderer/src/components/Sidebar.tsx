import { useTeams } from '../hooks/useTeams'
import { useNav } from '../store/nav'
import { Settings, Plus, Users, ChevronRight } from 'lucide-react'
import { cn } from '../lib/utils'
import type { TeamSpec } from '../../../shared/types'

function TeamRow({ team, isActive }: { team: TeamSpec; isActive: boolean }) {
  const { setPage } = useNav()

  return (
    <button
      onClick={() => setPage('teams', team.slug)}
      className={cn(
        'w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-left transition-colors',
        isActive
          ? 'bg-white shadow-sm text-gray-900'
          : 'text-gray-600 hover:bg-white/60 hover:text-gray-900'
      )}
    >
      <div className="flex items-center justify-center w-7 h-7 rounded-md bg-blue-50 text-blue-600 text-xs font-semibold shrink-0">
        {team.name.charAt(0).toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium truncate">{team.name}</div>
        <div className="text-xs text-gray-400 truncate">
          {team.agents.length} agent{team.agents.length !== 1 ? 's' : ''}
          {team.lastDeployedAt && (
            <span className="ml-1.5 text-green-500">deployed</span>
          )}
        </div>
      </div>
      <ChevronRight className="w-3.5 h-3.5 text-gray-300 shrink-0" />
    </button>
  )
}

export function Sidebar() {
  const { data: teams } = useTeams()
  const { page, teamSlug, setPage } = useNav()

  return (
    <aside className="w-60 shrink-0 bg-[var(--color-sidebar)] border-r border-[var(--color-sidebar-border)] h-full flex flex-col">
      {/* App header */}
      <div className="px-4 py-4 shrink-0">
        <span className="text-base font-semibold text-gray-900 tracking-tight">Coordina</span>
      </div>

      {/* Teams section */}
      <nav className="flex-1 overflow-y-auto px-2 pb-2 min-h-0">
        <div className="flex items-center justify-between px-3 mb-1">
          <div className="flex items-center gap-1.5 text-xs font-medium text-gray-400 uppercase tracking-wider">
            <Users className="w-3.5 h-3.5" />
            Teams
          </div>
          <button
            onClick={() => setPage('teams')}
            className="p-0.5 rounded text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
            title="New team"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="space-y-0.5">
          {(teams ?? []).map(team => (
            <TeamRow
              key={team.slug}
              team={team}
              isActive={page === 'teams' && teamSlug === team.slug}
            />
          ))}
          {!teams?.length && (
            <p className="px-3 py-4 text-xs text-gray-400 text-center">
              No teams yet
            </p>
          )}
        </div>
      </nav>

      {/* Bottom settings */}
      <div className="shrink-0 border-t border-[var(--color-sidebar-border)] px-2 py-2">
        <button
          onClick={() => setPage('settings')}
          className={cn(
            'w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-left text-sm transition-colors',
            page === 'settings'
              ? 'bg-white shadow-sm text-gray-900'
              : 'text-gray-500 hover:bg-white/60 hover:text-gray-900'
          )}
        >
          <Settings className="w-4 h-4" />
          Settings
        </button>
      </div>
    </aside>
  )
}
