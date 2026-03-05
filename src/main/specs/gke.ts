// GKE deployment spec deriver generating K8s manifests from team spec files
// FEATURE: GKE derivation layer with K8s Secrets for API key security
import { randomBytes, createHmac, createHash } from 'crypto'
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
  generateMemoryMd,
  generateSoulMd,
  generateSkillsMd,
  generateOpenClawJson,
} from '../github/spec'

import { DEFAULT_BOOTSTRAP_INSTRUCTIONS } from './bootstrap'
import { registerDeriver } from './base'
import type { DeploymentSpecDeriver } from './base'
import type { DeriveSecrets } from './base'
import type { TeamSpec, ProviderRecord, SpecFile } from '../../shared/types'
import { getProvider } from '../providers/base'
import { saveTeam } from '../store/teams'
import { resolveGatewayMode } from '../gateway/mode'

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
    envConfig: Record<string, unknown>,
    secrets?: DeriveSecrets
  ): Promise<SpecFile[]> {
    const {
      projectId,
      clusterZone,
      diskZone,
      domain: envDomain,
    } = envConfig as { projectId: string; clusterZone: string; diskZone?: string; domain?: string; gatewayMode?: 'port-forward' | 'ingress' }
    const namespace = spec.slug
    const mode = resolveGatewayMode(envConfig)
    const ingressDomain = mode === 'ingress' ? envDomain : undefined
    const telegramGroupChatId = spec.telegramGroupChatId?.trim()
    const telegramOwnerUserId = spec.telegramOwnerUserId?.trim()
    const workspaceDir = '/agent-data/openclaw/workspace'
    const files: SpecFile[] = []

    if (!spec.tokenSeed) {
      spec = { ...spec, tokenSeed: randomBytes(32).toString('hex') }
      await saveTeam(spec)
    }
    const seed = spec.tokenSeed!
    const teamGatewayToken = deriveAgentToken(seed, spec.slug)

    files.push({ path: 'namespace.yaml', content: generateNamespace(namespace) })

    const teamConfig = generateTeamConfigMap({
      teamSlug: spec.slug,
      namespace,
      teamMd: generateTeamMd({
        ...spec,
        telegramGroupChatId,
        telegramOwnerUserId,
        agents: spec.agents.map(a => ({
          ...a,
          gatewayUrl: `http://agent-${a.slug}.${namespace}.svc.cluster.local:18789`,
          gatewayToken: teamGatewayToken,
        })),
      }),
      bootstrapMd: spec.bootstrapInstructions || DEFAULT_BOOTSTRAP_INSTRUCTIONS,
    })
    const teamConfigHash = createHash('sha256').update(teamConfig).digest('hex')

    files.push({
      path: 'configmap-shared.yaml',
      content: teamConfig,
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

      const agentToken = teamGatewayToken
      const telegramBotId = agent.telegramBotId?.trim()
      const telegramBotToken = secrets?.agentTelegramTokens?.[agent.slug]
      const hasTelegramRouting = Boolean(telegramGroupChatId && telegramOwnerUserId && telegramBotId)
      const baseChannels = (typeof (openclawConfig as { channels?: unknown }).channels === 'object' && (openclawConfig as { channels?: unknown }).channels !== null)
        ? (openclawConfig as { channels?: Record<string, unknown> }).channels
        : undefined
      const telegramChannelsConfig = hasTelegramRouting
        ? {
            telegram: {
              enabled: Boolean(telegramBotToken),
              dmPolicy: 'allowlist',
              allowFrom: [telegramOwnerUserId!],
              groupPolicy: 'allowlist',
              groupAllowFrom: [telegramOwnerUserId!],
              groups: {
                [telegramGroupChatId!]: { requireMention: true },
              },
              streaming: 'partial',
            },
          }
        : undefined
      const baseGateway = (openclawConfig as { gateway?: Record<string, unknown> }).gateway ?? {}
      const baseHttp = (baseGateway.http as { endpoints?: Record<string, unknown> } | undefined) ?? {}
      const baseEndpoints = baseHttp.endpoints ?? {}
      const baseResponses = (baseEndpoints.responses as Record<string, unknown> | undefined) ?? {}
      const baseAgents = (openclawConfig as { agents?: Record<string, unknown> }).agents ?? {}
      const baseAgentDefaults = (
        openclawConfig as { agents?: { defaults?: Record<string, unknown> } }
      ).agents?.defaults ?? {}
      const baseTools = (openclawConfig as { tools?: Record<string, unknown> }).tools ?? {}
      const openclawConfigWithGateway = {
        ...openclawConfig,
        agents: {
          ...baseAgents,
          defaults: {
            ...baseAgentDefaults,
            workspace: workspaceDir,
          },
        },
        ...((baseChannels || telegramChannelsConfig)
          ? { channels: { ...(baseChannels ?? {}), ...(telegramChannelsConfig ?? {}) } }
          : {}),
        tools: {
          ...baseTools,
          profile: (baseTools.profile as string | undefined) ?? 'full',
        },
        gateway: {
          ...baseGateway,
          auth: {
            ...((baseGateway.auth as Record<string, unknown> | undefined) ?? {}),
            token: agentToken,
          },
          http: {
            ...baseHttp,
            endpoints: {
              ...baseEndpoints,
              responses: {
                ...baseResponses,
                enabled: true,
              },
            },
          },
        },
      }
      const envVarsWithTelegram = {
        ...envVars,
        ...(hasTelegramRouting && telegramBotToken
          ? { TELEGRAM_BOT_TOKEN: telegramBotToken }
          : {}),
      }
      const credentialSecretName = `${spec.slug}-${agent.slug}-credentials`
      files.push({ path: `agents/${agent.slug}/pv.yaml`, content: generateAgentPv({ teamSlug: spec.slug, agentSlug: agent.slug, projectId, zone: diskZone ?? clusterZone, storageGi: agent.storageGi }) })
      files.push({ path: `agents/${agent.slug}/pvc.yaml`, content: generateAgentPvc({ teamSlug: spec.slug, agentSlug: agent.slug, namespace, storageGi: agent.storageGi }) })
      files.push({ path: `agents/${agent.slug}/credentials.yaml`, content: generateProviderSecret({ teamSlug: spec.slug, providerSlug: agent.providerSlug, agentSlug: agent.slug, namespace, envVars: envVarsWithTelegram }) })
      const identityMd = generateIdentityMd({
        name: agent.name,
        role: agent.role,
        soul: agent.soul,
        emoji: agent.emoji,
        avatar: agent.avatar,
        teamName: spec.name,
        teamSlug: spec.slug,
        leadAgentSlug: spec.leadAgentSlug,
        teamSize: spec.agents.length,
      })
      const agentConfigMap = generateAgentConfigMap({
        teamSlug: spec.slug,
        agentSlug: agent.slug,
        namespace,
        identityMd,
        memoryMd: generateMemoryMd(),
        soulMd: generateSoulMd({ userInput: agent.soul }),
        skillsMd: generateSkillsMd(agent.skills),
        openclawJson: generateOpenClawJson(openclawConfigWithGateway),
      })
      const agentConfigHash = createHash('sha256').update(agentConfigMap).digest('hex')

      files.push({ path: `agents/${agent.slug}/configmap.yaml`, content: agentConfigMap })
      files.push({ path: `agents/${agent.slug}/statefulset.yaml`, content: generateAgentStatefulSet({
        teamSlug: spec.slug,
        agentSlug: agent.slug,
        image: agent.image || spec.image || undefined,
        namespace,
        credentialSecretName,
        cpu: agent.cpu,
        podAnnotations: {
          'coordina/shared-config-hash': teamConfigHash,
          'coordina/agent-config-hash': agentConfigHash,
        },
      }) })
      files.push({ path: `agents/${agent.slug}/service.yaml`, content: generateAgentService({ teamSlug: spec.slug, agentSlug: agent.slug, namespace }) })
    }

    if (ingressDomain) {
      files.push({ path: 'ingress.yaml', content: generateIngress({ teamSlug: spec.slug, agents: spec.agents.map(a => a.slug), domain: ingressDomain, namespace }) })
    }

    return files
  },
}

registerDeriver(gkeDeriver)
export default gkeDeriver
