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
    telegramBotId: normalizeOptional(agent.telegramBotId),
    email: normalizeOptional(agent.email),
    slackHandle: normalizeOptional(agent.slackHandle),
    githubId: normalizeOptional(agent.githubId),
    skills: Array.isArray(agent.skills)
      ? agent.skills.map(s => s.trim()).filter(Boolean)
      : [],
    soul: agent.soul ?? '',
    providerSlug: normalizeOptional(agent.providerSlug) ?? '',
    image: normalizeOptional(agent.image),
    isLead: Boolean(agent.isLead),
    cpu: normalizePositiveNumber(agent.cpu),
    storageGi: normalizePositiveInt(agent.storageGi),
  }
}

export function normalizeTeamSpec(spec: TeamSpec): TeamSpec {
  const normalizedAgents = Array.isArray(spec.agents) ? spec.agents.map(normalizeAgent) : []
  const normalizedLead = normalizeOptional(spec.leadAgentSlug)

  return {
    slug: normalizeOptional(spec.slug) ?? '',
    name: normalizeOptional(spec.name) ?? '',
    telegramGroupChatId: normalizeOptional(spec.telegramGroupChatId),
    telegramOwnerUserId: normalizeOptional(spec.telegramOwnerUserId),
    image: normalizeOptional(spec.image),
    storageGi: normalizePositiveInt(spec.storageGi),
    leadAgentSlug: normalizedLead && normalizedAgents.some(a => a.slug === normalizedLead) ? normalizedLead : undefined,
    bootstrapInstructions: normalizeOptional(spec.bootstrapInstructions),
    tokenSeed: normalizeOptional(spec.tokenSeed),
    agents: normalizedAgents,
  }
}

export function validateTelegramPair(spec: TeamSpec): void {
  const groupChatId = normalizeOptional(spec.telegramGroupChatId)
  const ownerUserId = normalizeOptional(spec.telegramOwnerUserId)
  const hasGroup = Boolean(groupChatId)
  const hasOwner = Boolean(ownerUserId)
  if (hasGroup !== hasOwner) {
    throw new Error('telegramGroupChatId and telegramOwnerUserId must both be set or both be empty')
  }
}
