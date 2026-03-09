// IPC handlers for provider CRUD replacing SQLite with file-based storage
// FEATURE: Provider management IPC layer using ~/.coordina/providers/{slug}.json
import { ipcMain } from 'electron'
import { listProviders, getProvider as getProviderFile, saveProvider, deleteProvider, getProviderApiKey, setProviderApiKey } from '../store/providers'
import { getProvider } from '../providers/base'
import { authenticateProvider } from '../providers/oauth'
import '../providers/index'
import type { ProviderRecord } from '../../shared/types'

export function registerProviderHandlers(): void {
  ipcMain.handle('providers:list', async () => {
    const records = await listProviders()
    return Promise.all(records.map(async (r) => {
      const apiKey = await getProviderApiKey(r.slug)
      const maskedApiKey = apiKey
        ? (apiKey.length > 12 ? `${apiKey.slice(0, 6)}••••••${apiKey.slice(-4)}` : '••••••••')
        : undefined
      return { ...r, maskedApiKey }
    }))
  })

  ipcMain.handle('providers:get', (_e, slug: string) => getProviderFile(slug))

  ipcMain.handle('providers:testKey', async (_e, data: { type: string; apiKey?: string; baseUrl?: string }) => {
    try {
      const modelProvider = getProvider(data.type)
      const config = { apiKey: data.apiKey, baseUrl: data.baseUrl }
      const formatResult = modelProvider.validate(config)
      if (!formatResult.valid) return { ok: false, error: formatResult.errors?.[0] }
      const models = await modelProvider.listModels(config)
      return { ok: true, models }
    } catch (e) {
      return { ok: false, error: (e as Error).message }
    }
  })

  ipcMain.handle('providers:oauth', async (_e, data: { slug: string; type: string }) => {
    try {
      const modelProvider = getProvider(data.type)
      if (modelProvider.authType !== 'oauth' || !modelProvider.oauthConfig) {
        return { ok: false, error: 'Provider does not support OAuth' }
      }
      const token = await authenticateProvider(data.slug, modelProvider.oauthConfig)
      const models = await modelProvider.listModels({ apiKey: token })
      return { ok: true, models }
    } catch (e) {
      return { ok: false, error: (e as Error).message }
    }
  })

  ipcMain.handle('providers:save', async (_e, data: ProviderRecord & { apiKey?: string }) => {
    const { apiKey, ...record } = data
    const modelProvider = getProvider(record.type)
    if (modelProvider.authType === 'apiKey' && apiKey) {
      const formatResult = modelProvider.validate({ apiKey })
      if (!formatResult.valid) return { ok: false, errors: formatResult.errors }
      const testResult = await modelProvider.testConnection({ apiKey })
      if (!testResult.valid) return { ok: false, errors: testResult.errors }
      await setProviderApiKey(record.slug, apiKey)
    }
    await saveProvider(record)
    return { ok: true }
  })

  ipcMain.handle('providers:delete', async (_e, slug: string) => {
    await deleteProvider(slug)
    return { ok: true }
  })

  ipcMain.handle('providers:getApiKey', (_e, slug: string) => getProviderApiKey(slug))
}
