// File watcher that auto-validates and derives specs on team spec save
// FEATURE: Auto-derive pipeline triggered by chokidar team spec file changes
import chokidar from 'chokidar'
import path from 'path'
import os from 'os'
import { BrowserWindow } from 'electron'
import { getTeam } from './store/teams'
import { listProviders, getProviderApiKey } from './store/providers'
import { listEnvironments } from './store/environments'
import { validateTeamSpec } from './validation/teamSpec'
import { getDeriver } from './specs/base'
import './specs/gke'
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

  if (!validationResult.valid) {
    sendToAllWindows('spec:derivation', { teamSlug: slug, status: 'error', error: 'Validation failed' })
    return
  }

  sendToAllWindows('spec:derivation', { teamSlug: slug, status: 'running' })

  try {
    const environments = await listEnvironments()
    const providersMap = new Map(
      await Promise.all(providerRecords.map(async (p) => {
        const apiKey = await getProviderApiKey(p.slug)
        return [p.slug, { ...p, apiKey: apiKey ?? undefined }] as const
      }))
    )

    for (const env of environments) {
      let deriver
      try { deriver = getDeriver(env.type) } catch { continue }
      const files = await deriver.derive(spec, providersMap, env.config)
      const deployDir = path.join(teamDeployDir, env.type)
      await fs.mkdir(deployDir, { recursive: true })
      await Promise.all(files.map(async (f) => {
        const filePath = path.join(deployDir, f.path)
        await fs.mkdir(path.dirname(filePath), { recursive: true })
        await fs.writeFile(filePath, f.content, 'utf-8')
      }))
    }

    sendToAllWindows('spec:derivation', { teamSlug: slug, status: 'success' })
  } catch (e) {
    sendToAllWindows('spec:derivation', { teamSlug: slug, status: 'error', error: e instanceof Error ? e.message : String(e) })
  }
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
