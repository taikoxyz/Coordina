import { useQuery } from '@tanstack/react-query'

export interface SpecFile {
  path: string
  content: string
}

export function useTeamSpecs(teamSlug: string) {
  return useQuery<SpecFile[]>({
    queryKey: ['specs', 'team', teamSlug],
    queryFn: () => window.api.invoke('specs:getTeamSpecs', teamSlug) as Promise<SpecFile[]>,
    enabled: !!teamSlug,
  })
}

export function useDeploySpecs(teamSlug: string, envId: string | undefined) {
  return useQuery<SpecFile[]>({
    queryKey: ['specs', 'deploy', teamSlug, envId],
    queryFn: () => window.api.invoke('specs:getDeploySpecs', teamSlug, envId) as Promise<SpecFile[]>,
    enabled: !!teamSlug && !!envId,
  })
}

export function useIsDeployDirty(teamSlug: string) {
  return useQuery<boolean>({
    queryKey: ['specs', 'dirty', teamSlug],
    queryFn: () => window.api.invoke('specs:isDeployDirty', teamSlug) as Promise<boolean>,
    enabled: !!teamSlug,
  })
}
