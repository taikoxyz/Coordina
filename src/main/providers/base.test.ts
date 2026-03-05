import { describe, it, expect, beforeEach } from 'vitest'
import { registerProvider, getProvider, listProviders, _resetRegistry } from './base'

describe('provider registry', () => {
  beforeEach(() => { _resetRegistry() })

  it('registers and retrieves a provider', () => {
    registerProvider({
      id: 'test',
      displayName: 'Test',
      defaultModel: 'test-model',
      configSchema: {},
      supportedModels: [],
      validate: () => ({ valid: true }),
      testConnection: async () => ({ valid: true }),
      listModels: async () => [],
      toOpenClawJson: (c: unknown) => ({
        agents: { defaults: { model: { primary: `test/${(c as { model: string }).model}` } } },
        models: { providers: { test: {} } },
      }),
      toEnvVars: () => ({}),
    })
    expect(getProvider('test').displayName).toBe('Test')
    expect(listProviders().some((p) => p.id === 'test')).toBe(true)
  })

  it('throws on unknown provider', () => {
    expect(() => getProvider('nonexistent')).toThrow('Unknown model provider: nonexistent')
  })
})
