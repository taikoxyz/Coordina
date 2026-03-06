// File watcher that auto-validates team specs on save
import chokidar from 'chokidar'
import path from 'path'
import os from 'os'
import { BrowserWindow } from 'electron'
import { getTeam } from './store/teams'
import { listProviders } from './store/providers'
import { validateTeamSpec } from './validation/teamSpec'
import fs from 'fs/promises'

const teamsDir = path.join(os.homedir(), '.coordina', 'teams')

const sendToAllWindows = (channel: string, data: unknown): void => {
  BrowserWindow.getAllWindows().forEach(w => w.webContents.send(channel, data))
}

export const runPipeline = async (slug: string): Promise<void> => {
  const spec = await getTeam(slug)
  if (!spec) return
  const teamDeployDir = path.join(teamsDir, slug, '.deploy')
  await fs.rm(teamDeployDir, { recursive: true, force: true })

  const providerRecords = await listProviders()
  const validationResult = validateTeamSpec(spec, providerRecords)
  sendToAllWindows('spec:validation', { teamSlug: slug, ...validationResult })
}

export const startSpecWatcher = (): void => {
  const watcher = chokidar.watch(path.join(teamsDir, '*.json'), { ignoreInitial: false, awaitWriteFinish: { stabilityThreshold: 300 } })

  watcher.on('add', (filePath) => {
    const slug = path.basename(filePath, '.json')
    runPipeline(slug)
  })

  watcher.on('change', (filePath) => {
    const slug = path.basename(filePath, '.json')
    runPipeline(slug)
  })
}
