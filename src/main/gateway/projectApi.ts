// Express router for project CRUD API endpoints scoped to teams
// FEATURE: REST API layer for project management via gateway
import { Router } from 'express'
import { listProjects, addProject, updateProject } from '../store/projects'
import type { Project } from '../../shared/types'

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

export function createProjectRouter() {
  const router = Router()

  router.get('/api/teams/:teamSlug/projects', async (req, res) => {
    const projects = await listProjects(req.params.teamSlug)
    res.json(projects.filter((p) => p.status === 'active'))
  })

  router.post('/api/teams/:teamSlug/projects', async (req, res) => {
    const { name, description, createdBy } = req.body as { name?: string; description?: string; createdBy?: string }
    if (!name || typeof name !== 'string') {
      res.status(400).json({ error: 'name is required' })
      return
    }
    const project: Project = {
      slug: slugify(name),
      name,
      ...(description ? { description } : {}),
      status: 'active',
      createdAt: Date.now(),
      createdBy: createdBy ?? 'unknown',
    }
    await addProject(req.params.teamSlug, project)
    res.status(201).json({ ok: true, project })
  })

  router.patch('/api/teams/:teamSlug/projects/:projectSlug', async (req, res) => {
    const { name, description, status } = req.body as { name?: string; description?: string; status?: string }
    const patch: Partial<Pick<Project, 'name' | 'description' | 'status'>> = {}
    if (name !== undefined) patch.name = name
    if (description !== undefined) patch.description = description
    if (status !== undefined) patch.status = status as Project['status']
    await updateProject(req.params.teamSlug, req.params.projectSlug, patch)
    res.json({ ok: true })
  })

  return router
}
