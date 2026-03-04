import { describe, it, expect, vi, beforeEach } from 'vitest'
import express from 'express'
import request from 'supertest'
import { createGatewayRouter } from './proxy'
import { getTeam } from '../store/teams'
import { getTeamDeployment } from '../store/deployments'

vi.mock('../store/teams', () => ({
  getTeam: vi.fn(),
}))

vi.mock('../store/deployments', () => ({
  getTeamDeployment: vi.fn(),
}))

describe('gateway proxy', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 404 when deployment metadata is missing', async () => {
    vi.mocked(getTeam).mockResolvedValue({ slug: 'eng', name: 'Eng', agents: [] } as any)
    vi.mocked(getTeamDeployment).mockResolvedValue(null)

    const app = express()
    app.use(createGatewayRouter())
    const res = await request(app).get('/proxy/eng/ws')

    expect(res.status).toBe(404)
    expect(res.body.error).toContain('not deployed')
  })

  it('returns 404 when team spec is missing', async () => {
    vi.mocked(getTeam).mockResolvedValue(null)
    vi.mocked(getTeamDeployment).mockResolvedValue({
      teamSlug: 'eng',
      envSlug: 'gke-prod',
      leadAgentSlug: 'lead',
      gatewayBaseUrl: 'https://eng.example.com',
      deployedAt: Date.now(),
    })

    const app = express()
    app.use(createGatewayRouter())
    const res = await request(app).get('/proxy/eng/ws')

    expect(res.status).toBe(404)
  })
})
