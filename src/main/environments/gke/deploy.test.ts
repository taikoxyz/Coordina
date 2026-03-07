// Tests for GKE deploy module — config validation and streaming status shape
// FEATURE: GKE deployment layer with async K8s API calls and streaming status
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { DeployStatus } from '../../../shared/types'

const {
  mockObjectApi,
  mockCoreApi,
  mockAppsApi,
  mockNetworkingApi,
  mockGetCluster,
  MockCoreV1Api,
  MockAppsV1Api,
  MockNetworkingV1Api,
} = vi.hoisted(() => {
  class MockCoreV1Api {}
  class MockAppsV1Api {}
  class MockNetworkingV1Api {}
  return {
    mockObjectApi: {
      read: vi.fn(),
      replace: vi.fn(),
      create: vi.fn(),
    },
    mockCoreApi: {
      deleteNamespacedPersistentVolumeClaim: vi.fn(),
      deleteNamespacedSecret: vi.fn(),
      deleteNamespacedService: vi.fn(),
      deleteNamespacedConfigMap: vi.fn(),
      deleteNamespacedPod: vi.fn(),
      deleteCollectionNamespacedService: vi.fn(),
      listNamespacedPod: vi.fn(),
      listNamespacedPersistentVolumeClaim: vi.fn(),
      readNamespacedPod: vi.fn(),
    },
    mockAppsApi: {
      deleteNamespacedStatefulSet: vi.fn(),
      listNamespacedStatefulSet: vi.fn(),
      deleteCollectionNamespacedStatefulSet: vi.fn(),
    },
    mockNetworkingApi: {
      deleteCollectionNamespacedIngress: vi.fn(),
    },
    mockGetCluster: vi.fn(),
    MockCoreV1Api,
    MockAppsV1Api,
    MockNetworkingV1Api,
  }
})

vi.mock('./auth', () => ({
  getOAuth2Client: vi.fn(async () => ({
    getAccessToken: async () => ({ token: 'ya29.test-token' }),
  })),
}))

vi.mock('@google-cloud/container', () => {
  class ClusterManagerClient {
    getCluster = mockGetCluster
  }
  return { ClusterManagerClient }
})

vi.mock('@kubernetes/client-node', () => {
  class KubeConfig {
    loadFromOptions = vi.fn()

    makeApiClient = vi.fn((ApiClass: unknown) => {
      if (ApiClass === MockCoreV1Api) return mockCoreApi
      if (ApiClass === MockAppsV1Api) return mockAppsApi
      if (ApiClass === MockNetworkingV1Api) return mockNetworkingApi
      return {}
    })
  }
  return {
    KubeConfig,
    KubernetesObjectApi: { makeApiClient: vi.fn(() => mockObjectApi) },
    CoreV1Api: MockCoreV1Api,
    AppsV1Api: MockAppsV1Api,
    NetworkingV1Api: MockNetworkingV1Api,
  }
})

import { deployTeam, getTeamStatus } from './deploy'
import type { GkeDeployConfig } from './deploy'

const config: GkeDeployConfig = {
  slug: 'env-1',
  projectId: 'my-proj',
  clusterName: 'my-cluster',
  clusterZone: 'us-central1-a',
  clientId: 'client-id',
  clientSecret: 'client-secret',
}

beforeEach(() => {
  vi.clearAllMocks()

  mockObjectApi.read.mockRejectedValue({ statusCode: 404 })
  mockObjectApi.replace.mockResolvedValue({})
  mockObjectApi.create.mockResolvedValue({})

  mockCoreApi.deleteNamespacedPersistentVolumeClaim.mockResolvedValue({})
  mockCoreApi.listNamespacedPersistentVolumeClaim.mockResolvedValue({ items: [] })
  mockCoreApi.deleteNamespacedSecret.mockResolvedValue({})
  mockCoreApi.deleteNamespacedService.mockResolvedValue({})
  mockCoreApi.deleteNamespacedConfigMap.mockResolvedValue({})
  mockCoreApi.deleteNamespacedPod.mockResolvedValue({})
  mockCoreApi.deleteCollectionNamespacedService.mockResolvedValue({})
  mockCoreApi.listNamespacedPod.mockResolvedValue({ items: [] })
  mockCoreApi.readNamespacedPod.mockResolvedValue({ status: { phase: 'Running' } })

  mockAppsApi.deleteNamespacedStatefulSet.mockResolvedValue({})
  mockAppsApi.listNamespacedStatefulSet.mockResolvedValue({ items: [] })
  mockAppsApi.deleteCollectionNamespacedStatefulSet.mockResolvedValue({})

  mockNetworkingApi.deleteCollectionNamespacedIngress.mockResolvedValue({})
  mockGetCluster.mockResolvedValue([{
    endpoint: '10.0.0.1',
    masterAuth: { clusterCaCertificate: 'base64-ca' },
  }])
})

