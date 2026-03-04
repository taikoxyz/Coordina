import { describe, it, expect, beforeAll, vi } from 'vitest'
import request from 'supertest'

vi.mock('electron', () => ({
  app: { getPath: vi.fn(() => ':memory:') },
}))

vi.mock('./environments/gke/auth', () => ({
  getGkeAccessToken: vi.fn().mockResolvedValue(null),
}))

vi.mock('./store/teams', () => ({
  getTeam: vi.fn().mockResolvedValue(null),
}))

vi.mock('./store/deployments', () => ({
  getTeamDeployment: vi.fn().mockResolvedValue(null),
}))

vi.mock('./store/environments', () => ({
  getEnvAuthToken: vi.fn().mockResolvedValue(null),
}))

import { createServer } from './server'

describe('local server', () => {
  let app: ReturnType<typeof createServer>

  beforeAll(() => {
    app = createServer()
  })

  it('GET /health returns 200', async () => {
    const res = await request(app).get('/health')
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
  })
})
