// Pure spec generation pipeline for team GitHub files and K8s deploy manifests
// FEATURE: Spec generation layer — team.json, agent files, K8s YAMLs, dirty detection

import { createHash } from 'crypto'
import {
  generateAgentsMd,
  generateIdentityMd,
  generateSoulMd,
  generateSkillsMd,
  generateOpenClawJson,
} from '../github/spec'
import {
  generateNamespace,
  generateAgentPv,
  generateAgentPvc,
  generateAgentStatefulSet,
  generateAgentService,
  generateIngress,
  generateTeamConfigMap,
  generateAgentConfigMap,
} from '../environments/gke/manifests'
import { toZone } from '../environments/gke/gcloud'
import { getProvider } from '../providers/base'
import { getSecret } from '../keychain'
import type Database from 'better-sqlite3'
import type { GkeDeployConfig } from '../environments/gke/deploy'
import type { TeamRecord, AgentRecord, ProviderRecord, SpecFile } from '../../shared/types'

export function mapAgentRow(r: Record<string, unknown>): AgentRecord {
  return {
    slug: r.slug as string,
    teamSlug: r.team_slug as string,
    name: r.name as string,
    role: r.role as string,
    email: r.email as string | undefined,
    slackHandle: r.slack_handle as string | undefined,
    githubId: r.github_id as string | undefined,
    skills: JSON.parse((r.skills as string) || '[]') as string[],
    soul: (r.soul as string) || '',
    providerId: r.provider_id as string | undefined,
    model: r.model as string | undefined,
    image: r.image as string | undefined,
    isLead: !!(r.is_lead as number),
  }
}

export function mapTeamRow(r: Record<string, unknown>): TeamRecord {
  return {
    slug: r.slug as string,
    name: r.name as string,
    githubRepo: r.github_repo as string | undefined,
    leadAgentSlug: r.lead_agent_slug as string | undefined,
    config: JSON.parse((r.config as string) || '{}') as Record<string, unknown>,
    domain: r.domain as string | undefined,
    image: r.image as string | undefined,
    deployedSpecHash: r.deployed_spec_hash as string | undefined,
  }
}

export async function buildProvidersMap(db: Database.Database): Promise<Map<string, ProviderRecord>> {
  const providerRows = db.prepare('SELECT id, type, name, config FROM providers').all() as Record<string, unknown>[]
  const map = new Map<string, ProviderRecord>()
  for (const row of providerRows) {
    const id = row.id as string
    const apiKey = await getSecret(id, 'provider-api-key')
    const config = JSON.parse((row.config as string) || '{}') as Record<string, unknown>
    map.set(id, {
      id,
      type: row.type as string,
      name: row.name as string,
      config: apiKey ? { ...config, apiKey } : config,
    })
  }
  return map
}

export type { TeamRecord, AgentRecord, ProviderRecord, SpecFile }

export function generateTeamSpecs(
  team: TeamRecord,
  agents: AgentRecord[],
  providers: Map<string, ProviderRecord>
): SpecFile[] {
  const files: SpecFile[] = []

  files.push({
    path: 'team.json',
    content: JSON.stringify({
      name: team.name,
      slug: team.slug,
      domain: team.domain,
      image: team.image,
      leadAgentSlug: team.leadAgentSlug,
    }, null, 2),
  })

  files.push({
    path: 'AGENTS.md',
    content: generateAgentsMd(agents.map(a => ({ slug: a.slug, name: a.name, role: a.role, isLead: a.isLead }))),
  })

  for (const agent of agents) {
    let modelConfig: Record<string, unknown> = { provider: 'anthropic', model: agent.model || 'claude-sonnet-4-6' }

    if (agent.providerId) {
      const provider = providers.get(agent.providerId)
      if (provider) {
        const registeredProvider = (() => { try { return getProvider(provider.type) } catch { return undefined } })()
        const fallbackModel = registeredProvider?.defaultModel ?? 'claude-sonnet-4-6'
        modelConfig = {
          ...provider.config,
          provider: provider.type,
          model: agent.model || (provider.config.model as string | undefined) || fallbackModel,
        }
      }
    }

    files.push({
      path: `agents/${agent.slug}/agent.json`,
      content: JSON.stringify({
        name: agent.name,
        role: agent.role,
        email: agent.email,
        slackHandle: agent.slackHandle,
        githubId: agent.githubId,
        skills: agent.skills,
        soul: agent.soul,
        modelConfig,
      }, null, 2),
    })

    files.push({
      path: `agents/${agent.slug}/IDENTITY.md`,
      content: generateIdentityMd({
        name: agent.name,
        slug: agent.slug,
        role: agent.role,
        email: agent.email,
        slackHandle: agent.slackHandle,
        githubId: agent.githubId,
      }),
    })

    files.push({
      path: `agents/${agent.slug}/SOUL.md`,
      content: generateSoulMd({ userInput: agent.soul }),
    })

    files.push({
      path: `agents/${agent.slug}/SKILLS.md`,
      content: generateSkillsMd(agent.skills),
    })

    files.push({
      path: `agents/${agent.slug}/openclaw.json`,
      content: generateOpenClawJson(modelConfig as Parameters<typeof generateOpenClawJson>[0]),
    })
  }

  return files
}

