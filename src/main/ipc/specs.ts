// IPC handlers exposing spec generation and dirty detection to the renderer
// FEATURE: Spec generation layer — getTeamSpecs, getDeploySpecs, isDeployDirty

import { ipcMain, app } from 'electron'
import path from 'path'
import { openDb } from '../db'
import { getSecret } from '../keychain'
import { generateTeamSpecs, generateDeploySpecs, hashSpecs } from '../specs'
import type { SpecFile, AgentRecord } from '../specs'
import type { ProviderRecord } from './providers'
import type { GkeDeployConfig } from '../environments/gke/deploy'

function getDb() {
  return openDb(path.join(app.getPath('userData'), 'coordina.db'))
}

function mapAgentRow(r: Record<string, unknown>): AgentRecord {
  return {
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
  }
}

function mapTeamRow(r: Record<string, unknown>) {
  return {
    slug: r.slug as string,
    name: r.name as string,
    githubRepo: r.github_repo as string | undefined,
    leadAgentSlug: r.lead_agent_slug as string | undefined,
    config: JSON.parse((r.config as string) || '{}') as Record<string, unknown>,
    domain: r.domain as string | undefined,
    image: r.image as string | undefined,
    deployedSpecHash: r.deployed_spec_hash as string | undefined,
  }
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

export function registerSpecsHandlers() {
  ipcMain.handle('specs:getTeamSpecs', async (_e, teamSlug: string): Promise<SpecFile[]> => {
    const db = getDb()
    const teamRow = db.prepare('SELECT slug, name, github_repo, lead_agent_slug, config, domain, image FROM teams WHERE slug = ?').get(teamSlug) as Record<string, unknown> | undefined
    if (!teamRow) return []

    const agentRows = db.prepare('SELECT * FROM agents WHERE team_slug = ?').all(teamSlug) as Record<string, unknown>[]
    const team = mapTeamRow(teamRow)
    const agents = agentRows.map(mapAgentRow)
    const providers = await buildProvidersMap(db)

    return generateTeamSpecs(team, agents, providers)
  })

  ipcMain.handle('specs:getDeploySpecs', async (_e, teamSlug: string, envId: string): Promise<SpecFile[]> => {
    if (!envId) return []
    const db = getDb()

    const teamRow = db.prepare('SELECT slug, name, github_repo, lead_agent_slug, config, domain, image FROM teams WHERE slug = ?').get(teamSlug) as Record<string, unknown> | undefined
    if (!teamRow) return []

    const agentRows = db.prepare('SELECT * FROM agents WHERE team_slug = ?').all(teamSlug) as Record<string, unknown>[]
    if (agentRows.length === 0) return []

    const envRow = db.prepare('SELECT config FROM environments WHERE id = ?').get(envId) as { config: string } | undefined
    if (!envRow) return []

    const team = mapTeamRow(teamRow)
    const agents = agentRows.map(mapAgentRow)
    const envConfig = JSON.parse(envRow.config) as GkeDeployConfig

    return generateDeploySpecs(team, agents, envConfig)
  })

  ipcMain.handle('specs:isDeployDirty', async (_e, teamSlug: string): Promise<boolean> => {
    const db = getDb()
    const teamRow = db.prepare('SELECT slug, name, github_repo, lead_agent_slug, config, domain, image, deployed_spec_hash FROM teams WHERE slug = ?').get(teamSlug) as Record<string, unknown> | undefined
    if (!teamRow) return true

    const deployedHash = teamRow.deployed_spec_hash as string | null | undefined
    if (!deployedHash) return true

    const agentRows = db.prepare('SELECT * FROM agents WHERE team_slug = ?').all(teamSlug) as Record<string, unknown>[]
    const team = mapTeamRow(teamRow)
    const agents = agentRows.map(mapAgentRow)
    const providers = await buildProvidersMap(db)

    const specs = generateTeamSpecs(team, agents, providers)
    const currentHash = hashSpecs(specs)
    return currentHash !== deployedHash
  })
}
