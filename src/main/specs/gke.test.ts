// GKE deriver tests verifying peer gateway injection into agent openclaw.json
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

describe('gkeDeriver peer injection', () => {
  it('includes all teammates as peers in each agent openclaw.json', async () => {
    const files = await gkeDeriver.derive(teamSpec, providers, envConfig)
    const alphaConfig = getOpenClawConfig(files, 'alpha')

    expect(alphaConfig.peers).toBeDefined()
    expect(alphaConfig.peers.beta).toBeDefined()
    expect(alphaConfig.peers.gamma).toBeDefined()
  })

  it('excludes the agent itself from its own peers', async () => {
    const files = await gkeDeriver.derive(teamSpec, providers, envConfig)
    const alphaConfig = getOpenClawConfig(files, 'alpha')
    const betaConfig = getOpenClawConfig(files, 'beta')

    expect(alphaConfig.peers.alpha).toBeUndefined()
    expect(betaConfig.peers.beta).toBeUndefined()
  })

  it('uses http:// URLs for peer gateways', async () => {
    const files = await gkeDeriver.derive(teamSpec, providers, envConfig)
    const alphaConfig = getOpenClawConfig(files, 'alpha')

    expect(alphaConfig.peers.beta.url).toBe('http://agent-beta.my-team.svc.cluster.local:18789')
    expect(alphaConfig.peers.gamma.url).toBe('http://agent-gamma.my-team.svc.cluster.local:18789')
  })

  it('includes auth token for each peer', async () => {
    const files = await gkeDeriver.derive(teamSpec, providers, envConfig)
    const alphaConfig = getOpenClawConfig(files, 'alpha')

    expect(typeof alphaConfig.peers.beta.token).toBe('string')
    expect(alphaConfig.peers.beta.token.length).toBeGreaterThan(0)
    expect(alphaConfig.peers.beta.token).not.toBe(alphaConfig.peers.gamma.token)
  })
})
