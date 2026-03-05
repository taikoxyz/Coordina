// IPC handlers for team spec CRUD replacing SQLite with file-based storage
// FEATURE: Team management IPC layer using ~/.coordina/teams/{slug}.json files
import { ipcMain } from 'electron'
import fs from 'fs/promises'
import path from 'path'
import os from 'os'
import { listTeams, getTeam, saveTeam, deleteTeam } from '../store/teams'
import { deleteTeamDeployment } from '../store/deployments'
import { runPipeline } from '../watcher'
import type { TeamSpec } from '../../shared/types'
import { getSecret, setSecret, deleteSecret } from '../keychain'
import { normalizeTeamSpec, validateTelegramPair } from '../validation/teamSpecNormalize'

function isSkippableFsError(error: unknown): boolean {
  const code = (error as NodeJS.ErrnoException | undefined)?.code
  return code === 'ENOENT' || code === 'ENOTDIR' || code === 'EISDIR'
}

async function readDirRecursive(dir: string, base = ''): Promise<{ path: string; content: string }[]> {
  let entries
  try { entries = await fs.readdir(dir, { withFileTypes: true }) } catch { return [] }
  const results: { path: string; content: string }[] = []
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const rel = base ? `${base}/${entry.name}` : entry.name
    if (entry.isDirectory()) {
      try {
        results.push(...await readDirRecursive(path.join(dir, entry.name), rel))
      } catch (error) {
        if (isSkippableFsError(error)) continue
        throw error
      }
    } else {
      try {
        const content = await fs.readFile(path.join(dir, entry.name), 'utf-8')
        results.push({ path: rel, content })
      } catch (error) {
        if (isSkippableFsError(error)) continue
        throw error
      }
    }
  }
  return results
}

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
    return { ok: true, cleared: false }
  })

  ipcMain.handle('teams:getDeployFiles', async (_e, { teamSlug, envType }: { teamSlug: string; envType: string }) => {
    const deployDir = path.join(os.homedir(), '.coordina', 'teams', teamSlug, '.deploy', envType)
    return readDirRecursive(deployDir)
  })

  ipcMain.handle('teams:derive', async (_e, slug: string) => {
    try { await runPipeline(slug); return { ok: true } }
    catch (e) { return { ok: false, reason: e instanceof Error ? e.message : String(e) } }
  })
}
