import type { Project } from '../../shared/types'
import {
  DEFAULT_CORE_TRUTHS,
  DEFAULT_CONTINUITY,
  DEFAULT_USER_INTRO,
} from '../../shared/derivationDefaults'

export interface AgentIdentity {
  slug: string
  name: string
  role: string
  persona?: string
  emoji?: string
  avatar?: string
  email?: string
  teamName?: string
  leadAgent?: string
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
  models?: { providers: { [provider: string]: { apiKey?: string; baseUrl?: string; api?: string } } }
  gateway?: {
    bind?: string
    host?: string
    auth?: {
      mode?: string
      token?: string
    }
    http?: {
      endpoints?: {
        responses?: {
          enabled?: boolean
        }
      }
    }
    controlUi?: {
      enabled?: boolean
    }
  }
  tools?: {
    profile?: string
    allow?: string[]
    deny?: string[]
  }
}

export interface UserInput {
  teamName: string
  adminName?: string
  adminEmail?: string
  telegramAdminId?: string
}

export interface EnvMdInput {
  agentSlug: string
  teamSlug: string
  clusterName: string
  clusterZone: string
  projectId: string
  image: string
  diskGi: number
  cpu: number
  memoryGi: number
  gatewayMode: string
  namespace: string
}

export function generateIdentityMd(agent: AgentIdentity): string {
  const lines: string[] = [
    `Slug: ${agent.slug}`,
    `Name: ${agent.name}`,
    `Creature: ${agent.role}`,
  ]
  if (agent.persona) lines.push(`Vibe: ${agent.persona}`)
  if (agent.emoji) lines.push(`Emoji: ${agent.emoji}`)
  if (agent.avatar) lines.push(`Avatar: ${agent.avatar}`)
  if (agent.email) lines.push(`Email: ${agent.email}`)
  if (agent.teamName) lines.push(`Team: ${agent.teamName}`)
  if (agent.leadAgent) lines.push(`Team lead: ${agent.leadAgent}`)
  return lines.join('\n') + '\n'
}


export function generateSoulMd(soul: SoulInput): string {
  const description = soul.enhanced ?? soul.userInput
  const sections: string[] = [
    '# Soul',
    '',
    '## Core Truths',
    DEFAULT_CORE_TRUTHS.map(t => `- ${t}`).join('\n'),
    '',
    description,
  ]
  if (soul.tone) sections.push('', `## Tone`, soul.tone)
  if (soul.values && soul.values.length > 0) sections.push('', `## Values`, soul.values.map(v => `- ${v}`).join('\n'))
  if (soul.boundaries && soul.boundaries.length > 0) sections.push('', `## Boundaries`, soul.boundaries.map(b => `- ${b}`).join('\n'))
  sections.push('', '## Continuity', DEFAULT_CONTINUITY)
  return sections.join('\n') + '\n'
}

export function generateOpenClawJson(config: OpenClawConfig): string {
  return JSON.stringify(config, null, 2)
}

export function generateProjectsMd(projects: Project[]): string {
  if (projects.length === 0) return '# Projects\n\n_No projects yet._\n'
  const sections: string[] = ['# Projects']
  for (const p of projects) {
    sections.push('', `## ${p.slug}`, `- Name: ${p.name}`, `- Status: ${p.status}`)
    if (p.description) sections.push(`- Description: ${p.description}`)
  }
  sections.push('')
  return sections.join('\n')
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
  lines.push('')
  lines.push('## Members')
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

export function generateUserMd(input: UserInput): string {
  const lines: string[] = ['# User', '', ...DEFAULT_USER_INTRO]

  const hasAdmin = input.adminName || input.adminEmail || input.telegramAdminId
  if (hasAdmin) {
    lines.push('', '## Team Admin')
    if (input.adminName) lines.push(`- Name: ${input.adminName}`)
    if (input.adminEmail) lines.push(`- Email: ${input.adminEmail}`)
    if (input.telegramAdminId) lines.push(`- Telegram: ${input.telegramAdminId}`)
  }

  lines.push('', '## Context')
  lines.push(`You are deployed as part of ${input.teamName}.${hasAdmin ? ' The admin above is your primary operator.' : ' Follow instructions from authorized team members.'}`)
  lines.push('')
  return lines.join('\n')
}

export function generateEnvMd(input: EnvMdInput): string {
  const lines: string[] = [
    '# Deployment Environment',
    '',
    '## Cluster',
    `- GCP Project: ${input.projectId}`,
    `- Cluster: ${input.clusterName}`,
    `- Zone: ${input.clusterZone}`,
    `- Namespace: ${input.namespace}`,
    '',
    '## Pod',
    `- Pod name: agent-${input.agentSlug}-0`,
    `- Image: ${input.image}`,
    `- CPU: ${input.cpu} vCPU`,
    `- Memory: ${input.memoryGi}Gi`,
    `- Disk: ${input.diskGi}Gi at /agent-data`,
    '- Gateway port: 18789',
    `- Gateway mode: ${input.gatewayMode}`,
    '',
    '## Runtime Variables',
    'These environment variables are populated by the Kubernetes Downward API at runtime:',
    '- `K8S_POD_NAME` - Actual pod name',
    '- `K8S_NAMESPACE` - Kubernetes namespace',
    '- `K8S_NODE_NAME` - Node the pod is scheduled on',
    '- `K8S_POD_IP` - Pod cluster IP address',
    '- `K8S_CPU_REQUEST` - CPU request',
    '- `K8S_CPU_LIMIT` - CPU limit',
    '- `K8S_MEMORY_REQUEST` - Memory request',
    '- `K8S_MEMORY_LIMIT` - Memory limit',
    '',
  ]
  return lines.join('\n')
}
