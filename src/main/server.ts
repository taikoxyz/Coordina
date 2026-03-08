import express from 'express'
import { createGatewayRouter } from './gateway/proxy'
import { createProjectRouter } from './gateway/projectApi'
import { getEnvAuthToken } from './store/environments'

export function createServer() {
  const app = express()

  // Renderer runs from a different origin (e.g. file:// in packaged app),
  // so local proxy routes must allow cross-origin requests.
  app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS')
    if (req.method === 'OPTIONS') {
      res.status(204).end()
      return
    }
    next()
  })

  app.get('/health', (_req, res) => res.json({ ok: true }))

  app.use(express.json())
  app.use(createProjectRouter())
  app.use(createGatewayRouter(getEnvAuthToken))

  return app
}
