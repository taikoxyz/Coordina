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
      soul: 'Pragmatic',
      providerSlug: 'anthropic',
      isLead: true,
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
      telegramGroupChatId: '-1001234567890',
      telegramOwnerUserId: '222222222',
    })).not.toThrow()
  })

  it('fails when group chat id exists without owner user id', () => {
    expect(() => validateTelegramPair({
      ...baseSpec,
      telegramGroupChatId: '-1001234567890',
      telegramOwnerUserId: '  ',
    })).toThrow('telegramGroupChatId and telegramOwnerUserId must both be set or both be empty')
  })

  it('fails when owner user id exists without group chat id', () => {
    expect(() => validateTelegramPair({
      ...baseSpec,
      telegramGroupChatId: '',
      telegramOwnerUserId: '222222222',
    })).toThrow('telegramGroupChatId and telegramOwnerUserId must both be set or both be empty')
  })
})

describe('normalizeTeamSpec', () => {
  it('rewrites legacy fields and trims optional strings', () => {
    const legacy = {
      ...baseSpec,
      slug: ' team-a ',
      name: ' Team A ',
      domain: 'legacy.example.com',
      telegramGroupChatId: ' -1001234567890 ',
      telegramOwnerUserId: ' 222222222 ',
      image: ' ghcr.io/org/openclaw:latest ',
      storageGi: -1,
      leadAgentSlug: 'missing-agent',
      agents: [{
        ...baseSpec.agents[0],
        slug: ' alpha ',
        name: ' Alpha ',
        role: ' Lead ',
        providerSlug: ' anthropic ',
        telegramBotId: ' 111111111 ',
        skills: [' research ', ' ', 'write'],
        cpu: -1,
        storageGi: 0,
      }],
    } as TeamSpec & { domain?: string }

    const normalized = normalizeTeamSpec(legacy)

    expect((normalized as TeamSpec & { domain?: string }).domain).toBeUndefined()
    expect(normalized.slug).toBe('team-a')
    expect(normalized.name).toBe('Team A')
    expect(normalized.telegramGroupChatId).toBe('-1001234567890')
    expect(normalized.telegramOwnerUserId).toBe('222222222')
    expect(normalized.image).toBe('ghcr.io/org/openclaw:latest')
    expect(normalized.storageGi).toBeUndefined()
    expect(normalized.leadAgentSlug).toBeUndefined()
    expect(normalized.agents[0].slug).toBe('alpha')
    expect(normalized.agents[0].providerSlug).toBe('anthropic')
    expect(normalized.agents[0].telegramBotId).toBe('111111111')
    expect(normalized.agents[0].skills).toEqual(['research', 'write'])
    expect(normalized.agents[0].cpu).toBeUndefined()
    expect(normalized.agents[0].storageGi).toBeUndefined()
  })
})
