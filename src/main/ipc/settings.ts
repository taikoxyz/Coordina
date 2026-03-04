// IPC handlers for app settings using file-based storage
// FEATURE: Settings IPC layer replacing SQLite with ~/.coordina/settings.json
import { ipcMain } from 'electron'
import { getSettings, saveSettings } from '../store/settings'
import type { AppSettings } from '../../shared/types'

export function registerSettingsHandlers(): void {
  ipcMain.handle('settings:get', () => getSettings())

  ipcMain.handle('settings:save', async (_e, settings: AppSettings) => {
    await saveSettings(settings)
    return { ok: true }
  })
}
