import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { EnvironmentRecord } from '../../../shared/types'

export type { EnvironmentRecord }

export const useGkeConfig = () =>
  useQuery<EnvironmentRecord | null>({
    queryKey: ['gke', 'config'],
    queryFn: () => window.api.invoke('gke:getConfig') as Promise<EnvironmentRecord | null>,
  })

export const useSaveGkeConfig = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (config: Record<string, unknown>) =>
      window.api.invoke('gke:save', config) as Promise<{ ok: boolean }>,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['gke'] }),
  })
}

export const useGkeAuthStatus = () =>
  useQuery<{ authenticated: boolean }>({
    queryKey: ['gke', 'authStatus'],
    queryFn: () => window.api.invoke('gke:authStatus') as Promise<{ authenticated: boolean }>,
  })
