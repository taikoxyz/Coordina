import { describe, it, expect } from 'vitest'
import { generateAgentStatefulSet, generateIapBackendConfig, generateIngress, generateConfigMap, generateTeamConfigMap, generateAgentConfigMap, generateMcSecret, generateMcPvc, generateMcDeployment, generateMcService, generateMcIngress } from './manifests'

describe('generateAgentStatefulSet', () => {
  it('generates StatefulSet manifest with deterministic PVC name', () => {
    const manifest = generateAgentStatefulSet({ teamSlug: 'eng-alpha', agentSlug: 'alice' })
    expect(manifest).toContain('name: agent-alice')
    expect(manifest).toContain('team-eng-alpha')
    expect(manifest).toContain('containerPort: 18789')
  })

  it('uses correct default image', () => {
    const manifest = generateAgentStatefulSet({ teamSlug: 'test', agentSlug: 'bob' })
    expect(manifest).toContain('alpine/openclaw:latest')
  })

  it('uses custom image when provided', () => {
    const manifest = generateAgentStatefulSet({ teamSlug: 'test', agentSlug: 'bob', image: 'myrepo/openclaw:v2' })
    expect(manifest).toContain('myrepo/openclaw:v2')
  })

  it('includes configmap volumes and mounts them in init container', () => {
    const manifest = generateAgentStatefulSet({ teamSlug: 'eng-alpha', agentSlug: 'alice' })
    expect(manifest).toContain('shared-config')
    expect(manifest).toContain('agent-config')
    expect(manifest).toContain('/config/shared')
    expect(manifest).toContain('/config/agent')
  })

  it('sets OPENCLAW_WORKSPACE_DIR and OPENCLAW_STATE_DIR env vars', () => {
    const manifest = generateAgentStatefulSet({ teamSlug: 'eng-alpha', agentSlug: 'alice' })
    expect(manifest).toContain('OPENCLAW_WORKSPACE_DIR')
    expect(manifest).toContain('/workspace')
    expect(manifest).toContain('OPENCLAW_STATE_DIR')
    expect(manifest).toContain('/openclaw-state')
  })

  it('includes bootstrap init container that seeds workspace files', () => {
    const manifest = generateAgentStatefulSet({ teamSlug: 'eng-alpha', agentSlug: 'alice' })
    expect(manifest).toContain('bootstrap-init')
    expect(manifest).toContain('busybox:1.36')
    expect(manifest).toContain('BOOTSTRAP.md')
    expect(manifest).toContain('IDENTITY.md')
    expect(manifest).toContain('SOUL.md')
    expect(manifest).toContain('SKILLS.md')
    expect(manifest).toContain('TEAM.md')
  })

  it('mounts credential secret at openclaw-state/openclaw.json when provided', () => {
    const manifest = generateAgentStatefulSet({ teamSlug: 'eng-alpha', agentSlug: 'alice', credentialSecretName: 'eng-alpha-anthropic-credentials' })
    expect(manifest).toContain('eng-alpha-anthropic-credentials')
    expect(manifest).toContain('openclaw.json')
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

describe('generateConfigMap', () => {
  it('generates valid ConfigMap YAML with literal block scalars', () => {
    const yaml = generateConfigMap({
      name: 'test-config',
      namespace: 'default',
      data: { 'file.txt': 'hello world', 'other.md': '# Title\n\nContent' },
    })
    expect(yaml).toContain('kind: ConfigMap')
    expect(yaml).toContain('name: test-config')
    expect(yaml).toContain('file.txt: |')
    expect(yaml).toContain('    hello world')
    expect(yaml).toContain('other.md: |')
  })

  it('handles content with trailing newline without extra blank line between entries', () => {
    const yaml = generateConfigMap({
      name: 'test-config',
      namespace: 'default',
      data: { 'a.json': '{"key":"val"}\n', 'b.md': '# Title\n' },
    })
    expect(yaml).toContain('a.json: |')
    expect(yaml).toContain('b.md: |')
    expect(yaml).not.toMatch(/\n\n\n/)
  })
})

describe('generateTeamConfigMap', () => {
  it('generates shared ConfigMap with TEAM.md and BOOTSTRAP.md', () => {
    const yaml = generateTeamConfigMap({
      teamSlug: 'alpha',
      namespace: 'team-alpha',
      teamMd: '## TEAM\n\n## About\n- name: Alpha',
      bootstrapMd: '# Bootstrap',
    })
    expect(yaml).toContain('name: alpha-shared-config')
    expect(yaml).toContain('TEAM.md: |')
    expect(yaml).toContain('BOOTSTRAP.md: |')
  })
})

describe('generateAgentConfigMap', () => {
  it('generates per-agent ConfigMap with IDENTITY.md, SOUL.md and SKILLS.md', () => {
    const yaml = generateAgentConfigMap({
      teamSlug: 'alpha',
      agentSlug: 'alice',
      namespace: 'team-alpha',
      identityMd: '# Identity',
      soulMd: '# Soul',
      skillsMd: '# Skills',
      openclawJson: '{"agents":{"defaults":{"model":{"primary":"openai/gpt-4o"}}},"models":{"providers":{"openai":{}}}}',
    })
    expect(yaml).toContain('name: alpha-alice-config')
    expect(yaml).toContain('IDENTITY.md: |')
    expect(yaml).toContain('SOUL.md: |')
    expect(yaml).toContain('SKILLS.md: |')
  })
})

describe('generateMcSecret', () => {
  it('generates MC Secret with gateway env vars', () => {
    const manifest = generateMcSecret({
      teamSlug: 'eng-alpha', namespace: 'eng-alpha',
      adminPassword: 'pass123', sessionSecret: 'sess456', apiKey: 'key789',
      leadAgentSlug: 'alice',
    })
    expect(manifest).toContain('kind: Secret')
    expect(manifest).toContain('eng-alpha-mc-credentials')
    expect(manifest).toContain('ADMIN_PASSWORD: pass123')
    expect(manifest).toContain('agent-alice.eng-alpha.svc.cluster.local')
    expect(manifest).toContain('OPENCLAW_GATEWAY_PORT')
    expect(manifest).toContain('coordina.component: mission-control')
  })
})

describe('generateMcPvc', () => {
  it('generates MC PVC with default 5Gi storage', () => {
    const manifest = generateMcPvc({ teamSlug: 'eng-alpha', namespace: 'eng-alpha' })
    expect(manifest).toContain('kind: PersistentVolumeClaim')
    expect(manifest).toContain('eng-alpha-mc-data')
    expect(manifest).toContain('5Gi')
    expect(manifest).toContain('coordina.component: mission-control')
  })
})

describe('generateMcDeployment', () => {
  it('generates MC Deployment with correct port and volume', () => {
    const manifest = generateMcDeployment({ teamSlug: 'eng-alpha', image: 'gcr.io/proj/mc:latest', namespace: 'eng-alpha' })
    expect(manifest).toContain('kind: Deployment')
    expect(manifest).toContain('name: mission-control')
    expect(manifest).toContain('containerPort: 3000')
    expect(manifest).toContain('/app/.data')
    expect(manifest).toContain('eng-alpha-mc-credentials')
    expect(manifest).toContain('gcr.io/proj/mc:latest')
    expect(manifest).toContain('/api/health')
  })
})

describe('generateMcService', () => {
  it('generates MC ClusterIP service on port 3000', () => {
    const manifest = generateMcService({ teamSlug: 'eng-alpha', namespace: 'eng-alpha' })
    expect(manifest).toContain('kind: Service')
    expect(manifest).toContain('name: mission-control')
    expect(manifest).toContain('port: 3000')
    expect(manifest).toContain('coordina.component: mission-control')
  })
})

describe('generateMcIngress', () => {
  it('generates MC Ingress with custom domain', () => {
    const manifest = generateMcIngress({ teamSlug: 'eng-alpha', domain: 'mc.example.com', namespace: 'eng-alpha' })
    expect(manifest).toContain('kind: Ingress')
    expect(manifest).toContain('eng-alpha-mc-ingress')
    expect(manifest).toContain('mc.example.com')
    expect(manifest).toContain('port:')
    expect(manifest).toContain('3000')
  })
})
