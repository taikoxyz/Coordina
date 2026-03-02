import { ipcMain } from 'electron'
import { setSecret, getSecret } from '../keychain'

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
}
