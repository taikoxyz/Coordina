// IPC handlers for environments and deployment using K8s API and file store
// FEATURE: Deployment IPC layer replacing SQLite and kubectl with async APIs
import { ipcMain, BrowserWindow } from 'electron'
import { listEnvironments, getEnvironment, saveEnvironment, deleteEnvironment } from '../store/environments'
import { getTeam, saveTeam } from '../store/teams'
import { listProviders, getProviderApiKey } from '../store/providers'
import { getSecret } from '../keychain'
import { saveTeamDeployment, deleteTeamDeployment } from '../store/deployments'
import { getDeriver } from '../specs/base'
import '../specs/gke'
import { validateDerivedSpecFiles } from '../specs/validate'
import { deployTeam, undeployTeam, getTeamStatus } from '../environments/gke/deploy'
import { authenticateGke } from '../environments/gke/auth'
import { resolveGatewayMode } from '../gateway/mode'
import type { EnvironmentRecord, DeployOptions } from '../../shared/types'
import { validateTeamSpec } from '../validation/teamSpec'

export function registerDeployHandlers(): void {
  const telegramAccount = (teamSlug: string, agentSlug: string) => `team:${teamSlug}:agent:${agentSlug}`
  const formatValidationFailure = (prefix: string, errors: { field: string; message: string }[]): string => {
    const summary = errors.slice(0, 3).map(error => `${error.field}: ${error.message}`).join('; ')
    return errors.length > 3 ? `${prefix}: ${summary}; and ${errors.length - 3} more` : `${prefix}: ${summary}`
  }

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
    const specValidation = validateTeamSpec(spec, providerRecords)
    if (!specValidation.valid) {
      return { ok: false, reason: formatValidationFailure('Team spec validation failed', specValidation.errors) }
    }

    const providersMap = new Map(
      await Promise.all(providerRecords.map(async (p) => {
        const apiKey = await getProviderApiKey(p.slug)
        return [p.slug, { ...p, apiKey: apiKey ?? undefined }] as const
      }))
    )

    const telegramTokens = Object.fromEntries(await Promise.all(
      spec.agents.map(async (agent) => {
        const token = await getSecret(telegramAccount(spec.slug, agent.slug), 'agent-telegram-token')
        return [agent.slug, token ?? undefined] as const
      })
    ))

    const deriver = getDeriver(env.type)
    const specFiles = await deriver.derive(spec, providersMap, env.config, { agentTelegramTokens: telegramTokens })
    const deployValidation = validateDerivedSpecFiles(specFiles)
    if (!deployValidation.valid) {
      return { ok: false, reason: formatValidationFailure('Deployment file validation failed', deployValidation.errors) }
    }

    const win = BrowserWindow.fromWebContents(event.sender)
    const deployConfig = { slug: envSlug, ...env.config as object } as Parameters<typeof deployTeam>[2]

    try {
      for await (const status of deployTeam(specFiles, teamSlug, deployConfig, options)) {
        win?.webContents.send('deploy:status', status)
      }
      const leadAgent = spec.agents[0]?.slug
      const envDomain = (env.config as { domain?: string }).domain
      const mode = resolveGatewayMode(env.config)
      if (leadAgent) {
        if (mode === 'ingress' && (!envDomain || envDomain.trim().length === 0)) {
          return { ok: false, reason: 'Environment domain is required when gateway mode is ingress' }
        }
        const deployedAt = Date.now()
        await saveTeamDeployment({
          teamSlug,
          envSlug,
          leadAgent,
          gatewayBaseUrl: mode === 'ingress'
            ? `https://${teamSlug}.${envDomain}`.replace(/\/+$/, '')
            : 'http://127.0.0.1',
          deployedAt,
        })
        const currentSpec = await getTeam(teamSlug)
        if (currentSpec) await saveTeam({ ...currentSpec, deployedEnvSlug: envSlug, lastDeployedAt: deployedAt })
      }
      return { ok: true }
    } catch (e) {
      return { ok: false, reason: e instanceof Error ? e.message : String(e) }
    }
  })

  ipcMain.handle('undeploy:team', async (event, { teamSlug, envSlug }: { teamSlug: string; envSlug: string }) => {
    const env = await getEnvironment(envSlug)
    if (!env) return { ok: false, reason: 'Environment not found' }

    const win = BrowserWindow.fromWebContents(event.sender)
    const deployConfig = { slug: envSlug, ...env.config as object } as Parameters<typeof undeployTeam>[1]

    try {
      for await (const status of undeployTeam(teamSlug, deployConfig)) {
        win?.webContents.send('deploy:status', status)
      }
      await deleteTeamDeployment(teamSlug)
      const currentSpec = await getTeam(teamSlug)
      if (currentSpec) await saveTeam({ ...currentSpec, deployedEnvSlug: undefined, lastDeployedAt: undefined })
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
}
