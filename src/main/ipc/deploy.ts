// IPC handlers for environments and deployment using K8s API and file store
// FEATURE: Deployment IPC layer replacing SQLite and kubectl with async APIs
import { ipcMain, BrowserWindow } from 'electron'
import { getEnvironment, saveEnvironment, getEnvToken } from '../store/environments'
import { getTeam, saveTeam } from '../store/teams'
import { getSecret } from '../keychain'
import { saveTeamDeployment, deleteTeamDeployment } from '../store/deployments'
import { getDeriver } from '../specs/base'
import '../specs/gke'
import { validateDerivedSpecFiles } from '../specs/validate'
import { deployTeam, undeployTeam, undeployAgent, getTeamStatus } from '../environments/gke/deploy'
import { authenticateGke } from '../environments/gke/auth'
import { resolveGatewayMode } from '../gateway/mode'
import type { DeployOptions } from '../../shared/types'
import { validateTeamSpec } from '../validation/teamSpec'
import { getDeployLogs, saveDeployLogs, clearDeployLogs } from '../store/deployLogs'

export function registerDeployHandlers(): void {
  const telegramAccount = (teamSlug: string, agentSlug: string) => `team:${teamSlug}:agent:${agentSlug}`
  const formatValidationFailure = (prefix: string, errors: { field: string; message: string }[]): string => {
    const summary = errors.slice(0, 3).map(error => `${error.field}: ${error.message}`).join('; ')
    return errors.length > 3 ? `${prefix}: ${summary}; and ${errors.length - 3} more` : `${prefix}: ${summary}`
  }
  const deriveValidatedDeployFiles = async (teamSlug: string, envSlug: string) => {
    const [spec, env] = await Promise.all([getTeam(teamSlug), getEnvironment(envSlug)])
    if (!spec) throw new Error('Team not found')
    if (!env) throw new Error('Environment not found')

    const specValidation = validateTeamSpec(spec)
    if (!specValidation.valid) {
      throw new Error(formatValidationFailure('Team spec validation failed', specValidation.errors))
    }

    const telegramTokens = Object.fromEntries(await Promise.all(
      spec.agents.map(async (agent) => {
        const token = await getSecret(telegramAccount(spec.slug, agent.slug), 'agent-telegram-token')
        return [agent.slug, token ?? undefined] as const
      })
    ))

    const emailPassword = spec.teamEmail
      ? (await getSecret(`team:${teamSlug}`, 'team-email-password')) ?? undefined
      : undefined

    const deriver = getDeriver(env.type)
    const specFiles = await deriver.derive(spec, env.config, { agentTelegramTokens: telegramTokens, teamEmailPassword: emailPassword })
    const deployValidation = validateDerivedSpecFiles(specFiles)
    if (!deployValidation.valid) {
      throw new Error(formatValidationFailure('Deployment file validation failed', deployValidation.errors))
    }

    return { spec, env, specFiles }
  }

  ipcMain.handle('gke:getConfig', () => getEnvironment('gke'))

  ipcMain.handle('gke:save', async (_e, config: Record<string, unknown>) => {
    await saveEnvironment({ slug: 'gke', type: 'gke', name: 'GKE', config })
    return { ok: true }
  })

  ipcMain.handle('gke:authStatus', async () => {
    const token = await getEnvToken('gke')
    return { authenticated: !!token }
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

  ipcMain.handle('deploy:preview', async (_event, { teamSlug, envSlug, agentSlug }: { teamSlug: string; envSlug: string; agentSlug?: string }) => {
    try {
      const { specFiles } = await deriveValidatedDeployFiles(teamSlug, envSlug)
      const filteredFiles = agentSlug
        ? specFiles.filter(f => !f.path.includes('/') || f.path.startsWith(`agents/${agentSlug}/`))
        : specFiles
      return { ok: true, files: filteredFiles.map(file => ({ path: file.path, content: file.content })) }
    } catch (error) {
      return { ok: false, reason: error instanceof Error ? error.message : String(error) }
    }
  })

  ipcMain.handle('deploy:team', async (event, { teamSlug, envSlug, options, agentSlug }: { teamSlug: string; envSlug: string; options: DeployOptions; agentSlug?: string }) => {
    let spec
    let env
    let specFiles
    try {
      const prepared = await deriveValidatedDeployFiles(teamSlug, envSlug)
      spec = prepared.spec
      env = prepared.env
      specFiles = prepared.specFiles
    } catch (error) {
      return { ok: false, reason: error instanceof Error ? error.message : String(error) }
    }

    const filesToDeploy = agentSlug
      ? specFiles.filter(f => !f.path.includes('/') || f.path.startsWith(`agents/${agentSlug}/`))
      : specFiles

    const win = BrowserWindow.fromWebContents(event.sender)
    const deployConfig = { slug: envSlug, ...env.config as object } as Parameters<typeof deployTeam>[2]

    try {
      for await (const status of deployTeam(filesToDeploy, teamSlug, deployConfig, options)) {
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

  ipcMain.handle('undeploy:team', async (event, { teamSlug, envSlug, deleteDisks }: { teamSlug: string; envSlug: string; deleteDisks?: boolean }) => {
    const env = await getEnvironment(envSlug)
    if (!env) return { ok: false, reason: 'Environment not found' }

    const win = BrowserWindow.fromWebContents(event.sender)
    const deployConfig = { slug: envSlug, ...env.config as object } as Parameters<typeof undeployTeam>[1]

    try {
      for await (const status of undeployTeam(teamSlug, deployConfig, { deleteDisks })) {
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

  ipcMain.handle('undeploy:agent', async (event, { teamSlug, agentSlug, envSlug, deleteDisks }: { teamSlug: string; agentSlug: string; envSlug: string; deleteDisks?: boolean }) => {
    const env = await getEnvironment(envSlug)
    if (!env) return { ok: false, reason: 'Environment not found' }

    const win = BrowserWindow.fromWebContents(event.sender)
    const deployConfig = { slug: envSlug, ...env.config as object } as Parameters<typeof undeployAgent>[2]

    try {
      for await (const status of undeployAgent(teamSlug, agentSlug, deployConfig, { deleteDisks })) {
        win?.webContents.send('deploy:status', status)
      }
      return { ok: true }
    } catch (e) {
      return { ok: false, reason: e instanceof Error ? e.message : String(e) }
    }
  })

  ipcMain.handle('deploy:getLogs', async (_e, { teamSlug }: { teamSlug: string }) => {
    return getDeployLogs(teamSlug)
  })

  ipcMain.handle('deploy:saveLogs', async (_e, { teamSlug, entries }: { teamSlug: string; entries: unknown[] }) => {
    await saveDeployLogs(teamSlug, entries as Parameters<typeof saveDeployLogs>[1])
    return { ok: true }
  })

  ipcMain.handle('deploy:clearLogs', async (_e, { teamSlug }: { teamSlug: string }) => {
    await clearDeployLogs(teamSlug)
    return { ok: true }
  })

  ipcMain.handle('deploy:getStatus', async (_e, { teamSlug, envSlug }: { teamSlug: string; envSlug: string }) => {
    const [spec, env] = await Promise.all([getTeam(teamSlug), getEnvironment(envSlug)])
    if (!spec || !env) return []
    const deployConfig = { slug: envSlug, ...env.config as object } as Parameters<typeof getTeamStatus>[2]
    return getTeamStatus(teamSlug, spec.agents.map(a => a.slug), deployConfig)
  })
}
