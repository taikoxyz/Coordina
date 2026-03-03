import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { ProviderRecord } from '../../../shared/types'

export type { ProviderRecord }

export function useProviders() {
  return useQuery<ProviderRecord[]>({
    queryKey: ['providers'],
    queryFn: () => window.api.invoke('providers:list') as Promise<ProviderRecord[]>,
  })
}

export function useCreateProvider() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { type: string; name: string; config: Record<string, unknown> }) =>
      window.api.invoke('providers:create', data) as Promise<{ ok: boolean; id?: string; errors?: string[] }>,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['providers'] }),
  })
}

export function useUpdateProvider() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: { name?: string; config?: Record<string, unknown> } }) =>
      window.api.invoke('providers:update', id, data) as Promise<{ ok: boolean; errors?: string[] }>,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['providers'] }),
  })
}

export function useDeleteProvider() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      window.api.invoke('providers:delete', id) as Promise<{ ok: boolean }>,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['providers'] }),
  })
}
