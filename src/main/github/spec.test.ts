import { describe, it, expect } from 'vitest'
import { generateIdentityMd, generateMemoryMd, generateSoulMd, generateOpenClawJson, generateSkillsMd, generateAgentsMd, generateTeamMd, generateUserMd, generateToolsMd, generateProjectsMd } from './spec'

describe('generateIdentityMd', () => {
  it('outputs key-value format with Name and Creature', () => {
    const md = generateIdentityMd({ name: 'Alice Chen', role: 'Engineer' })
    expect(md).toContain('Name: Alice Chen')
    expect(md).toContain('Creature: Engineer')
  })

  it('includes Vibe when persona provided', () => {
    const md = generateIdentityMd({ name: 'Alice', role: 'Engineer', persona: 'Sharp and curious.' })
    expect(md).toContain('Vibe: Sharp and curious.')
  })

  it('includes emoji and avatar when present', () => {
    const md = generateIdentityMd({ name: 'Alice', role: 'Engineer', emoji: '🤖', avatar: '/avatar.png' })
    expect(md).toContain('Emoji: 🤖')
    expect(md).toContain('Avatar: /avatar.png')
  })

  it('omits optional fields when absent', () => {
    const md = generateIdentityMd({ name: 'Bob', role: 'PM' })
    expect(md).not.toContain('Vibe:')
    expect(md).not.toContain('Emoji:')
    expect(md).not.toContain('Avatar:')
  })

  it('adds team context as inline key-values when provided', () => {
    const md = generateIdentityMd({
      name: 'Alice',
      role: 'Engineer',
      teamName: 'Team Phoenix',
      teamSlug: 'team-phoenix',
      leadAgent: 'lead-agent',
      teamSize: 5,
    })
    expect(md).toContain('Team: Team Phoenix')
    expect(md).toContain('Team slug: team-phoenix')
    expect(md).toContain('Team lead: lead-agent')
    expect(md).toContain('Team members: 5')
  })
})

