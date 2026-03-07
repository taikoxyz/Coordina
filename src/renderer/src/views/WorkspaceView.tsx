import { useEffect, useState } from 'react'
import { Users } from 'lucide-react'
import { useNav } from '../store/nav'
import { useTeam, useSaveTeam } from '../hooks/useTeams'
import { useEnvironments } from '../hooks/useEnvironments'
import { TeamSidebar } from '../components/TeamSidebar'
import { CreateTeamDialog } from '../components/CreateTeamDialog'
import { SpecEditor } from '../components/SpecEditor'
import { DeployDrawer } from '../components/DeployDrawer'
import { AgentsTab } from '../components/team/AgentsTab'
import { EmptyState } from '../components/EmptyState'
import { cn } from '../lib/utils'
import type { TeamSpec } from '../../../shared/types'

const tabs = [
  { id: 'spec', label: 'Spec' },
  { id: 'agents', label: 'Agents' },
] as const

export function WorkspaceView() {
  const { teamSlug, workspacePanel, setWorkspacePanel, setCreateTeamOpen } = useNav()
  const { data: savedSpec } = useTeam(teamSlug ?? '')
  const { data: environments } = useEnvironments()
  const saveTeam = useSaveTeam()

  const [localSpec, setLocalSpec] = useState<TeamSpec | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [selectedEnvSlug, setSelectedEnvSlug] = useState('')

  useEffect(() => {
    if (savedSpec) {
      setLocalSpec(savedSpec)
      setIsEditing(false)
    }
  }, [savedSpec])

  useEffect(() => {
    if (environments?.length && !selectedEnvSlug) {
      setSelectedEnvSlug(environments[0].slug)
    }
  }, [environments, selectedEnvSlug])

  const handleSave = async () => {
    if (!localSpec) return
    await saveTeam.mutateAsync(localSpec)
  }

  const handleSaveSpec = async (spec: TeamSpec) => {
    await saveTeam.mutateAsync(spec)
  }

  return (
    <div className="flex h-full overflow-hidden">
      <TeamSidebar />

      <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
        {!teamSlug || !localSpec ? (
          <EmptyState
            icon={<Users className="h-12 w-12" />}
            title="Select a team"
            description="Choose a team from the sidebar or create a new one to get started."
            actionLabel="Create team"
            onAction={() => setCreateTeamOpen(true)}
          />
        ) : (
          <>
            <div className="border-b border-gray-200 shrink-0">
              <div className="flex items-center justify-between px-5">
                <div className="flex gap-6">
                  {tabs.map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setWorkspacePanel(tab.id)}
                      className={cn(
                        'text-[13px] font-medium py-3 transition-colors relative',
                        workspacePanel === tab.id
                          ? 'text-gray-900'
                          : 'text-gray-400 hover:text-gray-600',
                      )}
                    >
                      {tab.label}
                      {workspacePanel === tab.id && (
                        <span className="absolute -bottom-[1px] left-0 right-0 h-[2px] bg-gray-900 rounded-t" />
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
              {workspacePanel === 'spec' ? (
                <SpecEditor
                  spec={localSpec}
                  onSpecChange={setLocalSpec}
                  isEditing={isEditing}
                  onEdit={() => setIsEditing(true)}
                  onSave={async () => {
                    await handleSave()
                    setIsEditing(false)
                  }}
                  isSaving={saveTeam.isPending}
                />
              ) : (
                <AgentsTab
                  spec={localSpec}
                  onSpecChange={setLocalSpec}
                  onSave={handleSave}
                  onSaveSpec={handleSaveSpec}
                  isSaving={saveTeam.isPending}
                />
              )}
            </div>

            <DeployDrawer
              spec={localSpec}
              environments={environments ?? []}
              selectedEnvSlug={selectedEnvSlug}
              onEnvChange={setSelectedEnvSlug}
              onSave={handleSave}
              isSaving={saveTeam.isPending}
            />
          </>
        )}
      </div>

      <CreateTeamDialog />
    </div>
  )
}
