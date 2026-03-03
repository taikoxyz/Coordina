import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockGenerateText = vi.hoisted(() => vi.fn())

vi.mock('ai', () => ({
  generateText: mockGenerateText,
}))

import type { LanguageModel } from 'ai'
import { enhanceSkills, enhanceSoul } from './enhance'

const mockModel = {} as LanguageModel

describe('enhanceSkills', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns expanded skill list for role', async () => {
    mockGenerateText.mockResolvedValue({
      text: '["TypeScript", "React", "Git", "Testing", "Code review"]',
    })
    const result = await enhanceSkills({ role: 'Engineer', skills: ['git', 'typescript'], model: mockModel })
    expect(Array.isArray(result)).toBe(true)
    expect(result.length).toBeGreaterThan(2)
  })

  it('falls back to original skills on malformed JSON response', async () => {
    mockGenerateText.mockResolvedValue({
      text: 'Here are some skills for you.',
    })
    const result = await enhanceSkills({ role: 'PM', skills: ['planning'], model: mockModel })
    expect(result).toEqual(['planning'])
  })
})

describe('enhanceSoul', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns richer soul description', async () => {
    const enhanced = 'Alice approaches engineering pragmatically with a focus on delivery and code quality.'
    mockGenerateText.mockResolvedValue({
      text: enhanced,
    })
    const result = await enhanceSoul({ role: 'Engineer', userInput: 'Alice is pragmatic.', model: mockModel })
    expect(typeof result).toBe('string')
    expect(result.length).toBeGreaterThan('Alice is pragmatic.'.length)
    expect(result).toBe(enhanced)
  })

  it('falls back to userInput on empty response', async () => {
    mockGenerateText.mockResolvedValue({ text: '' })
    const result = await enhanceSoul({ role: 'Engineer', userInput: 'fallback text', model: mockModel })
    expect(result).toBe('fallback text')
  })
})
