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

async function readDirRecursive(dir: string, base = ''): Promise<{ path: string; content: string }[]> {
  let entries
  try { entries = await fs.readdir(dir, { withFileTypes: true }) } catch { return [] }
  const results: { path: string; content: string }[] = []
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const rel = base ? `${base}/${entry.name}` : entry.name
    if (entry.isDirectory()) {
      results.push(...await readDirRecursive(path.join(dir, entry.name), rel))
    } else {
      const content = await fs.readFile(path.join(dir, entry.name), 'utf-8')
      results.push({ path: rel, content })
    }
  }
  return results
}

export function registerTeamHandlers(): void {
  ipcMain.handle('teams:list', () => listTeams())

  ipcMain.handle('teams:get', (_e, slug: string) => getTeam(slug))

  ipcMain.handle('teams:save', async (_e, spec: TeamSpec) => {
    await saveTeam(spec)
    return { ok: true }
  })

  ipcMain.handle('teams:delete', async (_e, slug: string) => {
    await Promise.all([
      deleteTeam(slug),
      deleteTeamDeployment(slug),
    ])
    return { ok: true }
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
