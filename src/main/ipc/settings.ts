import { ipcMain } from 'electron'
import { setSecret, getSecret } from '../keychain'
import { isGhInstalled, importGhToken, getStoredGitHubToken, deleteGitHubToken } from '../github/auth'
import { getDb } from '../db'

export function registerSettingsHandlers() {
  ipcMain.handle('settings:setAnthropicKey', async (_event, key: string) => {
    if (!key?.startsWith('sk-ant-')) return { ok: false, error: 'API key must start with sk-ant-' }
    await setSecret('app', 'anthropic-key', key)
    return { ok: true }
  })

  ipcMain.handle('settings:getAnthropicKey', async () => {
    return getSecret('app', 'anthropic-key')
  })

  ipcMain.handle('settings:hasAnthropicKey', async () => {
    const key = await getSecret('app', 'anthropic-key')
    return !!key
  })

  ipcMain.handle('settings:githubAuth:check', async () => {
    const [installed, connected] = await Promise.all([isGhInstalled(), getStoredGitHubToken()])
    return { installed, connected: !!connected }
  })

  ipcMain.handle('settings:githubAuth:login', async () => {
    try {
      await importGhToken()
      return { ok: true }
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : 'Authorization failed' }
    }
  })

  ipcMain.handle('settings:githubAuth:status', async () => {
    const token = await getStoredGitHubToken()
    return !!token
  })

  ipcMain.handle('settings:githubAuth:disconnect', async () => {
    await deleteGitHubToken()
    return { ok: true }
  })

  ipcMain.handle('settings:hasAiProvider', async () => {
    const anthropicKey = await getSecret('app', 'anthropic-key')
    if (anthropicKey) return true

    const db = getDb()
    const providers = db.prepare('SELECT id, type FROM providers').all() as { id: string; type: string }[]
    for (const p of providers) {
      if (p.type === 'ollama') return true
      const key = await getSecret(p.id, 'provider-api-key')
      if (key) return true
    }
    return false
  })
}
