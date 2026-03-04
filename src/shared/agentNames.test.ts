import { describe, expect, it } from 'vitest'
import {
  generateAutoAgentIdentities,
  SCI_FI_AGENT_NAMES,
  type ExistingAgentIdentity
} from './agentNames'

describe('generateAutoAgentIdentities', () => {
  it('uses the selected theme pool', () => {
    const [first] = generateAutoAgentIdentities([], 1, 'sci-fi')
    expect(first).toEqual({ name: 'Ripley', slug: 'ripley' })
  })

  it('uses variants once a name pool is exhausted', () => {
    const existingAgents: ExistingAgentIdentity[] = SCI_FI_AGENT_NAMES.map((name) => ({
      name,
      slug: name.toLowerCase().replace(/[^a-z0-9]+/g, '-')
    }))

    const [next] = generateAutoAgentIdentities(existingAgents, 1, 'sci-fi')
    expect(next.name).toBe('Ripley Prime')
    expect(next.slug).toBe('ripley-prime')
  })

  it('keeps generated slugs unique', () => {
    const [first] = generateAutoAgentIdentities([{ slug: 'ripley' }], 1, 'sci-fi')
    expect(first.slug).toBe('ripley-2')
  })

  it('generates multiple unique identities for batch add', () => {
    const generated = generateAutoAgentIdentities([], 10, 'mixed')
    expect(generated).toHaveLength(10)

    const names = new Set(generated.map((agent) => agent.name.toLowerCase()))
    const slugs = new Set(generated.map((agent) => agent.slug))

    expect(names.size).toBe(10)
    expect(slugs.size).toBe(10)
  })
})
