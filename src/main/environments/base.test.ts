// Tests for deployment environment registry — register, retrieve, list environments
// FEATURE: Deployment environment abstraction for multi-cloud provider support
import { describe, it, expect, beforeEach } from 'vitest'
import { registerEnvironment, getEnvironment, listEnvironments, _resetEnvRegistry } from './base'
import type { DeployStatus } from '../../shared/types'

async function* noopIterable(): AsyncGenerator<DeployStatus> {}

describe('environment registry', () => {
  beforeEach(() => _resetEnvRegistry())

  it('registers and retrieves an environment', () => {
    registerEnvironment({
      id: 'test-env',
      displayName: 'Test Env',
      configSchema: {},
      validate: () => ({ valid: true }),
      deploy: () => noopIterable(),
      undeploy: () => noopIterable(),
      getStatus: async () => [],
    })
    expect(getEnvironment('test-env').displayName).toBe('Test Env')
    expect(listEnvironments().some(e => e.id === 'test-env')).toBe(true)
  })

  it('throws on unknown environment', () => {
    expect(() => getEnvironment('nonexistent')).toThrow('Unknown deployment environment: nonexistent')
  })

  it('listEnvironments returns all registered environments', () => {
    registerEnvironment({ id: 'env-a', displayName: 'A', configSchema: {}, validate: () => ({ valid: true }), deploy: () => noopIterable(), undeploy: () => noopIterable(), getStatus: async () => [] })
    registerEnvironment({ id: 'env-b', displayName: 'B', configSchema: {}, validate: () => ({ valid: true }), deploy: () => noopIterable(), undeploy: () => noopIterable(), getStatus: async () => [] })
    expect(listEnvironments().length).toBe(2)
  })
})
