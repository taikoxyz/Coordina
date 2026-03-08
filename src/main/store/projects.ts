// File-based store for project specs with per-team JSON persistence
// FEATURE: Store layer for dynamic project management within teams
import fs from 'fs/promises'
import path from 'path'
import { getDataDir } from './dataDir'
import type { Project } from '../../shared/types'

const projectsDir = (): string => path.join(getDataDir(), 'projects')

const projectsPath = (teamSlug: string): string => path.join(projectsDir(), `${teamSlug}.json`)

const ensureDir = (): Promise<void> => fs.mkdir(projectsDir(), { recursive: true }).then(() => undefined)

const readProjects = async (teamSlug: string): Promise<Project[]> => {
  const content = await fs.readFile(projectsPath(teamSlug), 'utf-8').catch(() => null)
  if (!content) return []
  try {
    const parsed = JSON.parse(content) as { projects?: unknown }
    return Array.isArray(parsed.projects) ? (parsed.projects as Project[]) : []
  } catch {
    return []
  }
}

const writeProjects = async (teamSlug: string, projects: Project[]): Promise<void> => {
  await ensureDir()
  await fs.writeFile(projectsPath(teamSlug), JSON.stringify({ projects }, null, 2), 'utf-8')
}

export const listProjects = async (teamSlug: string): Promise<Project[]> => readProjects(teamSlug)

export const getProject = async (teamSlug: string, projectSlug: string): Promise<Project | null> => {
  const projects = await readProjects(teamSlug)
  return projects.find((p) => p.slug === projectSlug) ?? null
}

export const addProject = async (teamSlug: string, project: Project): Promise<void> => {
  const projects = await readProjects(teamSlug)
  projects.push(project)
  await writeProjects(teamSlug, projects)
}

export const updateProject = async (
  teamSlug: string,
  projectSlug: string,
  patch: Partial<Pick<Project, 'name' | 'description' | 'status'>>
): Promise<void> => {
  const projects = await readProjects(teamSlug)
  const idx = projects.findIndex((p) => p.slug === projectSlug)
  if (idx === -1) return
  projects[idx] = { ...projects[idx], ...patch }
  await writeProjects(teamSlug, projects)
}

export const deleteProject = async (teamSlug: string, projectSlug: string): Promise<void> => {
  const projects = await readProjects(teamSlug)
  const filtered = projects.filter((p) => p.slug !== projectSlug)
  await writeProjects(teamSlug, filtered)
}
