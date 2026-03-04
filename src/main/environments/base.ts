// Base interface for deployment environments with streaming status output
// FEATURE: Deployment environment abstraction for multi-cloud provider support
import type { AgentStatus, DeployOptions, DeployStatus, SpecFile } from '../../shared/types'

export type { AgentStatus, DeployOptions, DeployStatus, SpecFile }

export interface ValidationResult {
  valid: boolean
  errors?: string[]
}

export interface DeploymentEnvironment {
  id: string
  displayName: string
  configSchema: object
  validate(config: unknown): ValidationResult
  deploy(files: SpecFile[], teamSlug: string, config: unknown, options: DeployOptions): AsyncIterable<DeployStatus>
  undeploy(teamSlug: string, config: unknown): AsyncIterable<DeployStatus>
  getStatus(teamSlug: string, config: unknown): Promise<AgentStatus[]>
}

const registry = new Map<string, DeploymentEnvironment>()

export const registerEnvironment = (e: DeploymentEnvironment): void => { registry.set(e.id, e) }

export const getEnvironment = (id: string): DeploymentEnvironment => {
  const e = registry.get(id)
  if (!e) throw new Error(`Unknown deployment environment: ${id}`)
  return e
}

export const listEnvironments = (): DeploymentEnvironment[] => [...registry.values()]

export const _resetEnvRegistry = (): void => { registry.clear() }
