import { ipcMain } from 'electron'
import { getDb } from '../db'
import { commitSpecFiles } from '../github/repo'
import { generateTeamSpecs, mapAgentRow, mapTeamRow, buildProvidersMap } from '../specs'
import type { AgentRecord } from '../../shared/types'

export type { AgentRecord }

async function autoCommitTeamSpec(teamSlug: string) {
  const db = getDb()
  const teamRow = db.prepare('SELECT slug, name, github_repo, lead_agent_slug, config, domain, image, deployed_spec_hash FROM teams WHERE slug = ?').get(teamSlug) as Record<string, unknown> | undefined
  if (!teamRow?.github_repo) return

  const team = mapTeamRow(teamRow)
  const agentRows = db.prepare('SELECT * FROM agents WHERE team_slug = ?').all(teamSlug) as Record<string, unknown>[]
  const agents = agentRows.map(mapAgentRow)
  const providers = await buildProvidersMap(db)
  const files = generateTeamSpecs(team, agents, providers)

  await commitSpecFiles(teamRow.github_repo as string, files, `chore: update team spec for ${teamSlug}`)
}

export function registerAgentHandlers() {
  ipcMain.handle('agents:list', (_event, teamSlug: string) => {
    const db = getDb()
    const rows = db.prepare('SELECT * FROM agents WHERE team_slug = ?').all(teamSlug) as Record<string, unknown>[]
    return rows.map(mapAgentRow)
  })

  ipcMain.handle('agents:create', async (_event, data: {
    teamSlug: string; slug: string; name: string; role: string;
    email?: string; slackHandle?: string; githubId?: string;
    skills?: string[]; soul?: string; providerId?: string; model?: string; image?: string; isLead?: boolean
  }) => {
    const db = getDb()
    db.prepare(`
      INSERT INTO agents (slug, team_slug, name, role, email, slack_handle, github_id, skills, soul, provider_id, model, image, is_lead)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      data.slug, data.teamSlug, data.name, data.role,
      data.email ?? null, data.slackHandle ?? null, data.githubId ?? null,
      JSON.stringify(data.skills ?? []), data.soul ?? '',
      data.providerId ?? null, data.model ?? null, data.image ?? null, data.isLead ? 1 : 0
    )

    if (data.isLead) {
      db.prepare('UPDATE agents SET is_lead = 0 WHERE team_slug = ?').run(data.teamSlug)
      db.prepare('UPDATE agents SET is_lead = 1 WHERE slug = ? AND team_slug = ?').run(data.slug, data.teamSlug)
      db.prepare('UPDATE teams SET lead_agent_slug = ? WHERE slug = ?').run(data.slug, data.teamSlug)
    }

    await autoCommitTeamSpec(data.teamSlug)
    return { ok: true }
  })

  ipcMain.handle('agents:update', async (_event, slug: string, teamSlug: string, data: Partial<{
    name: string; role: string; email: string; slackHandle: string; githubId: string;
    skills: string[]; soul: string; providerId: string; model: string; image: string; isLead: boolean
  }>) => {
    const db = getDb()
    const fields: string[] = []
    const values: unknown[] = []

    if (data.name !== undefined) { fields.push('name = ?'); values.push(data.name) }
    if (data.role !== undefined) { fields.push('role = ?'); values.push(data.role) }
    if (data.email !== undefined) { fields.push('email = ?'); values.push(data.email) }
    if (data.slackHandle !== undefined) { fields.push('slack_handle = ?'); values.push(data.slackHandle) }
    if (data.githubId !== undefined) { fields.push('github_id = ?'); values.push(data.githubId) }
    if (data.skills !== undefined) { fields.push('skills = ?'); values.push(JSON.stringify(data.skills)) }
    if (data.soul !== undefined) { fields.push('soul = ?'); values.push(data.soul) }
    if (data.providerId !== undefined) { fields.push('provider_id = ?'); values.push(data.providerId) }
    if (data.model !== undefined) { fields.push('model = ?'); values.push(data.model) }
    if (data.image !== undefined) { fields.push('image = ?'); values.push(data.image || null) }
    if (data.isLead !== undefined) {
      if (data.isLead) db.prepare('UPDATE agents SET is_lead = 0 WHERE team_slug = ?').run(teamSlug)
      fields.push('is_lead = ?'); values.push(data.isLead ? 1 : 0)
    }

    if (fields.length > 0) {
      values.push(slug, teamSlug)
      db.prepare(`UPDATE agents SET ${fields.join(', ')} WHERE slug = ? AND team_slug = ?`).run(...values)
    }

    await autoCommitTeamSpec(teamSlug)
    return { ok: true }
  })

  ipcMain.handle('agents:delete', async (_event, slug: string, teamSlug: string) => {
    const db = getDb()
    db.prepare('DELETE FROM agents WHERE slug = ? AND team_slug = ?').run(slug, teamSlug)
    await autoCommitTeamSpec(teamSlug)
    return { ok: true }
  })
}
