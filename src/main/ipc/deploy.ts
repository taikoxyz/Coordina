import { ipcMain } from 'electron'
import { v4 as uuidv4 } from 'uuid'
import { app } from 'electron'
import path from 'path'
import { openDb } from '../db'
import { isSpecDirty } from '../github/repo'
import { deployTeam, undeployTeam, getTeamStatus } from '../environments/gke/deploy'
import type { GkeDeployConfig } from '../environments/gke/deploy'

function getDb() {
  return openDb(path.join(app.getPath('userData'), 'coordina.db'))
}

export function registerDeployHandlers() {
  ipcMain.handle('environments:list', () => {
    const db = getDb()
    const rows = db.prepare('SELECT id, type, name, config FROM environments').all() as any[]
    return rows.map(r => ({ id: r.id, type: r.type, name: r.name, config: JSON.parse(r.config) }))
  })

  ipcMain.handle('environments:create', (_event, data: { type: string; name: string; config: Record<string, unknown> }) => {
    const db = getDb()
    const id = uuidv4()
    db.prepare('INSERT INTO environments (id, type, name, config) VALUES (?, ?, ?, ?)').run(
      id, data.type, data.name, JSON.stringify(data.config)
    )
    return { ok: true, id }
  })

  ipcMain.handle('environments:delete', (_event, id: string) => {
    const db = getDb()
    db.prepare('DELETE FROM environments WHERE id = ?').run(id)
    return { ok: true }
  })

  ipcMain.handle('deploy:team', async (_event, { teamSlug, envId }: { teamSlug: string; envId: string }) => {
    const db = getDb()
    const team = db.prepare('SELECT * FROM teams WHERE slug = ?').get(teamSlug) as any
    if (!team) return { ok: false, reason: 'Team not found' }

    const env = db.prepare('SELECT * FROM environments WHERE id = ?').get(envId) as any
    if (!env) return { ok: false, reason: 'Environment not found' }

    // Deploy gate: spec must be committed before deploying
    if (team.github_repo) {
      const agents = db.prepare('SELECT * FROM agents WHERE team_slug = ?').all(teamSlug) as any[]
      const specFiles = agents.flatMap(a => [
        { path: `agents/${a.slug}/IDENTITY.md`, content: `# ${a.name}\n` },
        { path: `agents/${a.slug}/SOUL.md`, content: a.soul || '' },
      ])
      const dirty = await isSpecDirty(team.github_repo, specFiles)
      if (dirty) return { ok: false, reason: 'Team has uncommitted changes. Please commit your spec to GitHub before deploying.' }
    }

    const agents = db.prepare('SELECT slug FROM agents WHERE team_slug = ?').all(teamSlug) as any[]
    const envConfig = JSON.parse(env.config) as GkeDeployConfig
    const result = await deployTeam(teamSlug, agents.map(a => ({ slug: a.slug })), { ...envConfig, envId })
    if (result.ok && result.gatewayUrl) {
      db.prepare('UPDATE teams SET gateway_url = ?, deployed_env_id = ? WHERE slug = ?').run(result.gatewayUrl, envId, teamSlug)
    }
    return result
  })

  ipcMain.handle('undeploy:team', async (_event, { teamSlug, envId }: { teamSlug: string; envId: string }) => {
    const db = getDb()
    const env = db.prepare('SELECT * FROM environments WHERE id = ?').get(envId) as any
    if (!env) return { ok: false, reason: 'Environment not found' }

    const envConfig = JSON.parse(env.config) as GkeDeployConfig
    await undeployTeam(teamSlug, { ...envConfig, envId })
    db.prepare('UPDATE teams SET gateway_url = NULL, deployed_env_id = NULL WHERE slug = ?').run(teamSlug)
    return { ok: true }
  })

  ipcMain.handle('deploy:getStatus', async (_event, { teamSlug, envId }: { teamSlug: string; envId: string }) => {
    const db = getDb()
    const env = db.prepare('SELECT * FROM environments WHERE id = ?').get(envId) as any
    if (!env) return []

    const agents = db.prepare('SELECT slug FROM agents WHERE team_slug = ?').all(teamSlug) as any[]
    const envConfig = JSON.parse(env.config) as GkeDeployConfig
    return getTeamStatus(teamSlug, agents.map(a => a.slug), { ...envConfig, envId })
  })
}
