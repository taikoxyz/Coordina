// GKE deriver tests verifying gateway auth injection into agent openclaw.json
// FEATURE: GKE derivation layer with K8s Secrets for API key security
import { describe, it, expect, vi } from 'vitest'
import yaml from 'js-yaml'
import gkeDeriver from './gke'
import type { TeamSpec, ProviderRecord } from '../../shared/types'

vi.mock('../store/teams', () => ({
  saveTeam: vi.fn().mockResolvedValue(undefined),
  getMcAdminPassword: vi.fn().mockResolvedValue('testadminpass'),
  setMcAdminPassword: vi.fn().mockResolvedValue(undefined),
  getMcApiKey: vi.fn().mockResolvedValue('testapikey123'),
  setMcApiKey: vi.fn().mockResolvedValue(undefined),
}))
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
  domain: 'example.com',
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

describe('gkeDeriver gateway config', () => {
  it('injects gateway auth token into each agent openclaw.json', async () => {
    const files = await gkeDeriver.derive(teamSpec, providers, envConfig)
    const alphaConfig = getOpenClawConfig(files, 'alpha')
    expect(alphaConfig.gateway?.auth?.token).toBeDefined()
  })

  it('uses deterministic per-agent gateway tokens', async () => {
    const files = await gkeDeriver.derive(teamSpec, providers, envConfig)
    const alphaConfig = getOpenClawConfig(files, 'alpha')
    const betaConfig = getOpenClawConfig(files, 'beta')

    expect(typeof alphaConfig.gateway?.auth?.token).toBe('string')
    expect(typeof betaConfig.gateway?.auth?.token).toBe('string')
    expect(alphaConfig.gateway?.auth?.token).not.toBe(betaConfig.gateway?.auth?.token)
  })

  it('does not write unsupported top-level peers key', async () => {
    const files = await gkeDeriver.derive(teamSpec, providers, envConfig)
    const alphaConfig = getOpenClawConfig(files, 'alpha')

    expect(alphaConfig.peers).toBeUndefined()
  })
})

describe('gkeDeriver Mission Control integration', () => {
  it('generates MC manifests when missionControl is enabled', async () => {
    const specWithMc: TeamSpec = {
      ...teamSpec,
      missionControl: { enabled: true, image: 'gcr.io/proj/mc:latest' },
    }
    const files = await gkeDeriver.derive(specWithMc, providers, envConfig)
    const mcPaths = files.filter(f => f.path.startsWith('mc/')).map(f => f.path).sort()
    expect(mcPaths).toEqual([
      'mc/deployment.yaml', 'mc/ingress.yaml', 'mc/pvc.yaml', 'mc/secret.yaml', 'mc/service.yaml',
    ])
  })

  it('does not generate MC manifests when missionControl is not enabled', async () => {
    const files = await gkeDeriver.derive(teamSpec, providers, envConfig)
    expect(files.filter(f => f.path.startsWith('mc/'))).toHaveLength(0)
  })

  it('uses team domain for MC ingress when MC domain not set', async () => {
    const specWithMc: TeamSpec = {
      ...teamSpec,
      missionControl: { enabled: true, image: 'gcr.io/proj/mc:latest' },
    }
    const files = await gkeDeriver.derive(specWithMc, providers, envConfig)
    const mcIngress = files.find(f => f.path === 'mc/ingress.yaml')!
    expect(mcIngress.content).toContain('mc.example.com')
  })

  it('uses custom MC domain when provided', async () => {
    const specWithMc: TeamSpec = {
      ...teamSpec,
      missionControl: { enabled: true, image: 'gcr.io/proj/mc:latest', domain: 'dashboard.myco.dev' },
    }
    const files = await gkeDeriver.derive(specWithMc, providers, envConfig)
    const mcIngress = files.find(f => f.path === 'mc/ingress.yaml')!
    expect(mcIngress.content).toContain('dashboard.myco.dev')
  })

  it('persists generated credentials to keychain when not stored', async () => {
    const { getMcAdminPassword, setMcAdminPassword, getMcApiKey, setMcApiKey } = await import('../store/teams')
    vi.mocked(getMcAdminPassword).mockResolvedValueOnce(null)
    vi.mocked(getMcApiKey).mockResolvedValueOnce(null)

    const specWithMc: TeamSpec = {
      ...teamSpec,
      missionControl: { enabled: true, image: 'gcr.io/proj/mc:latest' },
    }
    await gkeDeriver.derive(specWithMc, providers, envConfig)

    expect(setMcAdminPassword).toHaveBeenCalledWith('my-team', expect.any(String))
    expect(setMcApiKey).toHaveBeenCalledWith('my-team', expect.any(String))
    const savedPassword = vi.mocked(setMcAdminPassword).mock.calls[0][1]
    const savedKey = vi.mocked(setMcApiKey).mock.calls[0][1]
    expect(savedPassword.length).toBe(64)
    expect(savedKey.length).toBe(64)
  })

  it('sets lead agent as gateway host in MC secret', async () => {
    const specWithMc: TeamSpec = {
      ...teamSpec,
      leadAgentSlug: 'alpha',
      missionControl: { enabled: true, image: 'gcr.io/proj/mc:latest' },
    }
    const files = await gkeDeriver.derive(specWithMc, providers, envConfig)
    const mcSecret = files.find(f => f.path === 'mc/secret.yaml')!
    expect(mcSecret.content).toContain('agent-alpha.my-team.svc.cluster.local')
  })
})
