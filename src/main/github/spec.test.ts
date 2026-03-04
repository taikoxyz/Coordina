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
    const json = generateOpenClawJson({
      agents: { defaults: { model: { primary: 'anthropic/claude-sonnet-4-6' } } },
      models: { providers: { anthropic: { apiKey: 'sk-ant-xxx' } } },
    })
    const parsed = JSON.parse(json)
    expect(parsed.agents.defaults.model.primary).toBe('anthropic/claude-sonnet-4-6')
    expect(parsed.models.providers.anthropic.apiKey).toBe('sk-ant-xxx')
  })

  it('excludes API key from JSON when not set', () => {
    const json = generateOpenClawJson({
      agents: { defaults: { model: { primary: 'ollama/llama3' } } },
      models: { providers: { ollama: { baseUrl: 'http://localhost:11434' } } },
    })
    const parsed = JSON.parse(json)
    expect(parsed.models.providers.ollama.baseUrl).toBe('http://localhost:11434')
    expect(parsed.models.providers.ollama.apiKey).toBeUndefined()
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
