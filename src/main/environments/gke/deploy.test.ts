import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockExecFileSync = vi.hoisted(() => vi.fn().mockReturnValue('Running'))

vi.mock('child_process', () => ({
  execFileSync: mockExecFileSync,
}))

vi.mock('./gcloud', () => ({
  ensureDisk: vi.fn(),
  toZone: vi.fn((z: string) => z),
}))

import { deployTeam, undeployTeam, getTeamStatus } from './deploy'

const config = { envId: 'env-1', projectId: 'my-proj', clusterName: 'my-cluster', clusterZone: 'us-central1-a' }

describe('deployTeam', () => {
  beforeEach(() => vi.clearAllMocks())

  it('applies manifests and returns gateway URL', async () => {
    const result = await deployTeam('eng-alpha', [{ slug: 'alice' }, { slug: 'bob' }], config)
    expect(result.ok).toBe(true)
    expect(result.gatewayUrl).toContain('eng-alpha')
    expect(mockExecFileSync).toHaveBeenCalledWith(
      'kubectl',
      expect.arrayContaining(['apply', '-f', '-']),
      expect.objectContaining({ input: expect.any(String) })
    )
  })
})

describe('undeployTeam', () => {
  beforeEach(() => vi.clearAllMocks())

  it('deletes StatefulSets but NOT PVCs', async () => {
    await undeployTeam('eng-alpha', config)
    const allArgs = mockExecFileSync.mock.calls.map(c => (c[1] as string[]).join(' '))
    expect(allArgs.some(a => a.includes('statefulset'))).toBe(true)
    expect(allArgs.some(a => a.includes('pvc') || a.includes('PersistentVolumeClaim'))).toBe(false)
  })
})

describe('getTeamStatus', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns running status for running pods', async () => {
    mockExecFileSync.mockReturnValue('Running')
    const statuses = await getTeamStatus('eng-alpha', ['alice', 'bob'], config)
    expect(statuses).toHaveLength(2)
    expect(statuses[0].status).toBe('running')
  })

  it('returns unknown status when pod not found', async () => {
    mockExecFileSync.mockImplementation(() => { throw new Error('not found') })
    const statuses = await getTeamStatus('eng-alpha', ['alice'], config)
    expect(statuses[0].status).toBe('unknown')
  })
})
