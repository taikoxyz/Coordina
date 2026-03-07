import fs from 'fs/promises'
import path from 'path'
import { getDataDir } from './dataDir'

interface DeployLogEntry {
  type: 'file' | 'status'
  path?: string
  content?: string
  line?: string
  color?: string
}

const logsDir = (): string => path.join(getDataDir(), 'deploy-logs')

const logPath = (teamSlug: string): string => path.join(logsDir(), `${teamSlug}.json`)

const ensureDir = (): Promise<void> => fs.mkdir(logsDir(), { recursive: true }).then(() => undefined)

export const getDeployLogs = async (teamSlug: string): Promise<DeployLogEntry[]> => {
  const content = await fs.readFile(logPath(teamSlug), 'utf-8').catch(() => null)
  if (!content) return []
  return JSON.parse(content) as DeployLogEntry[]
}

export const saveDeployLogs = async (teamSlug: string, entries: DeployLogEntry[]): Promise<void> => {
  await ensureDir()
  await fs.writeFile(logPath(teamSlug), JSON.stringify(entries, null, 2), 'utf-8')
}

export const clearDeployLogs = async (teamSlug: string): Promise<void> => {
  await fs.unlink(logPath(teamSlug)).catch(() => undefined)
}
