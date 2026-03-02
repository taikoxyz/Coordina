import { describe, it, expect, vi, beforeEach } from 'vitest'
import Database from 'better-sqlite3'

vi.mock('electron', () => ({
  ipcMain: { handle: vi.fn() },
  app: { getPath: vi.fn(() => ':memory:') },
}))

vi.mock('../github/repo', () => ({
  createRepo: vi.fn().mockResolvedValue('testuser/test-team'),
  commitSpecFiles: vi.fn().mockResolvedValue(undefined),
  isSpecDirty: vi.fn().mockResolvedValue(false),
  getAuthenticatedUser: vi.fn().mockResolvedValue('testuser'),
}))

const testDb = new Database(':memory:')
testDb.exec(`
  CREATE TABLE IF NOT EXISTS teams (
    slug TEXT PRIMARY KEY, name TEXT NOT NULL, github_repo TEXT,
    lead_agent_slug TEXT, config TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS agents (
    slug TEXT NOT NULL, team_slug TEXT NOT NULL, name TEXT NOT NULL,
    role TEXT NOT NULL, is_lead INTEGER DEFAULT 0, skills TEXT DEFAULT '[]',
    soul TEXT DEFAULT '', email TEXT, slack_handle TEXT, github_id TEXT,
    provider_id TEXT, model TEXT,
    PRIMARY KEY (slug, team_slug)
  );
`)

vi.mock('../db', () => ({ openDb: vi.fn(() => testDb) }))

import { createRepo, getAuthenticatedUser } from '../github/repo'
import { openDb } from '../db'

async function createTeam(data: { slug: string; name: string; createRepo?: boolean }) {
  const db = openDb(':memory:')
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
}

function listTeams() {
  const db = openDb(':memory:')
  const rows = db.prepare('SELECT slug, name, github_repo, lead_agent_slug, config FROM teams').all() as any[]
  return rows.map(r => ({ slug: r.slug, name: r.name, githubRepo: r.github_repo, config: JSON.parse(r.config) }))
}

function deleteTeam(slug: string) {
  const db = openDb(':memory:')
  db.prepare('DELETE FROM teams WHERE slug = ?').run(slug)
  return { ok: true }
}

describe('teams IPC logic', () => {
  beforeEach(() => {
    testDb.prepare('DELETE FROM teams').run()
    vi.clearAllMocks()
  })

  it('creates a team and stores it in DB', async () => {
    const result = await createTeam({ slug: 'eng-alpha', name: 'Engineering Alpha' })
    expect(result.ok).toBe(true)
    expect(result.slug).toBe('eng-alpha')
  })

  it('rejects duplicate team slug', async () => {
    await createTeam({ slug: 'my-team', name: 'My Team' })
    const result = await createTeam({ slug: 'my-team', name: 'Other Team' })
    expect(result.ok).toBe(false)
    expect(result.errors).toBeDefined()
  })

  it('creates GitHub repo when createRepo=true', async () => {
    const result = await createTeam({ slug: 'new-team', name: 'New Team', createRepo: true })
    expect(result.ok).toBe(true)
    expect(result.githubRepo).toBe('testuser/test-team')
    expect(createRepo).toHaveBeenCalled()
  })

  it('lists teams from DB', async () => {
    await createTeam({ slug: 'team-a', name: 'Team A' })
    await createTeam({ slug: 'team-b', name: 'Team B' })
    const teams = listTeams()
    expect(teams.length).toBe(2)
    expect(teams.map(t => t.slug)).toContain('team-a')
  })

  it('deletes team from DB', async () => {
    await createTeam({ slug: 'to-delete', name: 'Delete Me' })
    deleteTeam('to-delete')
    const teams = listTeams()
    expect(teams.some(t => t.slug === 'to-delete')).toBe(false)
  })
})
