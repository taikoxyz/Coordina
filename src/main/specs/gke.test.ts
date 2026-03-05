// GKE deriver tests verifying gateway auth injection into agent openclaw.json
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

function getTeamMd(files: { path: string; content: string }[]): string {
  const file = files.find(f => f.path === 'configmap-shared.yaml')!
  const configmap = yaml.load(file.content) as { data: Record<string, string> }
  return configmap.data['TEAM.md']
}

describe('gkeDeriver gateway injection', () => {
  it('includes per-agent gateway auth token in openclaw.json', async () => {
    const files = await gkeDeriver.derive(teamSpec, providers, envConfig)
    const alphaConfig = getOpenClawConfig(files, 'alpha')
    const betaConfig = getOpenClawConfig(files, 'beta')

    expect(typeof alphaConfig.gateway?.auth?.token).toBe('string')
    expect(alphaConfig.gateway.auth.token.length).toBeGreaterThan(0)
    expect(alphaConfig.gateway.auth.token).not.toBe(betaConfig.gateway.auth.token)
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

  it('includes gateway URLs in each TEAM.md member entry', async () => {
    const files = await gkeDeriver.derive(teamSpec, providers, envConfig)
    const teamMd = getTeamMd(files)

    expect(teamMd).toContain('### alpha')
    expect(teamMd).toContain('- gateway: ws://agent-alpha.my-team.svc.cluster.local:18789')
    expect(teamMd).toContain('### beta')
    expect(teamMd).toContain('- gateway: ws://agent-beta.my-team.svc.cluster.local:18789')
  })
})
