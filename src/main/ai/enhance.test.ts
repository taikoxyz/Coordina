import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockCreate = vi.hoisted(() => vi.fn())

vi.mock('@anthropic-ai/sdk', () => ({
  default: function MockAnthropic() {
    return {
      messages: { create: mockCreate },
    }
  },
}))

import { enhanceSkills, enhanceSoul } from './enhance'

describe('enhanceSkills', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns expanded skill list for role', async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: 'text', text: '["TypeScript", "React", "Git", "Testing", "Code review"]' }],
    })
    const result = await enhanceSkills({ role: 'Engineer', skills: ['git', 'typescript'], apiKey: 'sk-ant-test' })
    expect(Array.isArray(result)).toBe(true)
    expect(result.length).toBeGreaterThan(2)
  })

  it('throws if no Anthropic key configured', async () => {
    await expect(enhanceSkills({ role: 'Engineer', skills: [], apiKey: null }))
      .rejects.toThrow('Anthropic API key not configured')
  })

  it('falls back to original skills on malformed JSON response', async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: 'text', text: 'Here are some skills for you.' }],
    })
    const result = await enhanceSkills({ role: 'PM', skills: ['planning'], apiKey: 'sk-ant-test' })
    expect(result).toEqual(['planning'])
  })
})

describe('enhanceSoul', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns richer soul description', async () => {
    const enhanced = 'Alice approaches engineering pragmatically with a focus on delivery and code quality.'
    mockCreate.mockResolvedValue({
      content: [{ type: 'text', text: enhanced }],
    })
    const result = await enhanceSoul({ role: 'Engineer', userInput: 'Alice is pragmatic.', apiKey: 'sk-ant-test' })
    expect(typeof result).toBe('string')
    expect(result.length).toBeGreaterThan('Alice is pragmatic.'.length)
    expect(result).toBe(enhanced)
  })

  it('throws if no Anthropic key configured', async () => {
    await expect(enhanceSoul({ role: 'Engineer', userInput: 'x', apiKey: null }))
      .rejects.toThrow('Anthropic API key not configured')
  })
})
