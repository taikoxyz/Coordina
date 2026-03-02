import express from 'express'
import path from 'path'
import { openDb } from './db'
import { getGkeAccessToken } from './environments/gke/auth'
import { createGatewayRouter } from './gateway/proxy'
import { app as electronApp } from 'electron'

export function createServer() {
  const app = express()
  app.use(express.json())
  app.get('/health', (_req, res) => res.json({ ok: true }))

  const getDb = () => openDb(path.join(electronApp.getPath('userData'), 'coordina.db'))
  app.use(createGatewayRouter(getDb, getGkeAccessToken))

  return app
}
