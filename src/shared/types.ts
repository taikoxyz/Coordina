// Shared types between main and renderer processes

export interface AgentSpec {
  slug: string
  name: string
  role: string
  email?: string
  slackHandle?: string
  githubId?: string
  skills: string[]
  soulUserInput: string
  soulEnhanced?: string
  modelProviderId: string
}

export interface TeamSpec {
  slug: string
  name: string
  githubRepo?: string
  leadAgentSlug: string
  agents: AgentSpec[]
}

export interface ProviderRecord {
  id: string
  type: string
  name: string
  config: Record<string, unknown>
}

export interface EnvironmentRecord {
  id: string
  type: string
  name: string
  config: Record<string, unknown>
  used: boolean
}

export interface DeployResult {
  ok: boolean
  gatewayUrl?: string
  reason?: string
}
