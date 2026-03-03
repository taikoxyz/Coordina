import { useState, useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useNav } from '../store/nav'
import { useTeam, useAgents, useCreateAgent, useUpdateAgent, useDeleteAgent } from '../hooks/useTeams'
import { useEnvironments, useEnvironment, useDeployTeam, useUndeployTeam, useTeamStatus } from '../hooks/useEnvironments'
import { AgentCard } from '../components/teams/AgentCard'
import { AgentForm } from '../components/agents/AgentForm'
import { ChatPane } from '../components/chat/ChatPane'
import { FileBrowser } from '../components/files/FileBrowser'
import { SpecsPanel } from '../components/specs/SpecsPanel'
import type { AgentRecord } from '../hooks/useTeams'

interface TeamDetailPageProps {
  teamSlug: string
}

type PanelState =
  | { type: 'none' }
  | { type: 'chat'; agentSlug?: string; agentName?: string }
  | { type: 'files'; agentSlug: string; agentName: string }
  | { type: 'specs' }
  | { type: 'agent-form'; agent?: AgentRecord }

export function TeamDetailPage({ teamSlug }: TeamDetailPageProps) {
  const { setPage } = useNav()
  const qc = useQueryClient()
  const { data: team, isLoading: teamLoading } = useTeam(teamSlug)
  const { data: agents, isLoading: agentsLoading } = useAgents(teamSlug)
  const { data: environments = [] } = useEnvironments()
  const createAgent = useCreateAgent()
  const updateAgent = useUpdateAgent()
  const deleteAgent = useDeleteAgent()
  const deployTeam = useDeployTeam()
  const undeployTeam = useUndeployTeam()

  const [hasAiKey, setHasAiKey] = useState(false)
  const [panel, setPanel] = useState<PanelState>({ type: 'none' })
  const [selectedEnvId, setSelectedEnvId] = useState('')
  const [deployError, setDeployError] = useState<string | null>(null)

  useEffect(() => {
    window.api.invoke('settings:hasAiProvider').then(has => setHasAiKey(!!has))
  }, [])

  useEffect(() => {
    if (environments.length > 0 && !selectedEnvId) setSelectedEnvId(environments[0].id)
  }, [environments])

  async function handleSaveAgent(data: Omit<AgentRecord, 'teamSlug'>) {
    if (panel.type === 'agent-form' && panel.agent) {
      await updateAgent.mutateAsync({ slug: panel.agent.slug, teamSlug, data })
    } else {
      await createAgent.mutateAsync({ ...data, teamSlug })
    }
    setPanel({ type: 'none' })
  }

  async function handleDeploy() {
    setDeployError(null)
    const envId = selectedEnvId || environments[0]?.id
    if (!envId) return
    const result = await deployTeam.mutateAsync({ teamSlug, envId }) as { ok: boolean; reason?: string }
    if (!result.ok) { setDeployError(result.reason ?? 'Deploy failed'); return }
    qc.invalidateQueries({ queryKey: ['teams', teamSlug] })
  }

  async function handleUndeploy() {
    if (!team?.deployedEnvId) return
    setDeployError(null)
    await undeployTeam.mutateAsync({ teamSlug, envId: team.deployedEnvId })
    qc.invalidateQueries({ queryKey: ['teams', teamSlug] })
  }

  const sortedAgents = agents ? [...agents].sort((a, b) => (b.isLead ? 1 : 0) - (a.isLead ? 1 : 0)) : []
  const isDeployed = !!team?.gatewayUrl
  const { data: agentStatuses } = useTeamStatus(teamSlug, team?.deployedEnvId)
  // Use deployed env if available, otherwise fall back to the selected env
  const deployedEnv = useEnvironment(team?.deployedEnvId)
  const selectedEnv = useEnvironment(selectedEnvId || environments[0]?.id)
  const activeEnv = deployedEnv ?? selectedEnv
  const gkeCfg = activeEnv?.type === 'gke'
    ? activeEnv.config as { projectId?: string; clusterName?: string; clusterZone?: string }
    : null
  const gkeBase = gkeCfg?.projectId && gkeCfg?.clusterName && gkeCfg?.clusterZone
    ? `https://console.cloud.google.com/kubernetes`
    : null
  const k8sNamespace = `team-${teamSlug}`
  const teamNamespaceUrl = gkeBase && gkeCfg
    ? `${gkeBase}/workload_/gke/${gkeCfg.clusterZone}/${gkeCfg.clusterName}/${k8sNamespace}?project=${gkeCfg.projectId}`
    : null
  function agentPodUrl(agentSlug: string) {
    if (!gkeBase || !gkeCfg) return undefined
    return `${gkeBase}/pod/${gkeCfg.clusterZone}/${gkeCfg.clusterName}/${k8sNamespace}/agent-${agentSlug}-0?project=${gkeCfg.projectId}`
  }
  function agentIngressUrl(agentSlug: string) {
    if (!team?.gatewayUrl) return undefined
    return `${team.gatewayUrl}/agents/${agentSlug}`
  }

  if (teamLoading) return <div className="p-8 text-gray-400">Loading...</div>
  if (!team) return (
    <div className="p-8">
      <p className="text-gray-400">Team not found.</p>
      <button onClick={() => setPage('teams')} className="mt-4 text-sm text-blue-400 hover:underline">← Back to Teams</button>
    </div>
  )

  const panelOpen = panel.type !== 'none'

  const agentsList = (
    <>
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
              teamImage={team.image}
              isDeployed={isDeployed}
              deploymentStatus={(() => {
                if (!isDeployed) return 'undeployed'
                const s = agentStatuses?.find(x => x.agentSlug === agent.slug)?.status
                if (s === 'running') return 'running'
                if (s === 'pending') return 'pending'
                if (s === 'crashed') return 'crashed'
                return 'pending'
              })()}
              podUrl={agentPodUrl(agent.slug)}
              ingressUrl={isDeployed ? agentIngressUrl(agent.slug) : undefined}
              onEdit={() => setPanel({ type: 'agent-form', agent })}
              onDelete={() => {
                if (window.confirm(`Delete agent "${agent.name}"? This cannot be undone.`))
                  deleteAgent.mutate({ slug: agent.slug, teamSlug })
              }}
              onChat={() => setPanel({ type: 'chat', agentSlug: agent.slug, agentName: agent.name })}
              onFiles={() => setPanel({ type: 'files', agentSlug: agent.slug, agentName: agent.name })}
            />
          ))}
        </div>
      )}
    </>
  )

  const deploySection = (
    <div className="mt-2">
      {isDeployed ? (
        <div>
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-green-400" />
            <span className="text-xs text-green-400">Deployed</span>
            <button onClick={() => setPanel({ type: 'chat' })} className="text-xs text-blue-400 hover:underline ml-2">
              Chat with team →
            </button>
            {teamNamespaceUrl && (
              <button onClick={() => window.open(teamNamespaceUrl)} className="text-xs text-blue-400 hover:underline ml-1">
                Namespace →
              </button>
            )}
            <button onClick={() => setPanel({ type: 'specs' })} className="text-xs text-blue-400 hover:underline ml-1">
              Specs →
            </button>
            <button
              onClick={handleUndeploy}
              disabled={undeployTeam.isPending}
              className="text-xs text-gray-500 hover:text-red-400 hover:underline ml-2 transition-colors"
            >
              {undeployTeam.isPending ? 'Undeploying…' : 'Undeploy'}
            </button>
          </div>
          {deployError && <p className="text-xs text-red-400 mt-1">{deployError}</p>}
        </div>
      ) : environments.length === 0 ? (
        <p className="text-xs text-gray-500">
          No environments configured.{' '}
          <button onClick={() => setPage('environments')} className="text-blue-400 hover:underline">
            Add one in Environments →
          </button>
        </p>
      ) : (
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            {environments.length > 1 && (
              <select
                value={selectedEnvId}
                onChange={e => setSelectedEnvId(e.target.value)}
                className="text-xs bg-gray-700 border border-gray-600 text-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                {environments.map(e => (
                  <option key={e.id} value={e.id}>{e.name}</option>
                ))}
              </select>
            )}
            <button
              onClick={handleDeploy}
              disabled={deployTeam.isPending || sortedAgents.length === 0}
              className="text-xs px-3 py-1 rounded bg-green-700 hover:bg-green-600 disabled:opacity-50 text-white transition-colors"
            >
              {deployTeam.isPending ? 'Deploying…' : `Deploy to ${environments.length === 1 ? environments[0].name : 'GKE'}`}
            </button>
            {teamNamespaceUrl && (
              <button onClick={() => window.open(teamNamespaceUrl)} className="text-xs text-blue-400 hover:underline">
                Namespace →
              </button>
            )}
            <button onClick={() => setPanel({ type: 'specs' })} className="text-xs text-blue-400 hover:underline">
              Specs →
            </button>
          </div>
          {deployError && <p className="text-xs text-red-400 mt-1">{deployError}</p>}
        </div>
      )}
    </div>
  )

  const header = (
    <div className="flex items-start justify-between mb-6">
      <div>
        <button onClick={() => setPage('teams')} className="text-sm text-gray-400 hover:text-gray-200 mb-2 block">
          ← Teams
        </button>
        <h1 className="text-xl font-semibold text-gray-100">{team.name}</h1>
        <p className="text-sm text-gray-500 font-mono mt-0.5">{team.slug}</p>
        {team.githubRepo && (
          <button
            onClick={() => window.open(`https://github.com/${team.githubRepo}`)}
            className="text-xs text-blue-400 hover:text-blue-300 hover:underline mt-1 block"
          >
            github.com/{team.githubRepo} →
          </button>
        )}
        {deploySection}
      </div>
      <button
        onClick={() => setPanel({ type: 'agent-form' })}
        className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-colors"
      >
        {sortedAgents.length === 0 ? '+ Add Lead Agent' : '+ Add Agent'}
      </button>
    </div>
  )

  return (
    <div className={panelOpen ? 'flex h-full' : 'p-8 max-w-3xl'}>
      {/* Left column: team header + agents list */}
      <div className={panelOpen ? `${panel.type === 'agent-form' ? 'w-96' : 'w-80'} shrink-0 overflow-y-auto border-r border-gray-700 p-6` : ''}>
        {header}
        {agentsList}
      </div>

      {/* Right column: inline panels */}
      {panelOpen && (
        <div className="flex-1 flex flex-col min-w-0">
          {panel.type === 'chat' && (
            <ChatPane
              teamSlug={teamSlug}
              agentSlug={panel.agentSlug}
              agentName={panel.agentName}
              onClose={() => setPanel({ type: 'none' })}
            />
          )}
          {panel.type === 'files' && (
            <>
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700 flex-shrink-0">
                <span className="font-medium text-white text-sm">Files — {panel.agentName}</span>
                <button onClick={() => setPanel({ type: 'none' })} className="text-gray-400 hover:text-white">✕</button>
              </div>
              <div className="flex-1 overflow-hidden">
                <FileBrowser teamSlug={teamSlug} agentSlug={panel.agentSlug} agentName={panel.agentName} />
              </div>
            </>
          )}
          {panel.type === 'agent-form' && (
            <AgentForm
              agent={panel.agent}
              teamSlug={teamSlug}
              teamDomain={team.domain}
              teamDefaultImage={team.image}
              hasAiKey={hasAiKey}
              forceLead={!panel.agent && sortedAgents.length === 0 ? true : undefined}
              onSave={handleSaveAgent}
              onClose={() => setPanel({ type: 'none' })}
              asPanel
            />
          )}
          {panel.type === 'specs' && (
            <SpecsPanel
              teamSlug={teamSlug}
              envId={selectedEnvId || environments[0]?.id}
              onClose={() => setPanel({ type: 'none' })}
              onApply={handleDeploy}
              isApplying={deployTeam.isPending}
            />
          )}
        </div>
      )}
    </div>
  )
}
