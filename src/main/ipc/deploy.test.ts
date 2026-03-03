import { describe, it, expect, vi, beforeEach } from 'vitest'
import Database from 'better-sqlite3'

vi.mock('electron', () => ({
  ipcMain: { handle: vi.fn() },
  app: { getPath: vi.fn(() => ':memory:') },
}))

vi.mock('../environments/gke/deploy', () => ({
  deployTeam: vi.fn().mockResolvedValue({ ok: true, gatewayUrl: 'https://eng-alpha.example.com' }),
  undeployTeam: vi.fn().mockResolvedValue(undefined),
  getTeamStatus: vi.fn().mockResolvedValue([{ agentSlug: 'alice', status: 'running' }]),
}))

vi.mock('../specs', () => ({
  buildProvidersMap: vi.fn().mockResolvedValue(new Map()),
  generateTeamSpecs: vi.fn().mockReturnValue([]),
  mapAgentRow: vi.fn((r: any) => ({ ...r, slug: r.slug, skills: [], isLead: false })),
  mapTeamRow: vi.fn((r: any) => ({ ...r, slug: r.slug })),
  hashSpecs: vi.fn().mockReturnValue('hash-abc'),
}))

vi.mock('../environments/gke/manifests', () => ({
  generateTeamConfigMap: vi.fn().mockReturnValue('---'),
  generateAgentConfigMap: vi.fn().mockReturnValue('---'),
}))

const testDb = new Database(':memory:')
testDb.exec(`
  CREATE TABLE IF NOT EXISTS teams (
    slug TEXT PRIMARY KEY, name TEXT NOT NULL, github_repo TEXT,
    lead_agent_slug TEXT, config TEXT NOT NULL DEFAULT '{}',
    image TEXT, gateway_url TEXT, deployed_env_id TEXT, deployed_spec_hash TEXT
  );
  CREATE TABLE IF NOT EXISTS agents (
    slug TEXT NOT NULL, team_slug TEXT NOT NULL, name TEXT NOT NULL,
    role TEXT NOT NULL, is_lead INTEGER DEFAULT 0, skills TEXT DEFAULT '[]',
    soul TEXT DEFAULT '', email TEXT, slack_handle TEXT, github_id TEXT,
    provider_id TEXT, model TEXT, image TEXT,
    PRIMARY KEY (slug, team_slug)
  );
  CREATE TABLE IF NOT EXISTS environments (
    id TEXT PRIMARY KEY, type TEXT NOT NULL, name TEXT NOT NULL,
    config TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS providers (
    id TEXT PRIMARY KEY, type TEXT NOT NULL, name TEXT NOT NULL, config TEXT NOT NULL DEFAULT '{}'
  );
`)

vi.mock('../db', () => ({ openDb: vi.fn(() => testDb) }))

import { deployTeam, undeployTeam } from '../environments/gke/deploy'
import { openDb } from '../db'
import { buildProvidersMap, generateTeamSpecs, mapAgentRow, mapTeamRow, hashSpecs } from '../specs'
import { generateTeamConfigMap, generateAgentConfigMap } from '../environments/gke/manifests'
import type { SpecFile } from '../specs'
import type { GkeDeployConfig } from '../environments/gke/deploy'

// Replicate simplified handler logic for testing
async function handleDeploy({ teamSlug, envId }: { teamSlug: string; envId: string }) {
  const db = openDb(':memory:')
  const teamRow = db.prepare('SELECT * FROM teams WHERE slug = ?').get(teamSlug) as any
  if (!teamRow) return { ok: false, reason: 'Team not found' }

  const env = db.prepare('SELECT * FROM environments WHERE id = ?').get(envId) as any
  if (!env) return { ok: false, reason: 'Environment not found' }

  const agentRows = db.prepare('SELECT * FROM agents WHERE team_slug = ?').all(teamSlug) as any[]
  const teamImage = teamRow.image as string | null
  const missing = agentRows.filter((a: any) => !a.image && !teamImage).map((a: any) => a.slug as string)
  if (missing.length > 0) {
    return { ok: false, reason: `Container image not set for: ${missing.join(', ')}` }
  }

  const team = (mapTeamRow as any)(teamRow)
  const agents = agentRows.map((r: any) => (mapAgentRow as any)(r))
  const envConfig = JSON.parse(env.config) as GkeDeployConfig
  const namespace = `team-${teamSlug}`

  let teamSpecs: SpecFile[]
  let configMapManifests: string[]
  try {
    const providers = await buildProvidersMap(db)
    teamSpecs = (generateTeamSpecs as any)(team, agents, providers)
    const getContent = (p: string) => teamSpecs.find((f: any) => f.path === p)?.content ?? ''
    configMapManifests = [
      (generateTeamConfigMap as any)({ teamSlug, namespace, teamJson: getContent('team.json'), agentsMd: getContent('AGENTS.md') }),
      ...agents.map((agent: any) => (generateAgentConfigMap as any)({
        teamSlug, agentSlug: agent.slug, namespace,
        agentJson: getContent(`agents/${agent.slug}/agent.json`),
        identityMd: getContent(`agents/${agent.slug}/IDENTITY.md`),
        soulMd: getContent(`agents/${agent.slug}/SOUL.md`),
        skillsMd: getContent(`agents/${agent.slug}/SKILLS.md`),
        openclawJson: getContent(`agents/${agent.slug}/openclaw.json`),
      })),
    ]
  } catch (e) {
    const msg = (e instanceof Error ? e.message : String(e)).trim()
    return { ok: false, reason: msg || 'Failed to build provider configuration' }
  }

  const result: any = await (deployTeam as any)(
    teamSlug,
    agents.map((a: any) => ({ slug: a.slug, image: a.image ?? teamImage ?? undefined })),
    { ...envConfig, envId },
    team.domain || undefined,
    configMapManifests
  )

  if (result.ok) {
    if (result.gatewayUrl) {
      db.prepare('UPDATE teams SET gateway_url = ?, deployed_env_id = ? WHERE slug = ?').run(result.gatewayUrl, envId, teamSlug)
    }
    db.prepare('UPDATE teams SET deployed_spec_hash = ? WHERE slug = ?').run((hashSpecs as any)(teamSpecs!), teamSlug)
  }

  return result
}

