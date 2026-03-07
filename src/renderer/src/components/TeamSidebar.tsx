import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { useTeams, useDeleteTeam } from '../hooks/useTeams'
import { useNav } from '../store/nav'
import { cn } from '../lib/utils'
import type { TeamSpec } from '../../../shared/types'

function TeamRow({
  team,
  isActive,
  onSelect,
  deleteTarget,
  onDeleteTarget,
  onConfirmDelete,
}: {
  team: TeamSpec
  isActive: boolean
  onSelect: () => void
  deleteTarget: boolean
  onDeleteTarget: (slug: string | null) => void
  onConfirmDelete: () => void
}) {
  return (
    <button
      onClick={onSelect}
      className={cn(
        'group w-full border-b border-gray-100 px-3 py-2.5 text-left transition-colors',
        isActive
          ? 'bg-white text-gray-900'
          : 'text-gray-600 hover:bg-white/80 hover:text-gray-900',
      )}
    >
      <div className="flex items-center justify-between gap-1">
        <div className="min-w-0 flex-1">
          <div className="text-[12px] font-medium truncate">{team.name}</div>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="text-[10px] text-gray-400">
              {team.agents.length} agent{team.agents.length !== 1 ? 's' : ''}
            </span>
            {team.lastDeployedAt && (
              <span className="text-[10px] text-green-500">deployed</span>
            )}
          </div>
        </div>
        <div
          className="shrink-0"
          onClick={(e) => e.stopPropagation()}
        >
          {deleteTarget ? (
            <div className="flex items-center gap-1">
              <button
                onClick={onConfirmDelete}
                className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-red-600 text-white hover:bg-red-700"
              >
                Confirm
              </button>
              <button
                onClick={() => onDeleteTarget(null)}
                className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-gray-100 text-gray-600 hover:bg-gray-200"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => onDeleteTarget(team.slug)}
              className="opacity-0 group-hover:opacity-100 p-1 rounded text-gray-400 hover:text-red-600 hover:bg-red-50 transition-all"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>
    </button>
  )
}

export function TeamSidebar() {
  const { data: teams } = useTeams()
  const deleteTeam = useDeleteTeam()
  const { teamSlug, selectTeam, setCreateTeamOpen } = useNav()
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)

  return (
    <aside className="w-52 shrink-0 bg-[#f6f5f3] border-r border-gray-100 h-full flex flex-col">
      <div className="px-3 py-3 border-b border-gray-100 shrink-0">
        <div className="flex items-center justify-between gap-2">
          <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-gray-400">
            Teams
          </div>
          <button
            onClick={() => setCreateTeamOpen(true)}
            className="inline-flex h-6 w-6 items-center justify-center rounded-md text-gray-400 transition-colors hover:bg-white hover:text-gray-700"
            title="New team"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {(teams ?? []).map((team) => (
          <TeamRow
            key={team.slug}
            team={team}
            isActive={teamSlug === team.slug}
            onSelect={() => selectTeam(team.slug)}
            deleteTarget={deleteTarget === team.slug}
            onDeleteTarget={setDeleteTarget}
            onConfirmDelete={() => {
              deleteTeam.mutate(team.slug)
              setDeleteTarget(null)
            }}
          />
        ))}
        {!teams?.length && (
          <p className="px-3 py-4 text-[10px] text-gray-400 text-center">
            No teams yet
          </p>
        )}
      </div>
    </aside>
  )
}
