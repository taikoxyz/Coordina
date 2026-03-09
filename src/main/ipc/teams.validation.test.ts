import { describe, it, expect, vi } from 'vitest'
import type { TeamSpec } from '../../shared/types'

vi.mock('electron', () => ({
  ipcMain: { handle: vi.fn() },
}))

import { validateTelegramPair, normalizeTeamSpec } from '../validation/teamSpecNormalize'

const baseSpec: TeamSpec = {
  slug: 'team-a',
  name: 'Team A',
  agents: [
    {
      slug: 'alpha',
      name: 'Alpha',
      role: 'Lead',
      skills: [],
      persona: 'Pragmatic',
      model: 'anthropic',
    },
  ],
}

describe('validateTelegramPair', () => {
  it('passes when both fields are empty', () => {
    expect(() => validateTelegramPair({ ...baseSpec })).not.toThrow()
  })

  it('passes when both fields are provided', () => {
    expect(() => validateTelegramPair({
      ...baseSpec,
      telegramGroupId: '-1001234567890',
      telegramAdminId: '222222222',
    })).not.toThrow()
  })

  it('fails when group id exists without admin id', () => {
    expect(() => validateTelegramPair({
      ...baseSpec,
      telegramGroupId: '-1001234567890',
      telegramAdminId: '  ',
    })).toThrow('telegramGroupId and telegramAdminId must both be set or both be empty')
  })

  it('fails when admin id exists without group id', () => {
    expect(() => validateTelegramPair({
      ...baseSpec,
      telegramGroupId: '',
      telegramAdminId: '222222222',
    })).toThrow('telegramGroupId and telegramAdminId must both be set or both be empty')
  })
})

describe('normalizeTeamSpec', () => {
  it('rewrites legacy fields and trims optional strings', () => {
    const legacy = {
      ...baseSpec,
      slug: ' team-a ',
      name: ' Team A ',
      domain: 'legacy.example.com',
      telegramGroupId: ' -1001234567890 ',
      telegramAdminId: ' 222222222 ',
      defaultImage: ' ghcr.io/org/openclaw:latest ',
      defaultDiskGi: -1,
      leadAgent: 'missing-agent',
      agents: [{
        ...baseSpec.agents[0],
        slug: ' alpha ',
        name: ' Alpha ',
        role: ' Lead ',
        model: ' anthropic ',
        telegramBot: ' 111111111 ',
        skills: [' research ', ' ', 'write'],
        cpu: -1,
        diskGi: 0,
      }],
    } as TeamSpec & { domain?: string }

    const normalized = normalizeTeamSpec(legacy)

    expect((normalized as TeamSpec & { domain?: string }).domain).toBeUndefined()
    expect(normalized.slug).toBe('team-a')
    expect(normalized.name).toBe('Team A')
    expect(normalized.telegramGroupId).toBe('-1001234567890')
    expect(normalized.telegramAdminId).toBe('222222222')
    expect(normalized.defaultImage).toBe('ghcr.io/org/openclaw:latest')
    expect(normalized.defaultDiskGi).toBeUndefined()
    expect(normalized.leadAgent).toBeUndefined()
    expect(normalized.agents[0].slug).toBe('alpha')
    expect(normalized.agents[0].model).toBe('anthropic')
    expect(normalized.agents[0].telegramBot).toBe('111111111')
    expect(normalized.agents[0].skills).toEqual(['research', 'write'])
    expect(normalized.agents[0].cpu).toBeUndefined()
    expect(normalized.agents[0].diskGi).toBeUndefined()
  })
})
