import { ipcMain } from 'electron'
import { isGcloudInstalled, gcloudLogin, listGcpProjects, listGkeClusters } from '../environments/gke/gcloud'

export function registerGcpHandlers() {
  ipcMain.handle('gcp:isInstalled', () => {
    return { installed: isGcloudInstalled() }
  })

  ipcMain.handle('gcp:login', async () => {
    try {
      await gcloudLogin()
      return { ok: true }
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : 'Login failed' }
    }
  })

  ipcMain.handle('gcp:projects:list', async () => {
    try {
      const projects = await listGcpProjects()
      return { ok: true, projects }
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : 'Failed to list projects' }
    }
  })

  ipcMain.handle('gcp:clusters:list', async (_event, projectId: string) => {
    try {
      const clusters = await listGkeClusters(projectId)
      return { ok: true, clusters }
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : 'Failed to list clusters' }
    }
  })
}
