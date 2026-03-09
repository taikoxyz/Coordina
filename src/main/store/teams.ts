// File-based store for team specs reading and writing JSON files
// FEATURE: Store layer replacing SQLite for team spec persistence
import fs from 'fs/promises'
import path from 'path'
import os from 'os'
import { TeamSpec } from '../../shared/types'

const teamsDir = (): string => path.join(os.homedir(), '.coordina', 'teams')

const teamPath = (slug: string): string => path.join(teamsDir(), `${slug}.json`)

const ensureDir = (): Promise<void> => fs.mkdir(teamsDir(), { recursive: true }).then(() => undefined)

function migrateAgent(a: Record<string, unknown>): Record<string, unknown> {
  const out = { ...a }
  if ('soul' in out && !('persona' in out)) { out.persona = out.soul; delete out.soul }
  if ('providerSlug' in out && !('provider' in out)) { out.provider = out.providerSlug; delete out.providerSlug }
  if ('telegramBotId' in out && !('telegramBot' in out)) { out.telegramBot = out.telegramBotId; delete out.telegramBotId }
  if ('githubId' in out && !('githubUsername' in out)) { out.githubUsername = out.githubId; delete out.githubId }
  if ('slackHandle' in out && !('slack' in out)) { out.slack = out.slackHandle; delete out.slackHandle }
  if ('storageGi' in out && !('diskGi' in out)) { out.diskGi = out.storageGi; delete out.storageGi }
  if ('model' in out && !('models' in out)) { out.models = out.model ? [out.model] : []; delete out.model }
  delete out.emoji
  delete out.isLead
  return out
}

function migrateRaw(rest: Record<string, unknown>): void {
  if ('telegramGroupChatId' in rest && !('telegramGroupId' in rest)) { rest.telegramGroupId = rest.telegramGroupChatId; delete rest.telegramGroupChatId }
  if ('telegramOwnerUserId' in rest && !('telegramAdminId' in rest)) { rest.telegramAdminId = rest.telegramOwnerUserId; delete rest.telegramOwnerUserId }
  if ('image' in rest && !('defaultImage' in rest)) { rest.defaultImage = rest.image; delete rest.image }
  if ('storageGi' in rest && !('defaultDiskGi' in rest)) { rest.defaultDiskGi = rest.storageGi; delete rest.storageGi }
  if ('leadAgentSlug' in rest && !('leadAgent' in rest)) { rest.leadAgent = rest.leadAgentSlug; delete rest.leadAgentSlug }
  if ('bootstrapInstructions' in rest && !('startupInstructions' in rest)) { rest.startupInstructions = rest.bootstrapInstructions; delete rest.bootstrapInstructions }
  if ('tokenSeed' in rest && !('signingKey' in rest)) { rest.signingKey = rest.tokenSeed; delete rest.tokenSeed }
  if (Array.isArray(rest.agents)) rest.agents = rest.agents.map((a: unknown) => typeof a === 'object' && a !== null ? migrateAgent(a as Record<string, unknown>) : a)
}

function normalizeTeamSpec(raw: unknown): TeamSpec | null {
  if (!raw || typeof raw !== 'object') return null
  const rest = { ...(raw as Record<string, unknown>) }
  delete rest.domain
  migrateRaw(rest)
  if (typeof rest.slug !== 'string' || typeof rest.name !== 'string' || !Array.isArray(rest.agents)) return null
  return rest as unknown as TeamSpec
}

export const listTeams = async (): Promise<TeamSpec[]> => {
  await ensureDir()
  const entries = await fs.readdir(teamsDir()).catch(() => [] as string[])
  const specs = await Promise.all(
    entries
      .filter((f) => f.endsWith('.json'))
      .map((f) => fs.readFile(path.join(teamsDir(), f), 'utf-8').then(JSON.parse).then(normalizeTeamSpec).catch(() => null))
  )
  return specs.filter(Boolean) as TeamSpec[]
}

export const getTeam = async (slug: string): Promise<TeamSpec | null> => {
  const content = await fs.readFile(teamPath(slug), 'utf-8').catch(() => null)
  return content ? normalizeTeamSpec(JSON.parse(content)) : null
}

export const saveTeam = async (spec: TeamSpec): Promise<void> => {
  await ensureDir()
  const normalized = normalizeTeamSpec(spec)
  if (!normalized) return
  await fs.writeFile(teamPath(normalized.slug), JSON.stringify(normalized, null, 2), 'utf-8')
}

export const deleteTeam = async (slug: string): Promise<void> => {
  await fs.unlink(teamPath(slug)).catch(() => undefined)
}
