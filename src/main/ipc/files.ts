import { ipcMain } from 'electron'
import { getTeam } from '../store/teams'
import { getTeamDeployment } from '../store/deployments'

const LOCAL_PORT = 19876

async function fetchFromGateway(teamSlug: string, agentSlug: string, endpoint: string): Promise<unknown> {
  const url = `http://localhost:${LOCAL_PORT}/proxy/${teamSlug}/agents/${agentSlug}${endpoint}`
  const response = await fetch(url)
  if (!response.ok) throw new Error(`Gateway returned ${response.status}`)
  return response.json()
}

export function registerFileHandlers() {
  ipcMain.handle('files:list', async (_event, teamSlug: string, agentSlug: string) => {
    const [team, deployment] = await Promise.all([getTeam(teamSlug), getTeamDeployment(teamSlug)])

    if (!deployment) {
      // Team not deployed — return files from local spec
      const agent = team?.agents.find(a => a.slug === agentSlug)
      if (!agent) return { files: [], offline: true }
      return {
        offline: true,
        files: [
          { path: 'IDENTITY.md', size: null, isDir: false },
          { path: 'SOUL.md', size: null, isDir: false },
        ],
      }
    }

    try {
      const result = await fetchFromGateway(teamSlug, agentSlug, '/files') as any
      return { files: result.files ?? [], offline: false }
    } catch {
      return { files: [], offline: false, error: 'Failed to fetch file list from agent' }
    }
  })

  ipcMain.handle('files:get', async (_event, teamSlug: string, agentSlug: string, filePath: string) => {
    const [team, deployment] = await Promise.all([getTeam(teamSlug), getTeamDeployment(teamSlug)])

    if (!deployment) {
      // Offline mode — return spec files from local spec
      const agent = team?.agents.find(a => a.slug === agentSlug)
      if (!agent) return { content: null, offline: true }

      if (filePath === 'IDENTITY.md') {
        return { content: `# ${agent.name}\n\n**Role:** ${agent.role}\n`, offline: true }
      }
      if (filePath === 'SOUL.md') {
        return { content: agent.persona || '(no persona description)', offline: true }
      }
      return { content: null, offline: true, error: 'File not in local spec' }
    }

    try {
      const result = await fetchFromGateway(teamSlug, agentSlug, `/files/${encodeURIComponent(filePath)}`) as any
      return { content: result.content ?? '', offline: false }
    } catch {
      return { content: null, offline: false, error: 'Failed to fetch file from agent' }
    }
  })
}
