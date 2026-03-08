// React Query hooks for project CRUD using the file-based IPC layer
// FEATURE: Project management hooks consuming projects:list/update IPC channels
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { Project } from '../../../shared/types'

export type { Project }

export const useProjects = (teamSlug: string) =>
  useQuery<Project[]>({
    queryKey: ['projects', teamSlug],
    queryFn: () => window.api.invoke('projects:list', { teamSlug }) as Promise<Project[]>,
    enabled: !!teamSlug,
  })

export const useUpdateProject = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (args: { teamSlug: string; project: Project }) =>
      window.api.invoke('projects:update', args) as Promise<{ ok: boolean }>,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['projects'] })
    },
  })
}
