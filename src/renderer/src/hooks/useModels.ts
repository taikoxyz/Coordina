import { useQuery } from '@tanstack/react-query'
import type { ModelInfo } from '../../../shared/types'

export type { ModelInfo }

export function useModels(providerType: string) {
  return useQuery<ModelInfo[]>({
    queryKey: ['providers:models', providerType],
    queryFn: () => window.api.invoke('providers:models', providerType) as Promise<ModelInfo[]>,
    enabled: !!providerType && providerType !== 'ollama' && providerType !== 'openai-compatible',
    staleTime: 60 * 60 * 1000,
  })
}
