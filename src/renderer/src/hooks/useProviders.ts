import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

export const useOpenRouterStatus = () =>
  useQuery<{ connected: boolean; maskedKey?: string }>({
    queryKey: ['openrouter', 'status'],
    queryFn: () => window.api.invoke('openrouter:getStatus') as Promise<{ connected: boolean }>,
  })

export const useConnectOpenRouter = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (apiKey: string) =>
      window.api.invoke('openrouter:connect', { apiKey }) as Promise<{ ok: boolean; error?: string }>,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['openrouter'] }),
  })
}

export const useTestOpenRouter = () =>
  useMutation({
    mutationFn: () =>
      window.api.invoke('openrouter:test') as Promise<{ ok: boolean; error?: string }>,
  })

export const useDisconnectOpenRouter = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () =>
      window.api.invoke('openrouter:disconnect') as Promise<{ ok: boolean }>,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['openrouter'] }),
  })
}
