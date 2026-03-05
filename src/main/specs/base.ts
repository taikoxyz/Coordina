// Interface for deployment spec derivation across multiple cloud environments
// FEATURE: Derivation abstraction layer for cloud-agnostic manifest generation
import { TeamSpec, ProviderRecord, SpecFile } from '../../shared/types'

export interface DeriveSecrets {
  agentTelegramTokens?: Record<string, string | undefined>
}

export interface DeploymentSpecDeriver {
  envType: string
  derive(
    spec: TeamSpec,
    providers: Map<string, ProviderRecord & { apiKey?: string }>,
    envConfig: Record<string, unknown>,
    secrets?: DeriveSecrets
  ): Promise<SpecFile[]>
}

const registry = new Map<string, DeploymentSpecDeriver>()

export const registerDeriver = (d: DeploymentSpecDeriver): void => { registry.set(d.envType, d) }

export const getDeriver = (envType: string): DeploymentSpecDeriver => {
  const d = registry.get(envType)
  if (!d) throw new Error(`No spec deriver for environment type: ${envType}`)
  return d
}
