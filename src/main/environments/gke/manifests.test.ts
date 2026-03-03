import { describe, it, expect } from 'vitest'
import { generateAgentStatefulSet, generateIapBackendConfig, generateIngress, generateConfigMap, generateTeamConfigMap, generateAgentConfigMap } from './manifests'

describe('generateAgentStatefulSet', () => {
  it('generates StatefulSet manifest with deterministic PVC name', () => {
    const manifest = generateAgentStatefulSet({ teamSlug: 'eng-alpha', agentSlug: 'alice' })
    expect(manifest).toContain('name: agent-alice')
    expect(manifest).toContain('team-eng-alpha-alice')
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

  it('includes configmap volume mounts', () => {
    const manifest = generateAgentStatefulSet({ teamSlug: 'eng-alpha', agentSlug: 'alice' })
    expect(manifest).toContain('shared-config')
    expect(manifest).toContain('agent-config')
    expect(manifest).toContain('/config/shared')
    expect(manifest).toContain('/config/agent')
  })

  it('includes bootstrap init container', () => {
    const manifest = generateAgentStatefulSet({ teamSlug: 'eng-alpha', agentSlug: 'alice' })
    expect(manifest).toContain('bootstrap-init')
    expect(manifest).toContain('busybox:1.36')
    expect(manifest).toContain('BOOTSTRAP-INSTRUCTIONS.md')
    expect(manifest).toContain('BOOTSTRAP.md')
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
  it('generates shared ConfigMap with team.json, AGENTS.md and BOOTSTRAP-INSTRUCTIONS.md', () => {
    const yaml = generateTeamConfigMap({
      teamSlug: 'alpha',
      namespace: 'team-alpha',
      teamJson: '{"name":"Alpha"}',
      agentsMd: '# Agents',
      bootstrapInstructionsMd: '# Bootstrap',
    })
    expect(yaml).toContain('name: alpha-shared-config')
    expect(yaml).toContain('team.json: |')
    expect(yaml).toContain('AGENTS.md: |')
    expect(yaml).toContain('BOOTSTRAP-INSTRUCTIONS.md: |')
  })
})

describe('generateAgentConfigMap', () => {
  it('generates per-agent ConfigMap with 5 files', () => {
    const yaml = generateAgentConfigMap({
      teamSlug: 'alpha',
      agentSlug: 'alice',
      namespace: 'team-alpha',
      agentJson: '{}',
      identityMd: '# Identity',
      soulMd: '# Soul',
      skillsMd: '# Skills',
      openclawJson: '{}',
    })
    expect(yaml).toContain('name: alpha-alice-config')
    expect(yaml).toContain('agent.json: |')
    expect(yaml).toContain('IDENTITY.md: |')
    expect(yaml).toContain('SOUL.md: |')
    expect(yaml).toContain('SKILLS.md: |')
    expect(yaml).toContain('openclaw.json: |')
  })
})
