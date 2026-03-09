// IPC handlers for team spec CRUD replacing SQLite with file-based storage
// FEATURE: Team management IPC layer using ~/.coordina/teams/{slug}.json files
import { ipcMain } from 'electron'
import { listTeams, getTeam, saveTeam, deleteTeam } from '../store/teams'
import { deleteTeamDeployment } from '../store/deployments'
import { runPipeline } from '../watcher'
import type { TeamSpec } from '../../shared/types'
import { getSecret, setSecret, deleteSecret } from '../keychain'
import { normalizeTeamSpec, validateTelegramPair } from '../validation/teamSpecNormalize'
import { syncBotProfilePhoto } from '../telegram'

export function registerTeamHandlers(): void {
  const telegramAccount = (teamSlug: string, agentSlug: string) => `team:${teamSlug}:agent:${agentSlug}`

  ipcMain.handle('teams:list', () => listTeams())

  ipcMain.handle('teams:get', (_e, slug: string) => getTeam(slug))

  ipcMain.handle('teams:save', async (_e, spec: TeamSpec) => {
    const normalized = normalizeTeamSpec(spec)
    validateTelegramPair(normalized)
    await saveTeam(normalized)
    return { ok: true }
  })

  ipcMain.handle('teams:delete', async (_e, slug: string) => {
    const spec = await getTeam(slug)
    for (const agent of spec?.agents ?? []) {
      await deleteSecret(telegramAccount(slug, agent.slug), 'agent-telegram-token')
    }
    await Promise.all([
      deleteTeam(slug),
      deleteTeamDeployment(slug),
    ])
    return { ok: true }
  })

  ipcMain.handle('teams:getAgentTelegramTokenMasked', async (_e, data: { teamSlug: string; agentSlug: string }) => {
    const token = await getSecret(telegramAccount(data.teamSlug, data.agentSlug), 'agent-telegram-token')
    if (!token) return null
    return token.length > 10 ? `${token.slice(0, 4)}••••${token.slice(-4)}` : '••••••••'
  })

  ipcMain.handle('teams:setAgentTelegramToken', async (_e, data: { teamSlug: string; agentSlug: string; token?: string }) => {
    const token = data.token?.trim()
    if (!token) {
      await deleteSecret(telegramAccount(data.teamSlug, data.agentSlug), 'agent-telegram-token')
      return { ok: true, cleared: true }
    }
    await setSecret(telegramAccount(data.teamSlug, data.agentSlug), 'agent-telegram-token', token)
    const team = await getTeam(data.teamSlug)
    if (team) {
      const agentIndex = team.agents.findIndex(a => a.slug === data.agentSlug)
      if (agentIndex >= 0) {
        syncBotProfilePhoto(token, data.agentSlug, agentIndex).catch(e =>
          console.warn(`[telegram] avatar sync failed for ${data.agentSlug}:`, e)
        )
      }
    }
    return { ok: true, cleared: false }
  })

  ipcMain.handle('teams:getTeamEmailPasswordMasked', async (_e, data: { teamSlug: string }) => {
    const password = await getSecret(`team:${data.teamSlug}`, 'team-email-password')
    if (!password) return null
    return password.length > 10 ? `${password.slice(0, 4)}••••${password.slice(-4)}` : '••••••••'
  })

  ipcMain.handle('teams:setTeamEmailPassword', async (_e, data: { teamSlug: string; password?: string }) => {
    const password = data.password?.trim()
    if (!password) {
      await deleteSecret(`team:${data.teamSlug}`, 'team-email-password')
      return { ok: true, cleared: true }
    }
    await setSecret(`team:${data.teamSlug}`, 'team-email-password', password)
    return { ok: true, cleared: false }
  })

  ipcMain.handle('teams:syncAgentTelegramAvatar', async (_e, data: { teamSlug: string; agentSlug: string }) => {
    const team = await getTeam(data.teamSlug)
    if (!team) throw new Error(`Team ${data.teamSlug} not found`)
    const agentIndex = team.agents.findIndex(a => a.slug === data.agentSlug)
    if (agentIndex < 0) throw new Error(`Agent ${data.agentSlug} not found`)
    const token = await getSecret(telegramAccount(data.teamSlug, data.agentSlug), 'agent-telegram-token')
    if (!token) throw new Error('No Telegram token saved for this agent')
    await syncBotProfilePhoto(token, data.agentSlug, agentIndex)
    return { ok: true }
  })

  ipcMain.handle('teams:derive', async (_e, slug: string) => {
    try { await runPipeline(slug); return { ok: true } }
    catch (e) { return { ok: false, reason: e instanceof Error ? e.message : String(e) } }
  })
}
