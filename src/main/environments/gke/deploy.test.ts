import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockExecSync = vi.hoisted(() => vi.fn().mockReturnValue('Running'))

vi.mock('child_process', () => ({
  default: { execSync: mockExecSync },
  execSync: mockExecSync,
}))
vi.mock('./auth', () => ({
  getGkeCredentials: vi.fn().mockResolvedValue({ type: 'oauth', projectId: 'proj', clusterName: 'cluster', clusterZone: 'us-central1-a' }),
  getGkeAccessToken: vi.fn().mockResolvedValue('ya29.token'),
}))

import { deployTeam, undeployTeam, getTeamStatus } from './deploy'

const config = { envId: 'env-1', projectId: 'my-proj', clusterName: 'my-cluster', clusterZone: 'us-central1-a', domain: 'example.com' }

describe('deployTeam', () => {
  beforeEach(() => vi.clearAllMocks())

  it('applies manifests and returns gateway URL', async () => {
    const result = await deployTeam('eng-alpha', [{ slug: 'alice' }, { slug: 'bob' }], config)
    expect(result.ok).toBe(true)
    expect(result.gatewayUrl).toContain('eng-alpha')
    expect(mockExecSync).toHaveBeenCalledWith(
      expect.stringContaining('kubectl apply'),
      expect.objectContaining({ input: expect.any(String) })
    )
  })
})

describe('undeployTeam', () => {
  beforeEach(() => vi.clearAllMocks())

  it('deletes StatefulSets but NOT PVCs', async () => {
    await undeployTeam('eng-alpha', config)
    const calls = mockExecSync.mock.calls.map(c => c[0] as string)
    // Should delete statefulsets
    expect(calls.some(c => c.includes('statefulset'))).toBe(true)
    // Should NOT delete PVCs
    expect(calls.some(c => c.includes('pvc') || c.includes('PersistentVolumeClaim'))).toBe(false)
  })
})

describe('getTeamStatus', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns running status for running pods', async () => {
    mockExecSync.mockReturnValue("'Running'")
    const statuses = await getTeamStatus('eng-alpha', ['alice', 'bob'], config)
    expect(statuses).toHaveLength(2)
    expect(statuses[0].status).toBe('running')
  })

  it('returns unknown status when pod not found', async () => {
    mockExecSync.mockImplementation(() => { throw new Error('not found') })
    const statuses = await getTeamStatus('eng-alpha', ['alice'], config)
    expect(statuses[0].status).toBe('unknown')
  })
})
