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

export const useTestGkeAuth = () =>
  useMutation({
    mutationFn: () =>
      window.api.invoke('gke:testAuth') as Promise<{ ok: boolean; error?: string; email?: string }>,
  })

export const useGcpProjects = (enabled: boolean) =>
  useQuery<{ projectId: string; name: string }[]>({
    queryKey: ['gcp', 'projects'],
    queryFn: async () => {
      const result = await window.api.invoke('gcp:projects:list') as { ok: boolean; projects: { projectId: string; name: string }[] }
      return result.ok ? result.projects : []
    },
    enabled,
  })

export const useGcpRegions = (projectId: string | undefined) =>
  useQuery<string[]>({
    queryKey: ['gcp', 'regions', projectId],
    queryFn: async () => {
      if (!projectId) return []
      const result = await window.api.invoke('gcp:regions:list', projectId) as { ok: boolean; regions?: { name: string }[] }
      return result.ok ? (result.regions ?? []).map((r: { name: string }) => r.name).sort() : []
    },
    enabled: !!projectId,
  })

export const useGcpZones = (projectId: string | undefined, region: string | undefined) =>
  useQuery<string[]>({
    queryKey: ['gcp', 'zones', projectId, region],
    queryFn: async () => {
      if (!projectId) return []
      const result = await window.api.invoke('gcp:zones:list', { projectId, region }) as { ok: boolean; zones?: { name: string }[] }
      return result.ok ? (result.zones ?? []).map((z: { name: string }) => z.name).sort() : []
    },
    enabled: !!projectId,
  })
