import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

export interface EnvironmentRecord {
  id: string
  type: string
  name: string
  config: Record<string, unknown>
}

export function useEnvironments() {
  return useQuery<EnvironmentRecord[]>({
    queryKey: ['environments'],
    queryFn: () => window.api.invoke('environments:list'),
  })
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
