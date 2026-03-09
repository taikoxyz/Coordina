// GKE deployment executor using Kubernetes REST API replacing kubectl and gcloud
// FEATURE: GKE deployment layer with async K8s API calls and streaming status
import * as k8s from '@kubernetes/client-node'
import { ClusterManagerClient } from '@google-cloud/container'
import yaml from 'js-yaml'
import os from 'os'
import fs from 'fs/promises'
import path from 'path'
import crypto from 'crypto'
import { execFile } from 'child_process'
import { promisify } from 'util'
import { getOAuth2Client } from './auth'
import type { DeployOptions, DeployStatus, AgentStatus, SpecFile } from '../../../shared/types'

const execFileAsync = promisify(execFile)

export interface GkeDeployConfig {
  slug: string
  projectId: string
  clusterName: string
  clusterZone: string
  diskZone?: string
  clientId: string
  clientSecret: string
}

function parseAgentSlugFromStatefulSetName(name?: string): string | undefined {
  if (!name || !name.startsWith('agent-')) return undefined
  return name.slice('agent-'.length) || undefined
}

function parseAgentSlugFromPodName(name?: string): string | undefined {
  if (!name) return undefined
  const match = name.match(/^agent-(.+)-\d+$/)
  return match?.[1]
}

export async function buildKubeConfig(config: GkeDeployConfig): Promise<k8s.KubeConfig> {
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

export async function* deployTeam(
  specFiles: SpecFile[],
  teamSlug: string,
  config: GkeDeployConfig,
  options: DeployOptions
): AsyncGenerator<DeployStatus> {
  const kc = await buildKubeConfig(config)
  const client = k8s.KubernetesObjectApi.makeApiClient(kc)
  const coreApi = kc.makeApiClient(k8s.CoreV1Api)
  const appsApi = kc.makeApiClient(k8s.AppsV1Api)
  const networkingApi = kc.makeApiClient(k8s.NetworkingV1Api)
  const namespace = teamSlug
  const hasIngressManifest = specFiles.some(f => f.path === 'ingress.yaml')
  const desiredStatefulSetNames = specFiles
    .filter(f => f.path.includes('/statefulset.yaml'))
    .map((f) => {
      const doc = yaml.load(f.content) as k8s.KubernetesObject & { metadata?: k8s.V1ObjectMeta }
      return doc?.metadata?.name
    })
    .filter((name): name is string => Boolean(name))
  const desiredAgentSlugs = new Set(
    desiredStatefulSetNames
      .map(parseAgentSlugFromStatefulSetName)
      .filter((slug): slug is string => Boolean(slug))
  )

  // In port-forward mode ingress.yaml is omitted; delete stale ingress to avoid paying for unused LB resources.
  if (!hasIngressManifest) {
    try {
      await networkingApi.deleteCollectionNamespacedIngress({ namespace })
      yield { resource: `Ingress/${teamSlug}`, status: 'deleted', message: 'Removed stale ingress (port-forward mode)' }
    } catch {
      // Ignore cleanup failures and continue deploying core resources.
    }
  }

  const existingPodList = await coreApi.listNamespacedPod({ namespace, labelSelector: `coordina.team=${teamSlug}` })
    .catch(() => ({ items: [] } as { items: k8s.V1Pod[] }))
  const existingStatefulSetList = await appsApi.listNamespacedStatefulSet({ namespace, labelSelector: `coordina.team=${teamSlug}` })
    .catch(() => ({ items: [] } as { items: k8s.V1StatefulSet[] }))
  const existingPodNames = (existingPodList.items ?? []).map(p => p.metadata?.name).filter((name): name is string => Boolean(name))
  const existingStatefulSetNames = (existingStatefulSetList.items ?? []).map(s => s.metadata?.name).filter((name): name is string => Boolean(name))

  const removedAgentSlugs = new Set<string>()
  for (const name of existingPodNames) {
    const slug = parseAgentSlugFromPodName(name)
    if (slug && !desiredAgentSlugs.has(slug)) removedAgentSlugs.add(slug)
  }
  for (const name of existingStatefulSetNames) {
    const slug = parseAgentSlugFromStatefulSetName(name)
    if (slug && !desiredAgentSlugs.has(slug)) removedAgentSlugs.add(slug)
  }

  for (const agentSlug of [...removedAgentSlugs].sort()) {
    const statefulSetName = `agent-${agentSlug}`
    await tryDelete(() => appsApi.deleteNamespacedStatefulSet({ name: statefulSetName, namespace }))
    yield { resource: `StatefulSet/${statefulSetName}`, status: 'deleted', message: 'Agent removed from team spec' }
    for (const podName of existingPodNames.filter(name => parseAgentSlugFromPodName(name) === agentSlug)) {
      await tryDelete(() => coreApi.deleteNamespacedPod({ name: podName, namespace }))
      yield { resource: `Pod/${podName}`, status: 'deleted', message: 'Agent removed from team spec' }
    }
    await tryDelete(() => coreApi.deleteNamespacedService({ name: statefulSetName, namespace }))
    yield { resource: `Service/${statefulSetName}`, status: 'deleted', message: 'Agent removed from team spec' }
    await tryDelete(() => coreApi.deleteNamespacedConfigMap({ name: `${teamSlug}-${agentSlug}-config`, namespace }))
    yield { resource: `ConfigMap/${teamSlug}-${agentSlug}-config`, status: 'deleted', message: 'Agent removed from team spec' }
    await tryDelete(() => coreApi.deleteNamespacedSecret({ name: `${teamSlug}-${agentSlug}-credentials`, namespace }))
    yield { resource: `Secret/${teamSlug}-${agentSlug}-credentials`, status: 'deleted', message: 'Agent removed from team spec' }
  }

  const existingPvcNames = new Set<string>()
  if (options.keepDisks) {
    const pvcList = await coreApi.listNamespacedPersistentVolumeClaim({ namespace })
      .catch(() => ({ items: [] } as { items: k8s.V1PersistentVolumeClaim[] }))
    for (const pvc of pvcList.items ?? []) {
      if (pvc.metadata?.name) existingPvcNames.add(pvc.metadata.name)
    }
  }

  const newAgentPvcPaths = new Set<string>()
  for (const f of specFiles.filter(f => f.path.endsWith('/pvc.yaml'))) {
    const doc = yaml.load(f.content) as k8s.KubernetesObject & { metadata: k8s.V1ObjectMeta }
    if (doc?.metadata?.name && !existingPvcNames.has(doc.metadata.name)) {
      newAgentPvcPaths.add(f.path)
    }
  }

  // keepDisks=false is a destructive reset path; terminate desired StatefulSets first so PVC operations can proceed safely.
  if (!options.keepDisks) {
    for (const name of desiredStatefulSetNames) {
      await tryDelete(() => appsApi.deleteNamespacedStatefulSet({ name, namespace }))
    }
    for (const f of specFiles.filter(f => f.path.endsWith('/pvc.yaml'))) {
      const doc = yaml.load(f.content) as k8s.KubernetesObject & { metadata: k8s.V1ObjectMeta }
      if (doc?.metadata?.name) await tryDelete(() => coreApi.deleteNamespacedPersistentVolumeClaim({ name: doc.metadata.name!, namespace }))
    }
  }

  if (options.forceRecreate && options.keepDisks) {
    for (const name of desiredStatefulSetNames) {
      await tryDelete(() => appsApi.deleteNamespacedStatefulSet({ name, namespace }))
      yield { resource: `StatefulSet/${name}`, status: 'deleted', message: 'Force recreate' }
    }
  }

  // Always delete credentials secrets so API keys are refreshed
  for (const f of specFiles.filter(f => f.path.endsWith('credentials.yaml'))) {
    const doc = yaml.load(f.content) as k8s.KubernetesObject & { metadata: k8s.V1ObjectMeta }
    if (doc?.metadata?.name) await tryDelete(() => coreApi.deleteNamespacedSecret({ name: doc.metadata.name!, namespace }))
  }

  const skipPvcPaths = new Set(options.keepDisks
    ? specFiles.filter(f => f.path.endsWith('/pvc.yaml') && !newAgentPvcPaths.has(f.path)).map(f => f.path)
    : [])

  const orderedPaths = [
    'namespace.yaml', 'storageclass.yaml', 'configmap-shared.yaml',
    ...specFiles.filter(f => f.path.includes('/configmap.yaml')).map(f => f.path),
    ...specFiles.filter(f => f.path.endsWith('/credentials.yaml')).map(f => f.path),
    ...specFiles.filter(f => f.path.endsWith('/pvc.yaml')).map(f => f.path),
    ...specFiles.filter(f => f.path.includes('/statefulset.yaml')).map(f => f.path),
    ...specFiles.filter(f => f.path.includes('/service.yaml')).map(f => f.path),
    'ingress.yaml',
  ]

  for (const path of orderedPaths) {
    if (skipPvcPaths.has(path)) continue
    const file = specFiles.find(f => f.path === path)
    if (!file) continue
    for (const s of await applyManifest(client, file.content)) yield s
  }
}

export async function* undeployTeam(teamSlug: string, config: GkeDeployConfig, options: { deleteDisks?: boolean } = {}): AsyncGenerator<DeployStatus> {
  const kc = await buildKubeConfig(config)
  const appsApi = kc.makeApiClient(k8s.AppsV1Api)
  const coreApi = kc.makeApiClient(k8s.CoreV1Api)
  const networkingApi = kc.makeApiClient(k8s.NetworkingV1Api)
  const namespace = teamSlug

  for (const [label, fn] of [
    [`Ingress/${teamSlug}`, () => networkingApi.deleteCollectionNamespacedIngress({ namespace })],
    ['StatefulSets', () => appsApi.deleteCollectionNamespacedStatefulSet({ namespace, labelSelector: `coordina.team=${teamSlug}` })],
    ['Services', () => coreApi.deleteCollectionNamespacedService({ namespace, labelSelector: `coordina.team=${teamSlug}` })],
  ] as [string, () => Promise<unknown>][]) {
    try { await fn(); yield { resource: label, status: 'deleted' } }
    catch { yield { resource: label, status: 'error' } }
  }

  if (options.deleteDisks) {
    try {
      const pvcList = await coreApi.listNamespacedPersistentVolumeClaim({ namespace })
      for (const pvc of pvcList.items ?? []) {
        const name = pvc.metadata?.name
        if (!name) continue
        try { await coreApi.deleteNamespacedPersistentVolumeClaim({ name, namespace }); yield { resource: `PVC/${name}`, status: 'deleted' } }
        catch { yield { resource: `PVC/${name}`, status: 'error' } }
      }
    } catch { yield { resource: 'PVCs', status: 'error' } }
  }
}

export async function* undeployAgent(teamSlug: string, agentSlug: string, config: GkeDeployConfig, options: { deleteDisks?: boolean } = {}): AsyncGenerator<DeployStatus> {
  const kc = await buildKubeConfig(config)
  const appsApi = kc.makeApiClient(k8s.AppsV1Api)
  const coreApi = kc.makeApiClient(k8s.CoreV1Api)
  const namespace = teamSlug
  const resourceName = `agent-${agentSlug}`

  for (const [label, fn] of [
    [`StatefulSet/${resourceName}`, () => appsApi.deleteNamespacedStatefulSet({ name: resourceName, namespace })],
    [`Service/${resourceName}`, () => coreApi.deleteNamespacedService({ name: resourceName, namespace })],
  ] as [string, () => Promise<unknown>][]) {
    try { await fn(); yield { resource: label, status: 'deleted' } }
    catch { yield { resource: label, status: 'error' } }
  }

  if (options.deleteDisks) {
    const pvcName = `${teamSlug}-agent-${agentSlug}`
    try { await coreApi.deleteNamespacedPersistentVolumeClaim({ name: pvcName, namespace }); yield { resource: `PVC/${pvcName}`, status: 'deleted' } }
    catch { yield { resource: `PVC/${pvcName}`, status: 'error' } }
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

export async function execInPod(
  namespace: string,
  agentSlug: string,
  command: string[],
  config: GkeDeployConfig,
): Promise<string> {
  const kc = await buildKubeConfig(config)
  const tmpFile = path.join(os.tmpdir(), `coordina-kc-${crypto.randomBytes(8).toString('hex')}.json`)
  await fs.writeFile(tmpFile, kc.exportConfig(), 'utf-8')
  try {
    const { stdout } = await execFileAsync(
      'kubectl',
      ['--kubeconfig', tmpFile, '-n', namespace, 'exec', `statefulset/agent-${agentSlug}`, '--', ...command],
      { timeout: 15000, maxBuffer: 4 * 1024 * 1024 },
    )
    return stdout
  } finally {
    await fs.unlink(tmpFile).catch(() => undefined)
  }
}