describe('deployTeam', () => {
  it('yields status events for spec files', async () => {
    const files = [
      { path: 'namespace.yaml', content: 'apiVersion: v1\nkind: Namespace\nmetadata:\n  name: team-alpha\n' },
    ]
    const statuses: DeployStatus[] = []
    for await (const s of deployTeam(files, 'alpha', config, { keepDisks: true, forceRecreate: false })) {
      statuses.push(s)
    }
    expect(statuses.length).toBeGreaterThanOrEqual(1)
    expect(['created', 'updated', 'deleted', 'exists', 'error']).toContain(statuses[0].status)
  })

  it('deletes removed agent resources without restarting unchanged agents when keepDisks=true', async () => {
    mockCoreApi.listNamespacedPod.mockResolvedValue({
      items: [
        { metadata: { name: 'agent-alice-0' } },
        { metadata: { name: 'agent-bob-0' } },
      ],
    })
    mockAppsApi.listNamespacedStatefulSet.mockResolvedValue({
      items: [
        { metadata: { name: 'agent-alice' } },
        { metadata: { name: 'agent-bob' } },
      ],
    })

    const files = [
      { path: 'namespace.yaml', content: 'apiVersion: v1\nkind: Namespace\nmetadata:\n  name: alpha\n' },
      { path: 'agents/alice/statefulset.yaml', content: 'apiVersion: apps/v1\nkind: StatefulSet\nmetadata:\n  name: agent-alice\n  namespace: alpha\n' },
    ]

    const statuses: DeployStatus[] = []
    for await (const s of deployTeam(files, 'alpha', config, { keepDisks: true, forceRecreate: false })) {
      statuses.push(s)
    }

    expect(mockAppsApi.deleteNamespacedStatefulSet).toHaveBeenCalledWith({ name: 'agent-bob', namespace: 'alpha' })
    expect(mockAppsApi.deleteNamespacedStatefulSet).not.toHaveBeenCalledWith({ name: 'agent-alice', namespace: 'alpha' })
    expect(mockCoreApi.deleteNamespacedPod).toHaveBeenCalledWith({ name: 'agent-bob-0', namespace: 'alpha' })
    expect(statuses.some(s => s.resource === 'StatefulSet/agent-bob' && s.status === 'deleted')).toBe(true)
  })

  it('terminates desired StatefulSets first when keepDisks=false', async () => {
    const files = [
      { path: 'namespace.yaml', content: 'apiVersion: v1\nkind: Namespace\nmetadata:\n  name: alpha\n' },
      { path: 'agents/alice/statefulset.yaml', content: 'apiVersion: apps/v1\nkind: StatefulSet\nmetadata:\n  name: agent-alice\n  namespace: alpha\n' },
    ]

    for await (const status of deployTeam(files, 'alpha', config, { keepDisks: false, forceRecreate: false })) {
      void status
    }

    expect(mockAppsApi.deleteNamespacedStatefulSet).toHaveBeenCalledWith({ name: 'agent-alice', namespace: 'alpha' })
  })
})

describe('getTeamStatus', () => {
  it('returns agent statuses', async () => {
    const statuses = await getTeamStatus('alpha', ['alice', 'bob'], config)
    expect(statuses).toHaveLength(2)
    expect(statuses[0].agentSlug).toBe('alice')
  })
})
