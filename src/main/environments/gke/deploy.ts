// GKE deployment executor using Kubernetes REST API replacing kubectl and gcloud
// FEATURE: GKE deployment layer with async K8s API calls and streaming status
import * as k8s from '@kubernetes/client-node'
import { ClusterManagerClient } from '@google-cloud/container'
import yaml from 'js-yaml'
import { PassThrough } from 'node:stream'
import { getOAuth2Client } from './auth'
import { deleteDisk, labelDisk, listDisksByLabels, toZone, listGkeClusters, createAutopilotCluster } from './gcloud'
import type { DeployOptions, DeployStatus, AgentStatus, SpecFile, PodLogOptions, AgentLogEntry } from '../../../shared/types'

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

export async function resolveClusterForTeam(
  teamSlug: string,
  config: { projectId: string; defaultLocation: string },
  onStatus?: (msg: string) => void,
): Promise<{ clusterName: string; clusterZone: string }> {
  const pollForRunning = async (): Promise<{ clusterName: string; clusterZone: string }> => {
    for (let i = 0; i < 60; i++) {
      await new Promise(r => setTimeout(r, 15000))
      const clusters = await listGkeClusters(config.projectId)
      const found = clusters.find(c => c.name === teamSlug)
      if (found && found.status === 'RUNNING') return { clusterName: teamSlug, clusterZone: found.location }
    }
    throw new Error(`Cluster '${teamSlug}' did not become ready within 15 minutes`)
  }

  const clusters = await listGkeClusters(config.projectId)
  const existing = clusters.find(c => c.name === teamSlug)

  if (existing && existing.status === 'RUNNING') {
    return { clusterName: teamSlug, clusterZone: existing.location }
  }

  if (existing) {
    onStatus?.('Waiting for cluster to become ready...')
    return pollForRunning()
  }

  onStatus?.('Creating cluster ' + teamSlug + ' in ' + config.defaultLocation + '...')
  await createAutopilotCluster(config.projectId, teamSlug, config.defaultLocation)
  onStatus?.('Cluster created, waiting for it to become ready...')
  return pollForRunning()
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
        results.push({ resource, status: 'exists', message: 'spec immutable, redeploy with recreateDisks=true to update' })
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
  const batchApi = kc.makeApiClient(k8s.BatchV1Api)
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

  // When Mission Control is disabled for this deploy, remove its pod and associated resources.
  const hasMcManifest = specFiles.some(f => f.path === 'mission-control/deployment.yaml')
  if (!hasMcManifest) {
    for (const [resource, fn] of [
      ['Deployment/mission-control', () => appsApi.deleteNamespacedDeployment({ name: 'mission-control', namespace })],
      ['Service/mission-control', () => coreApi.deleteNamespacedService({ name: 'mission-control', namespace })],
      ['CronJob/agent-heartbeat-relay', () => batchApi.deleteNamespacedCronJob({ name: 'agent-heartbeat-relay', namespace })],
      ['Secret/mission-control-env', () => coreApi.deleteNamespacedSecret({ name: 'mission-control-env', namespace })],
      ['Secret/mission-control-pull-secret', () => coreApi.deleteNamespacedSecret({ name: 'mission-control-pull-secret', namespace })],
    ] as [string, () => Promise<unknown>][]) {
      try {
        await fn()
        yield { resource, status: 'deleted', message: 'Mission Control disabled' }
      } catch {
        // Resource may not exist — skip silently.
      }
    }
  }

  const existingPodList = await coreApi.listNamespacedPod({ namespace, labelSelector: `coordina.team=${teamSlug}` })
    .catch(() => ({ items: [] } as { items: k8s.V1Pod[] }))
  const existingStatefulSetList = await appsApi.listNamespacedStatefulSet({ namespace, labelSelector: `coordina.team=${teamSlug}` })
    .catch(() => ({ items: [] } as { items: k8s.V1StatefulSet[] }))
  const existingPodNames = (existingPodList.items ?? []).map(p => p.metadata?.name).filter((name): name is string => Boolean(name))
  const existingStatefulSetNames = (existingStatefulSetList.items ?? []).map(s => s.metadata?.name).filter((name): name is string => Boolean(name))

  const removedAgentSlugs = new Set<string>()
  if (!options.partialDeploy) {
    for (const name of existingPodNames) {
      const slug = parseAgentSlugFromPodName(name)
      if (slug && !desiredAgentSlugs.has(slug)) removedAgentSlugs.add(slug)
    }
    for (const name of existingStatefulSetNames) {
      const slug = parseAgentSlugFromStatefulSetName(name)
      if (slug && !desiredAgentSlugs.has(slug)) removedAgentSlugs.add(slug)
    }
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
    // Delete the agent's PVC when removed from team spec (avoids orphaned PVC accumulation)
    await tryDelete(() => coreApi.deleteNamespacedPersistentVolumeClaim({ name: `${teamSlug}-agent-${agentSlug}`, namespace }))
    yield { resource: `PVC/${teamSlug}-agent-${agentSlug}`, status: 'deleted', message: 'Agent removed from team spec' }
  }

  const existingPvcNames = new Set<string>()
  if (!options.recreateDisks) {
    const pvcList = await coreApi.listNamespacedPersistentVolumeClaim({ namespace })
      .catch(() => ({ items: [] } as { items: k8s.V1PersistentVolumeClaim[] }))
    for (const pvc of pvcList.items ?? []) {
      const name = pvc.metadata?.name
      if (!name) continue
      if (pvc.status?.phase === 'Lost') {
        await tryDelete(() => coreApi.deleteNamespacedPersistentVolumeClaim({ name, namespace }))
        yield { resource: `PVC/${name}`, status: 'deleted', message: 'Removed stale PVC (Lost phase)' }
        continue
      }
      existingPvcNames.add(name)
    }
  }

  const newAgentPvcPaths = new Set<string>()
  for (const f of specFiles.filter(f => f.path.endsWith('/pvc.yaml'))) {
    const doc = yaml.load(f.content) as k8s.KubernetesObject & { metadata: k8s.V1ObjectMeta }
    if (doc?.metadata?.name && !existingPvcNames.has(doc.metadata.name)) {
      newAgentPvcPaths.add(f.path)
    }
  }

  // recreateDisks deletes existing PVCs, PVs, and GCE disks so fresh disks are provisioned.
  if (options.recreateDisks) {
    const fallback = config.diskZone ?? toZone(config.clusterZone)
    for (const name of desiredStatefulSetNames) {
      await tryDelete(() => appsApi.deleteNamespacedStatefulSet({ name, namespace }))
      yield { resource: `StatefulSet/${name}`, status: 'deleted', message: 'Recreate disks' }
    }
    for (const f of specFiles.filter(f => f.path.endsWith('/pvc.yaml'))) {
      const doc = yaml.load(f.content) as k8s.KubernetesObject & { metadata: k8s.V1ObjectMeta }
      const pvcName = doc?.metadata?.name
      if (!pvcName) continue
      const agentSlugLabel = (() => {
        const labels = doc?.metadata?.labels as Record<string, string> | undefined
        return labels?.['coordina.agent']
      })()
      const existingPvc = await coreApi.readNamespacedPersistentVolumeClaim({ name: pvcName, namespace }).catch(() => null)
      const pvName = existingPvc?.spec?.volumeName
      let diskInfo: { name: string; zone: string } | null = null
      if (pvName) {
        const pv = await coreApi.readPersistentVolume({ name: pvName }).catch(() => null)
        const volumeHandle = pv?.spec?.csi?.volumeHandle
        if (volumeHandle) {
          const parts = volumeHandle.split('/')
          diskInfo = { name: parts[parts.length - 1], zone: parts[3] ?? fallback }
        }
      }
      await tryDelete(() => coreApi.deleteNamespacedPersistentVolumeClaim({ name: pvcName, namespace }))
      yield { resource: `PVC/${pvcName}`, status: 'deleted', message: 'Recreate disks' }
      if (pvName) {
        await tryDelete(() => coreApi.deletePersistentVolume({ name: pvName }))
        yield { resource: `PV/${pvName}`, status: 'deleted', message: 'Recreate disks' }
      }
      if (diskInfo) {
        try {
          deleteDisk(config.projectId, diskInfo.zone, diskInfo.name)
          yield { resource: `Disk/${diskInfo.name}`, status: 'deleted', message: 'Recreate disks' }
        } catch { /* disk may already be gone */ }
      }
      if (agentSlugLabel) {
        const orphanedDisks = listDisksByLabels(config.projectId, { 'coordina-team': teamSlug, 'coordina-agent': agentSlugLabel })
          .filter(d => !diskInfo || d.name !== diskInfo.name)
        for (const d of orphanedDisks) {
          try {
            deleteDisk(config.projectId, d.zone, d.name)
            yield { resource: `Disk/${d.name}`, status: 'deleted', message: 'Orphaned disk cleanup' }
          } catch { /* disk may already be gone */ }
        }
      }
    }
  }

  if (options.forceRecreatePods && !options.recreateDisks) {
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

  const skipPvcPaths = new Set(!options.recreateDisks
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
    'mission-control/pull-secret.yaml',
    'mission-control/secret.yaml',
    'mission-control/pvc.yaml',
    'mission-control/deployment.yaml',
    'mission-control/service.yaml',
  ]

  for (const path of orderedPaths) {
    if (skipPvcPaths.has(path)) continue
    const file = specFiles.find(f => f.path === path)
    if (!file) continue
    for (const s of await applyManifest(client, file.content)) yield s
  }

  const fallbackZone = config.diskZone ?? toZone(config.clusterZone)
  const pvcList = await coreApi.listNamespacedPersistentVolumeClaim({ namespace, labelSelector: `coordina.team=${teamSlug}` })
    .catch(() => ({ items: [] } as { items: k8s.V1PersistentVolumeClaim[] }))
  const unboundPvcNames = (pvcList.items ?? [])
    .filter(pvc => pvc.metadata?.labels?.['coordina.agent'] && !pvc.spec?.volumeName)
    .map(pvc => pvc.metadata!.name!)
  if (unboundPvcNames.length > 0) {
    yield { resource: 'DiskLabel', status: 'exists', message: `Waiting for ${unboundPvcNames.length} PVC(s) to bind…` }
    for (let attempt = 0; attempt < 12; attempt++) {
      await new Promise(r => setTimeout(r, 5000))
      let allBound = true
      for (const name of unboundPvcNames) {
        const pvc = await coreApi.readNamespacedPersistentVolumeClaim({ name, namespace }).catch(() => null)
        if (!pvc?.spec?.volumeName) { allBound = false; break }
      }
      if (allBound) break
    }
  }
  const freshPvcList = unboundPvcNames.length > 0
    ? await coreApi.listNamespacedPersistentVolumeClaim({ namespace, labelSelector: `coordina.team=${teamSlug}` })
        .catch(() => ({ items: [] } as { items: k8s.V1PersistentVolumeClaim[] }))
    : pvcList
  for (const pvc of freshPvcList.items ?? []) {
    const agentSlug = pvc.metadata?.labels?.['coordina.agent']
    const pvName = pvc.spec?.volumeName
    if (!agentSlug || !pvName) continue
    const pv = await coreApi.readPersistentVolume({ name: pvName }).catch(() => null)
    const volumeHandle = pv?.spec?.csi?.volumeHandle
    if (!volumeHandle) continue
    const parts = volumeHandle.split('/')
    const diskName = parts[parts.length - 1]
    const zone = parts[3] ?? fallbackZone
    try {
      labelDisk(config.projectId, zone, diskName, { 'coordina-team': teamSlug, 'coordina-agent': agentSlug })
    } catch {
      yield { resource: `DiskLabel/${diskName}`, status: 'error', message: 'Failed to label GCP disk — tag-based deletion may miss this disk' }
    }
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
    const fallbackZone = config.diskZone ?? toZone(config.clusterZone)
    const disksFromPvs: { name: string; zone: string }[] = []

    const pvcList = await coreApi.listNamespacedPersistentVolumeClaim({ namespace, labelSelector: `coordina.team=${teamSlug}` })
      .catch(() => ({ items: [] } as { items: k8s.V1PersistentVolumeClaim[] }))
    for (const pvc of pvcList.items ?? []) {
      const pvcName = pvc.metadata?.name
      const pvName = pvc.spec?.volumeName
      if (pvName) {
        const pv = await coreApi.readPersistentVolume({ name: pvName }).catch(() => null)
        const volumeHandle = pv?.spec?.csi?.volumeHandle
        if (volumeHandle) {
          const parts = volumeHandle.split('/')
          disksFromPvs.push({ name: parts[parts.length - 1], zone: parts[3] ?? fallbackZone })
        }
      }
      if (pvcName) {
        try {
          await coreApi.deleteNamespacedPersistentVolumeClaim({ name: pvcName, namespace })
          yield { resource: `PVC/${pvcName}`, status: 'deleted' }
        } catch { yield { resource: `PVC/${pvcName}`, status: 'error' } }
      }
      if (pvName) {
        try {
          await coreApi.deletePersistentVolume({ name: pvName })
          yield { resource: `PV/${pvName}`, status: 'deleted' }
        } catch { yield { resource: `PV/${pvName}`, status: 'error' } }
      }
    }

    const disks = listDisksByLabels(config.projectId, { 'coordina-team': teamSlug })
    const diskNames = new Set(disks.map(d => d.name))
    for (const d of disksFromPvs) {
      if (!diskNames.has(d.name)) disks.push(d)
    }
    for (const disk of disks) {
      try {
        deleteDisk(config.projectId, disk.zone, disk.name)
        yield { resource: `Disk/${disk.name}`, status: 'deleted' }
      } catch { yield { resource: `Disk/${disk.name}`, status: 'error' } }
    }
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
    [`ConfigMap/${teamSlug}-${agentSlug}-config`, () => coreApi.deleteNamespacedConfigMap({ name: `${teamSlug}-${agentSlug}-config`, namespace })],
    [`Secret/${teamSlug}-${agentSlug}-credentials`, () => coreApi.deleteNamespacedSecret({ name: `${teamSlug}-${agentSlug}-credentials`, namespace })],
  ] as [string, () => Promise<unknown>][]) {
    try { await fn(); yield { resource: label, status: 'deleted' } }
    catch { yield { resource: label, status: 'error' } }
  }

  if (options.deleteDisks) {
    const pvcName = `${teamSlug}-agent-${agentSlug}`
    const fallbackZone = config.diskZone ?? toZone(config.clusterZone)
    let diskFromPv: { name: string; zone: string } | null = null
    try {
      const pvc = await coreApi.readNamespacedPersistentVolumeClaim({ name: pvcName, namespace }).catch(() => null)
      const pvName = pvc?.spec?.volumeName
      if (pvName) {
        const pv = await coreApi.readPersistentVolume({ name: pvName }).catch(() => null)
        const volumeHandle = pv?.spec?.csi?.volumeHandle
        if (volumeHandle) {
          const parts = volumeHandle.split('/')
          diskFromPv = { name: parts[parts.length - 1], zone: parts[3] ?? fallbackZone }
        }
      }
      await tryDelete(() => coreApi.deleteNamespacedPersistentVolumeClaim({ name: pvcName, namespace }))
      yield { resource: `PVC/${pvcName}`, status: 'deleted' }
      if (pvName) {
        await tryDelete(() => coreApi.deletePersistentVolume({ name: pvName }))
        yield { resource: `PV/${pvName}`, status: 'deleted' }
      }
    } catch { yield { resource: `PVC/${pvcName}`, status: 'error' } }

    const disks = listDisksByLabels(config.projectId, { 'coordina-team': teamSlug, 'coordina-agent': agentSlug })
    const diskNames = new Set(disks.map(d => d.name))
    if (diskFromPv && !diskNames.has(diskFromPv.name)) {
      disks.push(diskFromPv)
    }
    for (const disk of disks) {
      try {
        deleteDisk(config.projectId, disk.zone, disk.name)
        yield { resource: `Disk/${disk.name}`, status: 'deleted' }
      } catch { yield { resource: `Disk/${disk.name}`, status: 'error' } }
    }
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
  const exec = new k8s.Exec(kc)
  const podName = `agent-${agentSlug}-0`
  return new Promise((resolve, reject) => {
    const stdout = new PassThrough()
    const stderr = new PassThrough()
    const chunks: Buffer[] = []
    const errChunks: Buffer[] = []
    let settled = false
    const timer = setTimeout(() => {
      if (settled) return
      settled = true
      stdout.destroy()
      stderr.destroy()
      reject(new Error('exec timed out after 15s'))
    }, 15_000)
    const settle = <T>(fn: (v: T) => void, v: T): void => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      fn(v)
    }
    stdout.on('data', (chunk: Buffer) => chunks.push(chunk))
    stderr.on('data', (chunk: Buffer) => errChunks.push(chunk))
    exec.exec(namespace, podName, 'openclaw', command, stdout, stderr, null, false, (status) => {
      if (status.status === 'Success') {
        settle(resolve, Buffer.concat(chunks).toString('utf-8'))
      } else {
        const errMsg = Buffer.concat(errChunks).toString('utf-8').trim() || status.message || 'exec failed'
        settle(reject, new Error(errMsg))
      }
    }).catch((err) => settle(reject, err))
  })
}

