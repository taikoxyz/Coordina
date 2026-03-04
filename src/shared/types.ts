export interface AgentSpec {
  slug: string
  name: string
  role: string
  email?: string
  slackHandle?: string
  githubId?: string
  skills: string[]
  soul: string
  providerSlug: string
  image?: string
  isLead: boolean
  cpu?: number
  storageGi?: number
}

export interface TeamSpec {
  slug: string
  name: string
  domain?: string
  image?: string
  storageGi?: number
  leadAgentSlug?: string
  bootstrapInstructions?: string
  tokenSeed?: string
  agents: AgentSpec[]
}

export interface ProviderRecord {
  slug: string
  type: string
  name: string
  model: string
}

export interface EnvironmentRecord {
  slug: string
  type: string
  name: string
  config: Record<string, unknown>
}

export interface AppSettings {
  gitEnabled?: boolean
  gitRepoPath?: string
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

export interface ValidationError {
  field: string
  message: string
}

export interface ValidationResult {
  valid: boolean
  errors: ValidationError[]
}

export interface DeployOptions {
  keepDisks: boolean
}

export interface DeployStatus {
  resource: string
  status: 'created' | 'updated' | 'deleted' | 'exists' | 'error'
  message?: string
}

export interface DeployResult {
  ok: boolean
  gatewayUrl?: string
  reason?: string
}
