import { describe, it, expect } from 'vitest'
import type { MissionControlConfig } from '../../shared/types'

describe('MissionControlConfig', () => {
  it('accepts a valid enabled config with all fields', () => {
    const config: MissionControlConfig = {
      enabled: true,
      image: 'gcr.io/my-project/mission-control:latest',
    }
    expect(config.enabled).toBe(true)
    expect(config.image).toBe('gcr.io/my-project/mission-control:latest')
  })

  it('accepts enabled: false', () => {
    const config: MissionControlConfig = {
      enabled: false,
      image: '',
    }
    expect(config.enabled).toBe(false)
  })
})
