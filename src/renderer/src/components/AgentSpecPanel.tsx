import { useEffect, useState } from 'react'
import { useTeam, useSaveTeam } from '../hooks/useTeams'
import { AgentCard } from './team/AgentCard'
import type { TeamSpec } from '../../../shared/types'

export function AgentSpecPanel({ teamSlug, agentSlug }: { teamSlug: string; agentSlug: string }) {
  const { data: savedSpec } = useTeam(teamSlug)
  const saveTeam = useSaveTeam()
  const [localSpec, setLocalSpec] = useState<TeamSpec | null>(null)
  const [isEditing, setIsEditing] = useState(false)

  useEffect(() => {
    if (savedSpec) {
      setLocalSpec(savedSpec)
      setIsEditing(false)
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

  return (
    <div className="h-full overflow-y-auto">
      <div className="py-6 px-6 max-w-2xl mx-auto space-y-4">
        <AgentCard
          teamSlug={localSpec.slug}
          agent={agent}
          index={agentIndex}
          isEditing={isEditing}
          onEdit={() => setIsEditing(true)}
          onCancel={() => {
            setLocalSpec(savedSpec ?? null)
            setIsEditing(false)
          }}
          onSave={async () => {
            if (localSpec) await saveTeam.mutateAsync(localSpec)
            setIsEditing(false)
          }}
          isSaving={saveTeam.isPending}
          onChange={updateAgent}
          onDelete={() => void deleteAgent()}
          teamEmail={localSpec.teamEmail}
          isLead={agent.slug === localSpec.leadAgent}
        />
      </div>
    </div>
  )
}
