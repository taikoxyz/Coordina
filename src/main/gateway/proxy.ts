import { Router, type Request, type Response } from 'express'
import type { IncomingMessage } from 'node:http'
import { createHmac } from 'node:crypto'
import { lookup as dnsLookup } from 'node:dns/promises'
import { createProxyMiddleware } from 'http-proxy-middleware'
import * as k8s from '@kubernetes/client-node'
import { ClusterManagerClient } from '@google-cloud/container'
import { getTeam } from '../store/teams'
import { getTeamDeployment, saveTeamDeployment, type TeamDeploymentRecord } from '../store/deployments'
import { getEnvironment, listEnvironments } from '../store/environments'
import { getOAuth2Client } from '../environments/gke/auth'
import { ensureAgentPortForward, type ClusterRef } from './portForward'
import { resolveGatewayMode } from './mode'

export type TokenFetcher = (envId: string) => Promise<string | null>

interface UpstreamTarget {
  target: string
  hostHeader?: string
}

interface ProxyRequestContext {
  rewrittenPath: string
  token: string | null
  upstream: UpstreamTarget
}

interface GkeGatewayConfig {
  projectId: string
  clusterZone?: string
  clientId: string
  clientSecret: string
}

class ProxyRequestError extends Error {
  constructor(
    readonly status: number,
    readonly proxyError: string,
    readonly detail?: string,
  ) {
    super(proxyError)
  }
}

function sendProxyError(res: Response, status: number, error: string, detail?: string): void {
  if (res.headersSent) return
  res.status(status).json({
    error,
    ...(detail ? { detail } : {}),
  })
}

function deriveAgentToken(seed: string, agentSlug: string): string {
  return createHmac('sha256', seed).update(agentSlug).digest('hex').slice(0, 48)
}

function parseGkeGatewayConfig(config: unknown): GkeGatewayConfig | null {
  const c = config as Partial<GkeGatewayConfig>
  if (
    typeof c.projectId === 'string' &&
    typeof c.clientId === 'string' &&
    typeof c.clientSecret === 'string'
  ) {
    return {
      projectId: c.projectId,
      clusterZone: typeof c.clusterZone === 'string' ? c.clusterZone : undefined,
      clientId: c.clientId,
      clientSecret: c.clientSecret,
    }
  }
  return null
}

async function readGkeIngressAddress(envSlug: string, teamSlug: string): Promise<string | null> {
  const env = await getEnvironment(envSlug)
  if (!env || env.type !== 'gke') return null
  const cfg = parseGkeGatewayConfig(env.config)
  if (!cfg) return null

  const deployment = await getTeamDeployment(teamSlug)
  const clusterZone = deployment?.clusterZone ?? cfg.clusterZone
  if (!clusterZone) return null

  const auth = await getOAuth2Client(env.slug, { clientId: cfg.clientId, clientSecret: cfg.clientSecret })
  const containerClient = new ClusterManagerClient({ authClient: auth })
  const [cluster] = await containerClient.getCluster({
    name: `projects/${cfg.projectId}/locations/${clusterZone}/clusters/${teamSlug}`,
  })

  if (!cluster.endpoint || !cluster.masterAuth?.clusterCaCertificate) return null

  const kc = new k8s.KubeConfig()
  kc.loadFromOptions({
    clusters: [{ name: teamSlug, server: `https://${cluster.endpoint}`, caData: cluster.masterAuth.clusterCaCertificate }],
    users: [{ name: 'gke-user', token: (await auth.getAccessToken()).token ?? '' }],
    contexts: [{ name: 'gke', cluster: teamSlug, user: 'gke-user' }],
    currentContext: 'gke',
  })

  const networkingApi = kc.makeApiClient(k8s.NetworkingV1Api)
  const ingress = await networkingApi.readNamespacedIngress({ name: `${teamSlug}-ingress`, namespace: teamSlug }).catch(() => null)
  const ingressStatus = ingress?.status?.loadBalancer?.ingress?.[0]
  if (typeof ingressStatus?.ip === 'string' && ingressStatus.ip.length > 0) return ingressStatus.ip
  if (typeof ingressStatus?.hostname === 'string' && ingressStatus.hostname.length > 0) return ingressStatus.hostname
  return null
}

function parseGkeClusterRef(config: unknown, overrides?: { clusterName?: string; clusterZone?: string }): ClusterRef | null {
  const c = config as Partial<ClusterRef>
  const projectId = c.projectId
  const clusterName = overrides?.clusterName ?? c.clusterName
  const clusterZone = overrides?.clusterZone ?? c.clusterZone
  if (
    typeof projectId === 'string' &&
    typeof clusterName === 'string' &&
    typeof clusterZone === 'string' &&
    projectId.length > 0 &&
    clusterName.length > 0 &&
    clusterZone.length > 0
  ) {
    return { projectId, clusterName, clusterZone }
  }
  return null
}

