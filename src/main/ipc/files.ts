import { ipcMain } from 'electron'
import { getTeam } from '../store/teams'
import { getTeamDeployment } from '../store/deployments'
import {
  generateIdentityMd,
  generateSoulMd,
  generateMemoryMd,
  generateSkillsMd,
  generateAgentsMd,
  generateTeamMd,
} from '../github/spec'
import { DEFAULT_BOOTSTRAP_INSTRUCTIONS } from '../specs/bootstrap'
import type { TeamSpec } from '../../shared/types'

const LOCAL_PORT = 19876

const WORKSPACE_FILES = [
  'IDENTITY.md', 'SOUL.md', 'MEMORY.md', 'SKILLS.md',
  'AGENTS.md', 'TEAM.md', 'BOOTSTRAP.md',
]

function listOfflineFiles(team: TeamSpec | null, agentSlug: string): { files: { path: string; size: null; isDir: false }[] } {
  const agent = team?.agents.find(a => a.slug === agentSlug)
  if (!agent) return { files: [] }
  return {
    files: WORKSPACE_FILES.map(path => ({ path, size: null, isDir: false as const })),
  }
}

function getOfflineFile(team: TeamSpec | null, agentSlug: string, filePath: string): { content: string | null } {
  const agent = team?.agents.find(a => a.slug === agentSlug)
  if (!agent || !team) return { content: null }

  const generators: Record<string, () => string> = {
    'IDENTITY.md': () => generateIdentityMd({
      name: agent.name, role: agent.role, persona: agent.persona,
      emoji: agent.emoji, avatar: agent.avatar, teamName: team.name,
      teamSlug: team.slug, leadAgent: team.leadAgent, teamSize: team.agents.length,
    }),
    'SOUL.md': () => generateSoulMd({ userInput: agent.persona || '' }),
    'MEMORY.md': () => generateMemoryMd(),
    'SKILLS.md': () => generateSkillsMd(agent.skills ?? []),
    'AGENTS.md': () => generateAgentsMd(),
    'TEAM.md': () => generateTeamMd({
      name: team.name, slug: team.slug, leadAgent: team.leadAgent,
      defaultImage: team.defaultImage, defaultDiskGi: team.defaultDiskGi,
      telegramGroupId: team.telegramGroupId, telegramAdminId: team.telegramAdminId,
      agents: team.agents.map(a => ({
        slug: a.slug, name: a.name, role: a.role,
        telegramBot: a.telegramBot, email: a.email, slack: a.slack,
        githubUsername: a.githubUsername, cpu: a.cpu,
      })),
    }),
    'BOOTSTRAP.md': () => team.startupInstructions || DEFAULT_BOOTSTRAP_INSTRUCTIONS,
  }

  const gen = generators[filePath]
  return { content: gen ? gen() : null }
}

async function fetchFromGateway(teamSlug: string, agentSlug: string, endpoint: string): Promise<unknown> {
  const url = `http://localhost:${LOCAL_PORT}/proxy/${teamSlug}/agents/${agentSlug}${endpoint}`
  const response = await fetch(url)
  if (!response.ok) throw new Error(`Gateway returned ${response.status}`)
  return response.json()
}

export function registerFileHandlers() {
  ipcMain.handle('files:list', async (_event, teamSlug: string, agentSlug: string, teamSnapshot?: TeamSpec | null) => {
    const [storedTeam, deployment] = await Promise.all([getTeam(teamSlug), getTeamDeployment(teamSlug)])
    const team = teamSnapshot ?? storedTeam

    if (!deployment) {
      return {
        offline: true,
        ...listOfflineFiles(team, agentSlug),
      }
    }

    try {
      const result = await fetchFromGateway(teamSlug, agentSlug, '/files') as any
      return { files: result.files ?? [], offline: false }
    } catch {
      const offline = listOfflineFiles(team, agentSlug)
      if (offline.files.length > 0) {
        return { ...offline, offline: true, error: 'Agent unavailable — showing seeded files' }
      }
      return { files: [], offline: false, error: 'Failed to fetch file list from agent' }
    }
  })

  ipcMain.handle('files:get', async (_event, teamSlug: string, agentSlug: string, filePath: string, teamSnapshot?: TeamSpec | null) => {
    const [storedTeam, deployment] = await Promise.all([getTeam(teamSlug), getTeamDeployment(teamSlug)])
    const team = teamSnapshot ?? storedTeam

    if (!deployment) {
      const offline = getOfflineFile(team, agentSlug, filePath)
      if (offline.content === null) return { content: null, offline: true, error: 'File not in local spec' }
      return { ...offline, offline: true }
    }

    try {
      const result = await fetchFromGateway(teamSlug, agentSlug, `/files/${encodeURIComponent(filePath)}`) as any
      return { content: result.content ?? '', offline: false }
    } catch {
      const offline = getOfflineFile(team, agentSlug, filePath)
      if (offline.content !== null) {
        return { ...offline, offline: true, error: 'Agent unavailable — showing seeded file' }
      }
      return { content: null, offline: false, error: 'Failed to fetch file from agent' }
    }
  })
}
