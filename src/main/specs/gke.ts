// GKE deployment spec deriver generating K8s manifests from team spec files
// FEATURE: GKE derivation layer with K8s Secrets for API key security
import { randomBytes, createHmac, createHash } from 'crypto'
import yaml from 'js-yaml'
import {
  generateNamespace,
  generateTeamConfigMap,
  generateStorageClass,
  generateAgentPvc,
  generateAgentConfigMap,
  generateAgentStatefulSet,
  generateAgentService,
  generateIngress,
  generateMissionControlSecret,
  generateMissionControlPvc,
  generateMissionControlDeployment,
  generateMissionControlService,
  generateMcImagePullSecret,
  generateNetworkPolicy,
} from '../environments/gke/manifests'
import type { MissionControlConfig } from '../../shared/types'
import { DEFAULT_CPU, DEFAULT_MEMORY_GI, DEFAULT_DISK_GI } from '../../shared/podDefaults'
import {
  generateTeamMd,
  generateIdentityMd,
  generateSoulMd,
  generateUserMd,
  generateOpenClawJson,
  generateProjectsMd,
  generateEnvMd,
} from '../github/spec'

import { deriveAgentEmail } from '../../shared/email'
import { DEFAULT_BOOTSTRAP_INSTRUCTIONS } from './bootstrap'
import { registerDeriver } from './base'
import type { DeploymentSpecDeriver } from './base'
import type { DeriveSecrets } from './base'
import type { TeamSpec, SpecFile } from '../../shared/types'
import { openrouterToOpenClawJson, openrouterToEnvVars, testOpenRouterConnection } from '../providers/base'
import { getOpenRouterApiKey } from '../store/providers'
import { getSecret } from '../keychain'
import { saveTeam } from '../store/teams'
import { resolveGatewayMode } from '../gateway/mode'
import { listProjects } from '../store/projects'

function deriveAgentToken(seed: string, agentSlug: string): string {
  return createHmac('sha256', seed).update(agentSlug).digest('hex').slice(0, 48)
}

export function deriveMcAdminPassword(signingKey: string): string {
  return createHmac('sha256', signingKey).update('mc-admin').digest('hex').slice(0, 24)
}

function deriveMcSessionSecret(signingKey: string): string {
  return createHmac('sha256', signingKey).update('mc-session').digest('hex').slice(0, 32)
}

