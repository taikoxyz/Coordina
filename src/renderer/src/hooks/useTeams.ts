// React Query hooks for team spec CRUD using the file-based IPC layer
// FEATURE: Team management hooks consuming teams:list/get/save/delete IPC channels
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { TeamSpec } from '../../../shared/types'

export type { TeamSpec }

export const useTeams = () =>
  useQuery<TeamSpec[]>({
    queryKey: ['teams'],
    queryFn: () => window.api.invoke('teams:list') as Promise<TeamSpec[]>,
  })

export const useTeam = (slug: string) =>
  useQuery<TeamSpec | null>({
    queryKey: ['teams', slug],
    queryFn: () => window.api.invoke('teams:get', slug) as Promise<TeamSpec | null>,
    enabled: !!slug,
  })

export const useSaveTeam = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (spec: TeamSpec) =>
      window.api.invoke('teams:save', spec) as Promise<{ ok: boolean }>,
    onSuccess: (_data, spec) => {
      qc.invalidateQueries({ queryKey: ['teams'] })
      qc.invalidateQueries({ queryKey: ['teams', spec.slug] })
    },
  })
}

export const useImportTeam = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () =>
      window.api.invoke('teams:import') as Promise<{ ok: boolean; slug?: string; reason?: string }>,
    onSuccess: (data) => {
      if (data.ok) qc.invalidateQueries({ queryKey: ['teams'] })
    },
  })
}

export const useDeleteTeam = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (slug: string) =>
      window.api.invoke('teams:delete', slug) as Promise<{ ok: boolean }>,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['teams'] }),
  })
}
