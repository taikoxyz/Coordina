import { ipcMain } from 'electron'
import { app } from 'electron'
import path from 'path'
import { openDb } from '../db'

function getDb() {
  return openDb(path.join(app.getPath('userData'), 'coordina.db'))
}

const LOCAL_PORT = 19876

async function fetchFromGateway(teamSlug: string, agentSlug: string, endpoint: string): Promise<unknown> {
  const url = `http://localhost:${LOCAL_PORT}/proxy/${teamSlug}/${agentSlug}${endpoint}`
  const response = await fetch(url)
  if (!response.ok) throw new Error(`Gateway returned ${response.status}`)
  return response.json()
}

export function registerFileHandlers() {
  ipcMain.handle('files:list', async (_event, teamSlug: string, agentSlug: string) => {
    const db = getDb()
    const team = db.prepare('SELECT gateway_url FROM teams WHERE slug = ?').get(teamSlug) as any

    if (!team?.gateway_url) {
      // Team not deployed — return files from DB (spec files only)
      const agent = db.prepare('SELECT * FROM agents WHERE slug = ? AND team_slug = ?').get(agentSlug, teamSlug) as any
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
    const db = getDb()
    const team = db.prepare('SELECT gateway_url FROM teams WHERE slug = ?').get(teamSlug) as any

    if (!team?.gateway_url) {
      // Offline mode — return spec files from DB
      const agent = db.prepare('SELECT * FROM agents WHERE slug = ? AND team_slug = ?').get(agentSlug, teamSlug) as any
      if (!agent) return { content: null, offline: true }

      if (filePath === 'IDENTITY.md') {
        return { content: `# ${agent.name}\n\n**Role:** ${agent.role}\n`, offline: true }
      }
      if (filePath === 'SOUL.md') {
        return { content: agent.soul || '(no soul description)', offline: true }
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
