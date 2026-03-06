import { useState, useEffect } from 'react'
import { useTeam, useSaveTeam } from '../hooks/useTeams'
import { useNav, type TeamTab } from '../store/nav'
import { TeamToolbar } from '../components/team/TeamToolbar'
import { TeamOverview } from '../components/team/TeamOverview'
import { AgentsTab } from '../components/team/AgentsTab'
import { DeployTab } from '../components/team/DeployTab'
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
]

export function TeamDetailPage({ teamSlug }: Props) {
  const { data: savedSpec, isLoading } = useTeam(teamSlug)
  const [localSpec, setLocalSpec] = useState<TeamSpec | null>(null)
  const [isEditingOverview, setIsEditingOverview] = useState(false)
  const { teamTab, setTeamTab } = useNav()
  const saveTeam = useSaveTeam()
  const { data: environments } = useEnvironments()

  const [selectedEnvSlug, setSelectedEnvSlug] = useState('')

  useEffect(() => {
    if (savedSpec) {
      setLocalSpec(savedSpec)
      setIsEditingOverview(false)
    }
  }, [savedSpec])

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

  return (
    <div className="h-full flex flex-col bg-white">
      <TeamToolbar
        spec={localSpec}
        showSaveButton={teamTab === 'agents' || teamTab === 'deploy'}
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
          <AgentsTab
            spec={localSpec}
            onSpecChange={setLocalSpec}
            envSlug={selectedEnvSlug || undefined}
          />
        )}

        {teamTab === 'deploy' && (
          <DeployTab spec={localSpec} onSave={handleSave} isSaving={saveTeam.isPending} />
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
