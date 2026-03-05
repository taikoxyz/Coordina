import { describe, it, expect } from 'vitest'
import { generateIdentityMd, generateSoulMd, generateOpenClawJson, generateSkillsMd, generateAgentsMd, generateTeamMd } from './spec'

describe('generateIdentityMd', () => {
  it('outputs OpenClaw format with Name, Creature, Vibe, Emoji, Avatar sections', () => {
    const md = generateIdentityMd({ name: 'Alice Chen', role: 'Engineer' })
    expect(md).toContain('Name:\nAlice Chen')
    expect(md).toContain('Creature:\nEngineer')
    expect(md).toContain('Vibe:')
    expect(md).toContain('Emoji:')
    expect(md).toContain('Avatar:')
  })

  it('includes soul as Vibe and optional emoji and avatar', () => {
    const md = generateIdentityMd({ name: 'Alice', role: 'Engineer', soul: 'Sharp and curious.', emoji: '🤖', avatar: '/avatar.png' })
    expect(md).toContain('Vibe:\nSharp and curious.')
    expect(md).toContain('Emoji:\n🤖')
    expect(md).toContain('Avatar:\n/avatar.png')
  })

  it('leaves optional sections blank when absent', () => {
    const md = generateIdentityMd({ name: 'Bob', role: 'PM' })
    expect(md).toContain('Vibe:\n')
    expect(md).toContain('Emoji:\n')
    expect(md).toContain('Avatar:\n')
  })
})

describe('generateSoulMd', () => {
  it('uses enhanced text when provided', () => {
    const md = generateSoulMd({ userInput: 'Alice is pragmatic.', enhanced: 'Alice approaches engineering pragmatically.' })
    expect(md).toContain('Alice approaches engineering pragmatically.')
    expect(md).not.toContain('Alice is pragmatic.')
  })

  it('falls back to userInput when no enhanced text', () => {
    const md = generateSoulMd({ userInput: 'Bob is methodical.' })
    expect(md).toContain('Bob is methodical.')
  })

  it('outputs minimal soul markdown without scaffolding', () => {
    const md = generateSoulMd({ userInput: 'x' })
    expect(md).toBe('# Soul\n\nx\n')
    expect(md).not.toContain('## Core Values')
    expect(md).not.toContain('## Working Style')
  })
})

describe('generateOpenClawJson', () => {
  it('generates openclaw.json for anthropic provider', () => {
    const json = generateOpenClawJson({
      agents: { defaults: { model: { primary: 'anthropic/claude-sonnet-4-6' } } },
      models: { providers: { anthropic: { apiKey: 'sk-ant-xxx' } } },
    })
    const parsed = JSON.parse(json)
    expect(parsed.agents.defaults.model.primary).toBe('anthropic/claude-sonnet-4-6')
    expect(parsed.models.providers.anthropic.apiKey).toBe('sk-ant-xxx')
  })

  it('excludes API key from JSON when not set', () => {
    const json = generateOpenClawJson({
      agents: { defaults: { model: { primary: 'ollama/llama3' } } },
      models: { providers: { ollama: { baseUrl: 'http://localhost:11434' } } },
    })
    const parsed = JSON.parse(json)
    expect(parsed.models.providers.ollama.baseUrl).toBe('http://localhost:11434')
    expect(parsed.models.providers.ollama.apiKey).toBeUndefined()
  })
})

describe('generateSkillsMd', () => {
  it('generates skills list', () => {
    const md = generateSkillsMd(['TypeScript', 'React', 'Docker'])
    expect(md).toContain('- TypeScript')
    expect(md).toContain('- React')
  })

  it('shows placeholder for empty skills', () => {
    const md = generateSkillsMd([])
    expect(md).toContain('No skills defined')
  })
})

describe('generateOpenClawJson gateway', () => {
  it('serializes gateway auth into openclaw.json when provided', () => {
    const config: import('./spec').OpenClawConfig = {
      agents: { defaults: { model: { primary: 'anthropic/claude-sonnet-4-6' } } },
      models: { providers: { anthropic: {} } },
      gateway: { auth: { token: 'tok-gateway' } },
    }
    const parsed = JSON.parse(generateOpenClawJson(config))
    expect(parsed.gateway.auth.token).toBe('tok-gateway')
  })
})

describe('generateAgentsMd', () => {
  it('marks lead agent', () => {
    const md = generateAgentsMd([
      { slug: 'alice', name: 'Alice', role: 'Engineer', isLead: true },
      { slug: 'bob', name: 'Bob', role: 'PM' },
    ])
    expect(md).toContain('Alice')
    expect(md).toContain('_(lead)_')
    expect(md).toContain('Bob')
  })
})

describe('generateTeamMd telegram', () => {
  it('includes telegram group and bot ids when team chat id is set', () => {
    const md = generateTeamMd({
      name: 'My Team',
      slug: 'my-team',
      telegramGroupChatId: '-1001234567890',
      telegramOwnerUserId: '222222222',
      agents: [
        { slug: 'alpha', name: 'Alpha', role: 'Lead', telegramBotId: '111111111' },
        { slug: 'beta', name: 'Beta', role: 'Engineer' },
      ],
    })

    expect(md).toContain('- telegram_group_chat_id: -1001234567890')
    expect(md).toContain('- telegram_owner_user_id: 222222222')
    expect(md).toContain('- telegram_bot_id: 111111111')
    expect(md).not.toContain('### beta\n- name: Beta\n- role: Engineer\n- telegram_bot_id:')
  })

  it('omits per-agent telegram ids when team chat id is not set', () => {
    const md = generateTeamMd({
      name: 'My Team',
      slug: 'my-team',
      agents: [
        { slug: 'alpha', name: 'Alpha', role: 'Lead', telegramBotId: '111111111' },
      ],
    })

    expect(md).not.toContain('telegram_group_chat_id')
    expect(md).not.toContain('telegram_bot_id')
  })

  it('omits per-agent telegram ids when owner user id is not set', () => {
    const md = generateTeamMd({
      name: 'My Team',
      slug: 'my-team',
      telegramGroupChatId: '-1001234567890',
      agents: [
        { slug: 'alpha', name: 'Alpha', role: 'Lead', telegramBotId: '111111111' },
      ],
    })

    expect(md).toContain('telegram_group_chat_id')
    expect(md).not.toContain('telegram_bot_id')
  })
})

describe('generateTeamMd', () => {
  it('includes per-agent gateway URL in Members section', () => {
    const md = generateTeamMd({
      name: 'Team',
      slug: 'team',
      agents: [
        { slug: 'alice', name: 'Alice', role: 'Lead', gatewayUrl: 'ws://agent-alice.team.svc.cluster.local:18789', isLead: true },
        { slug: 'bob', name: 'Bob', role: 'Engineer', gatewayUrl: 'ws://agent-bob.team.svc.cluster.local:18789' },
      ],
    })

    expect(md).toContain('### alice')
    expect(md).toContain('- gateway: ws://agent-alice.team.svc.cluster.local:18789')
    expect(md).toContain('### bob')
    expect(md).toContain('- gateway: ws://agent-bob.team.svc.cluster.local:18789')
  })
})
