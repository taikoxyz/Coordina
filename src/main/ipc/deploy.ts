import { ipcMain } from 'electron'
import { v4 as uuidv4 } from 'uuid'
import { app } from 'electron'
import path from 'path'
import { openDb } from '../db'
import { getSecret } from '../keychain'
import { deployTeam, undeployTeam, getTeamStatus } from '../environments/gke/deploy'
import type { GkeDeployConfig } from '../environments/gke/deploy'
import { generateTeamSpecs, hashSpecs } from '../specs'
import type { ProviderRecord } from './providers'

function getDb() {
  return openDb(path.join(app.getPath('userData'), 'coordina.db'))
}

async function buildProvidersMap(db: ReturnType<typeof getDb>): Promise<Map<string, ProviderRecord>> {
  const providerRows = db.prepare('SELECT id, type, name, config FROM providers').all() as Record<string, unknown>[]
  const map = new Map<string, ProviderRecord>()
  for (const row of providerRows) {
    const id = row.id as string
    const apiKey = await getSecret(id, 'provider-api-key')
    const config = JSON.parse((row.config as string) || '{}') as Record<string, unknown>
    map.set(id, {
      id,
      type: row.type as string,
      name: row.name as string,
      config: apiKey ? { ...config, apiKey } : config,
    })
  }
  return map
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
    const team = db.prepare('SELECT * FROM teams WHERE slug = ?').get(teamSlug) as any
    if (!team) return { ok: false, reason: 'Team not found' }

    const env = db.prepare('SELECT * FROM environments WHERE id = ?').get(envId) as any
    if (!env) return { ok: false, reason: 'Environment not found' }

    const agents = db.prepare('SELECT slug, image FROM agents WHERE team_slug = ?').all(teamSlug) as any[]
    const teamImage = team.image as string | null
    const missing = agents.filter((a: any) => !a.image && !teamImage).map((a: any) => a.slug)
    if (missing.length > 0) {
      return { ok: false, reason: `Container image not set for: ${missing.join(', ')}. Edit each agent or set a default team image before deploying.` }
    }

    const envConfig = JSON.parse(env.config) as GkeDeployConfig
    let result: { ok: boolean; gatewayUrl?: string; reason?: string }
    try {
      result = await deployTeam(
        teamSlug,
        agents.map(a => ({ slug: a.slug, image: a.image ?? teamImage ?? undefined })),
        { ...envConfig, envId },
        team.domain || ''
      )
    } catch (e) {
      const msg = (e instanceof Error ? e.message : String(e)).trim()
      return { ok: false, reason: msg || 'Deploy failed' }
    }

    if (result.ok) {
      if (result.gatewayUrl) {
        db.prepare('UPDATE teams SET gateway_url = ?, deployed_env_id = ? WHERE slug = ?').run(result.gatewayUrl, envId, teamSlug)
      }

      const teamForHash = db.prepare('SELECT * FROM teams WHERE slug = ?').get(teamSlug) as Record<string, unknown>
      const agentRowsForHash = db.prepare('SELECT * FROM agents WHERE team_slug = ?').all(teamSlug) as Record<string, unknown>[]
      const providersMap = await buildProvidersMap(db)

      const teamRecord = {
        slug: teamForHash.slug as string,
        name: teamForHash.name as string,
        githubRepo: teamForHash.github_repo as string | undefined,
        leadAgentSlug: teamForHash.lead_agent_slug as string | undefined,
        config: JSON.parse((teamForHash.config as string) || '{}') as Record<string, unknown>,
        domain: teamForHash.domain as string | undefined,
        image: teamForHash.image as string | undefined,
        deployedSpecHash: teamForHash.deployed_spec_hash as string | undefined,
      }
      const agentRecords = agentRowsForHash.map(r => ({
        slug: r.slug as string,
        teamSlug: r.team_slug as string,
        name: r.name as string,
        role: r.role as string,
        email: r.email as string | undefined,
        slackHandle: r.slack_handle as string | undefined,
        githubId: r.github_id as string | undefined,
        skills: JSON.parse((r.skills as string) || '[]') as string[],
        soul: (r.soul as string) || '',
        providerId: r.provider_id as string | undefined,
        model: r.model as string | undefined,
        image: r.image as string | undefined,
        isLead: !!(r.is_lead as number),
      }))

      const currentHash = hashSpecs(generateTeamSpecs(teamRecord, agentRecords, providersMap))
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
