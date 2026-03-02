import { Router } from 'express'
import { createProxyMiddleware } from 'http-proxy-middleware'
import type { Database } from 'better-sqlite3'

export type TokenFetcher = (envId: string) => Promise<string | null>

export function createGatewayRouter(getDb: () => Database, getToken: TokenFetcher = async () => null) {
  const router = Router()

  router.use('/proxy/:teamSlug', async (req, res, next) => {
    const { teamSlug } = req.params
    const db = getDb()
    const team = db.prepare('SELECT gateway_url, deployed_env_id FROM teams WHERE slug = ?').get(teamSlug) as any

    if (!team?.gateway_url) {
      res.status(404).json({ error: `Team '${teamSlug}' is not deployed` })
      return
    }

    const token = await getToken(team.deployed_env_id)

    const proxy = createProxyMiddleware({
      target: team.gateway_url,
      changeOrigin: true,
      ws: true,
      pathRewrite: { [`^/proxy/${teamSlug}`]: '' },
      on: {
        proxyReq: (proxyReq) => {
          if (token) {
            proxyReq.setHeader('Authorization', `Bearer ${token}`)
          }
        },
      },
    })

    proxy(req, res, next)
  })

  return router
}
