import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { AppSettings } from '../../../shared/types'

export const useSettings = () =>
  useQuery<AppSettings>({
    queryKey: ['settings'],
    queryFn: () => window.api.invoke('settings:get') as Promise<AppSettings>,
  })

export const useSaveSettings = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (settings: AppSettings) =>
      window.api.invoke('settings:save', settings) as Promise<{ ok: boolean }>,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['settings'] }),
  })
}
