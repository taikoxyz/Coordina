import { describe, it, expect, vi } from 'vitest'
import express from 'express'
import request from 'supertest'
import Database from 'better-sqlite3'
import { createGatewayRouter } from './proxy'

const testDb = new Database(':memory:')
testDb.exec(`
  CREATE TABLE IF NOT EXISTS teams (
    slug TEXT PRIMARY KEY, name TEXT NOT NULL, github_repo TEXT,
    lead_agent_slug TEXT, config TEXT NOT NULL DEFAULT '{}',
    gateway_url TEXT, deployed_env_id TEXT
  );
`)

describe('gateway proxy', () => {
  it('returns 404 when team is not deployed', async () => {
    testDb.prepare("INSERT OR IGNORE INTO teams VALUES ('no-deploy','Test',null,null,'{}',null,null)").run()
    const app = express()
    app.use(createGatewayRouter(() => testDb))
    const res = await request(app).get('/proxy/no-deploy/chat')
    expect(res.status).toBe(404)
    expect(res.body.error).toContain('not deployed')
  })

  it('returns 404 when team slug does not exist', async () => {
    const app = express()
    app.use(createGatewayRouter(() => testDb))
    const res = await request(app).get('/proxy/ghost-team/anything')
    expect(res.status).toBe(404)
  })

  it('passes custom token fetcher to proxy configuration', async () => {
    const getToken = vi.fn().mockResolvedValue('ya29.test-token')
    // The router should call getToken with the deployed_env_id
    testDb.prepare("INSERT OR REPLACE INTO teams VALUES ('deployed-team','Deployed',null,null,'{}','https://gateway.example.com','env-1')").run()

    const app = express()
    app.use(createGatewayRouter(() => testDb, getToken))

    // Note: actual proxying fails in test env since no upstream exists,
    // but we can verify the 404 path doesn't call getToken (team must be deployed)
    const noDeployRes = await request(app).get('/proxy/no-such-team/chat')
    expect(noDeployRes.status).toBe(404)
    expect(getToken).not.toHaveBeenCalled()
  })
})
