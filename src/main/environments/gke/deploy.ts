// GKE deployment executor using Kubernetes REST API replacing kubectl and gcloud
// FEATURE: GKE deployment layer with async K8s API calls and streaming status
import * as k8s from '@kubernetes/client-node'
import { ClusterManagerClient } from '@google-cloud/container'
import yaml from 'js-yaml'
import { getOAuth2Client } from './auth'
import type { DeployOptions, DeployStatus, AgentStatus, SpecFile } from '../../../shared/types'

export interface GkeDeployConfig {
  slug: string
  projectId: string
  clusterName: string
  clusterZone: string
  diskZone?: string
  clientId: string
  clientSecret: string
}

async function buildKubeConfig(config: GkeDeployConfig): Promise<k8s.KubeConfig> {
  const auth = await getOAuth2Client(config.slug, { clientId: config.clientId, clientSecret: config.clientSecret })
  const containerClient = new ClusterManagerClient({ authClient: auth })
  const [cluster] = await containerClient.getCluster({
    name: `projects/${config.projectId}/locations/${config.clusterZone}/clusters/${config.clusterName}`,
  })

  const kc = new k8s.KubeConfig()
  kc.loadFromOptions({
    clusters: [{ name: config.clusterName, server: `https://${cluster.endpoint}`, caData: cluster.masterAuth?.clusterCaCertificate }],
    users: [{ name: 'gke-user', token: (await auth.getAccessToken()).token ?? '' }],
    contexts: [{ name: 'gke', cluster: config.clusterName, user: 'gke-user' }],
    currentContext: 'gke',
  })
  return kc
}

async function applyManifest(client: k8s.KubernetesObjectApi, content: string): Promise<DeployStatus[]> {
  const docs = yaml.loadAll(content) as k8s.KubernetesObject[]
  const results: DeployStatus[] = []
  for (const doc of docs) {
    if (!doc?.kind || !doc.metadata?.name) continue
    const name = doc.metadata.name
    const resource = `${doc.kind}/${name}`
    try {
      await client.read(doc as k8s.KubernetesObject & { metadata: { name: string } })
      await client.replace(doc)
      results.push({ resource, status: 'updated' })
    } catch (e: unknown) {
      const err = e as { code?: number; statusCode?: number }
      if (err.code === 404 || err.statusCode === 404) {
        try {
          await client.create(doc)
          results.push({ resource, status: 'created' })
        } catch (createErr: unknown) {
          results.push({ resource, status: 'error', message: String(createErr) })
        }
      } else if (err.code === 422 || err.statusCode === 422) {
        results.push({ resource, status: 'exists', message: 'spec immutable, delete and redeploy with keepDisks=false to update' })
      } else {
        results.push({ resource, status: 'error', message: String(e) })
      }
    }
  }
  return results
}

async function tryDelete(fn: () => Promise<unknown>): Promise<void> {
  try { await fn() } catch { /* resource may not exist */ }
}

async function pollGceOperation(opLink: string, headers: Record<string, string>, label: string): Promise<void> {
  for (let i = 0; i < 30; i++) {
    await new Promise(r => setTimeout(r, 2000))
    const poll = await fetch(opLink, { headers })
    const status = await poll.json() as { status: string; error?: unknown }
    if (status.status === 'DONE') {
      if (status.error) throw new Error(`${label} failed: ${JSON.stringify(status.error)}`)
      return
    }
  }
  throw new Error(`${label} timed out`)
}

async function ensureGceDisk(token: string, projectId: string, zone: string, diskName: string, sizeGb: number): Promise<'created' | 'updated' | 'exists'> {
  const base = `https://compute.googleapis.com/compute/v1/projects/${projectId}/zones/${zone}`
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
  const check = await fetch(`${base}/disks/${diskName}`, { headers })
  if (check.ok) {
    const existing = await check.json() as { sizeGb: string }
    const existingGb = parseInt(existing.sizeGb)
    if (sizeGb < existingGb) throw new Error(`Cannot shrink disk ${diskName} from ${existingGb}Gi to ${sizeGb}Gi — GCE disks cannot be reduced in size`)
    if (sizeGb === existingGb) return 'exists'
    const resize = await fetch(`${base}/disks/${diskName}/resize`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ sizeGb }),
    })
    if (!resize.ok) throw new Error(`Failed to resize GCE disk: ${await resize.text()}`)
    await pollGceOperation((await resize.json() as { selfLink: string }).selfLink, headers, `GCE disk resize ${diskName}`)
    return 'updated'
  }
  const create = await fetch(`${base}/disks`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ name: diskName, sizeGb, type: `${base}/diskTypes/pd-balanced` }),
  })
  if (!create.ok) throw new Error(`Failed to create GCE disk: ${await create.text()}`)
  await pollGceOperation((await create.json() as { selfLink: string }).selfLink, headers, `GCE disk creation ${diskName}`)
  return 'created'
}

