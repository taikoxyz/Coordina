export interface AgentIdentity {
  name: string
  role: string
  soul?: string
  emoji?: string
  avatar?: string
  teamName?: string
  teamSlug?: string
  leadAgentSlug?: string
  teamSize?: number
}

export interface SoulInput {
  userInput: string
  enhanced?: string
}

export interface OpenClawConfig {
  agents: { defaults: { model: { primary: string; fallbacks?: string[] } } }
  models: { providers: { [provider: string]: { apiKey?: string; baseUrl?: string; api?: string } } }
  gateway?: {
    auth?: { token?: string }
    http?: {
      endpoints?: {
        responses?: {
          enabled?: boolean
        }
      }
    }
  }
  tools?: {
    profile?: string
    allow?: string[]
    deny?: string[]
  }
}

export function generateIdentityMd(agent: AgentIdentity): string {
  const lines: string[] = [
    `Name: ${agent.name}`,
    `Creature: ${agent.role}`,
  ]
  if (agent.soul) lines.push(`Vibe: ${agent.soul}`)
  if (agent.emoji) lines.push(`Emoji: ${agent.emoji}`)
  if (agent.avatar) lines.push(`Avatar: ${agent.avatar}`)
  if (agent.teamName) lines.push(`Team: ${agent.teamName}`)
  if (agent.teamSlug) lines.push(`Team slug: ${agent.teamSlug}`)
  if (agent.leadAgentSlug) lines.push(`Team lead: ${agent.leadAgentSlug}`)
  if (typeof agent.teamSize === 'number') lines.push(`Team members: ${agent.teamSize}`)
  lines.push('Team lookup: read `$OPENCLAW_WORKSPACE_DIR/TEAM.md` for team/agent queries')
  return lines.join('\n') + '\n'
}

export function generateMemoryMd(): string {
  return [
    '# Memory',
    '',
    '## Team',
    'When responding to queries about team structure, teammates, or agent-to-agent context, read `$OPENCLAW_WORKSPACE_DIR/TEAM.md` first.',
    '',
  ].join('\n')
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
  telegramGroupChatId?: string
  telegramOwnerUserId?: string
  image?: string
  leadAgentSlug?: string
  storageGi?: number
  agents: { slug: string; name: string; role: string; telegramBotId?: string; email?: string; slackHandle?: string; githubId?: string; cpu?: number; isLead?: boolean; gatewayUrl?: string; gatewayToken?: string }[]
}): string {
  const hasGateways = team.agents.some(a => a.gatewayUrl)
  const lines: string[] = ['## TEAM', '', '## About']
  lines.push(`- name: ${team.name}`)
  lines.push(`- slug: ${team.slug}`)
  if (team.telegramGroupChatId) lines.push(`- telegram_group_chat_id: ${team.telegramGroupChatId}`)
  if (team.telegramOwnerUserId) lines.push(`- telegram_owner_user_id: ${team.telegramOwnerUserId}`)
  if (team.image) lines.push(`- image: ${team.image}`)
  if (team.leadAgentSlug) lines.push(`- lead: ${team.leadAgentSlug}`)
  if (team.storageGi) lines.push(`- storage: ${team.storageGi}Gi`)
  lines.push('', '## Members')
  for (const a of team.agents) {
    lines.push(`### ${a.slug}`)
    lines.push(`- name: ${a.name}`)
    lines.push(`- role: ${a.role}`)
    if (team.telegramGroupChatId && team.telegramOwnerUserId && a.telegramBotId) lines.push(`- telegram_bot_id: ${a.telegramBotId}`)
    if (a.email) lines.push(`- email: ${a.email}`)
    if (a.slackHandle) lines.push(`- slack: ${a.slackHandle}`)
    if (a.githubId) lines.push(`- github: @${a.githubId}`)
    if (a.cpu) lines.push(`- cpu: ${a.cpu}`)
    if (a.gatewayUrl) lines.push(`- gateway: ${a.gatewayUrl}`)
    if (a.gatewayToken) lines.push(`- gateway_token: ${a.gatewayToken}`)
    if (a.isLead) lines.push(`- lead: true`)
    lines.push('')
  }
  if (hasGateways) {
    lines.push('## Communication Protocol')
    lines.push('')
    lines.push('To message a teammate, use the `exec` tool to call their gateway HTTP API.')
    lines.push('Do NOT use OpenClaw node/tailnet commands.')
    lines.push('')
    lines.push('Example — send a message to a teammate:')
    lines.push('```')
    lines.push('exec: curl -s -m 300 -X POST <gateway>/v1/responses \\')
    lines.push('  -H "Authorization: Bearer <gateway_token>" \\')
    lines.push('  -H "Content-Type: application/json" \\')
    lines.push('  -d \'{"model": "anthropic/claude-sonnet-4-6", "input": "Your message here"}\'')
    lines.push('```')
    lines.push('')
    lines.push('The `-m 300` flag sets a 5-minute timeout. For longer tasks, omit it and let `exec` background the request.')
    lines.push('')
    lines.push('Replace `<gateway>` and `<gateway_token>` with the values from the member entry above.')
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
