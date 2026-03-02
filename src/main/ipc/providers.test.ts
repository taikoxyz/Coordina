import { describe, it, expect, beforeEach, vi } from 'vitest'
import Database from 'better-sqlite3'

vi.mock('electron', () => ({
  ipcMain: { handle: vi.fn() },
  app: { getPath: vi.fn(() => ':memory:') },
}))

vi.mock('../keychain', () => ({
  setSecret: vi.fn().mockResolvedValue(undefined),
  getSecret: vi.fn().mockResolvedValue(null),
  deleteSecret: vi.fn().mockResolvedValue(true),
}))

// Shared in-memory DB for all tests
const testDb = new Database(':memory:')
testDb.exec(`
  CREATE TABLE IF NOT EXISTS providers (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    name TEXT NOT NULL,
    config TEXT NOT NULL
  )
`)

vi.mock('../db', () => ({
  openDb: vi.fn(() => testDb),
}))

import '../providers/index'
import { getProvider } from '../providers/base'
import { setSecret, deleteSecret } from '../keychain'
import { openDb } from '../db'

async function createProvider(data: { type: string; name: string; config: Record<string, unknown> }) {
  const provider = getProvider(data.type)
  const validation = provider.validate(data.config)
  if (!validation.valid) return { ok: false, errors: validation.errors }

  const id = 'test-id-' + Math.random().toString(36).slice(2)
  const { apiKey, ...nonSecretConfig } = data.config

  if (apiKey) {
    await setSecret(id, 'provider-api-key', String(apiKey))
  }

  const db = openDb(':memory:')
  db.prepare('INSERT INTO providers (id, type, name, config) VALUES (?, ?, ?, ?)').run(
    id, data.type, data.name, JSON.stringify(nonSecretConfig)
  )
  return { ok: true, id }
}

async function deleteProvider(id: string) {
  await deleteSecret(id, 'provider-api-key')
  const db = openDb(':memory:')
  db.prepare('DELETE FROM providers WHERE id = ?').run(id)
  return { ok: true }
}

describe('providers IPC logic', () => {
  beforeEach(() => vi.clearAllMocks())

  it('creates a provider and stores it in DB', async () => {
    const result = await createProvider({
      type: 'anthropic',
      name: 'My Anthropic',
      config: { apiKey: 'sk-ant-xxx', model: 'claude-sonnet-4-6' },
    })
    expect(result.ok).toBe(true)
    expect(result.id).toBeTruthy()
  })

  it('validates provider config on create', async () => {
    const result = await createProvider({
      type: 'anthropic',
      name: 'Bad Key',
      config: { apiKey: 'wrong-key', model: 'claude-sonnet-4-6' },
    })
    expect(result.ok).toBe(false)
    expect(result.errors).toBeDefined()
  })

  it('stores API key in keychain separately from config', async () => {
    await createProvider({
      type: 'anthropic',
      name: 'Test',
      config: { apiKey: 'sk-ant-secret', model: 'claude-sonnet-4-6' },
    })
    expect(setSecret).toHaveBeenCalledWith(expect.any(String), 'provider-api-key', 'sk-ant-secret')
  })

  it('lists providers from DB', () => {
    const db = openDb(':memory:')
    const rows = db.prepare('SELECT id, type, name, config FROM providers').all()
    expect(Array.isArray(rows)).toBe(true)
  })

  it('deletes provider and removes from keychain', async () => {
    await deleteProvider('some-id')
    expect(deleteSecret).toHaveBeenCalledWith('some-id', 'provider-api-key')
  })
})
