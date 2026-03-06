// GKE deriver tests verifying openclaw.json gateway auth and telegram wiring
// FEATURE: GKE derivation layer with K8s Secrets for API key security
import { describe, it, expect, vi } from 'vitest'
import yaml from 'js-yaml'
import gkeDeriver from './gke'
import type { TeamSpec, ProviderRecord } from '../../shared/types'

vi.mock('../store/teams', () => ({ saveTeam: vi.fn().mockResolvedValue(undefined) }))
vi.mock('../providers/base', () => ({
  getProvider: vi.fn().mockReturnValue({
    toOpenClawJson: vi.fn().mockReturnValue({
      agents: { defaults: { model: { primary: 'anthropic/claude-sonnet-4-6' } } },
      models: { providers: { anthropic: {} } },
    }),
    toEnvVars: vi.fn().mockReturnValue({ ANTHROPIC_API_KEY: 'sk-test' }),
  }),
}))

const teamSpec: TeamSpec = {
  slug: 'my-team',
  name: 'My Team',
  signingKey: 'fixed-seed-for-testing-1234567890abcdef',
  agents: [
    { slug: 'alpha', name: 'Alpha', role: 'Lead', skills: [], persona: 'Alpha persona', provider: 'anthropic' },
    { slug: 'beta', name: 'Beta', role: 'Engineer', skills: [], persona: 'Beta persona', provider: 'anthropic' },
    { slug: 'gamma', name: 'Gamma', role: 'Designer', skills: [], persona: 'Gamma persona', provider: 'anthropic' },
  ],
}

const providers = new Map<string, ProviderRecord & { apiKey?: string }>([
  ['anthropic', { slug: 'anthropic', type: 'anthropic', name: 'Anthropic', model: 'claude-sonnet-4-6', apiKey: 'sk-test' }],
])

const envConfig = { projectId: 'my-project', clusterZone: 'us-central1-a' }

function getOpenClawConfig(files: { path: string; content: string }[], agentSlug: string) {
  const file = files.find(f => f.path === `agents/${agentSlug}/configmap.yaml`)!
  const configmap = yaml.load(file.content) as { data: Record<string, string> }
  return JSON.parse(configmap.data['openclaw.json'])
}

function getTeamMd(files: { path: string; content: string }[]): string {
  const file = files.find(f => f.path === 'configmap-shared.yaml')!
  const configmap = yaml.load(file.content) as { data: Record<string, string> }
  return configmap.data['TEAM.md']
}

function getStatefulSetTemplateAnnotations(files: { path: string; content: string }[], agentSlug: string): Record<string, string> {
  const file = files.find(f => f.path === `agents/${agentSlug}/statefulset.yaml`)!
  const manifest = yaml.load(file.content) as { spec: { template: { metadata: { annotations?: Record<string, string> } } } }
  return manifest.spec.template.metadata?.annotations ?? {}
}

