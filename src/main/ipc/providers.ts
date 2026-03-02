import { ipcMain } from 'electron'
import { v4 as uuidv4 } from 'uuid'
import { openDb } from '../db'
import { setSecret, getSecret, deleteSecret } from '../keychain'
import { getProvider } from '../providers/base'
import '../providers/index'
import { app } from 'electron'
import path from 'path'

function getDb() {
  const dbPath = path.join(app.getPath('userData'), 'coordina.db')
  return openDb(dbPath)
}

export interface ProviderRecord {
  id: string
  type: string
  name: string
  config: Record<string, unknown>
}

export function registerProviderHandlers() {
  ipcMain.handle('providers:list', () => {
    const db = getDb()
    const rows = db.prepare('SELECT id, type, name, config FROM providers').all() as { id: string; type: string; name: string; config: string }[]
    return rows.map(r => ({ id: r.id, type: r.type, name: r.name, config: JSON.parse(r.config) }))
  })

  ipcMain.handle('providers:create', async (_event, data: { type: string; name: string; config: Record<string, unknown> }) => {
    const provider = getProvider(data.type)
    const validation = provider.validate(data.config)
    if (!validation.valid) return { ok: false, errors: validation.errors }

    const id = uuidv4()
    const { apiKey, ...nonSecretConfig } = data.config

    if (apiKey) {
      await setSecret(id, 'provider-api-key', String(apiKey))
    }

    const db = getDb()
    db.prepare('INSERT INTO providers (id, type, name, config) VALUES (?, ?, ?, ?)').run(
      id, data.type, data.name, JSON.stringify(nonSecretConfig)
    )
    return { ok: true, id }
  })

  ipcMain.handle('providers:update', async (_event, id: string, data: { name?: string; config?: Record<string, unknown> }) => {
    const db = getDb()
    const row = db.prepare('SELECT type, config FROM providers WHERE id = ?').get(id) as { type: string; config: string } | undefined
    if (!row) return { ok: false, errors: ['Provider not found'] }

    if (data.config) {
      const provider = getProvider(row.type)
      const validation = provider.validate(data.config)
      if (!validation.valid) return { ok: false, errors: validation.errors }

      const { apiKey, ...nonSecretConfig } = data.config
      if (apiKey) {
        await setSecret(id, 'provider-api-key', String(apiKey))
      }

      db.prepare('UPDATE providers SET config = ? WHERE id = ?').run(JSON.stringify(nonSecretConfig), id)
    }

    if (data.name) {
      db.prepare('UPDATE providers SET name = ? WHERE id = ?').run(data.name, id)
    }

    return { ok: true }
  })

  ipcMain.handle('providers:delete', async (_event, id: string) => {
    await deleteSecret(id, 'provider-api-key')
    const db = getDb()
    db.prepare('DELETE FROM providers WHERE id = ?').run(id)
    return { ok: true }
  })

  ipcMain.handle('providers:getApiKey', async (_event, id: string) => {
    return getSecret(id, 'provider-api-key')
  })
}
