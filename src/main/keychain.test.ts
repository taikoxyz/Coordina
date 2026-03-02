import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock keytar before importing keychain module
vi.mock('keytar', () => ({
  default: {
    setPassword: vi.fn().mockResolvedValue(undefined),
    getPassword: vi.fn().mockResolvedValue('secret-value'),
    deletePassword: vi.fn().mockResolvedValue(true),
  }
}))

import { setSecret, getSecret, deleteSecret } from './keychain'

describe('keychain', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('setSecret calls keytar.setPassword with namespaced key', async () => {
    const keytar = (await import('keytar')).default
    await setSecret('my-account', 'my-key', 'my-value')
    expect(keytar.setPassword).toHaveBeenCalledWith('coordina:my-key', 'my-account', 'my-value')
  })

  it('getSecret calls keytar.getPassword and returns value', async () => {
    const keytar = (await import('keytar')).default
    ;(keytar.getPassword as ReturnType<typeof vi.fn>).mockResolvedValueOnce('secret-value')
    const val = await getSecret('my-account', 'my-key')
    expect(keytar.getPassword).toHaveBeenCalledWith('coordina:my-key', 'my-account')
    expect(val).toBe('secret-value')
  })

  it('deleteSecret calls keytar.deletePassword', async () => {
    const keytar = (await import('keytar')).default
    await deleteSecret('my-account', 'my-key')
    expect(keytar.deletePassword).toHaveBeenCalledWith('coordina:my-key', 'my-account')
  })
})
