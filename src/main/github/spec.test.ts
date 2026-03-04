import { describe, it, expect } from 'vitest'
import { generateIdentityMd, generateSoulMd, generateOpenClawJson, generateSkillsMd, generateAgentsMd } from './spec'

describe('generateIdentityMd', () => {
  it('references TEAM.md with agent slug', () => {
    const md = generateIdentityMd({ name: 'Alice Chen', slug: 'alice', role: 'Engineer' })
    expect(md).toContain('`alice`')
    expect(md).toContain('TEAM.md')
  })

  it('works without optional fields', () => {
    const md = generateIdentityMd({ name: 'Bob', slug: 'bob', role: 'PM' })
    expect(md).toContain('`bob`')
    expect(md).toContain('TEAM.md')
  })
})

describe('generateSoulMd', () => {
  it('uses enhanced text when provided', () => {
    const md = generateSoulMd({ userInput: 'Alice is pragmatic.', enhanced: 'Alice approaches engineering pragmatically.' })
    expect(md).toContain('Alice approaches engineering pragmatically.')
    expect(md).not.toContain('Alice is pragmatic.')
  })

  it('falls back to userInput when no enhanced text', () => {
    const md = generateSoulMd({ userInput: 'Bob is methodical.' })
    expect(md).toContain('Bob is methodical.')
  })

  it('outputs minimal soul markdown without scaffolding', () => {
    const md = generateSoulMd({ userInput: 'x' })
    expect(md).toBe('# Soul\n\nx\n')
    expect(md).not.toContain('## Core Values')
    expect(md).not.toContain('## Working Style')
  })
})

describe('generateOpenClawJson', () => {
  it('generates openclaw.json for anthropic provider', () => {
    const json = generateOpenClawJson({ provider: 'anthropic', model: 'claude-sonnet-4-6', apiKey: 'sk-ant-xxx' })
    expect(JSON.parse(json)).toMatchObject({ provider: 'anthropic', model: 'claude-sonnet-4-6' })
  })

  it('excludes API key from JSON when not set', () => {
    const json = generateOpenClawJson({ provider: 'ollama', model: 'llama3', baseUrl: 'http://localhost:11434' })
    const parsed = JSON.parse(json)
    expect(parsed.baseUrl).toBe('http://localhost:11434')
  })
})

describe('generateSkillsMd', () => {
  it('generates skills list', () => {
    const md = generateSkillsMd(['TypeScript', 'React', 'Docker'])
    expect(md).toContain('- TypeScript')
    expect(md).toContain('- React')
  })

  it('shows placeholder for empty skills', () => {
    const md = generateSkillsMd([])
    expect(md).toContain('No skills defined')
  })
})

describe('generateOpenClawJson peers', () => {
  it('serializes peers into openclaw.json when provided', () => {
    const config: import('./spec').OpenClawConfig = {
      agents: { defaults: { model: { primary: 'anthropic/claude-sonnet-4-6' } } },
      models: { providers: { anthropic: {} } },
      peers: {
        beta: { url: 'http://agent-beta.my-team.svc.cluster.local:18789', token: 'tok-beta' },
        gamma: { url: 'http://agent-gamma.my-team.svc.cluster.local:18789', token: 'tok-gamma' },
      },
    }
    const parsed = JSON.parse(generateOpenClawJson(config))
    expect(parsed.peers.beta.url).toBe('http://agent-beta.my-team.svc.cluster.local:18789')
    expect(parsed.peers.beta.token).toBe('tok-beta')
    expect(parsed.peers.gamma.url).toBe('http://agent-gamma.my-team.svc.cluster.local:18789')
  })
})

describe('generateAgentsMd', () => {
  it('marks lead agent', () => {
    const md = generateAgentsMd([
      { slug: 'alice', name: 'Alice', role: 'Engineer', isLead: true },
      { slug: 'bob', name: 'Bob', role: 'PM' },
    ])
    expect(md).toContain('Alice')
    expect(md).toContain('_(lead)_')
    expect(md).toContain('Bob')
  })
})
