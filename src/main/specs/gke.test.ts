// GKE deriver tests verifying generated openclaw.json and secret env wiring
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
  tokenSeed: 'fixed-seed-for-testing-1234567890abcdef',
  agents: [
    { slug: 'alpha', name: 'Alpha', role: 'Lead', skills: [], soul: 'Alpha soul', providerSlug: 'anthropic', isLead: true },
    { slug: 'beta', name: 'Beta', role: 'Engineer', skills: [], soul: 'Beta soul', providerSlug: 'anthropic', isLead: false },
    { slug: 'gamma', name: 'Gamma', role: 'Designer', skills: [], soul: 'Gamma soul', providerSlug: 'anthropic', isLead: false },
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

describe('gkeDeriver openclaw config', () => {
  it('includes gateway auth token', async () => {
    const files = await gkeDeriver.derive(teamSpec, providers, envConfig)
    const alphaConfig = getOpenClawConfig(files, 'alpha')

    expect(typeof alphaConfig.gateway.auth.token).toBe('string')
    expect(alphaConfig.gateway.auth.token.length).toBeGreaterThan(0)
  })

  it('does not include unsupported peers or telegram top-level config', async () => {
    const withTelegram: TeamSpec = {
      ...teamSpec,
      telegramGroupChatId: '-1001234567890',
      telegramOwnerUserId: '222222222',
      agents: teamSpec.agents.map((agent) => (
        agent.slug === 'alpha' ? { ...agent, telegramBotId: '111111111' } : agent
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
      telegramGroupChatId: '-1001234567890',
      telegramOwnerUserId: '222222222',
      agents: teamSpec.agents.map((agent) => (
        agent.slug === 'alpha' ? { ...agent, telegramBotId: '111111111' } : agent
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
    expect(alphaConfig.channels.telegram.enabled).toBe(true)
  })
})
