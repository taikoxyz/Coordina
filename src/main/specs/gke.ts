// GKE deployment spec deriver generating K8s manifests from team spec files
// FEATURE: GKE derivation layer with K8s Secrets for API key security
import { randomBytes, createHmac } from 'crypto'
import yaml from 'js-yaml'
import {
  generateNamespace,
  generateTeamConfigMap,
  generateAgentPv,
  generateAgentPvc,
  generateAgentConfigMap,
  generateAgentStatefulSet,
  generateAgentService,
  generateIngress,
} from '../environments/gke/manifests'
import {
  generateTeamMd,
  generateIdentityMd,
  generateSoulMd,
  generateSkillsMd,
  generateOpenClawJson,
} from '../github/spec'

import { DEFAULT_BOOTSTRAP_INSTRUCTIONS } from './bootstrap'
import { registerDeriver } from './base'
import type { DeploymentSpecDeriver } from './base'
import type { TeamSpec, ProviderRecord, SpecFile } from '../../shared/types'
import { getProvider } from '../providers/base'
import { saveTeam } from '../store/teams'

function deriveAgentToken(seed: string, agentSlug: string): string {
  return createHmac('sha256', seed).update(agentSlug).digest('hex').slice(0, 48)
}


function generateProviderSecret(input: {
  teamSlug: string
  agentSlug: string
  providerSlug: string
  namespace: string
  envVars: Record<string, string>
}): string {
  const { teamSlug, agentSlug, providerSlug, namespace, envVars } = input
  const manifest = {
    apiVersion: 'v1',
    kind: 'Secret',
    type: 'Opaque',
    metadata: {
      name: `${teamSlug}-${agentSlug}-credentials`,
      namespace,
      labels: { 'coordina.team': teamSlug, 'coordina.agent': agentSlug, 'coordina.provider': providerSlug },
    },
    stringData: envVars,
  }
  return yaml.dump(manifest)
}

const gkeDeriver: DeploymentSpecDeriver = {
  envType: 'gke',

  async derive(
    spec: TeamSpec,
    providers: Map<string, ProviderRecord & { apiKey?: string }>,
    envConfig: Record<string, unknown>
  ): Promise<SpecFile[]> {
    const { projectId, clusterZone, diskZone } = envConfig as { projectId: string; clusterZone: string; diskZone?: string }
    const namespace = spec.slug
    const domain = spec.domain || 'example.com'
    const files: SpecFile[] = []

    if (!spec.tokenSeed) {
      spec = { ...spec, tokenSeed: randomBytes(32).toString('hex') }
      await saveTeam(spec)
    }
    const seed = spec.tokenSeed!
    const peers = spec.agents.map(a => ({
      slug: a.slug,
      url: `ws://agent-${a.slug}.${namespace}.svc.cluster.local:18789`,
      token: deriveAgentToken(seed, a.slug),
    }))

    files.push({ path: 'namespace.yaml', content: generateNamespace(namespace) })

    files.push({
      path: 'configmap-shared.yaml',
      content: generateTeamConfigMap({
        teamSlug: spec.slug,
        namespace,
        teamMd: generateTeamMd({ ...spec, peers }),
        bootstrapMd: spec.bootstrapInstructions || DEFAULT_BOOTSTRAP_INSTRUCTIONS,
      }),
    })

    for (const agent of spec.agents) {
      const providerRecord = providers.get(agent.providerSlug)
      let modelProvider
      try { modelProvider = providerRecord ? getProvider(providerRecord.type) : undefined } catch { /* unknown type */ }
      const model = providerRecord?.model ?? 'claude-sonnet-4-6'
      const openclawConfig = modelProvider && providerRecord
        ? modelProvider.toOpenClawJson({ apiKey: providerRecord.apiKey, model })
        : { agents: { defaults: { model: { primary: `anthropic/${model}` } } }, models: { providers: { anthropic: {} } } }
      const envVars = modelProvider && providerRecord
        ? modelProvider.toEnvVars({ apiKey: providerRecord.apiKey, model })
        : {}

      const agentToken = deriveAgentToken(seed, agent.slug)
      const agentPeers = peers
        .filter(p => p.slug !== agent.slug)
        .reduce<Record<string, { url: string; token: string }>>((acc, p) => {
          acc[p.slug] = { url: `http://agent-${p.slug}.${namespace}.svc.cluster.local:18789`, token: p.token }
          return acc
        }, {})
      const openclawConfigWithGateway = { ...openclawConfig, gateway: { auth: { token: agentToken } }, peers: agentPeers }
      const credentialSecretName = `${spec.slug}-${agent.slug}-credentials`
      files.push({ path: `agents/${agent.slug}/pv.yaml`, content: generateAgentPv({ teamSlug: spec.slug, agentSlug: agent.slug, projectId, zone: diskZone ?? clusterZone, storageGi: agent.storageGi }) })
      files.push({ path: `agents/${agent.slug}/pvc.yaml`, content: generateAgentPvc({ teamSlug: spec.slug, agentSlug: agent.slug, namespace, storageGi: agent.storageGi }) })
      files.push({ path: `agents/${agent.slug}/credentials.yaml`, content: generateProviderSecret({ teamSlug: spec.slug, providerSlug: agent.providerSlug, agentSlug: agent.slug, namespace, envVars }) })
      files.push({
        path: `agents/${agent.slug}/configmap.yaml`,
        content: generateAgentConfigMap({
          teamSlug: spec.slug,
          agentSlug: agent.slug,
          namespace,
          identityMd: generateIdentityMd({ name: agent.name, slug: agent.slug, role: agent.role, email: agent.email, slackHandle: agent.slackHandle, githubId: agent.githubId, providerSlug: agent.providerSlug, model }),
          soulMd: generateSoulMd({ userInput: agent.soul }),
          skillsMd: generateSkillsMd(agent.skills),
          openclawJson: generateOpenClawJson(openclawConfigWithGateway),
        }),
      })
      files.push({ path: `agents/${agent.slug}/statefulset.yaml`, content: generateAgentStatefulSet({ teamSlug: spec.slug, agentSlug: agent.slug, image: agent.image || spec.image || undefined, namespace, credentialSecretName, cpu: agent.cpu }) })
      files.push({ path: `agents/${agent.slug}/service.yaml`, content: generateAgentService({ teamSlug: spec.slug, agentSlug: agent.slug, namespace }) })
    }

    files.push({ path: 'ingress.yaml', content: generateIngress({ teamSlug: spec.slug, agents: spec.agents.map(a => a.slug), domain, namespace }) })

    return files
  },
}

registerDeriver(gkeDeriver)
export default gkeDeriver
