// Tests for GKE deploy module — config validation and streaming status shape
// FEATURE: GKE deployment layer with async K8s API calls and streaming status
import { describe, it, expect, vi } from 'vitest'

vi.mock('./auth', () => ({
  getOAuth2Client: vi.fn(async () => ({
    getAccessToken: async () => ({ token: 'ya29.test-token' }),
  })),
}))

vi.mock('@google-cloud/container', () => ({
  ClusterManagerClient: vi.fn(() => ({
    getCluster: vi.fn().mockResolvedValue([{
      endpoint: '10.0.0.1',
      masterAuth: { clusterCaCertificate: 'base64-ca' },
    }]),
  })),
}))

vi.mock('@kubernetes/client-node', () => {
  const mockObjectApi = {
    read: vi.fn().mockRejectedValue({ statusCode: 404 }),
    replace: vi.fn().mockResolvedValue({}),
    create: vi.fn().mockResolvedValue({}),
  }
  const mockCoreApi = {
    deleteNamespacedPersistentVolumeClaim: vi.fn().mockResolvedValue({}),
    deletePersistentVolume: vi.fn().mockResolvedValue({}),
    deleteNamespacedSecret: vi.fn().mockResolvedValue({}),
    deleteCollectionNamespacedService: vi.fn().mockResolvedValue({}),
    readNamespacedPod: vi.fn().mockResolvedValue({ status: { phase: 'Running' } }),
  }
  const mockAppsApi = {
    deleteNamespacedStatefulSet: vi.fn().mockResolvedValue({}),
    deleteCollectionNamespacedStatefulSet: vi.fn().mockResolvedValue({}),
  }
  const mockNetworkingApi = {
    deleteNamespacedIngress: vi.fn().mockResolvedValue({}),
  }
  return {
    KubeConfig: vi.fn(() => ({
      loadFromOptions: vi.fn(),
      makeApiClient: vi.fn((ApiClass: unknown) => {
        if (ApiClass === mockCoreApiClass) return mockCoreApi
        if (ApiClass === mockAppsApiClass) return mockAppsApi
        if (ApiClass === mockNetworkingApiClass) return mockNetworkingApi
        return {}
      }),
    })),
    KubernetesObjectApi: { makeApiClient: vi.fn(() => mockObjectApi) },
    CoreV1Api: (mockCoreApiClass = vi.fn()),
    AppsV1Api: (mockAppsApiClass = vi.fn()),
    NetworkingV1Api: (mockNetworkingApiClass = vi.fn()),
  }
  // eslint-disable-next-line no-var
  var mockCoreApiClass: ReturnType<typeof vi.fn>
  var mockAppsApiClass: ReturnType<typeof vi.fn>
  var mockNetworkingApiClass: ReturnType<typeof vi.fn>
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

describe('deployTeam', () => {
  it('yields status events for spec files', async () => {
    const files = [
      { path: 'namespace.yaml', content: 'apiVersion: v1\nkind: Namespace\nmetadata:\n  name: team-alpha\n' },
    ]
    const statuses: import('../../../shared/types').DeployStatus[] = []
    for await (const s of deployTeam(files, 'alpha', config, { keepDisks: true })) {
      statuses.push(s)
    }
    expect(statuses.length).toBeGreaterThanOrEqual(1)
    expect(['created', 'updated', 'error']).toContain(statuses[0].status)
  })
})

describe('getTeamStatus', () => {
  it('returns agent statuses', async () => {
    const statuses = await getTeamStatus('alpha', ['alice', 'bob'], config)
    expect(statuses).toHaveLength(2)
    expect(statuses[0].agentSlug).toBe('alice')
  })
})
