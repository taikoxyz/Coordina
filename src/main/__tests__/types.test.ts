import { describe, it, expect } from 'vitest'
import type { MissionControlConfig } from '../../shared/types'

describe('MissionControlConfig', () => {
  it('accepts a valid config', () => {
    const config: MissionControlConfig = {
      enabled: true,
      image: 'gcr.io/my-project/mission-control:latest',
      domain: 'mc.example.com',
      adminPassword: 'secret',
      sessionSecret: 'abc123abc123abc123abc123abc123ab',
      apiKey: 'myapikey',
    }
    expect(config.enabled).toBe(true)
  })
})
