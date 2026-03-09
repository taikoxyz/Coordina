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

  ipcMain.handle('openrouter:disconnect', async () => {
    await deleteOpenRouterApiKey()
    return { ok: true }
  })
}
