// React Query hooks for environment CRUD using the file-based IPC layer
// FEATURE: Environment management hooks consuming environments:list/save/delete IPC channels
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { EnvironmentRecord, AgentStatus } from '../../../shared/types'

export type { EnvironmentRecord, AgentStatus }

export const useEnvironments = () =>
  useQuery<EnvironmentRecord[]>({
    queryKey: ['environments'],
    queryFn: () => window.api.invoke('environments:list') as Promise<EnvironmentRecord[]>,
  })

export const useEnvironment = (slug: string | undefined) => {
  const { data: envs } = useEnvironments()
  return slug ? (envs?.find(e => e.slug === slug) ?? null) : null
}

export const useSaveEnvironment = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (record: EnvironmentRecord) => window.api.invoke('environments:save', record),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['environments'] }),
  })
}

export const useDeleteEnvironment = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (slug: string) => window.api.invoke('environments:delete', slug),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['environments'] }),
  })
}
