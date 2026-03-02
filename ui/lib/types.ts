export interface Team {
  id: string
  name: string
  display_name: string
  domain: string
  gcp_project_id: string
  gcp_project_status: 'pending' | 'provisioning' | 'ready' | 'error'
  default_cpu: string
  default_memory: string
  default_disk: string
  prefix_allowlist: string[]
  created_at: string
  updated_at: string
  members?: Member[]
}

export interface Member {
  id: string
  team_id: string
  name: string
  prefix: string
  display_name: string
  role: string
  is_team_lead: boolean
  model_provider: string
  model_id: string
  tools_enabled: string[]
  cpu: string | null
  memory: string | null
  disk: string | null
  container_port: number
  created_at: string
  updated_at: string
}

export interface ChatMessage {
  id: string
  team_id: string
  member_id: string
  role: 'user' | 'agent'
  content: string
  status: 'sent' | 'queued' | 'delivered'
  created_at: string
}

export interface MemberHealth {
  member_id: string
  status: 'online' | 'offline' | 'error'
  active_task?: string
  last_seen?: string
  uptime_seconds?: number
}

export interface GlobalSettings {
  gcp_org_id: string
  gcp_billing_account: string
  has_bootstrap_sa_key: boolean
  updated_at: string
}

export interface GCPStatus {
  gcp_project_id: string
  gcp_project_status: 'pending' | 'provisioning' | 'ready' | 'error'
}
