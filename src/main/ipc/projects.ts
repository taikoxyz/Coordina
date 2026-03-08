// IPC handlers for project CRUD operations within teams
// FEATURE: Project management IPC bridge between renderer and main process
import { ipcMain } from 'electron'
import { listProjects, addProject, updateProject, deleteProject } from '../store/projects'
import type { Project } from '../../shared/types'

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

export function registerProjectHandlers() {
  ipcMain.handle('projects:list', async (_event, req: { teamSlug: string }) => {
    return listProjects(req.teamSlug)
  })

  ipcMain.handle('projects:create', async (_event, req: { teamSlug: string; name: string; description?: string; createdBy?: string }) => {
    const project: Project = {
      slug: slugify(req.name),
      name: req.name,
      ...(req.description ? { description: req.description } : {}),
      status: 'active',
      createdAt: Date.now(),
      createdBy: req.createdBy ?? 'unknown',
    }
    await addProject(req.teamSlug, project)
    return { ok: true, project }
  })

  ipcMain.handle('projects:update', async (_event, req: { teamSlug: string; projectSlug: string; patch: Partial<Pick<Project, 'name' | 'description' | 'status'>> }) => {
    await updateProject(req.teamSlug, req.projectSlug, req.patch)
    return { ok: true }
  })

  ipcMain.handle('projects:delete', async (_event, req: { teamSlug: string; projectSlug: string }) => {
    await deleteProject(req.teamSlug, req.projectSlug)
    return { ok: true }
  })
}
