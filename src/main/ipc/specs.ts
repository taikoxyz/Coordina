import { ipcMain } from 'electron'
import { getDb } from '../db'
import { generateTeamSpecs, generateDeploySpecs, hashSpecs, mapAgentRow, mapTeamRow, buildProvidersMap } from '../specs'
import type { SpecFile } from '../specs'
import type { GkeDeployConfig } from '../environments/gke/deploy'

export function registerSpecsHandlers() {
  ipcMain.handle('specs:getTeamSpecs', async (_e, teamSlug: string): Promise<SpecFile[]> => {
    const db = getDb()
    const teamRow = db.prepare('SELECT slug, name, github_repo, lead_agent_slug, config, domain, image, deployed_spec_hash FROM teams WHERE slug = ?').get(teamSlug) as Record<string, unknown> | undefined
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
    const providers = await buildProvidersMap(db)

    return generateDeploySpecs(team, agents, envConfig, providers)
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