async function handleUndeploy({ teamSlug, envId }: { teamSlug: string; envId: string }) {
  const db = openDb(':memory:')
  const env = db.prepare('SELECT * FROM environments WHERE id = ?').get(envId) as any
  if (!env) return { ok: false, reason: 'Environment not found' }

  const envConfig = JSON.parse(env.config) as GkeDeployConfig
  await (undeployTeam as any)(teamSlug, { ...envConfig, envId })
  db.prepare('UPDATE teams SET gateway_url = NULL, deployed_env_id = NULL, deployed_spec_hash = NULL WHERE slug = ?').run(teamSlug)
  return { ok: true }
}

describe('deploy IPC logic', () => {
  beforeEach(() => {
    testDb.prepare('DELETE FROM teams').run()
    testDb.prepare('DELETE FROM agents').run()
    testDb.prepare('DELETE FROM environments').run()
    vi.clearAllMocks()
    vi.mocked(deployTeam as any).mockResolvedValue({ ok: true, gatewayUrl: 'https://eng-alpha.example.com' })
  })

  it('deploy fails when team not found', async () => {
    testDb.prepare("INSERT INTO environments VALUES ('env-1','gke','Prod','{}')").run()
    const result = await handleDeploy({ teamSlug: 'no-team', envId: 'env-1' })
    expect(result.ok).toBe(false)
    expect(result.reason).toContain('Team not found')
  })

  it('deploy fails when environment not found', async () => {
    testDb.prepare("INSERT INTO teams VALUES ('eng-alpha','Engineering Alpha',null,null,'{}',null,null,null,null)").run()
    const result = await handleDeploy({ teamSlug: 'eng-alpha', envId: 'no-env' })
    expect(result.ok).toBe(false)
    expect(result.reason).toContain('Environment not found')
  })

  it('deploy fails when agent has no image and team has no default image', async () => {
    testDb.prepare("INSERT INTO teams VALUES ('eng-alpha','Engineering Alpha',null,null,'{}',null,null,null,null)").run()
    testDb.prepare("INSERT INTO environments VALUES ('env-1','gke','Prod','{\"projectId\":\"proj\",\"clusterName\":\"cls\",\"clusterZone\":\"us-central1-a\"}')").run()
    testDb.prepare("INSERT INTO agents VALUES ('alice','eng-alpha','Alice','Engineer',0,'[]','','','','',null,null,null)").run()
    const result = await handleDeploy({ teamSlug: 'eng-alpha', envId: 'env-1' })
    expect(result.ok).toBe(false)
    expect(result.reason).toContain('Container image not set')
  })

  it('deploy proceeds when team image is set', async () => {
    testDb.prepare("INSERT INTO teams VALUES ('eng-alpha','Engineering Alpha',null,null,'{}','alpine/openclaw:latest',null,null,null)").run()
    testDb.prepare("INSERT INTO environments VALUES ('env-1','gke','Prod','{\"projectId\":\"proj\",\"clusterName\":\"cls\",\"clusterZone\":\"us-central1-a\"}')").run()
    testDb.prepare("INSERT INTO agents VALUES ('alice','eng-alpha','Alice','Engineer',0,'[]','','','','',null,null,null)").run()

    const result = await handleDeploy({ teamSlug: 'eng-alpha', envId: 'env-1' })
    expect(result.ok).toBe(true)
    expect(deployTeam).toHaveBeenCalled()
  })

  it('undeploy returns ok', async () => {
    testDb.prepare("INSERT INTO environments VALUES ('env-1','gke','Prod','{\"projectId\":\"proj\",\"clusterName\":\"cls\",\"clusterZone\":\"us-central1-a\"}')").run()
    testDb.prepare("INSERT INTO teams VALUES ('eng-alpha','Engineering Alpha',null,null,'{}',null,'https://eng-alpha.example.com','env-1',null)").run()

    const result = await handleUndeploy({ teamSlug: 'eng-alpha', envId: 'env-1' })
    expect(result.ok).toBe(true)
    expect(undeployTeam).toHaveBeenCalledWith('eng-alpha', expect.any(Object))
  })
})
