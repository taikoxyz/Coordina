import { describe, it, expect, beforeEach } from 'vitest'
import { registerProvider, getProvider, listProviders, _resetRegistry } from './base'

describe('provider registry', () => {
  beforeEach(() => { _resetRegistry() })

  it('registers and retrieves a provider', () => {
    registerProvider({
      id: 'test',
      displayName: 'Test',
      configSchema: {},
      supportedModels: [],
      validate: () => ({ valid: true }),
      toOpenClawJson: (c: unknown) => ({ provider: 'test', model: (c as { model: string }).model }),
    })
    expect(getProvider('test').displayName).toBe('Test')
    expect(listProviders().some((p) => p.id === 'test')).toBe(true)
  })

  it('throws on unknown provider', () => {
    expect(() => getProvider('nonexistent')).toThrow('Unknown model provider: nonexistent')
  })
})
