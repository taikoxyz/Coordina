import { describe, it, expect, vi, beforeEach } from 'vitest'
import Database from 'better-sqlite3'

vi.mock('electron', () => ({
  ipcMain: { handle: vi.fn() },
  app: { getPath: vi.fn(() => ':memory:') },
}))

vi.mock('../github/repo', () => ({
  isSpecDirty: vi.fn().mockResolvedValue(false),
}))

vi.mock('../environments/gke/deploy', () => ({
  deployTeam: vi.fn().mockResolvedValue({ ok: true, gatewayUrl: 'https://eng-alpha.example.com' }),
  undeployTeam: vi.fn().mockResolvedValue(undefined),
  getTeamStatus: vi.fn().mockResolvedValue([{ agentSlug: 'alice', status: 'running' }]),
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
  CREATE TABLE IF NOT EXISTS environments (
    id TEXT PRIMARY KEY, type TEXT NOT NULL, name TEXT NOT NULL,
    config TEXT NOT NULL, used INTEGER DEFAULT 0
  );
`)

vi.mock('../db', () => ({ openDb: vi.fn(() => testDb) }))

import { isSpecDirty } from '../github/repo'
import { deployTeam, undeployTeam } from '../environments/gke/deploy'
import { openDb } from '../db'

// Replicate the handler logic directly for testing (same pattern as teams.test.ts)
async function handleDeploy({ teamSlug, envId }: { teamSlug: string; envId: string }) {
  const db = openDb(':memory:')
  const team = db.prepare('SELECT * FROM teams WHERE slug = ?').get(teamSlug) as any
  if (!team) return { ok: false, reason: 'Team not found' }

  const env = db.prepare('SELECT * FROM environments WHERE id = ?').get(envId) as any
  if (!env) return { ok: false, reason: 'Environment not found' }

  if (team.github_repo) {
    const agents = db.prepare('SELECT * FROM agents WHERE team_slug = ?').all(teamSlug) as any[]
    const specFiles = agents.flatMap((a: any) => [
      { path: `agents/${a.slug}/IDENTITY.md`, content: `# ${a.name}\n` },
      { path: `agents/${a.slug}/SOUL.md`, content: a.soul || '' },
    ])
    const dirty = await isSpecDirty(team.github_repo, specFiles)
    if (dirty) return { ok: false, reason: 'Team has uncommitted changes. Please commit your spec to GitHub before deploying.' }
  }

  const agents = db.prepare('SELECT slug FROM agents WHERE team_slug = ?').all(teamSlug) as any[]
  const envConfig = JSON.parse(env.config)
  return (deployTeam as any)(teamSlug, agents.map((a: any) => ({ slug: a.slug })), { ...envConfig, envId })
}

async function handleUndeploy({ teamSlug, envId }: { teamSlug: string; envId: string }) {
  const db = openDb(':memory:')
  const env = db.prepare('SELECT * FROM environments WHERE id = ?').get(envId) as any
  if (!env) return { ok: false, reason: 'Environment not found' }

  const envConfig = JSON.parse(env.config)
  await (undeployTeam as any)(teamSlug, { ...envConfig, envId })
  return { ok: true }
}

describe('deploy IPC logic', () => {
  beforeEach(() => {
    testDb.prepare('DELETE FROM teams').run()
    testDb.prepare('DELETE FROM agents').run()
    testDb.prepare('DELETE FROM environments').run()
    vi.clearAllMocks()
    // Reset default mocks
    vi.mocked(isSpecDirty).mockResolvedValue(false)
    vi.mocked(deployTeam).mockResolvedValue({ ok: true, gatewayUrl: 'https://eng-alpha.example.com' })
  })

  it('deploy fails when team not found', async () => {
    testDb.prepare("INSERT INTO environments VALUES ('env-1','gke','Prod','{}',0)").run()
    const result = await handleDeploy({ teamSlug: 'no-team', envId: 'env-1' })
    expect(result.ok).toBe(false)
    expect(result.reason).toContain('Team not found')
  })

  it('deploy fails when spec has uncommitted changes', async () => {
    testDb.prepare("INSERT INTO teams VALUES ('eng-alpha','Engineering Alpha','owner/repo',null,'{}')").run()
    testDb.prepare("INSERT INTO environments VALUES ('env-1','gke','Prod','{\"projectId\":\"proj\",\"clusterName\":\"cls\",\"clusterZone\":\"us-central1-a\"}',0)").run()
    vi.mocked(isSpecDirty).mockResolvedValue(true)

    const result = await handleDeploy({ teamSlug: 'eng-alpha', envId: 'env-1' })
    expect(result.ok).toBe(false)
    expect(result.reason).toContain('uncommitted changes')
  })

  it('deploy proceeds when spec is clean', async () => {
    testDb.prepare("INSERT INTO teams VALUES ('eng-alpha','Engineering Alpha','owner/repo',null,'{}')").run()
    testDb.prepare("INSERT INTO environments VALUES ('env-1','gke','Prod','{\"projectId\":\"proj\",\"clusterName\":\"cls\",\"clusterZone\":\"us-central1-a\"}',0)").run()
    testDb.prepare("INSERT INTO agents VALUES ('alice','eng-alpha','Alice','Engineer',0,'[]','','','','',null,null)").run()
    vi.mocked(isSpecDirty).mockResolvedValue(false)

    const result = await handleDeploy({ teamSlug: 'eng-alpha', envId: 'env-1' })
    expect(result.ok).toBe(true)
    expect(deployTeam).toHaveBeenCalledWith('eng-alpha', [{ slug: 'alice' }], expect.any(Object))
  })

  it('deploy skips dirty check when no github_repo', async () => {
    testDb.prepare("INSERT INTO teams VALUES ('local-team','Local Team',null,null,'{}')").run()
    testDb.prepare("INSERT INTO environments VALUES ('env-1','gke','Prod','{\"projectId\":\"proj\",\"clusterName\":\"cls\",\"clusterZone\":\"us-central1-a\"}',0)").run()

    const result = await handleDeploy({ teamSlug: 'local-team', envId: 'env-1' })
    expect(result.ok).toBe(true)
    expect(isSpecDirty).not.toHaveBeenCalled()
  })

  it('undeploy deletes pods and returns ok', async () => {
    testDb.prepare("INSERT INTO environments VALUES ('env-1','gke','Prod','{\"projectId\":\"proj\",\"clusterName\":\"cls\",\"clusterZone\":\"us-central1-a\"}',0)").run()

    const result = await handleUndeploy({ teamSlug: 'eng-alpha', envId: 'env-1' })
    expect(result.ok).toBe(true)
    expect(undeployTeam).toHaveBeenCalledWith('eng-alpha', expect.any(Object))
  })
})
