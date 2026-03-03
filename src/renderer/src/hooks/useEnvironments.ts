import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { EnvironmentRecord, AgentStatus } from '../../../shared/types'

export type { EnvironmentRecord, AgentStatus }

export function useEnvironments() {
  return useQuery<EnvironmentRecord[]>({
    queryKey: ['environments'],
    queryFn: () => window.api.invoke('environments:list') as Promise<EnvironmentRecord[]>,
  })
}

export function useEnvironment(id: string | undefined) {
  const { data: envs } = useEnvironments()
  return id ? (envs?.find(e => e.id === id) ?? null) : null
}

export function useCreateEnvironment() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: { type: string; name: string; config: Record<string, unknown> }) =>
      window.api.invoke('environments:create', data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['environments'] }),
  })
}

export function useDeleteEnvironment() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => window.api.invoke('environments:delete', id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['environments'] }),
  })
}

export function useDeployTeam() {
  return useMutation({
    mutationFn: ({ teamSlug, envId }: { teamSlug: string; envId: string }) =>
      window.api.invoke('deploy:team', { teamSlug, envId }),
  })
}

export function useUndeployTeam() {
  return useMutation({
    mutationFn: ({ teamSlug, envId }: { teamSlug: string; envId: string }) =>
      window.api.invoke('undeploy:team', { teamSlug, envId }),
  })
}

export function useTeamStatus(teamSlug: string, envId: string | undefined) {
  return useQuery<AgentStatus[]>({
    queryKey: ['deploy:status', teamSlug, envId],
    queryFn: () => window.api.invoke('deploy:getStatus', { teamSlug, envId }) as Promise<AgentStatus[]>,
    enabled: !!envId,
    refetchInterval: 10_000,
  })
}