describe('generateMemoryMd', () => {
  it('returns minimal seed', () => {
    const md = generateMemoryMd()
    expect(md).toBe('# Memory\n')
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

  it('includes Core Truths and Continuity sections', () => {
    const md = generateSoulMd({ userInput: 'x' })
    expect(md).toContain('## Core Truths')
    expect(md).toContain('Be genuinely helpful')
    expect(md).toContain('## Continuity')
    expect(md).toContain('Files are your memory')
  })

  it('includes tone section when provided', () => {
    const md = generateSoulMd({ userInput: 'Base persona.', tone: 'Professional but friendly.' })
    expect(md).toContain('## Tone')
    expect(md).toContain('Professional but friendly.')
  })

  it('includes values section when provided', () => {
    const md = generateSoulMd({ userInput: 'Base persona.', values: ['Transparency', 'Quality'] })
    expect(md).toContain('## Values')
    expect(md).toContain('- Transparency')
    expect(md).toContain('- Quality')
  })

  it('includes boundaries section when provided', () => {
    const md = generateSoulMd({ userInput: 'Base persona.', boundaries: ['Never share API keys', 'Never fabricate data'] })
    expect(md).toContain('## Boundaries')
    expect(md).toContain('- Never share API keys')
    expect(md).toContain('- Never fabricate data')
  })

  it('omits tone, values, boundaries when not provided but keeps Core Truths and Continuity', () => {
    const md = generateSoulMd({ userInput: 'Just persona.' })
    expect(md).not.toContain('## Tone')
    expect(md).not.toContain('## Values')
    expect(md).not.toContain('## Boundaries')
    expect(md).toContain('## Core Truths')
    expect(md).toContain('## Continuity')
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
  const base = { agentName: 'Alpha', agentSlug: 'alpha', role: 'Lead', teamName: 'Team Phoenix', isLead: true, hasTelegram: false, hasGateways: false, hasProjects: false }

  it('includes OpenClaw defaults and team operating instructions', () => {
    const md = generateAgentsMd(base)
    expect(md).toContain('# Agents')
    expect(md).toContain('## Every Session')
    expect(md).toContain('## Memory System')
    expect(md).toContain('## Safety')
    expect(md).toContain('## Team Operating Instructions')
    expect(md).toContain('You are Alpha, the Lead of Team Phoenix.')
  })

  it('includes team lead marker when isLead', () => {
    const md = generateAgentsMd(base)
    expect(md).toContain('You are the team lead.')
  })

  it('omits team lead marker when not lead', () => {
    const md = generateAgentsMd({ ...base, isLead: false })
    expect(md).not.toContain('You are the team lead.')
  })

  it('includes telegram rule when hasTelegram', () => {
    const md = generateAgentsMd({ ...base, hasTelegram: true })
    expect(md).toContain('When `@all` is used in Telegram, you MUST respond')
  })

  it('omits telegram rule when no telegram', () => {
    const md = generateAgentsMd(base)
    expect(md).not.toContain('@all')
  })

  it('includes gateway communication note when hasGateways', () => {
    const md = generateAgentsMd({ ...base, hasGateways: true })
    expect(md).toContain('read TEAM.md for their gateway URL')
    expect(md).toContain('TOOLS.md')
  })

  it('includes custom operating rules', () => {
    const md = generateAgentsMd({ ...base, operatingRules: ['Always cite sources', 'Use formal language'] })
    expect(md).toContain('- Always cite sources')
    expect(md).toContain('- Use formal language')
  })

  it('includes priorities section under team instructions', () => {
    const md = generateAgentsMd(base)
    expect(md).toContain('### Priorities')
    expect(md).toContain('TEAM.md')
  })

  it('includes multi-project protocol when hasProjects', () => {
    const md = generateAgentsMd({ ...base, hasProjects: true })
    expect(md).toContain('### Multi-Project Protocol')
    expect(md).toContain('PROJECTS.md')
    expect(md).toContain('[project-slug]')
  })

  it('omits multi-project protocol when no projects', () => {
    const md = generateAgentsMd(base)
    expect(md).not.toContain('### Multi-Project Protocol')
  })

  it('includes async communication guidance when hasGateways', () => {
    const md = generateAgentsMd({ ...base, hasGateways: true })
    expect(md).toContain('[ASYNC]')
    expect(md).toContain('blocking curl')
  })
})

describe('generateProjectsMd', () => {
  it('generates project listing with members and status', () => {
    const md = generateProjectsMd([
      { slug: 'alpha', name: 'Project Alpha', description: 'Frontend redesign', members: ['alice', 'bob'], status: 'active' },
      { slug: 'beta', name: 'Project Beta', description: 'API migration', members: ['alice', 'charlie'], status: 'paused' },
    ])
    expect(md).toContain('# Projects')
    expect(md).toContain('## Project Alpha')
    expect(md).toContain('- slug: alpha')
    expect(md).toContain('- status: active')
    expect(md).toContain('- members: alice, bob')
    expect(md).toContain('- workspace: projects/alpha/')
    expect(md).toContain('## Project Beta')
    expect(md).toContain('- status: paused')
  })

  it('shows placeholder for empty projects', () => {
    const md = generateProjectsMd([])
    expect(md).toContain('No projects defined')
  })
})

describe('generateUserMd', () => {
  it('includes OpenClaw preamble and admin info when provided', () => {
    const md = generateUserMd({ teamName: 'Team Phoenix', adminName: 'Dan', adminEmail: 'dan@example.com', telegramAdminId: '222222222' })
    expect(md).toContain('# User')
    expect(md).toContain('learning about a person')
    expect(md).toContain('- Name: Dan')
    expect(md).toContain('- Email: dan@example.com')
    expect(md).toContain('- Telegram: 222222222')
    expect(md).toContain('The admin above is your primary operator.')
  })

  it('omits Team Admin section when no admin info', () => {
    const md = generateUserMd({ teamName: 'Team Phoenix' })
    expect(md).toContain('# User')
    expect(md).toContain('learning about a person')
    expect(md).toContain('Team Phoenix')
    expect(md).toContain('Follow instructions from authorized team members.')
    expect(md).not.toContain('## Team Admin')
  })

  it('includes partial admin info', () => {
    const md = generateUserMd({ teamName: 'Team Phoenix', adminName: 'Dan' })
    expect(md).toContain('- Name: Dan')
    expect(md).not.toContain('Email:')
    expect(md).not.toContain('Telegram:')
  })

  it('includes team lead section for non-lead agents', () => {
    const md = generateUserMd({ teamName: 'Team Phoenix', leadAgentName: 'Alpha', leadAgentSlug: 'alpha', isLead: false })
    expect(md).toContain('## Team Lead')
    expect(md).toContain('- Name: Alpha')
    expect(md).toContain('- Slug: alpha')
    expect(md).toContain('team lead directs your work')
  })

  it('omits team lead section for the lead agent', () => {
    const md = generateUserMd({ teamName: 'Team Phoenix', leadAgentName: 'Alpha', leadAgentSlug: 'alpha', isLead: true })
    expect(md).not.toContain('## Team Lead')
  })

  it('omits team lead section when no lead agent defined', () => {
    const md = generateUserMd({ teamName: 'Team Phoenix', isLead: false })
    expect(md).not.toContain('## Team Lead')
  })
})

describe('generateToolsMd', () => {
  it('includes inter-agent communication when hasGateways', () => {
    const md = generateToolsMd({ hasGateways: true, hasProjects: false })
    expect(md).toContain('# Tools')
    expect(md).toContain('## Inter-Agent Communication')
    expect(md).toContain('### Quick Request')
    expect(md).toContain('### Task Delegation')
    expect(md).toContain('### Responding to Async Requests')
    expect(md).toContain('Authorization: Bearer <gateway_token>')
    expect(md).toContain('Do NOT use OpenClaw node/tailnet commands')
  })

  it('includes agent gateway URL in async delegation example', () => {
    const md = generateToolsMd({ hasGateways: true, hasProjects: false, agentGatewayUrl: 'http://agent-alice.team.svc.cluster.local:18789' })
    expect(md).toContain('http://agent-alice.team.svc.cluster.local:18789')
  })

  it('omits inter-agent section when no gateways', () => {
    const md = generateToolsMd({ hasGateways: false, hasProjects: false })
    expect(md).toContain('# Tools')
    expect(md).toContain('## Workspace')
    expect(md).not.toContain('## Inter-Agent Communication')
  })

  it('includes project-scoped messages when hasProjects', () => {
    const md = generateToolsMd({ hasGateways: true, hasProjects: true })
    expect(md).toContain('## Project-Scoped Messages')
    expect(md).toContain('[project-alpha]')
  })

  it('omits project-scoped messages when no projects', () => {
    const md = generateToolsMd({ hasGateways: true, hasProjects: false })
    expect(md).not.toContain('## Project-Scoped Messages')
  })

  it('includes custom tool guidance', () => {
    const md = generateToolsMd({ hasGateways: false, hasProjects: false, toolGuidance: ['Use exec for shell commands', 'Prefer jq for JSON'] })
    expect(md).toContain('## Custom Guidance')
    expect(md).toContain('- Use exec for shell commands')
    expect(md).toContain('- Prefer jq for JSON')
  })

  it('always includes workspace section', () => {
    const md = generateToolsMd({ hasGateways: true, hasProjects: false })
    expect(md).toContain('## Workspace')
  })
})

describe('generateTeamMd telegram', () => {
  it('includes telegram group and bot ids when team chat id is set', () => {
    const md = generateTeamMd({
      name: 'My Team',
      slug: 'my-team',
      telegramGroupId: '-1001234567890',
      telegramAdminId: '222222222',
      agents: [
        { slug: 'alpha', name: 'Alpha', role: 'Lead', telegramBot: '111111111' },
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
        { slug: 'alpha', name: 'Alpha', role: 'Lead', telegramBot: '111111111' },
      ],
    })

    expect(md).not.toContain('telegram_group_chat_id')
    expect(md).not.toContain('telegram_bot_id')
  })

  it('omits per-agent telegram ids when admin id is not set', () => {
    const md = generateTeamMd({
      name: 'My Team',
      slug: 'my-team',
      telegramGroupId: '-1001234567890',
      agents: [
        { slug: 'alpha', name: 'Alpha', role: 'Lead', telegramBot: '111111111' },
      ],
    })

    expect(md).toContain('telegram_group_chat_id')
    expect(md).not.toContain('telegram_bot_id')
  })
})

describe('generateTeamMd', () => {
  it('uses team name in title', () => {
    const md = generateTeamMd({
      name: 'Team',
      slug: 'team',
      agents: [{ slug: 'alice', name: 'Alice', role: 'Lead' }],
    })
    expect(md).toContain('# Team: Team')
  })

  it('includes per-agent gateway URL and shared token in About', () => {
    const md = generateTeamMd({
      name: 'Team',
      slug: 'team',
      gatewayToken: 'shared-token-xyz',
      agents: [
        { slug: 'alice', name: 'Alice', role: 'Lead', gatewayUrl: 'http://agent-alice.team.svc.cluster.local:18789', isLead: true },
        { slug: 'bob', name: 'Bob', role: 'Engineer', gatewayUrl: 'http://agent-bob.team.svc.cluster.local:18789' },
      ],
    })

    expect(md).toContain('- gateway_token: shared-token-xyz')
    expect(md).toContain('### alice')
    expect(md).toContain('- gateway: http://agent-alice.team.svc.cluster.local:18789')
    expect(md).toContain('### bob')
    expect(md).toContain('- gateway: http://agent-bob.team.svc.cluster.local:18789')
    expect(md.match(/gateway_token/g)?.length).toBe(1)
  })

  it('does not include Communication Protocol section', () => {
    const md = generateTeamMd({
      name: 'Team',
      slug: 'team',
      gatewayToken: 'tok',
      agents: [
        { slug: 'alice', name: 'Alice', role: 'Lead', gatewayUrl: 'http://agent-alice.team.svc.cluster.local:18789' },
      ],
    })

    expect(md).not.toContain('## Communication Protocol')
  })

  it('includes mission section when teamDescription provided', () => {
    const md = generateTeamMd({
      name: 'Team',
      slug: 'team',
      teamDescription: 'Building the future of spatial computing.',
      agents: [{ slug: 'alice', name: 'Alice', role: 'Lead' }],
    })

    expect(md).toContain('## Mission')
    expect(md).toContain('Building the future of spatial computing.')
  })

  it('omits mission section when no teamDescription', () => {
    const md = generateTeamMd({
      name: 'Team',
      slug: 'team',
      agents: [{ slug: 'alice', name: 'Alice', role: 'Lead' }],
    })

    expect(md).not.toContain('## Mission')
  })
})
