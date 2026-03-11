import type { AgentNameTheme } from "./agentNames";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
}

export interface AdditionalPort {
  port: number
  targetPort: number
  name: string
  protocol?: string
}

export interface AdditionalPort {
  port: number
  targetPort: number
  name: string
  protocol?: string
}

export interface AgentSpec {
  slug: string
  name: string
  title?: string
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
  memoryGi?: number
  diskGi?: number
  tone?: string
  boundaries?: string[]
  values?: string[]
  operatingRules?: string[]
  toolGuidance?: string[]
  additionalPorts?: AdditionalPort[]
}

export interface TeamSpec {
  slug: string
  name: string
  telegramGroupId?: string
  telegramAdminId?: string
  defaultImage?: string
  defaultCpu?: number
  defaultMemoryGi?: number
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
  missionControlEnabled?: boolean
  logLevel?: string
}

export interface AgentTemplate {
  id: string;
  name: string;
  division: string;
  emoji: string;
  role: string;
  persona: string;
  skills: string[];
}

export interface EnvironmentRecord {
  slug: string;
  type: string;
  name: string;
  config: Record<string, unknown>;
}

export interface DerivationPatterns {
  soul?: {
    coreTruths?: string[];
    continuity?: string;
  };
  agents?: {
    firstRun?: string;
    memoryRules?: string[];
    safetyRules?: string[];
    priorities?: string[];
    teamLeadResponsibilities?: string[];
    defaultRules?: string[];
  };
  user?: {
    introLines?: string[];
  };
}

export interface AppSettings {
  derivationPatterns?: DerivationPatterns;
  agentNameTheme?: AgentNameTheme;
}

export interface SpecFile {
  path: string;
  content: string;
}

export interface ModelInfo {
  id: string;
  name: string;
  contextWindow?: number;
}

export interface AgentStatus {
  agentSlug: string;
  status: "running" | "pending" | "crashed" | "unknown";
  message?: string;
}

export interface ValidationError {
  field: string;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

export interface DeployOptions {
  recreateDisks: boolean;
  forceRecreatePods: boolean;
  partialDeploy?: boolean;
}

export interface DeployStatus {
  resource: string;
  status: "created" | "updated" | "deleted" | "exists" | "error";
  message?: string;
}

export interface DeployResult {
  ok: boolean;
  gatewayUrl?: string;
  reason?: string;
}

export interface DeployReadinessResult {
  ok: boolean;
  reason?: string;
}

export interface MissionControlConfig {
  enabled: boolean;
  image: string;
}

export interface Task {
  id: string
  title: string
  assignedTo?: string
  status: 'unclaimed' | 'in_progress' | 'review' | 'done'
  priority: 'low' | 'medium' | 'high' | 'critical'
  dueDate?: string
  blockers?: string[]
  projectId?: string
  description?: string
  createdAt?: string
  updatedAt?: string
}

export interface Task {
  id: string
  title: string
  assignedTo?: string
  status: 'unclaimed' | 'in_progress' | 'review' | 'done'
  priority: 'low' | 'medium' | 'high' | 'critical'
  dueDate?: string
  blockers?: string[]
  projectId?: string
  description?: string
  createdAt?: string
  updatedAt?: string
}

export interface Project {
  slug: string
  name: string
  description?: string
  status: 'active' | 'completed' | 'archived'
  createdAt: number
  createdBy: string
  progress?: number        // 0-100 computed from tasks
  tasks?: Task[]           // array of task objects
}

export interface PodLogOptions {
  tailLines?: number;
  sinceSeconds?: number;
}

export interface AgentLogEntry {
  agentSlug: string;
  logs: string;
}
