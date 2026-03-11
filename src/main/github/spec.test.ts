import { describe, it, expect } from 'vitest'
import { generateIdentityMd, generateSoulMd, generateOpenClawJson, generateTeamMd, generateUserMd, generateEnvMd } from './spec'

describe('generateIdentityMd', () => {
  it('outputs key-value format with Name and Creature', () => {
    const md = generateIdentityMd({ slug: 'alice-chen', name: 'Alice Chen', role: 'Engineer' })
    expect(md).toContain('Name: Alice Chen')
    expect(md).toContain('Creature: Engineer')
  })

  it('includes Vibe when persona provided', () => {
    const md = generateIdentityMd({ slug: 'alice', name: 'Alice', role: 'Engineer', persona: 'Sharp and curious.' })
    expect(md).toContain('Vibe: Sharp and curious.')
  })

  it('includes emoji and avatar when present', () => {
    const md = generateIdentityMd({ slug: 'alice', name: 'Alice', role: 'Engineer', emoji: '🤖', avatar: '/avatar.png' })
    expect(md).toContain('Emoji: 🤖')
    expect(md).toContain('Avatar: /avatar.png')
  })

  it('omits optional fields when absent', () => {
    const md = generateIdentityMd({ slug: 'bob', name: 'Bob', role: 'PM' })
    expect(md).not.toContain('Vibe:')
    expect(md).not.toContain('Emoji:')
    expect(md).not.toContain('Avatar:')
  })

  it('adds team context as inline key-values when provided', () => {
    const md = generateIdentityMd({
      slug: 'alice',
      name: 'Alice',
      role: 'Engineer',
      teamName: 'Team Phoenix',
      leadAgent: 'lead-agent',
    })
    expect(md).toContain('Team: Team Phoenix')
    expect(md).toContain('Team lead: lead-agent')
    expect(md).not.toContain('Team members')
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

describe('generateOpenClawJson gateway', () => {
  it('serializes gateway auth into openclaw.json when provided', () => {
    const config: import('./spec').OpenClawConfig = {
      agents: { defaults: { model: { primary: 'anthropic/claude-sonnet-4-6' } } },
      models: { providers: { anthropic: {} } },
      gateway: { bind: 'lan', auth: { mode: 'token', token: 'tok-gateway' } },
    }
    const parsed = JSON.parse(generateOpenClawJson(config))
    expect(parsed.gateway.bind).toBe('lan')
    expect(parsed.gateway.auth.mode).toBe('token')
    expect(parsed.gateway.auth.token).toBe('tok-gateway')
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

  it('omits team lead section (handled by AGENTS.md)', () => {
    const md = generateUserMd({ teamName: 'Team Phoenix' })
    expect(md).not.toContain('## Team Lead')
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

describe('generateEnvMd', () => {
  it('outputs cluster, pod, and runtime variables sections', () => {
    const md = generateEnvMd({
      agentSlug: 'alice',
      teamSlug: 'eng-alpha',
      clusterName: 'eng-alpha',
      clusterZone: 'us-central1-a',
      projectId: 'my-gcp-project',
      image: 'alpine/openclaw:latest',
      diskGi: 10,
      cpu: 1,
      gatewayMode: 'port-forward',
      namespace: 'eng-alpha',
    })
    expect(md).toContain('# Deployment Environment')
    expect(md).toContain('## Cluster')
    expect(md).toContain('GCP Project: my-gcp-project')
    expect(md).toContain('Cluster: eng-alpha')
    expect(md).toContain('Zone: us-central1-a')
    expect(md).toContain('## Pod')
    expect(md).toContain('Pod name: agent-alice-0')
    expect(md).toContain('Image: alpine/openclaw:latest')
    expect(md).toContain('CPU: 1 vCPU')
    expect(md).toContain('Disk: 10Gi at /agent-data')
    expect(md).toContain('Gateway port: 18789')
    expect(md).toContain('Gateway mode: port-forward')
    expect(md).toContain('## Runtime Variables')
    expect(md).toContain('K8S_POD_NAME')
    expect(md).toContain('K8S_NAMESPACE')
    expect(md).toContain('K8S_NODE_NAME')
    expect(md).toContain('K8S_POD_IP')
    expect(md).toContain('K8S_CPU_REQUEST')
    expect(md).toContain('K8S_CPU_LIMIT')
  })
})

