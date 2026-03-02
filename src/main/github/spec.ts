export interface AgentIdentity {
  name: string
  slug: string
  role: string
  email?: string
  slackHandle?: string
  githubId?: string
}

export interface SoulInput {
  userInput: string
  enhanced?: string
}

export interface OpenClawConfig {
  provider: string
  model: string
  apiKey?: string
  baseUrl?: string
  [key: string]: unknown
}

export function generateIdentityMd(agent: AgentIdentity): string {
  const lines: string[] = [
    `# ${agent.name}`,
    '',
    `**Role:** ${agent.role}`,
    `**Slug:** \`${agent.slug}\``,
  ]
  if (agent.email) lines.push(`**Email:** ${agent.email}`)
  if (agent.slackHandle) lines.push(`**Slack:** ${agent.slackHandle}`)
  if (agent.githubId) lines.push(`**GitHub:** @${agent.githubId}`)
  return lines.join('\n') + '\n'
}

const SOUL_TEMPLATE = `## Core Values

<!-- Your agent's core values go here -->

## Working Style

<!-- How your agent approaches work -->

## Communication Style

<!-- How your agent communicates -->

## Decision Making

<!-- How your agent makes decisions -->
`

export function generateSoulMd(soul: SoulInput): string {
  const description = soul.enhanced ?? soul.userInput
  return `# Soul\n\n${description}\n\n${SOUL_TEMPLATE}`
}

export function generateOpenClawJson(config: OpenClawConfig): string {
  return JSON.stringify(config, null, 2)
}

export interface AgentSpec {
  slug: string
  name: string
  role: string
  email?: string
  slackHandle?: string
  githubId?: string
  skills: string[]
  soul: SoulInput
  modelConfig: OpenClawConfig
}

export function generateAgentFiles(agent: AgentSpec): Record<string, string> {
  return {
    'IDENTITY.md': generateIdentityMd({ name: agent.name, slug: agent.slug, role: agent.role, email: agent.email, slackHandle: agent.slackHandle, githubId: agent.githubId }),
    'SOUL.md': generateSoulMd(agent.soul),
    'SKILLS.md': generateSkillsMd(agent.skills),
    'openclaw.json': generateOpenClawJson(agent.modelConfig),
  }
}

export function generateSkillsMd(skills: string[]): string {
  if (skills.length === 0) return '# Skills\n\n_No skills defined yet._\n'
  const list = skills.map(s => `- ${s}`).join('\n')
  return `# Skills\n\n${list}\n`
}

export function generateAgentsMd(agents: { slug: string; name: string; role: string; isLead?: boolean }[]): string {
  const lines = ['# Agents', '']
  for (const a of agents) {
    const tag = a.isLead ? ' _(lead)_' : ''
    lines.push(`## ${a.name}${tag}`)
    lines.push(`- **Slug:** \`${a.slug}\``)
    lines.push(`- **Role:** ${a.role}`)
    lines.push('')
  }
  return lines.join('\n')
}
