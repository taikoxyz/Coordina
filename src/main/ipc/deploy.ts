import { ipcMain } from 'electron'
import { v4 as uuidv4 } from 'uuid'
import { app } from 'electron'
import path from 'path'
import { openDb } from '../db'
import { deployTeam, undeployTeam, getTeamStatus } from '../environments/gke/deploy'
import type { GkeDeployConfig } from '../environments/gke/deploy'
import { generateTeamSpecs, hashSpecs, mapAgentRow, mapTeamRow, buildProvidersMap } from '../specs'

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
    db.prepare('UPDATE teams SET gateway_url = NULL, deployed_env_id = NULL WHERE deployed_env_id = ?').run(id)
    db.prepare('DELETE FROM environments WHERE id = ?').run(id)
    return { ok: true }
  })

  ipcMain.handle('deploy:team', async (_event, { teamSlug, envId }: { teamSlug: string; envId: string }) => {
    const db = getDb()
    const teamRow = db.prepare('SELECT * FROM teams WHERE slug = ?').get(teamSlug) as Record<string, unknown> | undefined
    if (!teamRow) return { ok: false, reason: 'Team not found' }

    const env = db.prepare('SELECT * FROM environments WHERE id = ?').get(envId) as any
    if (!env) return { ok: false, reason: 'Environment not found' }

    const agentRows = db.prepare('SELECT * FROM agents WHERE team_slug = ?').all(teamSlug) as Record<string, unknown>[]
    const teamImage = teamRow.image as string | null
    const missing = agentRows.filter(a => !a.image && !teamImage).map(a => a.slug as string)
    if (missing.length > 0) {
      return { ok: false, reason: `Container image not set for: ${missing.join(', ')}. Edit each agent or set a default team image before deploying.` }
    }

    const team = mapTeamRow(teamRow)
    const agents = agentRows.map(mapAgentRow)

    const envConfig = JSON.parse(env.config) as GkeDeployConfig
    let result: { ok: boolean; gatewayUrl?: string; reason?: string }
    try {
      result = await deployTeam(
        teamSlug,
        agents.map(a => ({ slug: a.slug, image: a.image ?? teamImage ?? undefined })),
        { ...envConfig, envId },
        team.domain || undefined
      )
    } catch (e) {
      const msg = (e instanceof Error ? e.message : String(e)).trim()
      return { ok: false, reason: msg || 'Deploy failed' }
    }

    if (result.ok) {
      if (result.gatewayUrl) {
        db.prepare('UPDATE teams SET gateway_url = ?, deployed_env_id = ? WHERE slug = ?').run(result.gatewayUrl, envId, teamSlug)
      }

      const providersMap = await buildProvidersMap(db)
      const currentHash = hashSpecs(generateTeamSpecs(team, agents, providersMap))
      db.prepare('UPDATE teams SET deployed_spec_hash = ? WHERE slug = ?').run(currentHash, teamSlug)
    }

    return result
  })

  ipcMain.handle('undeploy:team', async (_event, { teamSlug, envId }: { teamSlug: string; envId: string }) => {
    const db = getDb()
    const env = db.prepare('SELECT * FROM environments WHERE id = ?').get(envId) as any
    if (!env) return { ok: false, reason: 'Environment not found' }

    const envConfig = JSON.parse(env.config) as GkeDeployConfig
    await undeployTeam(teamSlug, { ...envConfig, envId })
    db.prepare('UPDATE teams SET gateway_url = NULL, deployed_env_id = NULL, deployed_spec_hash = NULL WHERE slug = ?').run(teamSlug)
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
