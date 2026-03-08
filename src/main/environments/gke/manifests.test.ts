import { describe, it, expect } from 'vitest'
import { generateAgentStatefulSet, generateAgentService, generateIapBackendConfig, generateIngress, generateConfigMap, generateTeamConfigMap, generateAgentConfigMap, generateStorageClass, generateAgentPvc } from './manifests'

describe('generateAgentStatefulSet', () => {
  it('generates StatefulSet manifest with deterministic PVC name', () => {
    const manifest = generateAgentStatefulSet({ teamSlug: 'eng-alpha', agentSlug: 'alice' })
    expect(manifest).toContain('name: agent-alice')
    expect(manifest).toContain('eng-alpha-agent-alice')
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

  it('sets OPENCLAW_WORKSPACE_DIR and OPENCLAW_STATE_DIR env vars pointing to PVC subdirectories', () => {
    const manifest = generateAgentStatefulSet({ teamSlug: 'eng-alpha', agentSlug: 'alice' })
    expect(manifest).toContain('OPENCLAW_WORKSPACE_DIR')
    expect(manifest).toContain('/agent-data/openclaw/workspace')
    expect(manifest).toContain('OPENCLAW_STATE_DIR')
    expect(manifest).toContain('/agent-data/openclaw/state')
  })

  it('includes bootstrap init container that seeds workspace files into /agent-data', () => {
    const manifest = generateAgentStatefulSet({ teamSlug: 'eng-alpha', agentSlug: 'alice' })
    expect(manifest).toContain('bootstrap-init')
    expect(manifest).toContain('busybox:1.36')
    expect(manifest).toContain('/agent-data/openclaw/workspace/BOOTSTRAP.md')
    expect(manifest).toContain('/agent-data/openclaw/workspace/IDENTITY.md')
    expect(manifest).toContain('/agent-data/openclaw/workspace/SOUL.md')
    expect(manifest).toContain('/agent-data/openclaw/workspace/SKILLS.md')
    expect(manifest).toContain('TEAM.md')
  })

  it('mounts credential secret at openclaw-state/openclaw.json when provided', () => {
    const manifest = generateAgentStatefulSet({ teamSlug: 'eng-alpha', agentSlug: 'alice', credentialSecretName: 'eng-alpha-anthropic-credentials' })
    expect(manifest).toContain('eng-alpha-anthropic-credentials')
    expect(manifest).toContain('openclaw.json')
  })

  it('mounts PVC at /agent-data with no emptyDir volumes', () => {
    const manifest = generateAgentStatefulSet({ teamSlug: 'eng-alpha', agentSlug: 'alice' })
    expect(manifest).toContain('mountPath: /agent-data')
    expect(manifest).not.toContain('emptyDir')
  })

  it('init container creates state and workspace directories', () => {
    const manifest = generateAgentStatefulSet({ teamSlug: 'eng-alpha', agentSlug: 'alice' })
    expect(manifest).toContain('mkdir -p /agent-data/openclaw/state /agent-data/openclaw/workspace')
    expect(manifest).toContain('chown -R 1000:1000')
    expect(manifest).toContain('chmod -R u+rwX,g+rwX')
  })

  it('sets pod fsGroup so runtime process can write PVC-backed state', () => {
    const manifest = generateAgentStatefulSet({ teamSlug: 'eng-alpha', agentSlug: 'alice' })
    expect(manifest).toContain('fsGroup: 1000')
    expect(manifest).toContain('fsGroupChangePolicy: OnRootMismatch')
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

describe('generateAgentService', () => {
  it('adds NEG annotation required by GCE ingress for ClusterIP backends', () => {
    const manifest = generateAgentService({ teamSlug: 'eng-alpha', agentSlug: 'alice' })
    expect(manifest).toContain('kind: Service')
    expect(manifest).toContain('cloud.google.com/neg')
    expect(manifest).toContain('{"ingress": true}')
    expect(manifest).toContain('type: ClusterIP')
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
  it('generates per-agent ConfigMap with agent markdown files', () => {
    const yaml = generateAgentConfigMap({
      teamSlug: 'alpha',
      agentSlug: 'alice',
      namespace: 'team-alpha',
      identityMd: '# Identity',
      soulMd: '# Soul',
      skillsMd: '# Skills',
      agentsMd: '# Agents',
      userMd: '# User',
      toolsMd: '# Tools',
      openclawJson: '{ "agents": { "defaults": { "model": { "primary": "anthropic/claude-sonnet-4-6" } } }, "models": { "providers": { "anthropic": {} } } }',
    })
    expect(yaml).toContain('name: alpha-alice-config')
    expect(yaml).toContain('IDENTITY.md: |')
    expect(yaml).not.toContain('MEMORY.md')
    expect(yaml).toContain('SOUL.md: |')
    expect(yaml).toContain('SKILLS.md: |')
    expect(yaml).toContain('AGENTS.md: |')
    expect(yaml).toContain('USER.md: |')
    expect(yaml).toContain('TOOLS.md: |')
  })
})

describe('generateStorageClass', () => {
  it('generates StorageClass with Retain policy and WaitForFirstConsumer binding', () => {
    const manifest = generateStorageClass({ teamSlug: 'eng-alpha' })
    expect(manifest).toContain('kind: StorageClass')
    expect(manifest).toContain('name: coordina-eng-alpha')
    expect(manifest).toContain('provisioner: pd.csi.storage.gke.io')
    expect(manifest).toContain('reclaimPolicy: Retain')
    expect(manifest).toContain('volumeBindingMode: WaitForFirstConsumer')
    expect(manifest).toContain('allowVolumeExpansion: true')
    expect(manifest).toContain('type: pd-balanced')
    expect(manifest).toContain('coordina.team: eng-alpha')
  })
})

describe('generateAgentPvc', () => {
  it('generates PVC with dynamic StorageClass instead of static volumeName', () => {
    const manifest = generateAgentPvc({ teamSlug: 'eng-alpha', agentSlug: 'alice', namespace: 'eng-alpha' })
    expect(manifest).toContain('kind: PersistentVolumeClaim')
    expect(manifest).toContain('name: eng-alpha-agent-alice')
    expect(manifest).toContain('storageClassName: coordina-eng-alpha')
    expect(manifest).toContain('coordina.agent: alice')
    expect(manifest).not.toContain('volumeName')
  })

  it('uses custom disk size when provided', () => {
    const manifest = generateAgentPvc({ teamSlug: 'eng-alpha', agentSlug: 'alice', namespace: 'eng-alpha', diskGi: 50 })
    expect(manifest).toContain('storage: 50Gi')
  })
})
