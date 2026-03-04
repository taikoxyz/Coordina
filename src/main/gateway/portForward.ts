import { execFileSync, spawn, type ChildProcessByStdio } from 'node:child_process'
import net from 'node:net'
import readline from 'node:readline'
import type { Readable } from 'node:stream'

interface Tunnel {
  process: ChildProcessByStdio<null, Readable, Readable>
  localPort: number
  ready: Promise<void>
}

const tunnels = new Map<string, Tunnel>()
const inFlight = new Map<string, Promise<Tunnel>>()
const readyContexts = new Set<string>()

function tunnelKey(envSlug: string, teamSlug: string, agentSlug: string): string {
  return `${envSlug}:${teamSlug}:${agentSlug}`
}

export interface ClusterRef {
  projectId: string
  clusterName: string
  clusterZone: string
}

function contextKey(ref: ClusterRef): string {
  return `${ref.projectId}:${ref.clusterName}:${ref.clusterZone}`
}

function ensureKubectlContext(ref: ClusterRef): void {
  const key = contextKey(ref)
  if (readyContexts.has(key)) return
  try {
    execFileSync(
      'gcloud',
      [
        'container',
        'clusters',
        'get-credentials',
        ref.clusterName,
        `--location=${ref.clusterZone}`,
        `--project=${ref.projectId}`,
      ],
      { stdio: 'pipe', encoding: 'utf-8' }
    )
    readyContexts.add(key)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    throw new Error(`Failed to prepare kubectl context for ${ref.clusterName}: ${msg}`)
  }
}

function allocateLocalPort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer()
    server.unref()
    server.on('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address()
      if (!addr || typeof addr === 'string') {
        server.close(() => reject(new Error('Failed to allocate local port for port-forward')))
        return
      }
      const port = addr.port
      server.close((err) => (err ? reject(err) : resolve(port)))
    })
  })
}

async function startTunnel(envSlug: string, teamSlug: string, agentSlug: string): Promise<Tunnel> {
  const localPort = await allocateLocalPort()
  const process = spawn(
    'kubectl',
    ['-n', teamSlug, 'port-forward', `svc/agent-${agentSlug}`, `${localPort}:18789`],
    { stdio: ['ignore', 'pipe', 'pipe'] }
  )

  let settled = false
  let logs = ''
  let timeout: NodeJS.Timeout | null = null

  const ready = new Promise<void>((resolve, reject) => {
    const fail = (message: string) => {
      if (settled) return
      settled = true
      if (timeout) clearTimeout(timeout)
      reject(new Error(message))
    }

    const onLine = (line: string) => {
      logs += `${line}\n`
      if (line.includes(`Forwarding from 127.0.0.1:${localPort}`) || line.includes(`Forwarding from [::1]:${localPort}`)) {
        if (settled) return
        settled = true
        if (timeout) clearTimeout(timeout)
        resolve()
        return
      }
      if (/error|unable|forbidden|denied|not found|timed out/i.test(line)) {
        fail(line)
      }
    }

    readline.createInterface({ input: process.stdout }).on('line', onLine)
    readline.createInterface({ input: process.stderr }).on('line', onLine)

    process.once('exit', (code, signal) => {
      fail(`kubectl port-forward exited (${code ?? signal ?? 'unknown'}). ${logs.trim()}`)
    })

    timeout = setTimeout(() => {
      fail(`kubectl port-forward timed out for ${teamSlug}/${agentSlug}`)
      process.kill('SIGTERM')
    }, 12000)
  })

  const key = tunnelKey(envSlug, teamSlug, agentSlug)
  process.once('exit', () => {
    const active = tunnels.get(key)
    if (active?.process === process) tunnels.delete(key)
  })

  return { process, localPort, ready }
}

export async function ensureAgentPortForward(params: {
  envSlug: string
  teamSlug: string
  agentSlug: string
  cluster: ClusterRef
}): Promise<string> {
  const { envSlug, teamSlug, agentSlug, cluster } = params
  ensureKubectlContext(cluster)
  const key = tunnelKey(envSlug, teamSlug, agentSlug)
  const existing = tunnels.get(key)
  if (existing && existing.process.exitCode === null && !existing.process.killed) {
    await existing.ready
    return `http://127.0.0.1:${existing.localPort}`
  }

  const pending = inFlight.get(key)
  if (pending) {
    const tunnel = await pending
    return `http://127.0.0.1:${tunnel.localPort}`
  }

  const next = (async () => {
    const tunnel = await startTunnel(envSlug, teamSlug, agentSlug)
    tunnels.set(key, tunnel)
    await tunnel.ready
    return tunnel
  })()

  inFlight.set(key, next)
  try {
    const tunnel = await next
    return `http://127.0.0.1:${tunnel.localPort}`
  } finally {
    inFlight.delete(key)
  }
}
