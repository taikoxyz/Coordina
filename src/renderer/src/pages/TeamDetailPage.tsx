import React, { useState, useEffect } from 'react'
import { useNav } from '../store/nav'
import { useTeam, useAgents, useCreateAgent, useUpdateAgent, useDeleteAgent } from '../hooks/useTeams'
import { AgentCard } from '../components/teams/AgentCard'
import { AgentForm } from '../components/agents/AgentForm'
import type { AgentRecord } from '../hooks/useTeams'
import { deriveSlug } from '../../../shared/slug'

interface TeamDetailPageProps {
  teamSlug: string
}

export function TeamDetailPage({ teamSlug }: TeamDetailPageProps) {
  const { setPage } = useNav()
  const { data: team, isLoading: teamLoading } = useTeam(teamSlug)
  const { data: agents, isLoading: agentsLoading } = useAgents(teamSlug)
  const createAgent = useCreateAgent()
  const updateAgent = useUpdateAgent()
  const deleteAgent = useDeleteAgent()

  const [showAgentForm, setShowAgentForm] = useState(false)
  const [editingAgent, setEditingAgent] = useState<AgentRecord | undefined>()
  const [hasAiKey, setHasAiKey] = useState(false)

  useEffect(() => {
    window.api.invoke('settings:hasAnthropicKey').then(has => setHasAiKey(!!has))
  }, [])

  async function handleSaveAgent(data: Omit<AgentRecord, 'teamSlug'>) {
    if (editingAgent) {
      await updateAgent.mutateAsync({ slug: editingAgent.slug, teamSlug, data })
    } else {
      await createAgent.mutateAsync({ ...data, teamSlug })
    }
    setShowAgentForm(false)
    setEditingAgent(undefined)
  }

  const sortedAgents = agents ? [...agents].sort((a, b) => (b.isLead ? 1 : 0) - (a.isLead ? 1 : 0)) : []

  if (teamLoading) return <div className="p-8 text-gray-400">Loading...</div>
  if (!team) return (
    <div className="p-8">
      <p className="text-gray-400">Team not found.</p>
      <button onClick={() => setPage('teams')} className="mt-4 text-sm text-blue-400 hover:underline">← Back to Teams</button>
    </div>
  )

  return (
    <div className="p-8 max-w-3xl">
      <div className="flex items-start justify-between mb-6">
        <div>
          <button onClick={() => setPage('teams')} className="text-sm text-gray-400 hover:text-gray-200 mb-2 block">
            ← Teams
          </button>
          <h1 className="text-xl font-semibold text-gray-100">{team.name}</h1>
          <p className="text-sm text-gray-500 font-mono mt-0.5">{team.slug}</p>
          {team.githubRepo && (
            <p className="text-xs text-gray-500 mt-1">GitHub: {team.githubRepo}</p>
          )}
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => { setEditingAgent(undefined); setShowAgentForm(true) }}
            className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-colors"
          >
            + Add Agent
          </button>
        </div>
      </div>

      {agentsLoading && <p className="text-gray-500 text-sm">Loading agents...</p>}

      {!agentsLoading && sortedAgents.length === 0 && (
        <div className="text-center py-16 text-gray-500">
          <p className="text-lg mb-2">No agents yet</p>
          <p className="text-sm">Add your first agent to get started.</p>
        </div>
      )}

      {sortedAgents.length > 0 && (
        <div className="space-y-3">
          {sortedAgents.map(agent => (
            <AgentCard
              key={agent.slug}
              agent={agent}
              onEdit={() => { setEditingAgent(agent); setShowAgentForm(true) }}
              onDelete={() => deleteAgent.mutate({ slug: agent.slug, teamSlug })}
              onChat={() => {}}
              onFiles={() => {}}
            />
          ))}
        </div>
      )}

      {showAgentForm && (
        <AgentForm
          agent={editingAgent}
          teamSlug={teamSlug}
          hasAiKey={hasAiKey}
          onSave={handleSaveAgent}
          onClose={() => { setShowAgentForm(false); setEditingAgent(undefined) }}
        />
      )}
    </div>
  )
}
