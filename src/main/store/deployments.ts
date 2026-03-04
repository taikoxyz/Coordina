import fs from 'fs/promises'
import path from 'path'
import { getDataDir } from './dataDir'

export interface TeamDeploymentRecord {
  teamSlug: string
  envSlug: string
  leadAgentSlug: string
  gatewayBaseUrl: string
  deployedAt: number
}

const deploymentsDir = (): string => path.join(getDataDir(), 'deployments')

const deploymentPath = (teamSlug: string): string => path.join(deploymentsDir(), `${teamSlug}.json`)

const ensureDir = (): Promise<void> => fs.mkdir(deploymentsDir(), { recursive: true }).then(() => undefined)

export const getTeamDeployment = async (teamSlug: string): Promise<TeamDeploymentRecord | null> => {
  const content = await fs.readFile(deploymentPath(teamSlug), 'utf-8').catch(() => null)
  return content ? JSON.parse(content) : null
}

export const saveTeamDeployment = async (record: TeamDeploymentRecord): Promise<void> => {
  await ensureDir()
  await fs.writeFile(deploymentPath(record.teamSlug), JSON.stringify(record, null, 2), 'utf-8')
}

export const deleteTeamDeployment = async (teamSlug: string): Promise<void> => {
  await fs.unlink(deploymentPath(teamSlug)).catch(() => undefined)
}
