import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('electron', () => ({ ipcMain: { handle: vi.fn() } }))

const mockStore = vi.hoisted(() => new Map<string, string>())

vi.mock('../keychain', () => ({
  setSecret: vi.fn(async (account: string, key: string, value: string) => {
    mockStore.set(`${account}:${key}`, value)
  }),
  getSecret: vi.fn(async (account: string, key: string) => {
    return mockStore.get(`${account}:${key}`) ?? null
  }),
  deleteSecret: vi.fn(async () => true),
}))

import { setSecret, getSecret } from '../keychain'

async function handleSetAnthropicKey(key: string) {
  if (!key?.startsWith('sk-ant-')) return { ok: false, error: 'API key must start with sk-ant-' }
  await setSecret('app', 'anthropic-key', key)
  return { ok: true }
}

async function handleGetAnthropicKey() {
  return getSecret('app', 'anthropic-key')
}

async function handleHasAnthropicKey() {
  const key = await getSecret('app', 'anthropic-key')
  return !!key
}

describe('settings IPC handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockStore.clear()
  })

  it('stores valid Anthropic key in keychain', async () => {
    const result = await handleSetAnthropicKey('sk-ant-test123')
    expect(result.ok).toBe(true)
    expect(setSecret).toHaveBeenCalledWith('app', 'anthropic-key', 'sk-ant-test123')
  })

  it('rejects key not starting with sk-ant-', async () => {
    const result = await handleSetAnthropicKey('wrong-key')
    expect(result.ok).toBe(false)
    expect(result.error).toContain('sk-ant-')
  })

  it('retrieves Anthropic key from keychain', async () => {
    await handleSetAnthropicKey('sk-ant-test123')
    const key = await handleGetAnthropicKey()
    expect(key).toBe('sk-ant-test123')
  })

  it('hasAnthropicKey returns false when no key', async () => {
    expect(await handleHasAnthropicKey()).toBe(false)
  })

  it('hasAnthropicKey returns true when key stored', async () => {
    await handleSetAnthropicKey('sk-ant-test123')
    expect(await handleHasAnthropicKey()).toBe(true)
  })
})
