export interface ValidationResult {
  valid: boolean
  errors?: string[]
}

export interface DeployResult {
  ok: boolean
  gatewayUrl?: string
  reason?: string
}

export interface AgentStatus {
  agentSlug: string
  status: 'running' | 'pending' | 'crashed' | 'unknown'
  message?: string
}

export interface DeploymentEnvironment {
  id: string
  displayName: string
  configSchema: object
  validate(config: unknown): ValidationResult
  deploy(teamSlug: string, config: unknown): Promise<DeployResult>
  undeploy(teamSlug: string, config: unknown): Promise<void>
  getStatus(teamSlug: string, config: unknown): Promise<AgentStatus[]>
}

const registry = new Map<string, DeploymentEnvironment>()

export function registerEnvironment(e: DeploymentEnvironment): void {
  registry.set(e.id, e)
}

export function getEnvironment(id: string): DeploymentEnvironment {
  const e = registry.get(id)
  if (!e) throw new Error(`Unknown deployment environment: ${id}`)
  return e
}

export function listEnvironments(): DeploymentEnvironment[] {
  return [...registry.values()]
}

/** Test helper — reset registry between tests */
export function _resetEnvRegistry(): void {
  registry.clear()
}
