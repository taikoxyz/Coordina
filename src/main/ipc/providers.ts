import { ipcMain } from 'electron'
import { getOpenRouterApiKey, setOpenRouterApiKey, deleteOpenRouterApiKey } from '../store/providers'
import { testOpenRouterConnection } from '../providers/base'

export function registerProviderHandlers(): void {
  ipcMain.handle('openrouter:getStatus', async () => {
    const apiKey = await getOpenRouterApiKey()
    return { connected: !!apiKey }
  })

  ipcMain.handle('openrouter:connect', async (_e, data: { apiKey: string }) => {
    try {
      const result = await testOpenRouterConnection(data.apiKey)
      if (!result.valid) return { ok: false, error: result.error }
      await setOpenRouterApiKey(data.apiKey)
      return { ok: true }
    } catch (e) {
      return { ok: false, error: (e as Error).message }
    }
  })

  ipcMain.handle('openrouter:test', async () => {
    const apiKey = await getOpenRouterApiKey()
    if (!apiKey) return { ok: false, error: 'No API key configured' }
    const result = await testOpenRouterConnection(apiKey)
    return result.valid ? { ok: true } : { ok: false, error: result.error ?? 'Authentication failed' }
  })

  ipcMain.handle('openrouter:disconnect', async () => {
    await deleteOpenRouterApiKey()
    return { ok: true }
  })
}
