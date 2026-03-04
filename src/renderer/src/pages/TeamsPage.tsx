// Teams list page with inline new-team form replacing the wizard dialog
// FEATURE: Teams page with dense list and inline creation without modal popups
import { useState } from 'react'
import { useTeams, useDeleteTeam, useSaveTeam } from '../hooks/useTeams'
import { useNav } from '../store/nav'
import type { TeamSpec } from '../../../shared/types'

const emptySpec = (): TeamSpec => ({ slug: '', name: '', agents: [] })
const toSlug = (name: string) => 'team-' + name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
const inputCls = 'bg-gray-800 border border-gray-700 rounded px-1.5 py-0.5 text-[11px] text-gray-200 focus:outline-none focus:border-blue-600 w-full font-mono'

export function TeamsPage() {
  const { data: teams, isLoading } = useTeams()
  const deleteTeam = useDeleteTeam()
  const saveTeam = useSaveTeam()
  const { setPage } = useNav()
  const [newSpec, setNewSpec] = useState<TeamSpec | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)

  const handleCreate = async () => {
    if (!newSpec?.slug || !newSpec?.name) return
    const result = await saveTeam.mutateAsync(newSpec)
    if (result.ok) {
      setNewSpec(null)
      setPage('teams', newSpec.slug)
    }
  }

  return (
    <div className="h-full flex overflow-hidden">
      <div className="flex-1 overflow-y-auto p-4 space-y-3 max-w-xl">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[12px] font-medium text-gray-300">Teams</span>
          <button
            onClick={() => setNewSpec(newSpec ? null : emptySpec())}
            className="text-[10px] text-blue-500 hover:text-blue-400"
          >
            {newSpec ? 'Cancel' : '+ new team'}
          </button>
        </div>

        {newSpec && (
          <div className="border border-blue-700/50 bg-gray-800/50 rounded p-2.5 space-y-1.5">
            <span className="text-[10px] text-blue-300 font-medium">New team</span>
            <div>
              <label className="text-[10px] text-gray-500 block mb-0.5">name</label>
              <input
                className={inputCls}
                value={newSpec.name}
                onChange={e => setNewSpec({ ...newSpec, name: e.target.value, slug: toSlug(e.target.value) })}
                placeholder="My Team"
                autoFocus
              />
              {newSpec.name && (
                <p className="text-[10px] text-gray-600 font-mono mt-0.5">{newSpec.slug}</p>
              )}
            </div>
            <button
              onClick={handleCreate}
              disabled={!newSpec.name || saveTeam.isPending}
              className="text-[10px] px-3 py-0.5 bg-blue-700 hover:bg-blue-600 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded transition-colors"
            >
              {saveTeam.isPending ? 'Creating…' : 'Create'}
            </button>
          </div>
        )}

        {isLoading && <p className="text-[11px] text-gray-500">Loading…</p>}
        {!isLoading && !teams?.length && !newSpec && (
          <p className="text-[11px] text-gray-600 py-6 text-center">No teams. Create one to get started.</p>
        )}

        {teams?.map(team => (
          <div
            key={team.slug}
            onClick={() => setPage('teams', team.slug)}
            className="flex items-center justify-between px-2.5 py-2 bg-gray-800/40 border border-gray-700/60 rounded cursor-pointer hover:border-gray-600 transition-colors group"
          >
            <div className="min-w-0">
              <div className="text-[11px] text-gray-200">{team.name}</div>
              <div className="text-[10px] text-gray-600 font-mono">{team.slug}</div>
              {team.agents.length > 0 && (
                <div className="text-[10px] text-gray-600 mt-0.5">{team.agents.length} agent{team.agents.length !== 1 ? 's' : ''}</div>
              )}
            </div>
            <div className="flex gap-1.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
              {deleteTarget === team.slug ? (
                <>
                  <button onClick={() => { deleteTeam.mutate(team.slug); setDeleteTarget(null) }} className="text-[10px] px-1.5 py-0.5 bg-red-800 hover:bg-red-700 text-red-200 rounded">Confirm</button>
                  <button onClick={() => setDeleteTarget(null)} className="text-[10px] px-1.5 py-0.5 bg-gray-700 text-gray-400 rounded">Cancel</button>
                </>
              ) : (
                <button onClick={() => setDeleteTarget(team.slug)} className="text-[10px] px-1.5 py-0.5 text-gray-600 hover:text-red-500 transition-colors">Delete</button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
