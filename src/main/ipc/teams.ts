import { ipcMain } from 'electron'
import { app } from 'electron'
import path from 'path'
import { openDb } from '../db'
import { createRepo, isSpecDirty, getAuthenticatedUser } from '../github/repo'
import { generateAgentsMd, generateIdentityMd, generateSoulMd, generateSkillsMd } from '../github/spec'
import type { TeamRecord } from '../../shared/types'

export type { TeamRecord }

function getDb() {
  return openDb(path.join(app.getPath('userData'), 'coordina.db'))
}

export function registerTeamHandlers() {
  ipcMain.handle('teams:list', () => {
    const db = getDb()
    const rows = db.prepare('SELECT slug, name, github_repo, lead_agent_slug, config, gateway_url, deployed_env_id, domain, image, bootstrap_instructions FROM teams').all() as any[]
    return rows.map(r => ({ slug: r.slug, name: r.name, githubRepo: r.github_repo, leadAgentSlug: r.lead_agent_slug, config: JSON.parse(r.config), gatewayUrl: r.gateway_url ?? undefined, deployedEnvId: r.deployed_env_id ?? undefined, domain: r.domain ?? undefined, image: r.image ?? undefined, bootstrapInstructions: r.bootstrap_instructions ?? undefined }))
  })

  ipcMain.handle('teams:create', async (_event, data: { slug: string; name: string; domain?: string; image?: string; bootstrapInstructions?: string; createRepo?: boolean }) => {
    try {
      const db = getDb()
      const existing = db.prepare('SELECT slug FROM teams WHERE slug = ?').get(data.slug)
      if (existing) return { ok: false, errors: ['Team slug already exists'] }

      let githubRepo: string | undefined
      if (data.createRepo) {
        const user = await getAuthenticatedUser()
        githubRepo = await createRepo(user, `coordina-team-${data.slug}`)
      }

      db.prepare('INSERT INTO teams (slug, name, github_repo, domain, image, bootstrap_instructions, config) VALUES (?, ?, ?, ?, ?, ?, ?)').run(
        data.slug, data.name, githubRepo ?? null, data.domain ?? null, data.image ?? null, data.bootstrapInstructions ?? null, '{}'
      )
      return { ok: true, slug: data.slug, githubRepo }
    } catch (e) {
      return { ok: false, errors: [(e as Error).message ?? 'Failed to create team'] }
    }
  })

  ipcMain.handle('teams:update', (_event, slug: string, data: { name?: string; leadAgentSlug?: string; image?: string; bootstrapInstructions?: string }) => {
    const db = getDb()
    if (data.name) db.prepare('UPDATE teams SET name = ? WHERE slug = ?').run(data.name, slug)
    if (data.leadAgentSlug !== undefined) db.prepare('UPDATE teams SET lead_agent_slug = ? WHERE slug = ?').run(data.leadAgentSlug, slug)
    if (data.image !== undefined) db.prepare('UPDATE teams SET image = ? WHERE slug = ?').run(data.image || null, slug)
    if (data.bootstrapInstructions !== undefined) db.prepare('UPDATE teams SET bootstrap_instructions = ? WHERE slug = ?').run(data.bootstrapInstructions || null, slug)
    return { ok: true }
  })

  ipcMain.handle('teams:delete', (_event, slug: string) => {
    const db = getDb()
    db.prepare('DELETE FROM teams WHERE slug = ?').run(slug)
    return { ok: true }
  })

  ipcMain.handle('teams:get', (_event, slug: string) => {
    const db = getDb()
    const row = db.prepare('SELECT slug, name, github_repo, lead_agent_slug, config, gateway_url, deployed_env_id, domain, image, bootstrap_instructions FROM teams WHERE slug = ?').get(slug) as any
    if (!row) return null
    return { slug: row.slug, name: row.name, githubRepo: row.github_repo, leadAgentSlug: row.lead_agent_slug, config: JSON.parse(row.config), gatewayUrl: row.gateway_url ?? undefined, deployedEnvId: row.deployed_env_id ?? undefined, domain: row.domain ?? undefined, image: row.image ?? undefined, bootstrapInstructions: row.bootstrap_instructions ?? undefined }
  })

  ipcMain.handle('teams:isSpecDirty', async (_event, teamSlug: string) => {
    const db = getDb()
    const team = db.prepare('SELECT github_repo FROM teams WHERE slug = ?').get(teamSlug) as any
    if (!team?.github_repo) return false

    const agents = db.prepare('SELECT * FROM agents WHERE team_slug = ?').all(teamSlug) as any[]
    const files: { path: string; content: string }[] = []
    for (const a of agents) {
      const skills = JSON.parse(a.skills || '[]')
      files.push({ path: `agents/${a.slug}/IDENTITY.md`, content: generateIdentityMd({ name: a.name, slug: a.slug, role: a.role, email: a.email, slackHandle: a.slack_handle, githubId: a.github_id }) })
      files.push({ path: `agents/${a.slug}/SOUL.md`, content: generateSoulMd({ userInput: a.soul || '' }) })
      files.push({ path: `agents/${a.slug}/SKILLS.md`, content: generateSkillsMd(skills) })
    }
    files.push({
      path: 'AGENTS.md',
      content: generateAgentsMd(agents.map(a => ({ slug: a.slug, name: a.name, role: a.role, isLead: !!a.is_lead }))),
    })
    return isSpecDirty(team.github_repo, files)
  })
}
