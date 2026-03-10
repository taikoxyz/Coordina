import { ipcMain } from 'electron'
import { getTeamDeployment } from '../store/deployments'
import { getEnvironment } from '../store/environments'
import { execInPod } from '../environments/gke/deploy'
import type { GkeDeployConfig } from '../environments/gke/deploy'

const WORKSPACE_DIR = '/agent-data/openclaw/workspace'

async function getGkeConfig(teamSlug: string): Promise<GkeDeployConfig | null> {
  const deployment = await getTeamDeployment(teamSlug)
  if (!deployment) return null
  const env = await getEnvironment(deployment.envSlug)
  if (!env || env.type !== 'gke') return null
  return {
    slug: deployment.envSlug,
    ...env.config as Omit<GkeDeployConfig, 'slug'>,
    clusterName: teamSlug,
    ...(deployment.clusterZone ? { clusterZone: deployment.clusterZone } : {}),
  }
}

interface FileEntry {
  path: string
  size: number | null
  isDir: boolean
}

const LIST_SCRIPT = [
  'const{readdirSync:r,statSync:s}=require("fs"),{join:j,relative:l}=require("path"),',
  'skip=new Set(["node_modules",".git"]);',
  'function w(d,m,b){if(m<0)return[];const a=[];try{for(const e of r(d,{withFileTypes:true})){',
  'if(skip.has(e.name))continue;const f=j(d,e.name),p=l(b,f);',
  'if(e.isDirectory()){a.push({path:p,size:null,isDir:true});a.push(...w(f,m-1,b))}',
  'else try{a.push({path:p,size:s(f).size,isDir:false})}catch{}}}catch{}return a}',
  `process.stdout.write(JSON.stringify(w(${JSON.stringify(WORKSPACE_DIR)},5,${JSON.stringify(WORKSPACE_DIR)})))`,
].join('')

export function registerFileHandlers() {
  ipcMain.handle('files:list', async (_event, teamSlug: string, agentSlug: string, _envSlug?: string) => {
    const config = await getGkeConfig(teamSlug)
    if (!config) {
      return { files: [], error: 'Files are only available after deployment' }
    }

    try {
      const output = await execInPod(teamSlug, agentSlug, ['node', '-e', LIST_SCRIPT], config)
      const files: FileEntry[] = JSON.parse(output)
      return { files }
    } catch (e) {
      return { files: [], error: `Failed to fetch file list: ${e instanceof Error ? e.message : String(e)}` }
    }
  })

  ipcMain.handle('files:get', async (_event, teamSlug: string, agentSlug: string, filePath: string, _envSlug?: string) => {
    const config = await getGkeConfig(teamSlug)
    if (!config) {
      return { content: null, error: 'Files are only available after deployment' }
    }

    const fullPath = `${WORKSPACE_DIR}/${filePath}`
    try {
      const content = await execInPod(teamSlug, agentSlug, ['cat', '--', fullPath], config)
      return { content }
    } catch (e) {
      return { content: null, error: `Failed to fetch file: ${e instanceof Error ? e.message : String(e)}` }
    }
  })
}
