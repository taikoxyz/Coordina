import { describe, it, expect } from 'vitest'
import './index' // registers all providers
import { getProvider } from './base'

describe('anthropic provider', () => {
  it('validates API key prefix', () => {
    const p = getProvider('anthropic')
    expect(p.validate({ apiKey: 'sk-ant-abc', model: 'claude-sonnet-4-6' }).valid).toBe(true)
    expect(p.validate({ apiKey: 'wrong', model: 'claude-sonnet-4-6' }).valid).toBe(false)
    expect(p.validate({ apiKey: '', model: 'claude-sonnet-4-6' }).valid).toBe(false)
  })
  it('toOpenClawJson maps correctly', () => {
    const p = getProvider('anthropic')
    expect(p.toOpenClawJson({ apiKey: 'sk-ant-abc', model: 'claude-sonnet-4-6' }))
      .toEqual({ agents: { defaults: { model: { primary: 'anthropic/claude-sonnet-4-6' } } }, models: { providers: { anthropic: { apiKey: 'sk-ant-abc' } } } })
  })
})

describe('openai provider', () => {
  it('validates API key prefix', () => {
    const p = getProvider('openai')
    expect(p.validate({ apiKey: 'sk-abc', model: 'gpt-4o' }).valid).toBe(true)
    expect(p.validate({ apiKey: 'wrong', model: 'gpt-4o' }).valid).toBe(false)
  })
})

describe('deepseek provider', () => {
  it('validates that apiKey is present', () => {
    const p = getProvider('deepseek')
    expect(p.validate({ apiKey: 'ds-abc', model: 'deepseek-chat' }).valid).toBe(true)
    expect(p.validate({ apiKey: '', model: 'deepseek-chat' }).valid).toBe(false)
  })
})

describe('ollama provider', () => {
  it('validates baseUrl is present', () => {
    const p = getProvider('ollama')
    expect(p.validate({ baseUrl: 'http://localhost:11434', model: 'llama3' }).valid).toBe(true)
    expect(p.validate({ baseUrl: '', model: 'llama3' }).valid).toBe(false)
  })
})

describe('openrouter provider', () => {
  it('validates API key prefix', () => {
    const p = getProvider('openrouter')
    expect(p.validate({ apiKey: 'sk-or-abc', model: 'openai/gpt-4o' }).valid).toBe(true)
    expect(p.validate({ apiKey: 'wrong', model: 'openai/gpt-4o' }).valid).toBe(false)
  })
})
