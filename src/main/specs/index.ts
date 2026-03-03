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
} from '../environments/gke/manifests'
import { toZone } from '../environments/gke/gcloud'
import type { GkeDeployConfig } from '../environments/gke/deploy'
import type { TeamRecord } from '../ipc/teams'
import type { ProviderRecord } from '../ipc/providers'

export interface SpecFile {
  path: string
  content: string
}

export interface AgentRecord {
  slug: string
  teamSlug: string
  name: string
  role: string
  email?: string
  slackHandle?: string
  githubId?: string
  skills: string[]
  soul: string
  providerId?: string
  model?: string
  image?: string
  isLead: boolean
}

type FullTeamRecord = TeamRecord & { domain?: string; image?: string }

export function generateTeamSpecs(
  team: FullTeamRecord,
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
        modelConfig = {
          ...provider.config,
          provider: provider.type,
          model: agent.model || (provider.config.model as string | undefined) || 'claude-sonnet-4-6',
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
  team: FullTeamRecord,
  agents: AgentRecord[],
  envConfig: GkeDeployConfig
): SpecFile[] {
  const files: SpecFile[] = []
  const namespace = `team-${team.slug}`
  const zone = toZone(envConfig.clusterZone)
  const domain = team.domain || 'example.com'

  files.push({ path: 'namespace.yaml', content: generateNamespace(namespace) })

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
