import type { AgentNameTheme } from './agentNames'

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: number
}

export interface AgentSpec {
  slug: string
  name: string
  role: string
  avatar?: string
  telegramBot?: string
  email?: string
  slack?: string
  githubUsername?: string
  skills: string[]
  persona: string
  models: string[]
  image?: string
  cpu?: number
  diskGi?: number
  tone?: string
  boundaries?: string[]
  values?: string[]
  operatingRules?: string[]
  toolGuidance?: string[]
}

export interface TeamSpec {
  slug: string
  name: string
  telegramGroupId?: string
  telegramAdminId?: string
  defaultImage?: string
  defaultCpu?: number
  defaultDiskGi?: number
  leadAgent?: string
  startupInstructions?: string
  signingKey?: string
  agents: AgentSpec[]
  deployedEnvSlug?: string
  lastDeployedAt?: number
  adminName?: string
  adminEmail?: string
  teamEmail?: string
  teamDescription?: string
}

export interface PersonaTemplate {
  id: string
  name: string
  division: string
  emoji: string
  role: string
  persona: string
  skills: string[]
}

export interface EnvironmentRecord {
  slug: string
  type: string
  name: string
  config: Record<string, unknown>
}

export interface DerivationPatterns {
  soul?: {
    coreTruths?: string[]
    continuity?: string
  }
  agents?: {
    firstRun?: string
    memoryRules?: string[]
    safetyRules?: string[]
    priorities?: string[]
    teamLeadResponsibilities?: string[]
    defaultRule?: string
  }
  user?: {
    introLines?: string[]
  }
}

export interface AppSettings {
  derivationPatterns?: DerivationPatterns
  gitEnabled?: boolean
  gitRepoPath?: string
  agentNameTheme?: AgentNameTheme
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
  forceRecreate: boolean
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

export interface Project {
  slug: string
  name: string
  description?: string
  status: 'active' | 'completed' | 'archived'
  createdAt: number
  createdBy: string
}
