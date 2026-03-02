import type { Team, Member, ChatMessage, MemberHealth, GlobalSettings, GCPStatus } from './types'

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
  testGlobalSettings: () => req<{ ok: boolean; message: string }>('/api/settings/gcp/test'),

  exportDockerCompose: (teamId: string) =>
    fetch(`/api/teams/${teamId}/export/docker-compose`).then((r) => r.text()),
}
