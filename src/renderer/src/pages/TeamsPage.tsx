import { useEffect, useState } from 'react'
import { useTeams, useDeleteTeam, useSaveTeam } from '../hooks/useTeams'
import { useNav } from '../store/nav'
import { Plus, Trash2, Users, ChevronRight } from 'lucide-react'
import type { TeamSpec } from '../../../shared/types'

const emptySpec = (): TeamSpec => ({ slug: '', name: '', agents: [] })
const toSlug = (name: string) => 'team-' + name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

interface Props {
  startCreating?: boolean
}

export function TeamsPage({ startCreating = false }: Props) {
  const { data: teams, isLoading } = useTeams()
  const deleteTeam = useDeleteTeam()
  const saveTeam = useSaveTeam()
  const { setPage } = useNav()
  const [newSpec, setNewSpec] = useState<TeamSpec | null>(() => startCreating ? emptySpec() : null)
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)

  useEffect(() => {
    if (!startCreating) return
    setNewSpec(prev => prev ?? emptySpec())
  }, [startCreating])

  const handleCreate = async () => {
    if (!newSpec?.slug || !newSpec?.name) return
    const result = await saveTeam.mutateAsync(newSpec)
    if (result.ok) {
      setNewSpec(null)
      setPage('teams', newSpec.slug)
    }
  }

  if (!isLoading && !teams?.length && !newSpec) {
    return (
      <div className="flex h-full items-center justify-center px-6">
        <div className="max-w-sm text-center">
          <Users className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-sm font-medium text-gray-400">No team found</p>
          <p className="text-xs text-gray-400 mt-1">Create your first team to get started.</p>
          <button
            onClick={() => setNewSpec(emptySpec())}
            className="mt-4 px-4 py-2 text-sm font-medium rounded-md bg-blue-600 text-white hover:bg-blue-700 transition-colors"
          >
            Create team
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-2xl mx-auto px-6 py-6 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-gray-900">Teams</h1>
            <p className="text-sm text-gray-500 mt-0.5">Manage your AI agent teams.</p>
          </div>
          <button
            onClick={() => setNewSpec(newSpec ? null : emptySpec())}
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-md bg-blue-600 text-white hover:bg-blue-700 transition-colors"
          >
            {newSpec ? (
              <>Cancel</>
            ) : (
              <><Plus className="w-4 h-4" /> New team</>
            )}
          </button>
        </div>

        {/* New team form */}
        {newSpec && (
          <div className="rounded-lg border border-blue-200 bg-blue-50/50 p-5 space-y-3">
            <h3 className="text-sm font-semibold text-gray-900">Create a new team</h3>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Team name</label>
              <input
                className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                value={newSpec.name}
                onChange={e => setNewSpec({ ...newSpec, name: e.target.value, slug: toSlug(e.target.value) })}
                placeholder="My Team"
                autoFocus
                onKeyDown={e => e.key === 'Enter' && handleCreate()}
              />
              {newSpec.name && (
                <p className="text-xs text-gray-400 font-mono mt-1">{newSpec.slug}</p>
              )}
            </div>
            <button
              onClick={handleCreate}
              disabled={!newSpec.name || saveTeam.isPending}
              className="px-4 py-2 text-sm font-medium rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {saveTeam.isPending ? 'Creating...' : 'Create team'}
            </button>
          </div>
        )}

        {/* Loading */}
        {isLoading && <p className="text-sm text-gray-400">Loading...</p>}

        {/* Team cards */}
        <div className="space-y-2">
          {teams?.map(team => (
            <div
              key={team.slug}
              onClick={() => setPage('teams', team.slug)}
              className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-4 py-3.5 cursor-pointer hover:border-gray-300 hover:shadow-sm transition-all group"
            >
              <div className="flex items-center gap-3.5 min-w-0">
                <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-blue-50 text-blue-600 text-sm font-semibold shrink-0">
                  {team.name.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-medium text-gray-900">{team.name}</div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-gray-400 font-mono">{team.slug}</span>
                    {team.agents.length > 0 && (
                      <span className="inline-flex items-center text-xs text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">
                        {team.agents.length} agent{team.agents.length !== 1 ? 's' : ''}
                      </span>
                    )}
                    {team.lastDeployedAt && (
                      <span className="inline-flex items-center text-xs text-green-600 bg-green-50 px-1.5 py-0.5 rounded">
                        Deployed
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <div
                  className="opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={e => e.stopPropagation()}
                >
                  {deleteTarget === team.slug ? (
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => { deleteTeam.mutate(team.slug); setDeleteTarget(null) }}
                        className="px-2.5 py-1 text-xs font-medium rounded-md bg-red-600 text-white hover:bg-red-700"
                      >
                        Confirm
                      </button>
                      <button
                        onClick={() => setDeleteTarget(null)}
                        className="px-2.5 py-1 text-xs font-medium rounded-md bg-gray-100 text-gray-600 hover:bg-gray-200"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setDeleteTarget(team.slug)}
                      className="p-1.5 rounded-md text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                <ChevronRight className="w-4 h-4 text-gray-300" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
