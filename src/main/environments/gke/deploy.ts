import { execSync } from 'child_process'
import {
  generateAgentStatefulSet, generateAgentService,
  generateIapBackendConfig, generateIngress,
} from './manifests'
import { getGkeCredentials, getGkeAccessToken } from './auth'
import type { DeployResult, AgentStatus } from '../base'

export interface GkeDeployConfig {
  envId: string
  projectId: string
  clusterName: string
  clusterZone: string
  domain?: string
  namespace?: string
}

function kubectl(args: string, input?: string): string {
  const cmd = `kubectl ${args}`
  return execSync(cmd, { input, encoding: 'utf-8', stdio: input ? ['pipe', 'pipe', 'pipe'] : ['inherit', 'pipe', 'pipe'] })
}

export async function deployTeam(
  teamSlug: string,
  agents: { slug: string; image?: string }[],
  config: GkeDeployConfig
): Promise<DeployResult> {
  const { namespace = 'default', domain = 'example.com' } = config

  // Generate all manifests
  const manifests: string[] = []

  for (const agent of agents) {
    manifests.push(generateAgentStatefulSet({ teamSlug, agentSlug: agent.slug, image: agent.image, namespace }))
    manifests.push(generateAgentService({ teamSlug, agentSlug: agent.slug, namespace }))
  }

  manifests.push(generateIapBackendConfig({ teamSlug, namespace }))
  manifests.push(generateIngress({ teamSlug, agents: agents.map(a => a.slug), domain, namespace }))

  const combined = manifests.join('\n---\n')

  kubectl(`apply --namespace=${namespace} -f -`, combined)

  return {
    ok: true,
    gatewayUrl: `https://${teamSlug}.${domain}`,
  }
}

export async function undeployTeam(teamSlug: string, config: GkeDeployConfig): Promise<void> {
  const { namespace = 'default' } = config
  // Soft undeploy: delete pods/services/ingress but NOT PVCs
  try {
    kubectl(`delete statefulset -l coordina.team=${teamSlug} --namespace=${namespace} --ignore-not-found`)
    kubectl(`delete service -l coordina.team=${teamSlug} --namespace=${namespace} --ignore-not-found`)
    kubectl(`delete ingress ${teamSlug}-ingress --namespace=${namespace} --ignore-not-found`)
    kubectl(`delete backendconfig ${teamSlug}-backend-config --namespace=${namespace} --ignore-not-found`)
  } catch {
    // Ignore errors for resources that don't exist
  }
  // PVCs are intentionally NOT deleted — data is preserved for redeployment
}

export async function getTeamStatus(
  teamSlug: string,
  agentSlugs: string[],
  config: GkeDeployConfig
): Promise<AgentStatus[]> {
  const { namespace = 'default' } = config
  const statuses: AgentStatus[] = []

  for (const slug of agentSlugs) {
    try {
      const output = kubectl(`get pod ${slug}-0 --namespace=${namespace} -o jsonpath='{.status.phase}'`)
      const phase = output.replace(/'/g, '').trim()
      const statusMap: Record<string, AgentStatus['status']> = {
        Running: 'running',
        Pending: 'pending',
        Failed: 'crashed',
        CrashLoopBackOff: 'crashed',
      }
      statuses.push({ agentSlug: slug, status: statusMap[phase] ?? 'unknown' })
    } catch {
      statuses.push({ agentSlug: slug, status: 'unknown' })
    }
  }

  return statuses
}