async function resolveUpstreamTarget(teamSlug: string, deployment: TeamDeploymentRecord): Promise<UpstreamTarget> {
  const target = deployment.gatewayBaseUrl
  let parsed: URL
  try {
    parsed = new URL(target)
  } catch {
    return { target }
  }

  try {
    await dnsLookup(parsed.hostname)
    return { target }
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code
    if (code !== 'ENOTFOUND' && code !== 'EAI_AGAIN') {
      return { target }
    }
  }

  const ingressAddress = await readGkeIngressAddress(deployment.envSlug, teamSlug).catch(() => null)
  if (!ingressAddress) return { target }

  return {
    target: `http://${ingressAddress}`,
    hostHeader: parsed.host,
  }
}

function resolveTargetAgentSlug(pathname: string, leadAgent: string, agentSlugs: Set<string>): string {
  const path = pathname || '/'
  const directWithPrefix = path.match(/^\/agents\/([^/]+)(\/.*)?$/)
  if (directWithPrefix && agentSlugs.has(directWithPrefix[1])) {
    return directWithPrefix[1]
  }

  const legacyDirect = path.match(/^\/([^/]+)(\/.*)?$/)
  if (legacyDirect && agentSlugs.has(legacyDirect[1])) {
    return legacyDirect[1]
  }

  return leadAgent
}

function resolveIngressUpstreamPath(pathname: string, leadAgent: string, agentSlugs: Set<string>): string {
  const path = pathname || '/'
  const targetAgentSlug = resolveTargetAgentSlug(path, leadAgent, agentSlugs)
  const directWithPrefix = path.match(/^\/agents\/([^/]+)(\/.*)?$/)
  if (directWithPrefix && agentSlugs.has(directWithPrefix[1])) {
    return `/agents/${targetAgentSlug}${directWithPrefix[2] ?? ''}`
  }
  const legacyDirect = path.match(/^\/([^/]+)(\/.*)?$/)
  if (legacyDirect && agentSlugs.has(legacyDirect[1])) {
    return `/agents/${targetAgentSlug}${legacyDirect[2] ?? ''}`
  }
  return `/agents/${targetAgentSlug}${path === '/' ? '' : path}`
}

function resolvePortForwardPath(pathname: string, agentSlugs: Set<string>): string {
  const path = pathname || '/'
  const directWithPrefix = path.match(/^\/agents\/[^/]+(\/.*)?$/)
  if (directWithPrefix) {
    return directWithPrefix[1] ?? '/'
  }
  const legacyDirect = path.match(/^\/([^/]+)(\/.*)?$/)
  if (legacyDirect && agentSlugs.has(legacyDirect[1])) {
    return legacyDirect[2] ?? '/'
  }
  return path
}

interface ParsedProxyRequest {
  teamSlug: string
  requestedPath: string
  requestedEnvSlug?: string
}

function parseProxyRequest(req: IncomingMessage): ParsedProxyRequest {
  const parsed = new URL(req.url ?? '/', 'http://localhost')
  const match = parsed.pathname.match(/^\/proxy\/([^/]+)(\/.*)?$/)
  if (!match) {
    throw new ProxyRequestError(404, 'Invalid proxy route')
  }

  const requestedEnvSlug = parsed.searchParams.get('envSlug') ?? undefined
  return {
    teamSlug: match[1],
    requestedPath: match[2] ?? '/',
    ...(requestedEnvSlug ? { requestedEnvSlug } : {}),
  }
}

async function buildDeploymentRecord(params: {
  teamSlug: string
  teamSpec: Awaited<ReturnType<typeof getTeam>>
  envSlug: string
}): Promise<TeamDeploymentRecord | null> {
  const env = await getEnvironment(params.envSlug)
  if (!env || !params.teamSpec) return null

  const mode = resolveGatewayMode(env.config)
  const domain = (env.config as { domain?: string }).domain
  const leadAgent = params.teamSpec.agents[0]?.slug
  if (!leadAgent) return null
  if (mode === 'ingress' && (!domain || domain.trim().length === 0)) return null

  const gatewayBaseUrl = mode === 'ingress'
    ? `https://${params.teamSlug}.${domain}`.replace(/\/+$/, '')
    : 'http://127.0.0.1'

  return {
    teamSlug: params.teamSlug,
    envSlug: env.slug,
    leadAgent,
    gatewayBaseUrl,
    deployedAt: Date.now(),
  }
}

