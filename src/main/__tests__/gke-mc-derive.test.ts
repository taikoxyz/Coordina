import { describe, it, expect, vi } from 'vitest'

vi.mock('../store/providers', () => ({ getOpenRouterApiKey: vi.fn().mockResolvedValue('sk-test') }))
vi.mock('../providers/base', () => ({
  openrouterToOpenClawJson: vi.fn().mockReturnValue({
    agents: { defaults: { model: { primary: 'claude' } } },
    gateway: {},
    tools: {},
    channels: {},
  }),
  openrouterToEnvVars: vi.fn().mockReturnValue({}),
  testOpenRouterConnection: vi.fn().mockResolvedValue({ valid: true }),
}))
vi.mock('../store/teams', () => ({ saveTeam: vi.fn().mockResolvedValue(undefined) }))
vi.mock('../store/settings', () => ({ getSettings: vi.fn().mockResolvedValue({}) }))
vi.mock('../store/projects', () => ({ listProjects: vi.fn().mockResolvedValue([]) }))
vi.mock('../gateway/mode', () => ({ resolveGatewayMode: vi.fn().mockReturnValue('port-forward') }))

import { getDeriver } from '../specs/base'
import '../specs/gke'
import type { TeamSpec } from '../../shared/types'

const TEAM: TeamSpec = {
  slug: 'alpha',
  name: 'Alpha Team',
  leadAgent: 'alice',
  agents: [{ slug: 'alice', name: 'Alice', role: 'Lead', persona: 'p', skills: [], models: [] }],
  signingKey: 'a'.repeat(64),
}

const MC_CONFIG = {
  enabled: true,
  image: 'gcr.io/proj/mc:latest',
  domain: 'mc.example.com',
  adminPassword: 'pass',
  sessionSecret: '12345678901234567890123456789012',
  apiKey: 'key123',
}

describe('GKE deriver with Mission Control', () => {
  it('includes MC manifest files when missionControl.enabled is true', async () => {
    const deriver = getDeriver('gke')
    const files = await deriver.derive(TEAM, { missionControl: MC_CONFIG })
    const paths = files.map(f => f.path)
    expect(paths).toContain('mission-control/secret.yaml')
    expect(paths).toContain('mission-control/pvc.yaml')
    expect(paths).toContain('mission-control/deployment.yaml')
    expect(paths).toContain('mission-control/service.yaml')
    expect(paths).toContain('mission-control/ingress.yaml')
  })

  it('omits MC manifest files when missionControl is not configured', async () => {
    const deriver = getDeriver('gke')
    const files = await deriver.derive(TEAM, {})
    const paths = files.map(f => f.path)
    expect(paths).not.toContain('mission-control/secret.yaml')
  })
})