describe('gkeDeriver gateway injection', () => {
  it('includes per-agent gateway auth token in openclaw.json', async () => {
    const files = await gkeDeriver.derive(teamSpec, providers, envConfig)
    const alphaConfig = getOpenClawConfig(files, 'alpha')
    const betaConfig = getOpenClawConfig(files, 'beta')

    expect(typeof alphaConfig.gateway?.auth?.token).toBe('string')
    expect(alphaConfig.gateway.auth.token.length).toBeGreaterThan(0)
    expect(alphaConfig.gateway.auth.token).toBe(betaConfig.gateway.auth.token)
  })

  it('does not include unsupported peers key in openclaw.json', async () => {
    const files = await gkeDeriver.derive(teamSpec, providers, envConfig)
    const alphaConfig = getOpenClawConfig(files, 'alpha')
    expect(alphaConfig.peers).toBeUndefined()
  })

  it('enables OpenClaw HTTP responses endpoint for chat UI', async () => {
    const files = await gkeDeriver.derive(teamSpec, providers, envConfig)
    const alphaConfig = getOpenClawConfig(files, 'alpha')
    expect(alphaConfig.gateway?.http?.endpoints?.responses?.enabled).toBe(true)
  })

  it('sets agents.defaults.workspace to PVC-backed workspace path', async () => {
    const files = await gkeDeriver.derive(teamSpec, providers, envConfig)
    const alphaConfig = getOpenClawConfig(files, 'alpha')
    expect(alphaConfig.agents?.defaults?.workspace).toBe('/agent-data/openclaw/workspace')
  })

  it('includes gateway URLs in each TEAM.md member entry', async () => {
    const files = await gkeDeriver.derive(teamSpec, providers, envConfig)
    const teamMd = getTeamMd(files)

    expect(teamMd).toContain('### alpha')
    expect(teamMd).toContain('- gateway: http://agent-alpha.my-team.svc.cluster.local:18789')
    expect(teamMd).toContain('- gateway_token:')
    expect(teamMd).toContain('### beta')
    expect(teamMd).toContain('- gateway: http://agent-beta.my-team.svc.cluster.local:18789')
    expect(teamMd).toContain('## Communication Protocol')
    expect(teamMd).toContain('exec')
    expect(teamMd).toContain('POST <gateway>/v1/responses')
  })

  it('sets tools.profile to full for unrestricted agent capabilities', async () => {
    const files = await gkeDeriver.derive(teamSpec, providers, envConfig)
    const alphaConfig = getOpenClawConfig(files, 'alpha')

    expect(alphaConfig.tools?.profile).toBe('full')
  })

  it('adds config hash annotations to trigger rollout when generated files change', async () => {
    const files = await gkeDeriver.derive(teamSpec, providers, envConfig)
    const annotations = getStatefulSetTemplateAnnotations(files, 'alpha')
    const sharedConfigHash = annotations['coordina/shared-config-hash']
    const agentConfigHash = annotations['coordina/agent-config-hash']

    expect(typeof sharedConfigHash).toBe('string')
    expect(sharedConfigHash).toHaveLength(64)
    expect(typeof agentConfigHash).toBe('string')
    expect(agentConfigHash).toHaveLength(64)
  })
})

describe('gkeDeriver telegram config', () => {
  it('does not include telegram top-level config', async () => {
    const withTelegram: TeamSpec = {
      ...teamSpec,
      telegramGroupId: '-1001234567890',
      telegramAdminId: '222222222',
      agents: teamSpec.agents.map((agent) => (
        agent.slug === 'alpha' ? { ...agent, telegramBot: '111111111' } : agent
      )),
    }

    const files = await gkeDeriver.derive(withTelegram, providers, envConfig)
    const alphaConfig = getOpenClawConfig(files, 'alpha')

    expect(alphaConfig.peers).toBeUndefined()
    expect(alphaConfig.telegram).toBeUndefined()
  })

  it('injects TELEGRAM_BOT_TOKEN into credentials secret when telegram is fully configured', async () => {
    const withTelegram: TeamSpec = {
      ...teamSpec,
      telegramGroupId: '-1001234567890',
      telegramAdminId: '222222222',
      agents: teamSpec.agents.map((agent) => (
        agent.slug === 'alpha' ? { ...agent, telegramBot: '111111111' } : agent
      )),
    }
    const files = await gkeDeriver.derive(withTelegram, providers, envConfig, {
      agentTelegramTokens: { 'alpha': '123:abc-token' },
    })
    const alphaCreds = files.find(f => f.path === 'agents/alpha/credentials.yaml')
    const betaCreds = files.find(f => f.path === 'agents/beta/credentials.yaml')
    const alphaConfig = getOpenClawConfig(files, 'alpha')
    expect(alphaCreds?.content).toContain('TELEGRAM_BOT_TOKEN')
    expect(alphaCreds?.content).toContain('123:abc-token')
    expect(betaCreds?.content).not.toContain('TELEGRAM_BOT_TOKEN')
    expect(alphaConfig.channels.telegram.dmPolicy).toBe('allowlist')
    expect(alphaConfig.channels.telegram.allowFrom).toEqual(['222222222'])
    expect(alphaConfig.channels.telegram.groupPolicy).toBe('allowlist')
    expect(alphaConfig.channels.telegram.groupAllowFrom).toEqual(['222222222'])
    expect(alphaConfig.channels.telegram.groups['-1001234567890']).toEqual({ requireMention: true })
    expect(alphaConfig.messages.groupChat.mentionPatterns).toEqual(['@all', '@agents', '@team', '@111111111'])
    expect(alphaConfig.channels.telegram.enabled).toBe(true)
  })
})