async function buildProxyRequestContext(req: IncomingMessage, getToken: TokenFetcher): Promise<ProxyRequestContext> {
  const { teamSlug, requestedPath, requestedEnvSlug } = parseProxyRequest(req)
  const [teamSpec, existingDeployment] = await Promise.all([getTeam(teamSlug), getTeamDeployment(teamSlug)])

  if (!teamSpec) {
    throw new ProxyRequestError(404, `Team '${teamSlug}' is not deployed`)
  }

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
    throw new ProxyRequestError(404, `Team '${teamSlug}' is not deployed`)
  }

  const leadAgent = deployment.leadAgent || teamSpec.agents[0]?.slug
  if (!leadAgent) {
    throw new ProxyRequestError(404, `Team '${teamSlug}' has no agents`)
  }

  const env = await getEnvironment(deployment.envSlug)
  if (!env) {
    throw new ProxyRequestError(404, `Environment '${deployment.envSlug}' not found`)
  }

  const mode = resolveGatewayMode(env.config)
  const agentSlugs = new Set(teamSpec.agents.map(a => a.slug))
  const targetAgentSlug = resolveTargetAgentSlug(requestedPath, leadAgent, agentSlugs)
  const rewrittenPath = mode === 'port-forward'
    ? resolvePortForwardPath(requestedPath, agentSlugs)
    : resolveIngressUpstreamPath(requestedPath, leadAgent, agentSlugs)
  const token = mode === 'ingress'
    ? await getToken(deployment.envSlug)
    : (teamSpec.signingKey ? deriveAgentToken(teamSpec.signingKey, teamSlug) : null)

  const upstream = await (async (): Promise<UpstreamTarget> => {
    if (mode === 'port-forward') {
      const pfDeployment = await getTeamDeployment(teamSlug)
      const cluster = parseGkeClusterRef(env.config, {
        clusterName: teamSlug,
        clusterZone: pfDeployment?.clusterZone,
      })
      if (!cluster) {
        throw new Error(`Environment '${env.slug}' is missing GKE cluster settings (projectId, clusterZone)`)
      }
      const target = await ensureAgentPortForward({
        envSlug: deployment.envSlug,
        teamSlug,
        agentSlug: targetAgentSlug,
        cluster,
      })
      return { target }
    }
    return resolveUpstreamTarget(teamSlug, deployment)
  })().catch((e) => {
    throw new ProxyRequestError(
      502,
      'Failed to establish port-forward to agent gateway',
      e instanceof Error ? e.message : String(e),
    )
  })

  return { rewrittenPath, token, upstream }
}

const proxyRequestContextSymbol = Symbol('proxyRequestContext')
const resolvedProxyRequestContextSymbol = Symbol('resolvedProxyRequestContext')

type ContextualIncomingMessage = IncomingMessage & {
  [proxyRequestContextSymbol]?: Promise<ProxyRequestContext>
  [resolvedProxyRequestContextSymbol]?: ProxyRequestContext
}

function getResolvedProxyRequestContext(req: IncomingMessage): ProxyRequestContext | undefined {
  return (req as ContextualIncomingMessage)[resolvedProxyRequestContextSymbol]
}

function getProxyRequestContext(req: IncomingMessage, getToken: TokenFetcher): Promise<ProxyRequestContext> {
  const contextualReq = req as ContextualIncomingMessage

  if (!contextualReq[proxyRequestContextSymbol]) {
    contextualReq[proxyRequestContextSymbol] = buildProxyRequestContext(req, getToken).then((context) => {
      contextualReq[resolvedProxyRequestContextSymbol] = context
      return context
    })
  }

  return contextualReq[proxyRequestContextSymbol]
}

function isProxyPath(req: Request): boolean {
  return req.path === '/proxy' || req.path.startsWith('/proxy/')
}

function isExpressResponse(value: unknown): value is Response {
  if (typeof value !== 'object' || value === null) return false
  const candidate = value as Partial<Response>
  return typeof candidate.status === 'function' && typeof candidate.json === 'function'
}

export function createGatewayRouter(getToken: TokenFetcher = async () => null) {
  const router = Router()
  const proxy = createProxyMiddleware({
    pathFilter: '/proxy',
    target: 'http://127.0.0.1',
    changeOrigin: true,
    ws: true,
    router: async (req) => (await getProxyRequestContext(req, getToken)).upstream.target,
    pathRewrite: async (_path, req) => (await getProxyRequestContext(req, getToken)).rewrittenPath,
    on: {
      error: (err, _req, res) => {
        if (!isExpressResponse(res)) {
          return
        }

        if (err instanceof ProxyRequestError) {
          sendProxyError(res, err.status, err.proxyError, err.detail)
          return
        }

        const e = err as NodeJS.ErrnoException
        const code = e.code ? String(e.code) : 'UNKNOWN_PROXY_ERROR'
        const detail = e.message ? `${code}: ${e.message}` : code
        sendProxyError(res, 502, 'Gateway upstream connection failed', detail)
      },
      proxyReq: (proxyReq, req) => {
        const context = getResolvedProxyRequestContext(req)
        if (!context) return
        if (context.token) {
          proxyReq.setHeader('Authorization', `Bearer ${context.token}`)
        }
        if (context.upstream.hostHeader) {
          proxyReq.setHeader('Host', context.upstream.hostHeader)
        }
      },
      proxyReqWs: (proxyReq, req) => {
        const context = getResolvedProxyRequestContext(req)
        if (!context) return
        if (context.token) {
          proxyReq.setHeader('Authorization', `Bearer ${context.token}`)
        }
        if (context.upstream.hostHeader) {
          proxyReq.setHeader('Host', context.upstream.hostHeader)
        }
      },
    },
  })

  router.use(async (req, res, next) => {
    if (!isProxyPath(req)) {
      next()
      return
    }

    try {
      await getProxyRequestContext(req, getToken)
      next()
    } catch (e) {
      if (e instanceof ProxyRequestError) {
        sendProxyError(res, e.status, e.proxyError, e.detail)
        return
      }
      next(e)
    }
  })
  router.use(proxy)

  return router
}
