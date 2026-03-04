import express from 'express'
import { getDb } from './db'
import { createGatewayRouter } from './gateway/proxy'

export function createServer() {
  const app = express()
  app.use(express.json())
  app.get('/health', (_req, res) => res.json({ ok: true }))

  app.use(createGatewayRouter(getDb))

  return app
}
