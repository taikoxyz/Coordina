// React Query hooks for provider CRUD using the file-based IPC layer
// FEATURE: Provider management hooks consuming providers:list/save/delete IPC channels
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { ProviderRecord } from '../../../shared/types'

export type { ProviderRecord }

export const useProviders = () =>
  useQuery<(ProviderRecord & { maskedApiKey?: string })[]>({
    queryKey: ['providers'],
    queryFn: () => window.api.invoke('providers:list') as Promise<(ProviderRecord & { maskedApiKey?: string })[]>,
  })

export const useSaveProvider = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: ProviderRecord & { apiKey?: string }) =>
      window.api.invoke('providers:save', data) as Promise<{ ok: boolean; errors?: string[] }>,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['providers'] }),
  })
}

export const useDeleteProvider = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (slug: string) =>
      window.api.invoke('providers:delete', slug) as Promise<{ ok: boolean }>,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['providers'] }),
  })
}

export const useOAuthProvider = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { slug: string; type: string }) =>
      window.api.invoke('providers:oauth', data) as Promise<{ ok: boolean; models?: string[]; error?: string }>,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['providers'] }),
  })
}