export function generateDeploySpecs(
  team: TeamRecord,
  agents: AgentRecord[],
  envConfig: GkeDeployConfig,
  providers: Map<string, ProviderRecord>
): SpecFile[] {
  const files: SpecFile[] = []
  const namespace = `team-${team.slug}`
  const zone = toZone(envConfig.clusterZone)
  const domain = team.domain || 'example.com'

  files.push({ path: 'namespace.yaml', content: generateNamespace(namespace) })

  const teamSpecs = generateTeamSpecs(team, agents, providers)
  const getContent = (p: string) => teamSpecs.find(f => f.path === p)?.content ?? ''

  files.push({
    path: 'configmap-shared.yaml',
    content: generateTeamConfigMap({
      teamSlug: team.slug,
      namespace,
      teamJson: getContent('team.json'),
      agentsMd: getContent('AGENTS.md'),
    }),
  })

  for (const agent of agents) {
    files.push({
      path: `agents/${agent.slug}/configmap.yaml`,
      content: generateAgentConfigMap({
        teamSlug: team.slug,
        agentSlug: agent.slug,
        namespace,
        agentJson: getContent(`agents/${agent.slug}/agent.json`),
        identityMd: getContent(`agents/${agent.slug}/IDENTITY.md`),
        soulMd: getContent(`agents/${agent.slug}/SOUL.md`),
        skillsMd: getContent(`agents/${agent.slug}/SKILLS.md`),
        openclawJson: getContent(`agents/${agent.slug}/openclaw.json`),
      }),
    })
  }

  for (const agent of agents) {
    const image = agent.image || team.image

    if (image) {
      files.push({
        path: `agents/${agent.slug}/pv.yaml`,
        content: generateAgentPv({ teamSlug: team.slug, agentSlug: agent.slug, projectId: envConfig.projectId, zone }),
      })
    }

    files.push({
      path: `agents/${agent.slug}/pvc.yaml`,
      content: generateAgentPvc({ teamSlug: team.slug, agentSlug: agent.slug, namespace }),
    })

    files.push({
      path: `agents/${agent.slug}/statefulset.yaml`,
      content: generateAgentStatefulSet({ teamSlug: team.slug, agentSlug: agent.slug, image: image || undefined, namespace }),
    })

    files.push({
      path: `agents/${agent.slug}/service.yaml`,
      content: generateAgentService({ teamSlug: team.slug, agentSlug: agent.slug, namespace }),
    })
  }

  files.push({
    path: 'ingress.yaml',
    content: generateIngress({ teamSlug: team.slug, agents: agents.map(a => a.slug), domain, namespace }),
  })

  return files
}

export function hashSpecs(specs: SpecFile[]): string {
  const sorted = [...specs].sort((a, b) => a.path.localeCompare(b.path))
  return createHash('sha256')
    .update(sorted.map(f => `${f.path}:${f.content}`).join('\n'))
    .digest('hex')
}
