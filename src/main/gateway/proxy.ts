import { Router, type Response } from 'express'
import { createProxyMiddleware } from 'http-proxy-middleware'
import { getTeam } from '../store/teams'
import { getTeamDeployment, saveTeamDeployment, type TeamDeploymentRecord } from '../store/deployments'
import { getEnvironment, listEnvironments } from '../store/environments'

export type TokenFetcher = (envId: string) => Promise<string | null>

function sendProxyError(res: Response, status: number, error: string, detail?: string): void {
  if (res.headersSent) return
  res.status(status).json({
    error,
    ...(detail ? { detail } : {}),
  })
}

function resolveUpstreamPath(pathname: string, leadAgentSlug: string, agentSlugs: Set<string>): string {
  const path = pathname || '/'
  const directWithPrefix = path.match(/^\/agents\/([^/]+)(\/.*)?$/)
  if (directWithPrefix && agentSlugs.has(directWithPrefix[1])) {
    return `/agents/${directWithPrefix[1]}${directWithPrefix[2] ?? ''}`
  }

  const legacyDirect = path.match(/^\/([^/]+)(\/.*)?$/)
  if (legacyDirect && agentSlugs.has(legacyDirect[1])) {
    return `/agents/${legacyDirect[1]}${legacyDirect[2] ?? ''}`
  }

  return `/agents/${leadAgentSlug}${path === '/' ? '' : path}`
}

async function buildDeploymentRecord(params: {
  teamSlug: string
  teamSpec: Awaited<ReturnType<typeof getTeam>>
  envSlug: string
}): Promise<TeamDeploymentRecord | null> {
  const env = await getEnvironment(params.envSlug)
  if (!env || !params.teamSpec) return null

  const domain = params.teamSpec.domain || (env.config as { domain?: string }).domain
  const leadAgentSlug = params.teamSpec.agents[0]?.slug
  if (!domain || !leadAgentSlug) return null

  return {
    teamSlug: params.teamSlug,
    envSlug: env.slug,
    leadAgentSlug,
    gatewayBaseUrl: `https://${params.teamSlug}.${domain}`.replace(/\/+$/, ''),
    deployedAt: Date.now(),
  }
}

export function createGatewayRouter(getToken: TokenFetcher = async () => null) {
  const router = Router()

  router.use('/proxy/:teamSlug', async (req, res, next) => {
    const { teamSlug } = req.params
    const [teamSpec, existingDeployment] = await Promise.all([getTeam(teamSlug), getTeamDeployment(teamSlug)])

    if (!teamSpec) {
      res.status(404).json({ error: `Team '${teamSlug}' is not deployed` })
      return
    }

    const requestedEnvSlug = typeof req.query.envSlug === 'string' ? req.query.envSlug : undefined
    const deployment = await (async (): Promise<TeamDeploymentRecord | null> => {
      if (requestedEnvSlug) {
        // If UI specifies env, it must take precedence over cached deployment metadata.
        if (existingDeployment?.envSlug === requestedEnvSlug) return existingDeployment
        const recovered = await buildDeploymentRecord({ teamSlug, teamSpec, envSlug: requestedEnvSlug })
        if (!recovered) return null
        await saveTeamDeployment(recovered)
        return recovered
      }

      if (existingDeployment) return existingDeployment

      const envs = await listEnvironments()
      if (envs.length !== 1) return null

      const recovered = await buildDeploymentRecord({ teamSlug, teamSpec, envSlug: envs[0].slug })
      if (!recovered) return null
      await saveTeamDeployment(recovered)
      return recovered
    })()

    if (!deployment) {
      res.status(404).json({ error: `Team '${teamSlug}' is not deployed` })
      return
    }

    const leadAgentSlug = deployment.leadAgentSlug || teamSpec.agents[0]?.slug
    if (!leadAgentSlug) {
      res.status(404).json({ error: `Team '${teamSlug}' has no agents` })
      return
    }

    const token = await getToken(deployment.envSlug)
    const agentSlugs = new Set(teamSpec.agents.map(a => a.slug))
    const rewrittenPath = resolveUpstreamPath(req.path, leadAgentSlug, agentSlugs)

    const proxy = createProxyMiddleware({
      target: deployment.gatewayBaseUrl,
      changeOrigin: true,
      ws: true,
      pathRewrite: () => rewrittenPath,
      on: {
        error: (err, _req, res) => {
          const e = err as NodeJS.ErrnoException
          const code = e.code ? String(e.code) : 'UNKNOWN_PROXY_ERROR'
          const detail = e.message ? `${code}: ${e.message}` : code
          sendProxyError(res as Response, 502, 'Gateway upstream connection failed', detail)
        },
        proxyReq: (proxyReq) => {
          if (token) {
            proxyReq.setHeader('Authorization', `Bearer ${token}`)
          }
        },
        proxyReqWs: (proxyReq) => {
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
