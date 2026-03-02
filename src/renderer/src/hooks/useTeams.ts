import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

export interface TeamRecord {
  slug: string
  name: string
  githubRepo?: string
  leadAgentSlug?: string
  config: Record<string, unknown>
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
  isLead: boolean
}

export function useTeams() {
  return useQuery<TeamRecord[]>({
    queryKey: ['teams'],
    queryFn: () => window.api.invoke('teams:list') as Promise<TeamRecord[]>,
  })
}

export function useTeam(slug: string) {
  return useQuery<TeamRecord | null>({
    queryKey: ['teams', slug],
    queryFn: () => window.api.invoke('teams:get', slug) as Promise<TeamRecord | null>,
    enabled: !!slug,
  })
}

export function useCreateTeam() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { slug: string; name: string; createRepo?: boolean }) =>
      window.api.invoke('teams:create', data) as Promise<{ ok: boolean; slug?: string; githubRepo?: string; errors?: string[] }>,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['teams'] }),
  })
}

export function useDeleteTeam() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (slug: string) =>
      window.api.invoke('teams:delete', slug) as Promise<{ ok: boolean }>,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['teams'] }),
  })
}

export function useAgents(teamSlug: string) {
  return useQuery<AgentRecord[]>({
    queryKey: ['agents', teamSlug],
    queryFn: () => window.api.invoke('agents:list', teamSlug) as Promise<AgentRecord[]>,
    enabled: !!teamSlug,
  })
}

export function useCreateAgent() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Partial<AgentRecord> & { teamSlug: string; slug: string; name: string; role: string }) =>
      window.api.invoke('agents:create', data) as Promise<{ ok: boolean }>,
    onSuccess: (_data, variables) => qc.invalidateQueries({ queryKey: ['agents', variables.teamSlug] }),
  })
}

export function useUpdateAgent() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ slug, teamSlug, data }: { slug: string; teamSlug: string; data: Partial<AgentRecord> }) =>
      window.api.invoke('agents:update', slug, teamSlug, data) as Promise<{ ok: boolean }>,
    onSuccess: (_data, variables) => qc.invalidateQueries({ queryKey: ['agents', variables.teamSlug] }),
  })
}

export function useDeleteAgent() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ slug, teamSlug }: { slug: string; teamSlug: string }) =>
      window.api.invoke('agents:delete', slug, teamSlug) as Promise<{ ok: boolean }>,
    onSuccess: (_data, variables) => qc.invalidateQueries({ queryKey: ['agents', variables.teamSlug] }),
  })
}