export function deriveMcApiKey(signingKey: string): string {
  return createHmac('sha256', signingKey).update('mc-api-key').digest('hex').slice(0, 32)
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
    envConfig: Record<string, unknown>,
    secrets?: DeriveSecrets
  ): Promise<SpecFile[]> {
    const { domain: envDomain, logLevel, projectId, clusterZone } = envConfig as { domain?: string; logLevel?: string; projectId?: string; clusterZone?: string }
    const namespace = spec.slug
    const mode = resolveGatewayMode(envConfig)
    const ingressDomain = mode === 'ingress' ? envDomain : undefined
    const telegramGroupId = spec.telegramGroupId?.trim()
    const telegramAdminId = spec.telegramAdminId?.trim()
    const workspaceDir = '/agent-data/openclaw/workspace'
    const files: SpecFile[] = []

    if (!spec.signingKey) {
      spec = { ...spec, signingKey: randomBytes(32).toString('hex') }
      await saveTeam(spec)
    }
    const seed = spec.signingKey!
    const teamGatewayToken = deriveAgentToken(seed, spec.slug)

    files.push({ path: 'namespace.yaml', content: generateNamespace(namespace) })
    files.push({ path: 'storageclass.yaml', content: generateStorageClass({ teamSlug: spec.slug }) })
    files.push({ path: 'networkpolicy.yaml', content: generateNetworkPolicy({ teamSlug: spec.slug, namespace }) })

    const hasGateways = true
    const hasEmail = Boolean(spec.teamEmail && secrets?.teamEmailPassword)
    const teamMd = generateTeamMd({
      ...spec,
      telegramGroupId,
      telegramAdminId,
      gatewayToken: teamGatewayToken,
      agents: spec.agents.map(a => {
        const aIsLead = a.slug === spec.leadAgent
        const aDerived = hasEmail ? deriveAgentEmail(spec.teamEmail!, a.slug, aIsLead) : undefined
        return {
          ...a,
          email: a.email || aDerived,
          isLead: aIsLead,
          gatewayUrl: `http://agent-${a.slug}.${namespace}.svc.cluster.local:18789`,
        }
      }),
    })
    const bootstrapMd = spec.startupInstructions || DEFAULT_BOOTSTRAP_INSTRUCTIONS
    const bootstrapHash = createHash('sha256').update(bootstrapMd).digest('hex').slice(0, 12)
    const projects = await listProjects(spec.slug)
    const projectsMd = generateProjectsMd(projects)
    const teamConfig = generateTeamConfigMap({ teamSlug: spec.slug, namespace, teamMd, bootstrapMd, projectsMd })
    const teamConfigHash = createHash('sha256').update(teamConfig).digest('hex')

    files.push({ path: 'TEAM.md', content: teamMd })
    files.push({ path: 'BOOTSTRAP.md', content: bootstrapMd })
    files.push({ path: 'PROJECTS.md', content: projectsMd })
    files.push({ path: 'configmap-shared.yaml', content: teamConfig })

    const perTeamKey = await getSecret(`team:${spec.slug}`, 'team-openrouter-key')
    const openrouterApiKey = perTeamKey || await getOpenRouterApiKey()
    if (!openrouterApiKey) {
      throw new Error('OpenRouter API key is not configured. Go to Settings → OpenRouter to connect your account.')
    }
    const keyCheck = await testOpenRouterConnection(openrouterApiKey)
    if (!keyCheck.valid) {
      throw new Error(`OpenRouter API key is invalid or expired: ${keyCheck.error ?? 'unknown error'}. Go to Settings → OpenRouter to reconnect.`)
    }

    const githubToken = await getSecret(`team:${spec.slug}`, 'team-github-token')
    const hasGitHub = Boolean(githubToken)
    let githubUsername: string | undefined
    if (githubToken) {
      try {
        const res = await fetch('https://api.github.com/user', {
          headers: { Authorization: `Bearer ${githubToken}`, Accept: 'application/vnd.github+json' },
        })
        if (res.ok) {
          const user = await res.json() as { login: string }
          githubUsername = user.login
        }
      } catch { /* GitHub username is optional — continue without it */ }
    }

    for (const agent of spec.agents) {
      const isLead = agent.slug === spec.leadAgent
      const derivedEmail = hasEmail ? deriveAgentEmail(spec.teamEmail!, agent.slug, isLead) : undefined
      const effectiveEmail = agent.email || derivedEmail
      const models = agent.models.length > 0 ? agent.models : ['anthropic/claude-sonnet-4-6']
      const openclawConfig = openrouterToOpenClawJson(models)
      const effectiveApiKey = secrets?.agentOpenRouterKeys?.[agent.slug] || openrouterApiKey
      const envVars = openrouterToEnvVars(effectiveApiKey)

      const agentToken = teamGatewayToken
      const telegramBot = agent.telegramBot?.trim()
      const telegramBotToken = secrets?.agentTelegramTokens?.[agent.slug]
      const hasTelegramRouting = Boolean(telegramGroupId && telegramAdminId && telegramBot)
      const baseChannels = (typeof (openclawConfig as { channels?: unknown }).channels === 'object' && (openclawConfig as { channels?: unknown }).channels !== null)
        ? (openclawConfig as { channels?: Record<string, unknown> }).channels
        : undefined
      const telegramChannelsConfig = hasTelegramRouting
        ? {
            telegram: {
              enabled: Boolean(telegramBotToken),
              dmPolicy: 'allowlist',
              allowFrom: [telegramAdminId!],
              groupPolicy: 'allowlist',
              groupAllowFrom: [telegramAdminId!],
              groups: {
                [telegramGroupId!]: { requireMention: true },
              },
              streaming: 'partial',
            },
          }
        : undefined
      const telegramMessagesConfig = hasTelegramRouting
        ? { groupChat: { mentionPatterns: ['@all', '@agents', '@team', `@${telegramBot}`] } }
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
        logging: { level: spec.logLevel ?? logLevel ?? 'info', consoleLevel: spec.logLevel ?? logLevel ?? 'info' },
        agents: {
          ...baseAgents,
          defaults: {
            ...baseAgentDefaults,
            model: openclawConfig.agents.defaults.model,
            workspace: workspaceDir,
          },
        },
        ...((baseChannels || telegramChannelsConfig)
          ? { channels: { ...(baseChannels ?? {}), ...(telegramChannelsConfig ?? {}) } }
          : {}),
        ...(telegramMessagesConfig ? { messages: telegramMessagesConfig } : {}),
        tools: {
          ...baseTools,
          profile: (baseTools.profile as string | undefined) ?? 'full',
        },
        gateway: {
          ...baseGateway,
          bind: (baseGateway.bind as string | undefined) ?? 'lan',
          mode: 'local',
          auth: {
            ...((baseGateway.auth as Record<string, unknown> | undefined) ?? {}),
            mode: ((((baseGateway.auth as Record<string, unknown> | undefined) ?? {}).mode) as string | undefined) ?? 'token',
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
          controlUi: { enabled: false },
        },
      }
      const envVarsWithTelegram = {
        ...envVars,
        ...(hasTelegramRouting && telegramBotToken
          ? { TELEGRAM_BOT_TOKEN: telegramBotToken }
          : {}),
        ...(hasEmail && effectiveEmail && secrets?.teamEmailPassword ? {
          EMAIL_ADDRESS: effectiveEmail,
          EMAIL_PASSWORD: secrets.teamEmailPassword,
        } : {}),
        ...(githubToken ? { GITHUB_TOKEN: githubToken } : {}),
      }
      const credentialSecretName = `${spec.slug}-${agent.slug}-credentials`
      const credentialsHash = createHash('sha256').update(JSON.stringify(envVarsWithTelegram)).digest('hex')
      files.push({ path: `agents/${agent.slug}/pvc.yaml`, content: generateAgentPvc({ teamSlug: spec.slug, agentSlug: agent.slug, namespace, diskGi: agent.diskGi }) })
      files.push({ path: `agents/${agent.slug}/credentials.yaml`, content: generateProviderSecret({ teamSlug: spec.slug, providerSlug: 'openrouter', agentSlug: agent.slug, namespace, envVars: envVarsWithTelegram }) })
      const identityMd = generateIdentityMd({
        slug: agent.slug,
        name: agent.name,
        role: agent.role,
        persona: agent.persona,
        avatar: agent.avatar,
        email: hasEmail ? effectiveEmail : undefined,
        teamName: spec.name,
        leadAgent: spec.leadAgent,
      })
      const soulMd = generateSoulMd({ userInput: agent.persona, tone: agent.tone, boundaries: agent.boundaries, values: agent.values })
      const userMd = generateUserMd({
        teamName: spec.name,
        adminName: spec.adminName,
        adminEmail: spec.adminEmail,
        telegramAdminId,
      })
      const effectiveImage = agent.image || spec.defaultImage || 'alpine/openclaw:latest'
      const envMd = generateEnvMd({
        agentSlug: agent.slug,
        teamSlug: spec.slug,
        clusterName: spec.slug,
        clusterZone: clusterZone || 'unknown',
        projectId: projectId || 'unknown',
        image: effectiveImage,
        diskGi: agent.diskGi ?? DEFAULT_DISK_GI,
        cpu: agent.cpu ?? DEFAULT_CPU,
        memoryGi: agent.memoryGi ?? DEFAULT_MEMORY_GI,
        gatewayMode: mode,
        namespace,
      })
      const openclawJson = generateOpenClawJson(openclawConfigWithGateway)
      const agentConfigMap = generateAgentConfigMap({
        teamSlug: spec.slug,
        agentSlug: agent.slug,
        namespace,
        identityMd,
        soulMd,
        userMd,
        openclawJson,
        envMd,
      })
      const agentConfigHash = createHash('sha256').update(agentConfigMap).digest('hex')

      files.push({ path: `agents/${agent.slug}/IDENTITY.md`, content: identityMd })
      files.push({ path: `agents/${agent.slug}/SOUL.md`, content: soulMd })
      files.push({ path: `agents/${agent.slug}/USER.md`, content: userMd })
      files.push({ path: `agents/${agent.slug}/openclaw.json`, content: openclawJson })
      files.push({ path: `agents/${agent.slug}/ENV.md`, content: envMd })
      files.push({ path: `agents/${agent.slug}/configmap.yaml`, content: agentConfigMap })
      files.push({ path: `agents/${agent.slug}/statefulset.yaml`, content: generateAgentStatefulSet({
        teamSlug: spec.slug,
        agentSlug: agent.slug,
        image: agent.image || spec.defaultImage || undefined,
        namespace,
        credentialSecretName,
        cpu: agent.cpu,
        additionalPorts: agent.additionalPorts,
        memoryGi: agent.memoryGi,
        podAnnotations: {
          'coordina/shared-config-hash': teamConfigHash,
          'coordina/agent-config-hash': agentConfigHash,
          'coordina/credentials-hash': credentialsHash,
        },
        bootstrapHash,
      }) })
      files.push({ path: `agents/${agent.slug}/service.yaml`, content: generateAgentService({ teamSlug: spec.slug, agentSlug: agent.slug, namespace, additionalPorts: agent.additionalPorts }) })
    }

    if (ingressDomain) {
      files.push({ path: 'ingress.yaml', content: generateIngress({ teamSlug: spec.slug, agents: spec.agents.map(a => a.slug), domain: ingressDomain, namespace }) })
    }

    const mc = (envConfig as { missionControl?: MissionControlConfig }).missionControl
    const DEFAULT_MC_IMAGE = 'ghcr.io/builderz-labs/mission-control:latest'
    if (spec.missionControlEnabled !== false) {
      const mcImage = mc?.image || DEFAULT_MC_IMAGE
      const leadSlug = spec.leadAgent ?? spec.agents[0]?.slug ?? ''
      const mcPullSecretName = githubToken ? 'mission-control-pull-secret' : undefined
      if (githubToken) {
        files.push({ path: 'mission-control/pull-secret.yaml', content: generateMcImagePullSecret({ namespace, githubToken }) })
      }
      files.push({ path: 'mission-control/secret.yaml', content: generateMissionControlSecret({ namespace, adminPassword: deriveMcAdminPassword(seed), sessionSecret: deriveMcSessionSecret(seed), apiKey: deriveMcApiKey(seed), leadAgentSlug: leadSlug, gatewayToken: teamGatewayToken }) })
      files.push({ path: 'mission-control/pvc.yaml', content: generateMissionControlPvc({ namespace }) })
      files.push({ path: 'mission-control/deployment.yaml', content: generateMissionControlDeployment({ namespace, image: mcImage, imagePullSecret: mcPullSecretName }) })
      files.push({ path: 'mission-control/service.yaml', content: generateMissionControlService({ namespace }) })
    }

    return files
  },
}

registerDeriver(gkeDeriver)
export default gkeDeriver
