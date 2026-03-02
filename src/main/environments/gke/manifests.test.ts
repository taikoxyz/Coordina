import { describe, it, expect } from 'vitest'
import { generateAgentStatefulSet, generateIapBackendConfig, generateIngress } from './manifests'

describe('generateAgentStatefulSet', () => {
  it('generates StatefulSet manifest with deterministic PVC name', () => {
    const manifest = generateAgentStatefulSet({ teamSlug: 'eng-alpha', agentSlug: 'alice', storageGi: 10 })
    expect(manifest).toContain('name: alice')
    expect(manifest).toContain('workspace-eng-alpha-alice')
    expect(manifest).toContain('containerPort: 18789')
  })

  it('uses correct default image', () => {
    const manifest = generateAgentStatefulSet({ teamSlug: 'test', agentSlug: 'bob' })
    expect(manifest).toContain('openclaw/openclaw:latest')
  })

  it('uses custom image when provided', () => {
    const manifest = generateAgentStatefulSet({ teamSlug: 'test', agentSlug: 'bob', image: 'myrepo/openclaw:v2' })
    expect(manifest).toContain('myrepo/openclaw:v2')
  })
})

describe('generateIapBackendConfig', () => {
  it('generates IAP BackendConfig for team', () => {
    const manifest = generateIapBackendConfig({ teamSlug: 'eng-alpha' })
    expect(manifest).toContain('kind: BackendConfig')
    expect(manifest).toContain('iap:')
    expect(manifest).toContain('enabled: true')
    expect(manifest).toContain('eng-alpha')
  })
})

describe('generateIngress', () => {
  it('generates Ingress with paths for each agent', () => {
    const manifest = generateIngress({ teamSlug: 'eng-alpha', agents: ['alice', 'bob'], domain: 'example.com' })
    expect(manifest).toContain('kind: Ingress')
    expect(manifest).toContain('eng-alpha-ingress')
    expect(manifest).toContain('alice')
    expect(manifest).toContain('bob')
  })
})