export async function* deployTeam(
  specFiles: SpecFile[],
  teamSlug: string,
  config: GkeDeployConfig,
  options: DeployOptions
): AsyncGenerator<DeployStatus> {
  const auth = await getOAuth2Client(config.slug, { clientId: config.clientId, clientSecret: config.clientSecret })
  const token = (await auth.getAccessToken()).token ?? ''
  const kc = await buildKubeConfig(config)
  const client = k8s.KubernetesObjectApi.makeApiClient(kc)
  const coreApi = kc.makeApiClient(k8s.CoreV1Api)
  const appsApi = kc.makeApiClient(k8s.AppsV1Api)
  const namespace = teamSlug

  for (const f of specFiles.filter(f => f.path.endsWith('/pv.yaml'))) {
    const doc = yaml.load(f.content) as k8s.KubernetesObject & { metadata: k8s.V1ObjectMeta; spec?: { capacity?: { storage?: string } } }
    const diskName = doc?.metadata?.name
    if (!diskName) continue
    const sizeGb = parseInt(doc.spec?.capacity?.storage ?? '10') || 10
    try {
      const diskStatus = await ensureGceDisk(token, config.projectId, config.diskZone ?? config.clusterZone, diskName, sizeGb)
      yield { resource: `GCEDisk/${diskName}`, status: diskStatus }
    } catch (e: unknown) {
      yield { resource: `GCEDisk/${diskName}`, status: 'error', message: String(e) }
      return
    }
  }

  for (const f of specFiles.filter(f => f.path.endsWith('credentials.yaml'))) {
    const doc = yaml.load(f.content) as k8s.KubernetesObject & { metadata: k8s.V1ObjectMeta }
    if (doc?.metadata?.name) await tryDelete(() => coreApi.deleteNamespacedSecret({ name: doc.metadata.name!, namespace }))
  }

  for (const f of specFiles.filter(f => f.path.includes('/statefulset.yaml'))) {
    const doc = yaml.load(f.content) as k8s.KubernetesObject & { metadata: k8s.V1ObjectMeta }
    if (doc?.metadata?.name) await tryDelete(() => appsApi.deleteNamespacedStatefulSet({ name: doc.metadata.name!, namespace }))
  }

  const orderedPaths = [
    'namespace.yaml', 'configmap-shared.yaml',
    ...specFiles.filter(f => f.path.includes('/configmap.yaml')).map(f => f.path),
    ...specFiles.filter(f => f.path.endsWith('/credentials.yaml')).map(f => f.path),
    ...specFiles.filter(f => f.path.endsWith('/pv.yaml')).map(f => f.path),
    ...specFiles.filter(f => f.path.endsWith('/pvc.yaml')).map(f => f.path),
    ...specFiles.filter(f => f.path.includes('/statefulset.yaml')).map(f => f.path),
    ...specFiles.filter(f => f.path.includes('/service.yaml')).map(f => f.path),
    'ingress.yaml',
  ]

  for (const path of orderedPaths) {
    const file = specFiles.find(f => f.path === path)
    if (!file) continue
    for (const s of await applyManifest(client, file.content)) yield s
  }
}

export async function* undeployTeam(teamSlug: string, config: GkeDeployConfig): AsyncGenerator<DeployStatus> {
  const kc = await buildKubeConfig(config)
  const appsApi = kc.makeApiClient(k8s.AppsV1Api)
  const coreApi = kc.makeApiClient(k8s.CoreV1Api)
  const networkingApi = kc.makeApiClient(k8s.NetworkingV1Api)
  const namespace = teamSlug

  for (const [label, fn] of [
    [`Ingress/${teamSlug}-ingress`, () => networkingApi.deleteNamespacedIngress({ name: `${teamSlug}-ingress`, namespace })],
    ['StatefulSets', () => appsApi.deleteCollectionNamespacedStatefulSet({ namespace, labelSelector: `coordina.team=${teamSlug}` })],
    ['Services', () => coreApi.deleteCollectionNamespacedService({ namespace, labelSelector: `coordina.team=${teamSlug}` })],
  ] as [string, () => Promise<unknown>][]) {
    try { await fn(); yield { resource: label, status: 'deleted' } }
    catch { yield { resource: label, status: 'error' } }
  }
}

export async function getTeamStatus(teamSlug: string, agentSlugs: string[], config: GkeDeployConfig): Promise<AgentStatus[]> {
  const kc = await buildKubeConfig(config)
  const coreApi = kc.makeApiClient(k8s.CoreV1Api)
  const namespace = teamSlug
  const phaseMap: Record<string, AgentStatus['status']> = { Running: 'running', Pending: 'pending', Failed: 'crashed' }
  return Promise.all(agentSlugs.map(async (slug) => {
    try {
      const pod = await coreApi.readNamespacedPod({ name: `agent-${slug}-0`, namespace })
      return { agentSlug: slug, status: phaseMap[pod.status?.phase ?? ''] ?? 'unknown' }
    } catch {
      return { agentSlug: slug, status: 'unknown' as const }
    }
  }))
}
