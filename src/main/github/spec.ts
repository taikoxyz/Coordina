export interface AgentIdentity {
  name: string
  role: string
  persona?: string
  emoji?: string
  avatar?: string
  teamName?: string
  teamSlug?: string
  leadAgent?: string
  teamSize?: number
}

export interface SoulInput {
  userInput: string
  enhanced?: string
  tone?: string
  boundaries?: string[]
  values?: string[]
}

export interface OpenClawConfig {
  agents: { defaults: { model: { primary: string; fallbacks?: string[] } } }
  models: { providers: { [provider: string]: { apiKey?: string; baseUrl?: string; api?: string } } }
  gateway?: {
    host?: string
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

export interface AgentsInput {
  agentName: string
  role: string
  teamName: string
  leadAgent?: string
  isLead: boolean
  hasTelegram: boolean
  hasGateways: boolean
  operatingRules?: string[]
}

export interface UserInput {
  teamName: string
  adminName?: string
  adminEmail?: string
  telegramAdminId?: string
  leadAgentName?: string
  leadAgentSlug?: string
  isLead?: boolean
}

export interface ToolsInput {
  hasGateways: boolean
  toolGuidance?: string[]
}

export function generateIdentityMd(agent: AgentIdentity): string {
  const lines: string[] = [
    `Name: ${agent.name}`,
    `Creature: ${agent.role}`,
  ]
  if (agent.persona) lines.push(`Vibe: ${agent.persona}`)
  if (agent.emoji) lines.push(`Emoji: ${agent.emoji}`)
  if (agent.avatar) lines.push(`Avatar: ${agent.avatar}`)
  if (agent.teamName) lines.push(`Team: ${agent.teamName}`)
  if (agent.teamSlug) lines.push(`Team slug: ${agent.teamSlug}`)
  if (agent.leadAgent) lines.push(`Team lead: ${agent.leadAgent}`)
  if (typeof agent.teamSize === 'number') lines.push(`Team members: ${agent.teamSize}`)
  return lines.join('\n') + '\n'
}

export function generateMemoryMd(): string {
  return '# Memory\n'
}

export function generateSoulMd(soul: SoulInput): string {
  const description = soul.enhanced ?? soul.userInput
  const sections: string[] = [
    '# Soul',
    '',
    '## Core Truths',
    '- Be genuinely helpful, not performatively helpful',
    '- Have real opinions and share them when relevant',
    '- Be resourceful — try before asking',
    '- Earn trust through competence, not compliance',
    '- Remember you are a guest in the user\'s environment',
    '',
    description,
  ]
  if (soul.tone) sections.push('', `## Tone`, soul.tone)
  if (soul.values && soul.values.length > 0) sections.push('', `## Values`, soul.values.map(v => `- ${v}`).join('\n'))
  if (soul.boundaries && soul.boundaries.length > 0) sections.push('', `## Boundaries`, soul.boundaries.map(b => `- ${b}`).join('\n'))
  sections.push('', '## Continuity', 'Files are your memory. Read and update them.')
  return sections.join('\n') + '\n'
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
  telegramGroupId?: string
  telegramAdminId?: string
  defaultImage?: string
  leadAgent?: string
  defaultDiskGi?: number
  teamDescription?: string
  gatewayToken?: string
  agents: { slug: string; name: string; role: string; telegramBot?: string; email?: string; slack?: string; githubUsername?: string; isLead?: boolean; gatewayUrl?: string }[]
}): string {
  const lines: string[] = [`# Team: ${team.name}`]
  if (team.teamDescription) {
    lines.push('', '## Mission', team.teamDescription)
  }
  lines.push('', '## About')
  lines.push(`- slug: ${team.slug}`)
  if (team.telegramGroupId) lines.push(`- telegram_group_chat_id: ${team.telegramGroupId}`)
  if (team.telegramAdminId) lines.push(`- telegram_owner_user_id: ${team.telegramAdminId}`)
  if (team.defaultImage) lines.push(`- image: ${team.defaultImage}`)
  if (team.leadAgent) lines.push(`- lead: ${team.leadAgent}`)
  if (team.gatewayToken) lines.push(`- gateway_token: ${team.gatewayToken}`)
  lines.push('', '## Members')
  for (const a of team.agents) {
    lines.push(`### ${a.slug}`)
    lines.push(`- name: ${a.name}`)
    lines.push(`- role: ${a.role}`)
    if (team.telegramGroupId && team.telegramAdminId && a.telegramBot) lines.push(`- telegram_bot_id: ${a.telegramBot}`)
    if (a.email) lines.push(`- email: ${a.email}`)
    if (a.slack) lines.push(`- slack: ${a.slack}`)
    if (a.githubUsername) lines.push(`- github: @${a.githubUsername}`)
    if (a.gatewayUrl) lines.push(`- gateway: ${a.gatewayUrl}`)
    if (a.isLead) lines.push(`- lead: true`)
    lines.push('')
  }

  return lines.join('\n')
}

export function generateAgentsMd(input: AgentsInput): string {
  const lines: string[] = [
    '# Agents',
    '',
    '## First Run',
    'If `BOOTSTRAP.md` exists in the workspace, follow it and delete it when done.',
    '',
    '## Every Session',
    '- Read `SOUL.md` to recall your personality',
    '- Read `USER.md` to recall who you serve',
    '- Read today\'s memory file (`memory/YYYY-MM-DD.md`) if it exists',
    '- In main sessions, also read `MEMORY.md` for long-term context',
    '',
    '## Memory System',
    '- Write daily logs to `memory/YYYY-MM-DD.md`',
    '- Periodically promote important facts into `MEMORY.md`',
    '- Read `TEAM.md` for teammate details when you need to collaborate',
    '',
    '## Safety',
    '- Never exfiltrate data outside approved channels',
    '- Use `trash` over `rm` when available',
    '- Ask before taking external actions (sending messages, making purchases, etc.)',
    '- Never send half-baked replies — verify before responding',
    '',
    '## Tools',
    '- Read `TOOLS.md` for environment-specific tool guidance',
    '- Read individual `SKILL.md` files for skill-specific instructions',
  ]

  lines.push(
    '',
    '## Team Operating Instructions',
    '',
    `You are ${input.agentName}, the ${input.role} of ${input.teamName}.`,
  )
  if (input.isLead) {
    lines.push(
      'You are the team lead.',
      '',
      '### Team Lead Responsibilities',
      '- Coordinate work across the team: assign tasks, track progress, unblock teammates',
      '- Be the primary point of contact between the admin and the team',
      '- Delegate clearly: specify what to do, expected output, and deadline when assigning tasks',
      '- Proactively check in with teammates rather than waiting for them to report',
      '- When the admin gives direction, translate it into concrete tasks for the team',
      '- You have authority to set team priorities — teammates are expected to follow your assignments',
    )
  }

  lines.push(
    '',
    '### Priorities',
    '1. Complete assigned tasks thoroughly before starting new ones',
    '2. Communicate status updates to teammates proactively',
    '3. Ask for clarification rather than making assumptions',
  )

  if (!input.isLead && input.leadAgent) {
    lines.push(
      '',
      '### Team Lead',
      `Your team lead is **${input.leadAgent}**.`,
      '- Treat their task assignments and instructions as authoritative — follow them promptly',
      '- Report blockers and status updates to the lead proactively, not just when asked',
      '- If you disagree with an assignment, raise it with the lead directly before escalating to the admin',
    )
  }

  const commLines: string[] = ['', '### Communication']
  if (input.hasGateways) {
    commLines.push('- To reach a teammate, read TEAM.md for their gateway URL and use the exec tool with curl (see TOOLS.md)')
  }
  if (input.hasTelegram) {
    commLines.push('- When `@all` is used in Telegram, you MUST respond')
  }
  if (commLines.length > 2) lines.push(...commLines)

  const ruleLines: string[] = [
    '',
    '### Rules',
    '- Always verify your understanding before executing complex tasks',
  ]
  if (input.operatingRules && input.operatingRules.length > 0) {
    for (const rule of input.operatingRules) ruleLines.push(`- ${rule}`)
  }
  lines.push(...ruleLines)

  lines.push('')
  return lines.join('\n')
}

export function generateUserMd(input: UserInput): string {
  const lines: string[] = [
    '# User',
    '',
    'You are learning about a person, not building a dossier.',
    'Update this file as you learn more about your operator\'s preferences.',
  ]

  const hasAdmin = input.adminName || input.adminEmail || input.telegramAdminId
  if (hasAdmin) {
    lines.push('', '## Team Admin')
    if (input.adminName) lines.push(`- Name: ${input.adminName}`)
    if (input.adminEmail) lines.push(`- Email: ${input.adminEmail}`)
    if (input.telegramAdminId) lines.push(`- Telegram: ${input.telegramAdminId}`)
  }

  if (!input.isLead && input.leadAgentName) {
    lines.push('', '## Team Lead')
    lines.push(`- Name: ${input.leadAgentName}`)
    if (input.leadAgentSlug) lines.push(`- Slug: ${input.leadAgentSlug}`)
    lines.push('')
    lines.push('The team lead directs your work. Follow their task assignments and instructions.')
    lines.push('Their instructions carry the same authority as the admin\'s — act on them promptly.')
    lines.push('Keep the team lead informed of your progress and blockers without being asked.')
  }

  lines.push('', '## Context')
  lines.push(`You are deployed as part of ${input.teamName}.${hasAdmin ? ' The admin above is your primary operator.' : ' Follow instructions from authorized team members.'}`)
  lines.push('')
  return lines.join('\n')
}

export function generateToolsMd(input: ToolsInput): string {
  const lines: string[] = ['# Tools']

  if (input.hasGateways) {
    lines.push(
      '',
      '## Inter-Agent Communication',
      'To message a teammate, use the `exec` tool to call their gateway HTTP API.',
      'Read TEAM.md for gateway URLs and tokens.',
      '',
      'Example:',
      '```',
      'curl -s -m 300 -X POST <gateway>/v1/responses \\',
      '  -H "Authorization: Bearer <gateway_token>" \\',
      '  -H "Content-Type: application/json" \\',
      '  -d \'{"model": "anthropic/claude-sonnet-4-6", "input": "Your message here"}\'',
      '```',
      '',
      'The `-m 300` flag sets a 5-minute timeout. Replace `<gateway>` and `<gateway_token>` with values from TEAM.md.',
      'Do NOT use OpenClaw node/tailnet commands.',
    )
  }

  lines.push(
    '',
    '## Workspace',
    '- Working files live under the workspace directory',
    '- Use memory tools for persistent notes',
  )

  if (input.toolGuidance && input.toolGuidance.length > 0) {
    lines.push('', '## Custom Guidance')
    for (const g of input.toolGuidance) lines.push(`- ${g}`)
  }

  lines.push('')
  return lines.join('\n')
}