export async function getAgentLogs(
  teamSlug: string,
  agentSlug: string,
  config: GkeDeployConfig,
  opts?: PodLogOptions,
): Promise<string> {
  const kc = await buildKubeConfig(config)
  const coreApi = kc.makeApiClient(k8s.CoreV1Api)
  const response = await coreApi.readNamespacedPodLog({
    name: `agent-${agentSlug}-0`,
    namespace: teamSlug,
    container: 'openclaw',
    tailLines: opts?.tailLines ?? 200,
    timestamps: true,
    ...(opts?.sinceSeconds ? { sinceSeconds: opts.sinceSeconds } : {}),
  })
  return response
}

export async function getTeamLogs(
  teamSlug: string,
  agentSlugs: string[],
  config: GkeDeployConfig,
  opts?: PodLogOptions,
): Promise<AgentLogEntry[]> {
  const kc = await buildKubeConfig(config)
  const coreApi = kc.makeApiClient(k8s.CoreV1Api)
  return Promise.all(agentSlugs.map(async (slug) => {
    try {
      const logs = await coreApi.readNamespacedPodLog({
        name: `agent-${slug}-0`,
        namespace: teamSlug,
        container: 'openclaw',
        tailLines: opts?.tailLines ?? 200,
        timestamps: true,
        ...(opts?.sinceSeconds ? { sinceSeconds: opts.sinceSeconds } : {}),
      })
      return { agentSlug: slug, logs }
    } catch {
      return { agentSlug: slug, logs: '' }
    }
  }))
}
