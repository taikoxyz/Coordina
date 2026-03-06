import { ipcMain } from 'electron'
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
    const deployment = await getTeamDeployment(teamSlug)
    if (!deployment) {
      return { files: [], error: 'Files are only available after deployment' }
    }

    try {
      const result = await fetchFromGateway(teamSlug, agentSlug, '/files') as any
      return { files: result.files ?? [] }
    } catch {
      return { files: [], error: 'Failed to fetch file list from agent' }
    }
  })

  ipcMain.handle('files:get', async (_event, teamSlug: string, agentSlug: string, filePath: string) => {
    const deployment = await getTeamDeployment(teamSlug)
    if (!deployment) {
      return { content: null, error: 'Files are only available after deployment' }
    }

    try {
      const result = await fetchFromGateway(teamSlug, agentSlug, `/files/${encodeURIComponent(filePath)}`) as any
      return { content: result.content ?? '' }
    } catch {
      return { content: null, error: 'Failed to fetch file from agent' }
    }
  })
}
