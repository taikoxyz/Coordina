import { describe, it, expect } from 'vitest'
import yaml from 'js-yaml'
import {
  generateMissionControlSecret,
  generateMissionControlPvc,
  generateMissionControlDeployment,
  generateMissionControlService,
  generateMissionControlHeartbeatCronJob,
} from '../environments/gke/manifests'

const BASE = {
  namespace: 'my-team',
  adminPassword: 'pass',
  sessionSecret: '12345678901234567890123456789012',
  apiKey: 'key123',
  leadAgentSlug: 'alice',
  image: 'gcr.io/proj/mission-control:latest',
}

describe('generateMissionControlSecret', () => {
  it('generates a Secret with all required env vars', () => {
    const out = yaml.load(generateMissionControlSecret(BASE)) as Record<string, unknown>
    expect(out.kind).toBe('Secret')
    expect((out.stringData as Record<string, string>).MC_ADMIN_PASSWORD).toBe('pass')
    expect((out.stringData as Record<string, string>).OPENCLAW_GATEWAY_HOST).toBe(
      'agent-alice.my-team.svc.cluster.local'
    )
    expect((out.stringData as Record<string, string>).OPENCLAW_GATEWAY_PORT).toBe('18789')
  })
})

describe('generateMissionControlPvc', () => {
  it('generates a 5Gi PVC', () => {
    const out = yaml.load(generateMissionControlPvc({ namespace: 'my-team' })) as Record<string, unknown>
    expect(out.kind).toBe('PersistentVolumeClaim')
    const spec = out.spec as Record<string, unknown>
    expect((spec.resources as Record<string, Record<string, string>>).requests.storage).toBe('5Gi')
  })
})

describe('generateMissionControlDeployment', () => {
  it('generates a Deployment with image and port 3000', () => {
    const out = yaml.load(
      generateMissionControlDeployment({ namespace: 'my-team', image: 'gcr.io/proj/mc:latest' })
    ) as Record<string, unknown>
    expect(out.kind).toBe('Deployment')
    const containers = ((out.spec as Record<string, unknown>).template as Record<string, unknown>)
    const c = ((containers.spec as Record<string, unknown>).containers as Array<Record<string, unknown>>)[0]
    expect(c.image).toBe('gcr.io/proj/mc:latest')
    expect((c.ports as Array<Record<string, unknown>>)[0].containerPort).toBe(3000)
  })
})

describe('generateMissionControlService', () => {
  it('generates a ClusterIP Service on port 3000', () => {
    const out = yaml.load(generateMissionControlService({ namespace: 'my-team' })) as Record<string, unknown>
    expect(out.kind).toBe('Service')
    expect((out.spec as Record<string, string>).type).toBe('ClusterIP')
  })
})


describe('generateMissionControlHeartbeatCronJob', () => {
  it('generates a CronJob', () => {
    const out = yaml.load(
      generateMissionControlHeartbeatCronJob({ namespace: 'my-team', agentIds: [1, 2] })
    ) as Record<string, unknown>
    expect(out.kind).toBe('CronJob')
    expect(out.metadata).toBeTruthy()
  })
})
