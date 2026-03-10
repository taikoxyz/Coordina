import fs from 'fs/promises'
import path from 'path'
import { getDataDir } from './dataDir'

export interface TeamDeploymentRecord {
  teamSlug: string
  envSlug: string
  leadAgent: string
  gatewayBaseUrl: string
  clusterZone?: string
  deployedAt: number
}

const deploymentsDir = (): string => path.join(getDataDir(), 'deployments')

const deploymentPath = (teamSlug: string): string => path.join(deploymentsDir(), `${teamSlug}.json`)

const ensureDir = (): Promise<void> => fs.mkdir(deploymentsDir(), { recursive: true }).then(() => undefined)

function migrateDeployment(raw: Record<string, unknown>): TeamDeploymentRecord {
  if ('leadAgentSlug' in raw && !('leadAgent' in raw)) {
    raw.leadAgent = raw.leadAgentSlug
    delete raw.leadAgentSlug
  }
  return raw as unknown as TeamDeploymentRecord
}

export const getTeamDeployment = async (teamSlug: string): Promise<TeamDeploymentRecord | null> => {
  const content = await fs.readFile(deploymentPath(teamSlug), 'utf-8').catch(() => null)
  if (!content) return null
  const raw = JSON.parse(content) as Record<string, unknown>
  return migrateDeployment(raw)
}

export const saveTeamDeployment = async (record: TeamDeploymentRecord): Promise<void> => {
  await ensureDir()
  await fs.writeFile(deploymentPath(record.teamSlug), JSON.stringify(record, null, 2), 'utf-8')
}

export const deleteTeamDeployment = async (teamSlug: string): Promise<void> => {
  await fs.unlink(deploymentPath(teamSlug)).catch(() => undefined)
}
