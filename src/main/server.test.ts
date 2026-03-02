import { describe, it, expect, beforeAll } from 'vitest'
import request from 'supertest'
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
