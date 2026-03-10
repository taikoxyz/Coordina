import { useEffect, useState } from 'react'
import { Pencil, Trash2 } from 'lucide-react'
import { useTeam, useSaveTeam } from '../hooks/useTeams'
import { useGkeConfig } from '../hooks/useEnvironments'
import { agentTextColor } from '../lib/agentColors'
import { AgentCard } from './team/AgentCard'
import { AgentAvatar } from './AgentAvatar'
import { Button, DialogShell } from './ui'
import type { TeamSpec } from '../../../shared/types'

export function AgentSpecPanel({ teamSlug, agentSlug }: { teamSlug: string; agentSlug: string }) {
  const { data: savedSpec } = useTeam(teamSlug)
  const saveTeam = useSaveTeam()
  const { data: gkeConfig } = useGkeConfig()
  const [localSpec, setLocalSpec] = useState<TeamSpec | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [alsoUndeploy, setAlsoUndeploy] = useState(false)
  const [deleteDisks, setDeleteDisks] = useState(false)

  useEffect(() => {
    if (savedSpec) {
      setLocalSpec(savedSpec)
      setIsEditing(false)
      setShowDeleteDialog(false)
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
    setShowDeleteDialog(false)
    if (alsoUndeploy && gkeConfig) {
      await window.api.invoke('undeploy:agent', {
        teamSlug: localSpec.slug,
        agentSlug,
        envSlug: 'gke',
        deleteDisks,
      })
    }
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
    setShowDeleteDialog(false)
  }

  return (
    <>
      <div className="shrink-0 border-b border-gray-200">
        <div className="max-w-2xl mx-auto px-3 h-11 flex items-center gap-2.5">
          <AgentAvatar slug={agent.slug} colorIndex={agentIndex} size={36} />
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
                disabled={saveTeam.isPending || !(agent.name ?? '').trim() || (agent.models ?? []).length === 0}
              >
                {saveTeam.isPending ? 'Saving...' : 'Save'}
              </Button>
              <Button variant="destructive" size="sm" onClick={() => { setAlsoUndeploy(false); setDeleteDisks(false); setShowDeleteDialog(true) }}>
                Delete
              </Button>
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
            defaultImage={localSpec.defaultImage}
            defaultCpu={localSpec.defaultCpu}
            defaultDiskGi={localSpec.defaultDiskGi}
          />
        </div>
      </div>

      <DialogShell
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        title="Delete Agent"
      >
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            This will remove <span className="font-medium text-foreground">{agent.name || agent.slug}</span> from the team spec.
          </p>
          {gkeConfig && (
            <>
              <label className="flex items-start gap-2.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={alsoUndeploy}
                  onChange={(e) => { setAlsoUndeploy(e.target.checked); if (!e.target.checked) setDeleteDisks(false) }}
                  className="mt-0.5 rounded border-gray-300 text-destructive focus:ring-destructive"
                />
                <span className="text-sm">
                  <span className="font-medium text-foreground">Also delete deployment</span>
                  <span className="block text-xs text-muted-foreground mt-0.5">Remove Kubernetes resources (StatefulSet, Service, Pod) for this agent.</span>
                </span>
              </label>
              {alsoUndeploy && (
                <label className="flex items-start gap-2.5 cursor-pointer select-none ml-6">
                  <input
                    type="checkbox"
                    checked={deleteDisks}
                    onChange={(e) => setDeleteDisks(e.target.checked)}
                    className="mt-0.5 rounded border-gray-300 text-destructive focus:ring-destructive"
                  />
                  <span className="text-sm">
                    <span className="font-medium text-foreground">Also delete disks</span>
                    <span className="block text-xs text-muted-foreground mt-0.5">Permanently removes all agent memory, workspace files, and stored data. This cannot be undone.</span>
                  </span>
                </label>
              )}
            </>
          )}
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>Cancel</Button>
            <Button variant="destructive" onClick={() => void deleteAgent()}>
              <Trash2 className="w-3.5 h-3.5" />
              Delete Agent
            </Button>
          </div>
        </div>
      </DialogShell>
    </>
  )
}
