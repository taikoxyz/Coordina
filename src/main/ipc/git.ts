// IPC handlers for git operations on team spec files via simple-git
// FEATURE: Git versioning IPC layer for team spec change tracking and commits
import { ipcMain } from 'electron'
import { simpleGit } from 'simple-git'
import path from 'path'
import os from 'os'
import { getSettings } from '../store/settings'

const getGit = (repoPath: string) => simpleGit(repoPath)

export function registerGitHandlers(): void {
  ipcMain.handle('git:status', async () => {
    const settings = await getSettings()
    if (!settings.gitEnabled) return { enabled: false }
    const repoPath = settings.gitRepoPath ?? path.join(os.homedir(), '.coordina')
    try {
      const git = getGit(repoPath)
      const status = await git.status()
      return { enabled: true, dirty: !status.isClean(), files: status.files.map(f => f.path) }
    } catch {
      return { enabled: true, dirty: false, files: [] }
    }
  })

  ipcMain.handle('git:diff', async (_e, filePath: string) => {
    const settings = await getSettings()
    if (!settings.gitEnabled) return ''
    const repoPath = settings.gitRepoPath ?? path.join(os.homedir(), '.coordina')
    try {
      return getGit(repoPath).diff([filePath])
    } catch {
      return ''
    }
  })

  ipcMain.handle('git:commit', async (_e, message: string) => {
    const settings = await getSettings()
    if (!settings.gitEnabled) return { ok: false, reason: 'Git not enabled' }
    const repoPath = settings.gitRepoPath ?? path.join(os.homedir(), '.coordina')
    try {
      const git = getGit(repoPath)
      await git.add(['teams/'])
      await git.commit(message)
      return { ok: true }
    } catch (e) {
      return { ok: false, reason: e instanceof Error ? e.message : String(e) }
    }
  })
}
