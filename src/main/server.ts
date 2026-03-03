import express from 'express'
import { getDb } from './db'
import { getGkeAccessToken } from './environments/gke/auth'
import { createGatewayRouter } from './gateway/proxy'

export function createServer() {
  const app = express()
  app.use(express.json())
  app.get('/health', (_req, res) => res.json({ ok: true }))

  app.use(createGatewayRouter(getDb, getGkeAccessToken))

  return app
}
