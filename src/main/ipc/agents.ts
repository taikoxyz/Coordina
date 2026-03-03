import { ipcMain, app } from 'electron'
import path from 'path'
import { openDb } from '../db'
import { commitSpecFiles } from '../github/repo'
import { generateAgentFiles, generateAgentsMd, type AgentSpec } from '../github/spec'
import { getSecret } from '../keychain'

function getDb() {
  return openDb(path.join(app.getPath('userData'), 'coordina.db'))
}

async function autoCommitTeamSpec(teamSlug: string) {
  const db = getDb()
  const team = db.prepare('SELECT github_repo FROM teams WHERE slug = ?').get(teamSlug) as any
  if (!team?.github_repo) return

  const agents = db.prepare('SELECT * FROM agents WHERE team_slug = ?').all(teamSlug) as any[]
  const files: { path: string; content: string }[] = []

  for (const a of agents) {
    const skills = JSON.parse(a.skills || '[]')
    const providerId = a.provider_id
    let modelConfig = { provider: 'anthropic', model: a.model || 'claude-sonnet-4-6' }

    if (providerId) {
      const provider = db.prepare('SELECT type, config FROM providers WHERE id = ?').get(providerId) as any
      if (provider) {
        const apiKey = await getSecret(providerId, 'provider-api-key')
        const providerConfig = JSON.parse(provider.config)
        modelConfig = { ...providerConfig, provider: provider.type, model: a.model || providerConfig.model || 'claude-sonnet-4-6', ...(apiKey ? { apiKey } : {}) }
      }
    }

    const agentSpec: AgentSpec = {
      slug: a.slug, name: a.name, role: a.role,
      email: a.email, slackHandle: a.slack_handle, githubId: a.github_id,
      skills, soul: { userInput: a.soul || '' },
      modelConfig,
    }

    const agentFiles = generateAgentFiles(agentSpec)
    for (const [filename, content] of Object.entries(agentFiles)) {
      files.push({ path: `agents/${a.slug}/${filename}`, content })
    }
  }

  files.push({
    path: 'AGENTS.md',
    content: generateAgentsMd(agents.map(a => ({ slug: a.slug, name: a.name, role: a.role, isLead: !!a.is_lead }))),
  })

  await commitSpecFiles(team.github_repo, files, `chore: update team spec for ${teamSlug}`)
}

export interface AgentRecord {
  slug: string
  teamSlug: string
  name: string
  role: string
  email?: string
  slackHandle?: string
  githubId?: string
  skills: string[]
  soul: string
  providerId?: string
  model?: string
  image?: string
  isLead: boolean
}

export function registerAgentHandlers() {
  ipcMain.handle('agents:list', (_event, teamSlug: string) => {
    const db = getDb()
    const rows = db.prepare('SELECT * FROM agents WHERE team_slug = ?').all(teamSlug) as any[]
    return rows.map(r => ({
      slug: r.slug, teamSlug: r.team_slug, name: r.name, role: r.role,
      email: r.email, slackHandle: r.slack_handle, githubId: r.github_id,
      skills: JSON.parse(r.skills || '[]'), soul: r.soul || '',
      providerId: r.provider_id, model: r.model, image: r.image ?? undefined, isLead: !!r.is_lead,
    }))
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
