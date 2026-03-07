import { useState, useEffect } from 'react'
import { useTeam, useSaveTeam } from '../hooks/useTeams'
import { useNav, type TeamTab } from '../store/nav'
import { SpecsTab } from '../components/team/SpecsTab'
import { DeployTab } from '../components/team/DeployTab'
import { ChatTab } from '../components/team/ChatTab'
import { useEnvironments } from '../hooks/useEnvironments'
import { cn } from '../lib/utils'
import type { TeamSpec } from '../../../shared/types'

interface Props {
  teamSlug: string
}

const tabs: { id: TeamTab; label: string }[] = [
  { id: 'specs', label: 'Team Specifications' },
  { id: 'deployments', label: 'Deployments' },
  { id: 'chat', label: 'Chat' },
]

export function TeamDetailPage({ teamSlug }: Props) {
  const { data: savedSpec, isLoading } = useTeam(teamSlug)
  const [localSpec, setLocalSpec] = useState<TeamSpec | null>(null)
  const { teamTab, setTeamTab } = useNav()
  const saveTeam = useSaveTeam()
  const { data: environments } = useEnvironments()
  const [selectedEnvSlug, setSelectedEnvSlug] = useState('')

  useEffect(() => {
    if (savedSpec) setLocalSpec(savedSpec)
  }, [savedSpec])

  useEffect(() => {
    if (environments?.length && !selectedEnvSlug) setSelectedEnvSlug(environments[0].slug)
  }, [environments, selectedEnvSlug])

  if (isLoading) return <div className="p-6 text-sm text-gray-500">Loading...</div>
  if (!localSpec) return <div className="p-6 text-sm text-gray-500">Team not found.</div>

  const handleSave = () => saveTeam.mutateAsync(localSpec).then(() => undefined)
  const handleSaveSpec = (specToSave: TeamSpec) => saveTeam.mutateAsync(specToSave).then(() => undefined)

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Tab bar */}
      <div className="flex gap-1 px-6 border-b border-gray-200 shrink-0">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setTeamTab(tab.id)}
            className={cn(
              'px-3 py-2 text-sm font-medium transition-colors relative',
              teamTab === tab.id ? 'text-blue-600' : 'text-gray-500 hover:text-gray-700'
            )}
          >
            {tab.label}
            {tab.id === 'chat' && ` (${localSpec.agents.length})`}
            {teamTab === tab.id && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 rounded-t" />
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        {teamTab === 'specs' && (
          <SpecsTab
            spec={localSpec}
            onSpecChange={setLocalSpec}
            onSave={handleSave}
            onSaveSpec={handleSaveSpec}
            isSaving={saveTeam.isPending}
          />
        )}
        {teamTab === 'deployments' && (
          <DeployTab
            spec={localSpec}
            onSave={handleSave}
            isSaving={saveTeam.isPending}
            selectedEnvSlug={selectedEnvSlug}
            onEnvChange={setSelectedEnvSlug}
          />
        )}
        {teamTab === 'chat' && (
          <ChatTab
            spec={localSpec}
            onSpecChange={setLocalSpec}
            onSaveSpec={handleSaveSpec}
            envSlug={selectedEnvSlug || undefined}
          />
        )}
      </div>

      {saveTeam.error && (
        <div className="px-6 py-2 border-t border-red-200 bg-red-50 text-xs text-red-700 shrink-0">
          {(saveTeam.error as Error).message}
        </div>
      )}
    </div>
  )
}
