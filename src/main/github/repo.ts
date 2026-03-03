import { Octokit } from '@octokit/rest'
import { getStoredGitHubToken } from './auth'
import type { SpecFile } from '../../shared/types'

async function getOctokit(): Promise<Octokit> {
  const token = await getStoredGitHubToken()
  if (!token) throw new Error('GitHub not authenticated. Please connect your GitHub account in Settings.')
  return new Octokit({ auth: token })
}

export async function createRepo(_owner: string, name: string): Promise<string> {
  const octokit = await getOctokit()
  const { data } = await octokit.repos.createForAuthenticatedUser({
    name,
    private: true,
    auto_init: true,
    description: `Coordina team repo: ${name}`,
  })
  return data.full_name
}

export async function commitSpecFiles(fullRepoName: string, files: SpecFile[], message: string): Promise<void> {
  const octokit = await getOctokit()
  const [owner, repo] = fullRepoName.split('/')

  // Get current HEAD SHA
  const { data: ref } = await octokit.git.getRef({ owner, repo, ref: 'heads/main' })
  const baseSha = ref.object.sha

  // Get tree SHA
  const { data: baseCommit } = await octokit.git.getCommit({ owner, repo, commit_sha: baseSha })
  const baseTreeSha = baseCommit.tree.sha

  // Create blobs for all files
  const treeItems = await Promise.all(files.map(async file => {
    const { data: blob } = await octokit.git.createBlob({
      owner, repo,
      content: Buffer.from(file.content).toString('base64'),
      encoding: 'base64',
    })
    return { path: file.path, mode: '100644' as const, type: 'blob' as const, sha: blob.sha }
  }))

  // Create new tree
  const { data: newTree } = await octokit.git.createTree({ owner, repo, base_tree: baseTreeSha, tree: treeItems })

  // Create commit
  const { data: newCommit } = await octokit.git.createCommit({
    owner, repo, message,
    tree: newTree.sha,
    parents: [baseSha],
  })

  // Update ref
  await octokit.git.updateRef({ owner, repo, ref: 'heads/main', sha: newCommit.sha })
}

export async function getFileShas(fullRepoName: string, paths: string[]): Promise<Record<string, string>> {
  const octokit = await getOctokit()
  const [owner, repo] = fullRepoName.split('/')
  const shas: Record<string, string> = {}

  await Promise.all(paths.map(async path => {
    try {
      const { data } = await octokit.repos.getContent({ owner, repo, path })
      if (!Array.isArray(data) && data.type === 'file') {
        shas[path] = data.sha
      }
    } catch {
      // file doesn't exist yet
    }
  }))

  return shas
}

export async function isSpecDirty(fullRepoName: string, localFiles: SpecFile[]): Promise<boolean> {
  const octokit = await getOctokit()
  const [owner, repo] = fullRepoName.split('/')

  for (const file of localFiles) {
    try {
      const { data } = await octokit.repos.getContent({ owner, repo, path: file.path })
      if (!Array.isArray(data) && data.type === 'file' && 'content' in data) {
        const remoteContent = Buffer.from(data.content, 'base64').toString('utf-8')
        if (remoteContent !== file.content) return true
      } else {
        return true // file type mismatch or doesn't exist
      }
    } catch {
      return true // file doesn't exist remotely
    }
  }
  return false
}

export async function getAuthenticatedUser(): Promise<string> {
  const octokit = await getOctokit()
  const { data } = await octokit.users.getAuthenticated()
  return data.login
}
