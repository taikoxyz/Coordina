import { execFileSync } from 'child_process'
import {
  generateNamespace, generateAgentPv, generateAgentPvc,
  generateAgentStatefulSet, generateAgentService, generateIngress,
} from './manifests'
import { ensureDisk, toZone } from './gcloud'
import type { DeployResult, AgentStatus } from '../base'

export interface GkeDeployConfig {
  envId: string
  projectId: string
  clusterName: string
  clusterZone: string
}

function kubectl(args: string[], input?: string): string {
  return execFileSync('kubectl', args, {
    input,
    encoding: 'utf-8',
    stdio: input ? ['pipe', 'pipe', 'pipe'] : ['inherit', 'pipe', 'pipe'],
  })
}

function getCredentials(config: GkeDeployConfig) {
  execFileSync('gcloud', [
    'container', 'clusters', 'get-credentials', config.clusterName,
    '--zone', config.clusterZone,
    '--project', config.projectId,
  ], { encoding: 'utf-8', stdio: 'pipe' })
}

export async function deployTeam(
  teamSlug: string,
  agents: { slug: string; image?: string }[],
  config: GkeDeployConfig,
  domain: string = 'example.com'
): Promise<DeployResult> {
  const namespace = `team-${teamSlug}`

  getCredentials(config)

  // GKE Autopilot clusters have a regional location (e.g. "us-central1").
  // GCE disks and PV zone nodeAffinity require an actual zone — derive one if needed.
  const diskZone = toZone(config.clusterZone)

  // Namespace first so it exists before other resources
  kubectl(['apply', '-f', '-'], generateNamespace(namespace))

  for (const agent of agents) {
    const pvName = `team-${teamSlug}-${agent.slug}`
    ensureDisk(config.projectId, diskZone, pvName, 10)

    // PV and PVC specs are immutable after creation — only create if they don't exist yet
    try { kubectl(['get', 'pv', pvName, '--no-headers']) } catch {
      kubectl(['apply', '-f', '-'], generateAgentPv({ teamSlug, agentSlug: agent.slug, projectId: config.projectId, zone: diskZone }))
    }
    try { kubectl(['get', 'pvc', pvName, `--namespace=${namespace}`, '--no-headers']) } catch {
      kubectl(['apply', '-f', '-'], generateAgentPvc({ teamSlug, agentSlug: agent.slug, namespace }))
    }
  }

  // StatefulSets, Services, and Ingress are mutable — apply all at once
  const mutable: string[] = []
  for (const agent of agents) {
    mutable.push(generateAgentStatefulSet({ teamSlug, agentSlug: agent.slug, image: agent.image, namespace }))
    mutable.push(generateAgentService({ teamSlug, agentSlug: agent.slug, namespace }))
  }
  mutable.push(generateIngress({ teamSlug, agents: agents.map(a => a.slug), domain, namespace }))
  kubectl(['apply', '-f', '-'], mutable.join('\n---\n'))

  return {
    ok: true,
    gatewayUrl: `https://${teamSlug}.${domain}`,
  }
}

export async function undeployTeam(teamSlug: string, config: GkeDeployConfig): Promise<void> {
  const namespace = `team-${teamSlug}`
  getCredentials(config)
  // Soft undeploy: delete pods/services/ingress but NOT PVCs
  try {
    kubectl(['delete', 'statefulset', '-l', `coordina.team=${teamSlug}`, `--namespace=${namespace}`, '--ignore-not-found'])
    kubectl(['delete', 'service', '-l', `coordina.team=${teamSlug}`, `--namespace=${namespace}`, '--ignore-not-found'])
    kubectl(['delete', 'ingress', `${teamSlug}-ingress`, `--namespace=${namespace}`, '--ignore-not-found'])
    kubectl(['delete', 'backendconfig', `${teamSlug}-backend-config`, `--namespace=${namespace}`, '--ignore-not-found'])
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
  const namespace = `team-${teamSlug}`
  getCredentials(config)
  const statuses: AgentStatus[] = []

  for (const slug of agentSlugs) {
    try {
      const output = kubectl(['get', 'pod', `agent-${slug}-0`, `--namespace=${namespace}`, '-o', 'jsonpath={.status.phase}'])
      const phase = output.trim()
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
