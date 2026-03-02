import { ipcMain } from 'electron'
import { v4 as uuidv4 } from 'uuid'
import { app } from 'electron'
import path from 'path'
import { openDb } from '../db'
import { createRepo, commitSpecFiles, isSpecDirty, getAuthenticatedUser } from '../github/repo'
import { generateAgentsMd } from '../github/spec'

function getDb() {
  return openDb(path.join(app.getPath('userData'), 'coordina.db'))
}

export interface TeamRecord {
  slug: string
  name: string
  githubRepo?: string
  leadAgentSlug?: string
  config: Record<string, unknown>
}

export function registerTeamHandlers() {
  ipcMain.handle('teams:list', () => {
    const db = getDb()
    const rows = db.prepare('SELECT slug, name, github_repo, lead_agent_slug, config FROM teams').all() as any[]
    return rows.map(r => ({ slug: r.slug, name: r.name, githubRepo: r.github_repo, leadAgentSlug: r.lead_agent_slug, config: JSON.parse(r.config) }))
  })

  ipcMain.handle('teams:create', async (_event, data: { slug: string; name: string; createRepo?: boolean }) => {
    const db = getDb()
    const existing = db.prepare('SELECT slug FROM teams WHERE slug = ?').get(data.slug)
    if (existing) return { ok: false, errors: ['Team slug already exists'] }

    let githubRepo: string | undefined
    if (data.createRepo) {
      const user = await getAuthenticatedUser()
      githubRepo = await createRepo(user, data.slug)
    }

    db.prepare('INSERT INTO teams (slug, name, github_repo, config) VALUES (?, ?, ?, ?)').run(
      data.slug, data.name, githubRepo ?? null, '{}'
    )
    return { ok: true, slug: data.slug, githubRepo }
  })

  ipcMain.handle('teams:update', (_event, slug: string, data: { name?: string; leadAgentSlug?: string }) => {
    const db = getDb()
    if (data.name) db.prepare('UPDATE teams SET name = ? WHERE slug = ?').run(data.name, slug)
    if (data.leadAgentSlug !== undefined) db.prepare('UPDATE teams SET lead_agent_slug = ? WHERE slug = ?').run(data.leadAgentSlug, slug)
    return { ok: true }
  })

  ipcMain.handle('teams:delete', (_event, slug: string) => {
    const db = getDb()
    db.prepare('DELETE FROM teams WHERE slug = ?').run(slug)
    return { ok: true }
  })

  ipcMain.handle('teams:get', (_event, slug: string) => {
    const db = getDb()
    const row = db.prepare('SELECT slug, name, github_repo, lead_agent_slug, config FROM teams WHERE slug = ?').get(slug) as any
    if (!row) return null
    return { slug: row.slug, name: row.name, githubRepo: row.github_repo, leadAgentSlug: row.lead_agent_slug, config: JSON.parse(row.config) }
  })

  ipcMain.handle('teams:isSpecDirty', async (_event, teamSlug: string) => {
    const db = getDb()
    const team = db.prepare('SELECT github_repo FROM teams WHERE slug = ?').get(teamSlug) as any
    if (!team?.github_repo) return false

    const agents = db.prepare('SELECT * FROM agents WHERE team_slug = ?').all(teamSlug) as any[]
    const files = agents.flatMap(a => [
      { path: `agents/${a.slug}/IDENTITY.md`, content: `# ${a.name}\n\n**Role:** ${a.role}\n` },
    ])
    files.push({
      path: 'AGENTS.md',
      content: generateAgentsMd(agents.map(a => ({ slug: a.slug, name: a.name, role: a.role, isLead: !!a.is_lead }))),
    })

    return isSpecDirty(team.github_repo, files)
  })
}
