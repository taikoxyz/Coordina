import type { Team, Member, ChatMessage, MemberHealth, GlobalSettings, GCPStatus, FileEntry, MaterializeStatus } from './types'

async function req<T>(path: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json', ...opts?.headers },
    ...opts,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error((err as { error?: string }).error ?? res.statusText)
  }
  return res.json() as Promise<T>
}

export const api = {
  getTeams: () => req<Team[]>('/api/teams'),
  createTeam: (data: Partial<Team>) =>
    req<Team>('/api/teams', { method: 'POST', body: JSON.stringify(data) }),
  getTeam: (id: string) => req<Team>(`/api/teams/${id}`),
  updateTeam: (id: string, data: Partial<Team>) =>
    req<Team>(`/api/teams/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteTeam: (id: string) =>
    req<void>(`/api/teams/${id}`, { method: 'DELETE' }),

  getMembers: (teamId: string) => req<Member[]>(`/api/teams/${teamId}/members`),
  createMember: (teamId: string, data: Partial<Member>) =>
    req<Member>(`/api/teams/${teamId}/members`, { method: 'POST', body: JSON.stringify(data) }),
  getMember: (teamId: string, memberId: string) =>
    req<Member>(`/api/teams/${teamId}/members/${memberId}`),
  updateMember: (teamId: string, memberId: string, data: Partial<Member>) =>
    req<Member>(`/api/teams/${teamId}/members/${memberId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  deleteMember: (teamId: string, memberId: string) =>
    req<void>(`/api/teams/${teamId}/members/${memberId}`, { method: 'DELETE' }),

  getChatHistory: (teamId: string, memberId: string) =>
    req<ChatMessage[]>(`/api/teams/${teamId}/members/${memberId}/chat/history`),
  sendMessage: (teamId: string, memberId: string, content: string) =>
    req<{ messages: ChatMessage[] }>(`/api/teams/${teamId}/members/${memberId}/chat`, {
      method: 'POST',
      body: JSON.stringify({ content }),
    }),

  getMemberHealth: (teamId: string, memberId: string) =>
    req<MemberHealth>(`/api/teams/${teamId}/members/${memberId}/health`),
  getTeamHealth: (teamId: string) =>
    req<MemberHealth[]>(`/api/teams/${teamId}/health`),

  getGCPStatus: (teamId: string) =>
    req<GCPStatus>(`/api/teams/${teamId}/gcp/status`),
  reprovisionGCP: (teamId: string) =>
    req<void>(`/api/teams/${teamId}/gcp/reprovision`, { method: 'POST' }),

  getGlobalSettings: () => req<GlobalSettings>('/api/settings/gcp'),
  saveGlobalSettings: (data: {
    gcp_org_id: string
    gcp_billing_account: string
    bootstrap_sa_key: string
  }) =>
    req<{ updated_at: string }>('/api/settings/gcp', {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  testGlobalSettings: () => req<{
    ok: boolean
    message: string
    sa_email?: string
    checks?: Array<{ name: string; level: string; has: boolean }>
  }>('/api/settings/gcp/test'),

  exportDockerCompose: (teamId: string) =>
    fetch(`/api/teams/${teamId}/export/docker-compose`).then((r) => r.text()),

  getGCPAuthURL: () => req<{ url: string }>('/api/auth/gcp/begin'),
  getGCPAuthStatus: () =>
    req<{
      connected: boolean
      email: string
      sa_email: string
      sa_created: boolean
      provisioning_status: string
      org_id: string
      billing_account: string
      oauth_configured: boolean
    }>('/api/auth/gcp/status'),
  revokeGCPAuth: () => req<void>('/api/auth/gcp/revoke', { method: 'POST' }),

  gcloudBegin: () => req<{ url: string }>('/api/auth/gcloud/begin'),
  gcloudSubmit: (code: string) =>
    req<{ email: string }>('/api/auth/gcloud/submit', {
      method: 'POST',
      body: JSON.stringify({ code }),
    }),

  gcloudADCBegin: () => req<{ url: string }>('/api/auth/workspace/gcloud/begin'),
  gcloudADCSubmit: (code: string) =>
    req<{ email: string }>('/api/auth/workspace/gcloud/submit', {
      method: 'POST',
      body: JSON.stringify({ code }),
    }),

  getWorkspaceAuthURL: () => req<{ url: string }>('/api/auth/workspace/begin'),
  getWorkspaceAuthStatus: () =>
    req<{ connected: boolean; email: string }>('/api/auth/workspace/status'),
  revokeWorkspaceAuth: () => req<void>('/api/auth/workspace/revoke', { method: 'POST' }),

  getMemberFiles: (
    teamId: string,
    memberId: string,
    opts?: { filter?: 'memory'; format?: 'markdown' },
  ) => {
    const params = new URLSearchParams()
    if (opts?.filter) params.set('filter', opts.filter)
    if (opts?.format) params.set('format', opts.format)
    const qs = params.toString() ? `?${params.toString()}` : ''
    return req<{ files: FileEntry[]; offline?: boolean }>(
      `/api/teams/${teamId}/members/${memberId}/files${qs}`,
    )
  },

  duplicateMember: (teamId: string, memberId: string, newName: string) =>
    req<Member>(`/api/teams/${teamId}/members/${memberId}/duplicate`, {
      method: 'POST',
      body: JSON.stringify({ name: newName }),
    }),

  startMaterialize: (teamId: string) =>
    req<{ status: string }>(`/api/teams/${teamId}/materialize`, { method: 'POST' }),
  getMaterializeStatus: (teamId: string) =>
    req<MaterializeStatus>(`/api/teams/${teamId}/materialize/status`),
}
