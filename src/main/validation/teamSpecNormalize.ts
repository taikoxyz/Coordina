import type { TeamSpec, AgentSpec } from '../../shared/types'

function normalizeOptional(value?: string): string | undefined {
  const trimmed = value?.trim()
  return trimmed ? trimmed : undefined
}

function normalizePositiveInt(value?: number): number | undefined {
  return Number.isInteger(value) && (value as number) > 0 ? value : undefined
}

function normalizePositiveNumber(value?: number): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : undefined
}

function normalizeAgent(agent: AgentSpec): AgentSpec {
  return {
    slug: normalizeOptional(agent.slug) ?? '',
    name: normalizeOptional(agent.name) ?? '',
    role: normalizeOptional(agent.role) ?? '',
    emoji: normalizeOptional(agent.emoji),
    avatar: normalizeOptional(agent.avatar),
    telegramBot: normalizeOptional(agent.telegramBot),
    email: normalizeOptional(agent.email),
    slack: normalizeOptional(agent.slack),
    githubUsername: normalizeOptional(agent.githubUsername),
    skills: Array.isArray(agent.skills)
      ? agent.skills.map(s => s.trim()).filter(Boolean)
      : [],
    persona: agent.persona ?? '',
    provider: normalizeOptional(agent.provider) ?? '',
    image: normalizeOptional(agent.image),
    cpu: normalizePositiveNumber(agent.cpu),
    diskGi: normalizePositiveInt(agent.diskGi),
  }
}

export function normalizeTeamSpec(spec: TeamSpec): TeamSpec {
  const normalizedAgents = Array.isArray(spec.agents) ? spec.agents.map(normalizeAgent) : []
  const normalizedLead = normalizeOptional(spec.leadAgent)

  return {
    slug: normalizeOptional(spec.slug) ?? '',
    name: normalizeOptional(spec.name) ?? '',
    telegramGroupId: normalizeOptional(spec.telegramGroupId),
    telegramAdminId: normalizeOptional(spec.telegramAdminId),
    defaultImage: normalizeOptional(spec.defaultImage),
    defaultDiskGi: normalizePositiveInt(spec.defaultDiskGi),
    leadAgent: normalizedLead && normalizedAgents.some(a => a.slug === normalizedLead) ? normalizedLead : undefined,
    startupInstructions: normalizeOptional(spec.startupInstructions),
    signingKey: normalizeOptional(spec.signingKey),
    agents: normalizedAgents,
  }
}

export function validateTelegramPair(spec: TeamSpec): void {
  const groupId = normalizeOptional(spec.telegramGroupId)
  const adminId = normalizeOptional(spec.telegramAdminId)
  const hasGroup = Boolean(groupId)
  const hasAdmin = Boolean(adminId)
  if (hasGroup !== hasAdmin) {
    throw new Error('telegramGroupId and telegramAdminId must both be set or both be empty')
  }
}
