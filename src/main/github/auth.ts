import { setSecret, getSecret, deleteSecret } from '../keychain'
import { spawn } from 'child_process'

function runGh(args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn('gh', args, { stdio: ['ignore', 'pipe', 'pipe'] })
    let stdout = ''
    let stderr = ''
    child.stdout?.on('data', (d: Buffer) => { stdout += d.toString() })
    child.stderr?.on('data', (d: Buffer) => { stderr += d.toString() })
    child.on('close', code => {
      if (code === 0) resolve(stdout.trim())
      else reject(new Error(stderr.trim() || `gh exited with code ${code}`))
    })
    child.on('error', () => reject(new Error('not-found')))
  })
}

export function isGhInstalled(): Promise<boolean> {
  return runGh(['--version']).then(() => true).catch(() => false)
}

export async function importGhToken(): Promise<string> {
  const token = await runGh(['auth', 'token', '-h', 'github.com'])
  if (!token) throw new Error('No GitHub token found. Run `gh auth login` in your terminal first.')
  await setSecret('app', 'github-token', token)
  return token
}

export async function storeGitHubToken(token: string): Promise<void> {
  await setSecret('app', 'github-token', token)
}

export async function getStoredGitHubToken(): Promise<string | null> {
  return getSecret('app', 'github-token')
}

export async function deleteGitHubToken(): Promise<void> {
  await deleteSecret('app', 'github-token')
}
