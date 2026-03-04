// Tests for GKE OAuth2 auth — token retrieval and client construction
// FEATURE: GCP OAuth2 auth flow storing tokens in OS keychain for GKE access
import { describe, it, expect, vi } from 'vitest'

vi.mock('../../store/environments', () => ({
  getEnvToken: vi.fn(async () => null),
  setEnvToken: vi.fn(async () => {}),
}))

import { getOAuth2Client } from './auth'

describe('getOAuth2Client', () => {
  it('throws when no token is stored', async () => {
    await expect(
      getOAuth2Client('env-1', { clientId: 'id', clientSecret: 'secret' })
    ).rejects.toThrow('Not authenticated')
  })

  it('returns a client when token exists', async () => {
    const { getEnvToken } = await import('../../store/environments')
    vi.mocked(getEnvToken).mockResolvedValueOnce(JSON.stringify({ access_token: 'ya29.test' }))
    const client = await getOAuth2Client('env-1', { clientId: 'id', clientSecret: 'secret' })
    expect(client).toBeDefined()
  })
})
