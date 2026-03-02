import { useState, useEffect } from 'react'
import { useNav } from '../store/nav'
import { useTeam, useAgents, useCreateAgent, useUpdateAgent, useDeleteAgent } from '../hooks/useTeams'
import { AgentCard } from '../components/teams/AgentCard'
import { AgentForm } from '../components/agents/AgentForm'
import { ChatPane } from '../components/chat/ChatPane'
import { FileBrowser } from '../components/files/FileBrowser'
import type { AgentRecord } from '../hooks/useTeams'

interface TeamDetailPageProps {
  teamSlug: string
}

type ModalState =
  | { type: 'none' }
  | { type: 'chat'; agentSlug?: string; agentName?: string }
  | { type: 'files'; agentSlug: string; agentName: string }

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
  const [modal, setModal] = useState<ModalState>({ type: 'none' })

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
  const isDeployed = !!(team as any)?.gatewayUrl

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
          {isDeployed && (
            <div className="flex items-center gap-1.5 mt-1">
              <div className="w-1.5 h-1.5 rounded-full bg-green-400" />
              <span className="text-xs text-green-400">Deployed</span>
              <button
                onClick={() => setModal({ type: 'chat' })}
                className="text-xs text-blue-400 hover:underline ml-2"
              >
                Chat with team →
              </button>
            </div>
          )}
        </div>
        <button
          onClick={() => { setEditingAgent(undefined); setShowAgentForm(true) }}
          className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-colors"
        >
          + Add Agent
        </button>
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
              isDeployed={isDeployed}
              onEdit={() => { setEditingAgent(agent); setShowAgentForm(true) }}
              onDelete={() => deleteAgent.mutate({ slug: agent.slug, teamSlug })}
              onChat={() => setModal({ type: 'chat', agentSlug: agent.slug, agentName: agent.name })}
              onFiles={() => setModal({ type: 'files', agentSlug: agent.slug, agentName: agent.name })}
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

      {/* Chat modal */}
      {modal.type === 'chat' && (
        <div className="fixed inset-0 bg-black/60 z-50 flex flex-col">
          <div className="flex-1 flex flex-col max-w-3xl w-full mx-auto bg-gray-900 rounded-t-xl mt-8 overflow-hidden">
            <ChatPane
              teamSlug={teamSlug}
              agentSlug={modal.agentSlug}
              agentName={modal.agentName}
              onClose={() => setModal({ type: 'none' })}
            />
          </div>
        </div>
      )}

      {/* Files modal */}
      {modal.type === 'files' && (
        <div className="fixed inset-0 bg-black/60 z-50 flex flex-col">
          <div className="flex-1 flex flex-col max-w-5xl w-full mx-auto bg-gray-900 rounded-t-xl mt-8 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700 flex-shrink-0">
              <span className="font-medium text-white">Files — {modal.agentName}</span>
              <button onClick={() => setModal({ type: 'none' })} className="text-gray-400 hover:text-white">✕</button>
            </div>
            <div className="flex-1 overflow-hidden">
              <FileBrowser teamSlug={teamSlug} agentSlug={modal.agentSlug} agentName={modal.agentName} />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
