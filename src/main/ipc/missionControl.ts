// IPC handlers and utilities for Mission Control agent registration
// FEATURE: Mission Control integration layer for post-deploy agent registration

import { ipcMain } from 'electron'
import { getEnvironment } from '../store/environments'
import { getTeam } from '../store/teams'
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
      await fetch(`${mcUrl}/api/gateways`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          name: agent.slug,
          host: `agent-${agent.slug}.${namespace}.svc.cluster.local`,
          port: 18789,
        }),
      })
    }
  }

  for (const agent of agents) {
    await fetch(`${mcUrl}/api/agents`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ name: agent.slug, status: 'active' }),
    })
  }
}

export function registerMissionControlHandlers(): void {
  ipcMain.handle('mc:registerAgents', async (_e, { teamSlug, envSlug }: { teamSlug: string; envSlug: string }) => {
    const [team, env] = await Promise.all([getTeam(teamSlug), getEnvironment(envSlug)])
    if (!team) return { ok: false, reason: 'Team not found' }
    if (!env) return { ok: false, reason: 'Environment not found' }

    const mc = (env.config as { missionControl?: MissionControlConfig }).missionControl
    if (!mc?.enabled) return { ok: false, reason: 'Mission Control not configured' }

    const mcUrl = `https://${mc.domain}`
    const agents = team.agents.map(a => ({ slug: a.slug, isLead: a.slug === team.leadAgent }))

    try {
      await registerAgentsWithMissionControl({ mcUrl, apiKey: mc.apiKey, namespace: teamSlug, agents })
      return { ok: true, mcUrl }
    } catch (e) {
      return { ok: false, reason: e instanceof Error ? e.message : String(e) }
    }
  })
}
