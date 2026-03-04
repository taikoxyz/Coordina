// File-based store for team specs reading and writing JSON files
// FEATURE: Store layer replacing SQLite for team spec persistence
import fs from 'fs/promises'
import path from 'path'
import os from 'os'
import { TeamSpec } from '../../shared/types'

const teamsDir = (): string => path.join(os.homedir(), '.coordina', 'teams')

const teamPath = (slug: string): string => path.join(teamsDir(), `${slug}.json`)

const ensureDir = (): Promise<void> => fs.mkdir(teamsDir(), { recursive: true }).then(() => undefined)

export const listTeams = async (): Promise<TeamSpec[]> => {
  await ensureDir()
  const entries = await fs.readdir(teamsDir()).catch(() => [] as string[])
  const specs = await Promise.all(
    entries
      .filter((f) => f.endsWith('.json'))
      .map((f) => fs.readFile(path.join(teamsDir(), f), 'utf-8').then(JSON.parse).catch(() => null))
  )
  return specs.filter(Boolean) as TeamSpec[]
}

export const getTeam = async (slug: string): Promise<TeamSpec | null> => {
  const content = await fs.readFile(teamPath(slug), 'utf-8').catch(() => null)
  return content ? JSON.parse(content) : null
}

export const saveTeam = async (spec: TeamSpec): Promise<void> => {
  await ensureDir()
  await fs.writeFile(teamPath(spec.slug), JSON.stringify(spec, null, 2), 'utf-8')
}

export const deleteTeam = async (slug: string): Promise<void> => {
  await fs.unlink(teamPath(slug)).catch(() => undefined)
}
