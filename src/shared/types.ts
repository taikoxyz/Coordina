export interface TeamRecord {
  slug: string
  name: string
  githubRepo?: string
  leadAgentSlug?: string
  config: Record<string, unknown>
  gatewayUrl?: string
  deployedEnvId?: string
  domain?: string
  image?: string
  deployedSpecHash?: string
  bootstrapInstructions?: string
}

export interface AgentRecord {
  slug: string
  teamSlug: string
  name: string
  role: string
  email?: string
  slackHandle?: string
  githubId?: string
  skills: string[]
  soul: string
  providerId?: string
  model?: string
  image?: string
  isLead: boolean
}

export interface ProviderRecord {
  id: string
  type: string
  name: string
  config: Record<string, unknown>
  maskedApiKey?: string
}

export interface EnvironmentRecord {
  id: string
  type: string
  name: string
  config: Record<string, unknown>
}

export interface SpecFile {
  path: string
  content: string
}

export interface ModelInfo {
  id: string
  name: string
  contextWindow?: number
}

export interface AgentStatus {
  agentSlug: string
  status: 'running' | 'pending' | 'crashed' | 'unknown'
  message?: string
}

export interface DeployResult {
  ok: boolean
  gatewayUrl?: string
  reason?: string
}
