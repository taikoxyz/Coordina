export interface AgentIdentity {
  name: string
  slug: string
  role: string
  email?: string
  slackHandle?: string
  githubId?: string
  providerSlug?: string
  model?: string
}

export interface SoulInput {
  userInput: string
  enhanced?: string
}

export interface OpenClawConfig {
  agents: { defaults: { model: { primary: string; fallbacks?: string[] } } }
  models: { providers: { [provider: string]: { apiKey?: string; baseUrl?: string; api?: string } } }
}

export function generateIdentityMd(agent: AgentIdentity): string {
  return `My identity is defined in \`/config/shared/TEAM.md\` — find slug \`${agent.slug}\` under Members.\n`
}

export function generateSoulMd(soul: SoulInput): string {
  const description = soul.enhanced ?? soul.userInput
  return `# Soul\n\n${description}\n`
}

export function generateOpenClawJson(config: OpenClawConfig): string {
  return JSON.stringify(config, null, 2)
}

export function generateSkillsMd(skills: string[]): string {
  if (skills.length === 0) return '# Skills\n\n_No skills defined yet._\n'
  const list = skills.map(s => `- ${s}`).join('\n')
  return `# Skills\n\n${list}\n`
}

export function generateTeamMd(team: {
  name: string
  slug: string
  domain?: string
  image?: string
  leadAgentSlug?: string
  storageGi?: number
  agents: { slug: string; name: string; role: string; email?: string; slackHandle?: string; githubId?: string; cpu?: number; isLead?: boolean }[]
}): string {
  const lines: string[] = ['## TEAM', '', '## About']
  lines.push(`- name: ${team.name}`)
  lines.push(`- slug: ${team.slug}`)
  if (team.domain) lines.push(`- domain: ${team.domain}`)
  if (team.image) lines.push(`- image: ${team.image}`)
  if (team.leadAgentSlug) lines.push(`- lead: ${team.leadAgentSlug}`)
  if (team.storageGi) lines.push(`- storage: ${team.storageGi}Gi`)
  lines.push('', '## Members')
  for (const a of team.agents) {
    lines.push(`### ${a.slug}`)
    lines.push(`- name: ${a.name}`)
    lines.push(`- role: ${a.role}`)
    if (a.email) lines.push(`- email: ${a.email}`)
    if (a.slackHandle) lines.push(`- slack: ${a.slackHandle}`)
    if (a.githubId) lines.push(`- github: @${a.githubId}`)
    if (a.cpu) lines.push(`- cpu: ${a.cpu}`)
    if (a.isLead) lines.push(`- lead: true`)
    lines.push('')
  }
  return lines.join('\n')
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
