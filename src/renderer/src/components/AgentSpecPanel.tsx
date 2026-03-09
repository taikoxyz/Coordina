import { useEffect, useState } from 'react'
import { Pencil } from 'lucide-react'
import { useTeam, useSaveTeam } from '../hooks/useTeams'
import { agentTextColor } from '../lib/agentColors'
import { AgentCard } from './team/AgentCard'
import { Button } from './ui'
import type { TeamSpec } from '../../../shared/types'

export function AgentSpecPanel({ teamSlug, agentSlug }: { teamSlug: string; agentSlug: string }) {
  const { data: savedSpec } = useTeam(teamSlug)
  const saveTeam = useSaveTeam()
  const [localSpec, setLocalSpec] = useState<TeamSpec | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  useEffect(() => {
    if (savedSpec) {
      setLocalSpec(savedSpec)
      setIsEditing(false)
      setConfirmDelete(false)
    }
  }, [savedSpec])

  if (!localSpec) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-gray-400">
        Loading agent...
      </div>
    )
  }

  const agentIndex = localSpec.agents.findIndex((a) => a.slug === agentSlug)
  const agent = localSpec.agents[agentIndex]

  if (!agent) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-gray-400">
        Agent not found
      </div>
    )
  }

  const updateAgent = (updated: typeof agent) => {
    const agents = [...localSpec.agents]
    agents[agentIndex] = updated
    setLocalSpec({ ...localSpec, agents })
  }

  const deleteAgent = async () => {
    const newAgents = localSpec.agents.filter((_, j) => j !== agentIndex)
    const newSpec = { ...localSpec, agents: newAgents, leadAgent: newAgents[0]?.slug || undefined }
    await saveTeam.mutateAsync(newSpec)
  }

  const handleSave = async () => {
    if (localSpec) await saveTeam.mutateAsync(localSpec)
    setIsEditing(false)
  }

  const handleCancel = () => {
    setLocalSpec(savedSpec ?? null)
    setIsEditing(false)
    setConfirmDelete(false)
  }

  return (
    <>
      <div className="shrink-0 border-b border-gray-200">
        <div className="max-w-2xl mx-auto px-6 h-11 flex items-center gap-2">
          <div className={`text-xs font-semibold uppercase tracking-[0.16em] ${agentTextColor(agentIndex)}`}>
            {agent.name || 'Unnamed agent'}
          </div>
          <div className="flex-1" />
          {isEditing ? (
            <>
              <Button
                variant="primary"
                size="sm"
                onClick={() => void handleSave()}
                disabled={saveTeam.isPending}
              >
                {saveTeam.isPending ? 'Saving...' : 'Save'}
              </Button>
              {confirmDelete ? (
                <Button variant="destructive" size="sm" onClick={() => void deleteAgent()}>
                  Confirm delete
                </Button>
              ) : (
                <Button variant="destructive" size="sm" onClick={() => setConfirmDelete(true)}>
                  Delete
                </Button>
              )}
              <Button variant="secondary" size="sm" onClick={handleCancel} disabled={saveTeam.isPending}>
                Cancel
              </Button>
            </>
          ) : (
            <Button variant="ghost" size="icon" onClick={() => setIsEditing(true)} title="Edit agent">
              <Pencil className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto min-h-0">
        <div className="py-4 px-6 max-w-2xl mx-auto">
          <AgentCard
            teamSlug={localSpec.slug}
            agent={agent}
            isEditing={isEditing}
            onChange={updateAgent}
            teamEmail={localSpec.teamEmail}
            isLead={agent.slug === localSpec.leadAgent}
          />
        </div>
      </div>
    </>
  )
}
