import express from 'express'
import { createGatewayRouter } from './gateway/proxy'
import { getEnvAuthToken } from './store/environments'

export function createServer() {
  const app = express()
  app.get('/health', (_req, res) => res.json({ ok: true }))

  app.use(createGatewayRouter(getEnvAuthToken))
  app.use(express.json())

  return app
}
