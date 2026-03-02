import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../keychain', () => ({
  setSecret: vi.fn().mockResolvedValue(undefined),
  getSecret: vi.fn().mockResolvedValue(null),
  deleteSecret: vi.fn().mockResolvedValue(true),
}))

vi.mock('electron', () => ({ shell: { openExternal: vi.fn() } }))

import { storeGitHubToken, getStoredGitHubToken, deleteGitHubToken } from './auth'
import { setSecret, getSecret, deleteSecret } from '../keychain'

describe('GitHub auth token storage', () => {
  beforeEach(() => vi.clearAllMocks())

  it('stores GitHub token in keychain', async () => {
    await storeGitHubToken('ghp_test123')
    expect(setSecret).toHaveBeenCalledWith('app', 'github-token', 'ghp_test123')
  })

  it('retrieves stored GitHub token', async () => {
    vi.mocked(getSecret).mockResolvedValueOnce('ghp_stored')
    const token = await getStoredGitHubToken()
    expect(getSecret).toHaveBeenCalledWith('app', 'github-token')
    expect(token).toBe('ghp_stored')
  })

  it('returns null when no token stored', async () => {
    vi.mocked(getSecret).mockResolvedValueOnce(null)
    const token = await getStoredGitHubToken()
    expect(token).toBeNull()
  })

  it('deletes GitHub token from keychain', async () => {
    await deleteGitHubToken()
    expect(deleteSecret).toHaveBeenCalledWith('app', 'github-token')
  })
})
