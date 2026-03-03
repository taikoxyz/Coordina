import { describe, it, expect, vi, beforeEach } from 'vitest'
import Database from 'better-sqlite3'

vi.mock('electron', () => ({
  ipcMain: { handle: vi.fn() },
  app: { getPath: vi.fn(() => ':memory:') },
}))

vi.mock('../github/repo', () => ({
  commitSpecFiles: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('../keychain', () => ({
  getSecret: vi.fn().mockResolvedValue(null),
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
  CREATE TABLE IF NOT EXISTS providers (
    id TEXT PRIMARY KEY, type TEXT NOT NULL, name TEXT NOT NULL, config TEXT NOT NULL
  );
`)

testDb.prepare("INSERT INTO teams (slug, name, config) VALUES ('eng-alpha', 'Eng Alpha', '{}')").run()

vi.mock('../db', () => ({ openDb: vi.fn(() => testDb) }))

import { openDb } from '../db'

async function createAgent(data: {
  teamSlug: string; slug: string; name: string; role: string;
  skills?: string[]; soul?: string; isLead?: boolean
}) {
  const db = openDb(':memory:')
  db.prepare(`
    INSERT INTO agents (slug, team_slug, name, role, skills, soul, is_lead)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    data.slug, data.teamSlug, data.name, data.role,
    JSON.stringify(data.skills ?? []), data.soul ?? '',
    data.isLead ? 1 : 0
  )
  return { ok: true }
}

function listAgents(teamSlug: string) {
  const db = openDb(':memory:')
  const rows = db.prepare('SELECT * FROM agents WHERE team_slug = ?').all(teamSlug) as any[]
  return rows.map(r => ({
    slug: r.slug, teamSlug: r.team_slug, name: r.name, role: r.role,
    skills: JSON.parse(r.skills || '[]'), soul: r.soul, isLead: !!r.is_lead,
  }))
}

async function deleteAgent(slug: string, teamSlug: string) {
  const db = openDb(':memory:')
  db.prepare('DELETE FROM agents WHERE slug = ? AND team_slug = ?').run(slug, teamSlug)
  return { ok: true }
}

describe('agents IPC logic', () => {
  beforeEach(() => {
    testDb.prepare('DELETE FROM agents').run()
    vi.clearAllMocks()
  })

  it('creates an agent and stores it in DB', async () => {
    const result = await createAgent({ teamSlug: 'eng-alpha', slug: 'alice', name: 'Alice Chen', role: 'Engineer' })
    expect(result.ok).toBe(true)
    const agents = listAgents('eng-alpha')
    expect(agents[0].name).toBe('Alice Chen')
  })

  it('stores skills as JSON array', async () => {
    await createAgent({ teamSlug: 'eng-alpha', slug: 'bob', name: 'Bob', role: 'PM', skills: ['planning', 'roadmap'] })
    const agents = listAgents('eng-alpha')
    expect(agents[0].skills).toEqual(['planning', 'roadmap'])
  })

  it('lists all agents for a team', async () => {
    await createAgent({ teamSlug: 'eng-alpha', slug: 'alice', name: 'Alice', role: 'Engineer' })
    await createAgent({ teamSlug: 'eng-alpha', slug: 'bob', name: 'Bob', role: 'PM' })
    const agents = listAgents('eng-alpha')
    expect(agents.length).toBe(2)
  })

  it('deletes agent from DB', async () => {
    await createAgent({ teamSlug: 'eng-alpha', slug: 'alice', name: 'Alice', role: 'Engineer' })
    await deleteAgent('alice', 'eng-alpha')
    const agents = listAgents('eng-alpha')
    expect(agents.length).toBe(0)
  })
})
