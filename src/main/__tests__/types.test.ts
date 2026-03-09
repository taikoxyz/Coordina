import { describe, it, expect } from 'vitest'
import type { MissionControlConfig } from '../../shared/types'

describe('MissionControlConfig', () => {
  it('accepts a valid enabled config with all fields', () => {
    const config: MissionControlConfig = {
      enabled: true,
      image: 'gcr.io/my-project/mission-control:latest',
      domain: 'mc.example.com',
      adminPassword: 'secret',
      sessionSecret: 'abc123abc123abc123abc123abc123ab',
      apiKey: 'myapikey',
    }
    expect(config.enabled).toBe(true)
    expect(config.image).toBe('gcr.io/my-project/mission-control:latest')
    expect(config.domain).toBe('mc.example.com')
    expect(config.adminPassword).toBe('secret')
    expect(config.sessionSecret).toBe('abc123abc123abc123abc123abc123ab')
    expect(config.apiKey).toBe('myapikey')
  })

  it('accepts enabled: false', () => {
    const config: MissionControlConfig = {
      enabled: false,
      image: '',
      domain: '',
      adminPassword: '',
      sessionSecret: '',
      apiKey: '',
    }
    expect(config.enabled).toBe(false)
  })
})
