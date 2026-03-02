import { describe, it, expect, vi, beforeEach } from 'vitest'

const store = vi.hoisted(() => new Map<string, string>())

vi.mock('../../keychain', () => ({
  setSecret: vi.fn(async (a: string, k: string, v: string) => store.set(`${a}:${k}`, v)),
  getSecret: vi.fn(async (a: string, k: string) => store.get(`${a}:${k}`) ?? null),
  deleteSecret: vi.fn(async (a: string, k: string) => store.delete(`${a}:${k}`)),
}))

import { storeGkeCredentials, getGkeCredentials, storeGkeAccessToken, getGkeAccessToken } from './auth'

describe('GKE auth', () => {
  beforeEach(() => store.clear())

  it('stores and retrieves GKE credentials', async () => {
    const creds = { type: 'oauth' as const, projectId: 'my-proj', clusterName: 'my-cluster', clusterZone: 'us-central1-a' }
    await storeGkeCredentials('env-1', creds)
    const retrieved = await getGkeCredentials('env-1')
    expect(retrieved).toEqual(creds)
  })

  it('returns null for missing credentials', async () => {
    const result = await getGkeCredentials('nonexistent')
    expect(result).toBeNull()
  })

  it('stores and retrieves access token', async () => {
    await storeGkeAccessToken('env-1', 'ya29.test-token')
    const token = await getGkeAccessToken('env-1')
    expect(token).toBe('ya29.test-token')
  })
})
