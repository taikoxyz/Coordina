// IPC handlers for environments and deployment using K8s API and file store
// FEATURE: Deployment IPC layer replacing SQLite and kubectl with async APIs
import { ipcMain, BrowserWindow } from 'electron'
import { listEnvironments, getEnvironment, saveEnvironment, deleteEnvironment } from '../store/environments'
import { getTeam } from '../store/teams'
import { listProviders, getProviderApiKey } from '../store/providers'
import { getDeriver } from '../specs/base'
import '../specs/gke'
import { deployTeam, undeployTeam, getTeamStatus, getMcStatus } from '../environments/gke/deploy'
import { authenticateGke } from '../environments/gke/auth'
import { getMcAdminPassword, setMcAdminPassword, getMcApiKey, setMcApiKey } from '../store/teams'
import { registerAgentsWithMc } from '../mc/register'
import type { EnvironmentRecord, DeployOptions } from '../../shared/types'

export function registerDeployHandlers(): void {
  ipcMain.handle('environments:list', () => listEnvironments())

  ipcMain.handle('environments:get', (_e, slug: string) => getEnvironment(slug))

  ipcMain.handle('environments:save', async (_e, record: EnvironmentRecord) => {
    await saveEnvironment(record)
    return { ok: true }
  })

  ipcMain.handle('environments:delete', async (_e, slug: string) => {
    await deleteEnvironment(slug)
    return { ok: true }
  })

  ipcMain.handle('gke:auth', async (_e, envSlug: string) => {
    const env = await getEnvironment(envSlug)
    if (!env) return { ok: false, reason: 'Environment not found' }
    const { clientId, clientSecret } = env.config as { clientId: string; clientSecret: string }
    try {
      await authenticateGke(envSlug, { clientId, clientSecret })
      return { ok: true }
    } catch (e) {
      return { ok: false, reason: e instanceof Error ? e.message : String(e) }
    }
  })

  ipcMain.handle('deploy:team', async (event, { teamSlug, envSlug, options }: { teamSlug: string; envSlug: string; options: DeployOptions }) => {
    const [spec, env] = await Promise.all([getTeam(teamSlug), getEnvironment(envSlug)])
    if (!spec) return { ok: false, reason: 'Team not found' }
    if (!env) return { ok: false, reason: 'Environment not found' }

    const providerRecords = await listProviders()
    const providersMap = new Map(
      await Promise.all(providerRecords.map(async (p) => {
        const apiKey = await getProviderApiKey(p.slug)
        return [p.slug, { ...p, apiKey: apiKey ?? undefined }] as const
      }))
    )

    const deriver = getDeriver(env.type)
    const specFiles = await deriver.derive(spec, providersMap, env.config)

    const win = BrowserWindow.fromWebContents(event.sender)
    const deployConfig = { slug: envSlug, ...env.config as object } as Parameters<typeof deployTeam>[2]

    try {
      for await (const status of deployTeam(specFiles, teamSlug, deployConfig, options)) {
        win?.webContents.send('deploy:status', status)
      }
      return { ok: true }
    } catch (e) {
      return { ok: false, reason: e instanceof Error ? e.message : String(e) }
    }
  })

  ipcMain.handle('undeploy:team', async (event, { teamSlug, envSlug }: { teamSlug: string; envSlug: string }) => {
    const [spec, env] = await Promise.all([getTeam(teamSlug), getEnvironment(envSlug)])
    if (!env) return { ok: false, reason: 'Environment not found' }

    const win = BrowserWindow.fromWebContents(event.sender)
    const deployConfig = { slug: envSlug, ...env.config as object } as Parameters<typeof undeployTeam>[1]

    try {
      for await (const status of undeployTeam(teamSlug, deployConfig, { mcEnabled: !!spec?.missionControl?.enabled })) {
        win?.webContents.send('deploy:status', status)
      }
      return { ok: true }
    } catch (e) {
      return { ok: false, reason: e instanceof Error ? e.message : String(e) }
    }
  })

  ipcMain.handle('deploy:getStatus', async (_e, { teamSlug, envSlug }: { teamSlug: string; envSlug: string }) => {
    const [spec, env] = await Promise.all([getTeam(teamSlug), getEnvironment(envSlug)])
    if (!spec || !env) return []
    const deployConfig = { slug: envSlug, ...env.config as object } as Parameters<typeof getTeamStatus>[2]
    return getTeamStatus(teamSlug, spec.agents.map(a => a.slug), deployConfig)
  })

  ipcMain.handle('mc:status', async (_e, { teamSlug, envSlug }: { teamSlug: string; envSlug: string }) => {
    const [spec, env] = await Promise.all([getTeam(teamSlug), getEnvironment(envSlug)])
    if (!spec?.missionControl?.enabled) return { podStatus: 'not-deployed' as const }
    if (!env) return { podStatus: 'unknown' as const }
    const deployConfig = { slug: envSlug, ...env.config as object } as Parameters<typeof getMcStatus>[1]
    return getMcStatus(teamSlug, deployConfig)
  })

  ipcMain.handle('mc:register-agents', async (_e, { teamSlug, envSlug }: { teamSlug: string; envSlug: string }) => {
    const [spec, env] = await Promise.all([getTeam(teamSlug), getEnvironment(envSlug)])
    if (!spec || !env) return { ok: false, reason: 'Team or environment not found' }
    if (!spec.missionControl?.enabled) return { ok: false, reason: 'Mission Control not enabled' }

    const apiKey = await getMcApiKey(spec.slug)
    if (!apiKey) return { ok: false, reason: 'MC API key not configured' }

    const domain = spec.missionControl.domain || `mc.${spec.domain || 'example.com'}`
    return registerAgentsWithMc({
      mcBaseUrl: `https://${domain}`,
      apiKey,
      teamSlug: spec.slug,
      agents: spec.agents.map(a => ({ slug: a.slug, name: a.name, role: a.role, isLead: a.isLead })),
      namespace: spec.slug,
    })
  })

  ipcMain.handle('mc:save-credentials', async (_e, { teamSlug, adminPassword, apiKey }: { teamSlug: string; adminPassword?: string; apiKey?: string }) => {
    if (adminPassword) await setMcAdminPassword(teamSlug, adminPassword)
    if (apiKey) await setMcApiKey(teamSlug, apiKey)
    return { ok: true }
  })

  ipcMain.handle('mc:get-credentials', async (_e, teamSlug: string) => {
    const [adminPassword, apiKey] = await Promise.all([getMcAdminPassword(teamSlug), getMcApiKey(teamSlug)])
    return { hasAdminPassword: !!adminPassword, hasApiKey: !!apiKey, hasCredentials: !!(adminPassword && apiKey) }
  })
}
