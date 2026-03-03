import { useState } from 'react'
import { useTeams, useDeleteTeam } from '../hooks/useTeams'
import { CreateTeamWizard } from '../components/teams/CreateTeamWizard'
import { useNav } from '../store/nav'

export function TeamsPage() {
  const { data: teams, isLoading } = useTeams()
  const deleteTeam = useDeleteTeam()
  const { setPage } = useNav()
  const [showCreate, setShowCreate] = useState(false)

  const header = (
    <div className="flex items-center justify-between mb-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-100">Teams</h1>
        <p className="text-sm text-gray-400 mt-1">Manage your AI agent teams.</p>
      </div>
      <button
        onClick={() => setShowCreate(v => !v)}
        className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-colors"
      >
        {showCreate ? 'Cancel' : '+ Create Team'}
      </button>
    </div>
  )

  const teamsList = (
    <>
      {isLoading && <p className="text-gray-500 text-sm">Loading...</p>}

      {!isLoading && (!teams || teams.length === 0) && (
        <div className="text-center py-16 text-gray-500">
          <p className="text-lg mb-2">No teams yet</p>
          <p className="text-sm">Create your first team to get started.</p>
        </div>
      )}

      {teams && teams.length > 0 && (
        <div className="space-y-3">
          {teams.map(team => (
            <div
              key={team.slug}
              className="bg-gray-800 border border-gray-700 rounded-lg p-4 flex items-center justify-between gap-4 cursor-pointer hover:border-gray-500 transition-colors"
              onClick={() => setPage('teams', team.slug)}
            >
              <div className="min-w-0">
                <h3 className="font-medium text-gray-100">{team.name}</h3>
                <p className="text-sm text-gray-500 font-mono">{team.slug}</p>
                {team.githubRepo && (
                  <button
                    onClick={e => { e.stopPropagation(); window.open(`https://github.com/${team.githubRepo}`) }}
                    className="text-xs text-blue-400 hover:text-blue-300 hover:underline mt-0.5 block"
                  >
                    github.com/{team.githubRepo} →
                  </button>
                )}
              </div>
              <div className="flex gap-2 shrink-0" onClick={e => e.stopPropagation()}>
                <button
                  onClick={() => {
                    if (window.confirm(`Delete team "${team.name}"? This cannot be undone.`))
                      deleteTeam.mutate(team.slug)
                  }}
                  className="text-sm px-3 py-1.5 rounded bg-gray-700 hover:bg-red-900 text-gray-200 hover:text-red-300 transition-colors"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  )

  if (!showCreate) {
    return (
      <div className="p-8 max-w-2xl">
        {header}
        {teamsList}
      </div>
    )
  }

  return (
    <div className="flex h-full">
      <div className="w-80 shrink-0 overflow-y-auto border-r border-gray-700 p-6">
        {header}
        {teamsList}
      </div>
      <div className="flex-1 overflow-y-auto p-8">
        <CreateTeamWizard asPanel onClose={() => setShowCreate(false)} />
      </div>
    </div>
  )
}
