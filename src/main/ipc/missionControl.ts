// IPC handlers and utilities for Mission Control agent registration
// FEATURE: Mission Control integration layer for post-deploy agent registration

import { ipcMain } from 'electron'
import * as net from 'net'
import * as k8s from '@kubernetes/client-node'
import { getEnvironment } from '../store/environments'
import { getTeam } from '../store/teams'
import { buildKubeConfig } from '../environments/gke/deploy'
import { deriveMcApiKey } from '../specs/gke'
import type { MissionControlConfig } from '../../shared/types'

export interface AgentRegistrationEntry {
  slug: string
  isLead: boolean
}

export interface RegisterOptions {
  mcUrl: string
  apiKey: string
  namespace: string
  agents: AgentRegistrationEntry[]
}

export async function registerAgentsWithMissionControl(opts: RegisterOptions): Promise<void> {
  const { mcUrl, apiKey, namespace, agents } = opts
  const headers = { 'x-api-key': apiKey, 'Content-Type': 'application/json' }

  for (const agent of agents) {
    if (!agent.isLead) {
      const gwRes = await fetch(`${mcUrl}/api/gateways`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          name: agent.slug,
          host: `agent-${agent.slug}.${namespace}.svc.cluster.local`,
          port: 18789,
        }),
      })
      if (!gwRes.ok) throw new Error(`MC API error ${gwRes.status} on /api/gateways: ${await gwRes.text().catch(() => '')}`)
    }
  }

  for (const agent of agents) {
    const agentRes = await fetch(`${mcUrl}/api/agents`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ name: agent.slug, status: 'active' }),
    })
    if (!agentRes.ok) throw new Error(`MC API error ${agentRes.status} on /api/agents: ${await agentRes.text().catch(() => '')}`)
  }
}

async function withMcPortForward(kc: k8s.KubeConfig, namespace: string, fn: (url: string) => Promise<void>): Promise<void> {
  const coreApi = kc.makeApiClient(k8s.CoreV1Api)
  const pods = await coreApi.listNamespacedPod({ namespace, labelSelector: 'app=mission-control' })
  const pod = pods.items.find(p => p.status?.phase === 'Running')
  if (!pod?.metadata?.name) throw new Error('Mission Control pod is not running')

  const portForward = new k8s.PortForward(kc)
  const server = net.createServer((socket) => {
    portForward.portForward(namespace, pod.metadata!.name!, [3000], socket, null, socket)
  })

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const localPort = (server.address() as net.AddressInfo).port

  try {
    await fn(`http://127.0.0.1:${localPort}`)
  } finally {
    server.close()
  }
}

export function registerMissionControlHandlers(): void {
  ipcMain.handle('mc:registerAgents', async (_e, { teamSlug, envSlug }: { teamSlug: string; envSlug: string }) => {
    const [team, env] = await Promise.all([getTeam(teamSlug), getEnvironment(envSlug)])
    if (!team) return { ok: false, reason: 'Team not found' }
    if (!env) return { ok: false, reason: 'Environment not found' }

    const mc = (env.config as { missionControl?: MissionControlConfig }).missionControl
    if (!mc?.enabled) return { ok: false, reason: 'Mission Control not configured in GKE settings' }
    if (!team.signingKey) return { ok: false, reason: 'Signing key not set on team' }
    const apiKey = deriveMcApiKey(team.signingKey)

    const gkeConfig = env.config as { projectId: string; clusterName: string; clusterZone: string; clientId: string; clientSecret: string }
    const kc = await buildKubeConfig({ slug: envSlug, projectId: gkeConfig.projectId, clusterName: gkeConfig.clusterName, clusterZone: gkeConfig.clusterZone, clientId: gkeConfig.clientId, clientSecret: gkeConfig.clientSecret })
    const agents = team.agents.map(a => ({ slug: a.slug, isLead: a.slug === team.leadAgent }))

    try {
      await withMcPortForward(kc, teamSlug, (mcUrl) =>
        registerAgentsWithMissionControl({ mcUrl, apiKey, namespace: teamSlug, agents })
      )
      return { ok: true }
    } catch (e) {
      return { ok: false, reason: e instanceof Error ? e.message : String(e) }
    }
  })
}
