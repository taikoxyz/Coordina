// File-based store for app settings reading and writing JSON
// FEATURE: Store layer replacing SQLite for application settings persistence
import fs from 'fs/promises'
import path from 'path'
import os from 'os'
import { AppSettings } from '../../shared/types'

const settingsPath = (): string => path.join(os.homedir(), '.coordina', 'settings.json')

export const getSettings = async (): Promise<AppSettings> => {
  const content = await fs.readFile(settingsPath(), 'utf-8').catch(() => null)
  return content ? JSON.parse(content) : {}
}

export const saveSettings = async (settings: AppSettings): Promise<void> => {
  await fs.mkdir(path.dirname(settingsPath()), { recursive: true })
  await fs.writeFile(settingsPath(), JSON.stringify(settings, null, 2), 'utf-8')
}
