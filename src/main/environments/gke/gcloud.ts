import { execFileSync, spawn } from 'child_process'

export interface GcpProject {
  projectId: string
  name: string
}

export interface GkeCluster {
  name: string
  location: string
  status: string
}

export function isGcloudInstalled(): boolean {
  try {
    execFileSync('gcloud', ['version'], { encoding: 'utf-8', stdio: 'pipe' })
    return true
  } catch {
    return false
  }
}

export function gcloudLogin(): Promise<void> {
  return new Promise((resolve, reject) => {
    // stdin: 'ignore' prevents gcloud from blocking on TTY reads
    // stdout/stderr: 'pipe' captures output without printing to Electron's terminal
    const child = spawn('gcloud', ['auth', 'application-default', 'login'], {
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    let stderr = ''
    child.stderr?.on('data', (d: Buffer) => { stderr += d.toString() })
    child.on('close', code => {
      if (code === 0) resolve()
      else reject(new Error(stderr.trim() || `gcloud auth failed (exit code ${code})`))
    })
    child.on('error', err => reject(new Error(`Failed to run gcloud: ${err.message}`)))
  })
}

export function listGcpProjects(): Promise<GcpProject[]> {
  return new Promise((resolve, reject) => {
    let stdout = ''
    let stderr = ''
    const child = spawn('gcloud', ['projects', 'list', '--format=json'], {
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    child.stdout?.on('data', (d: Buffer) => { stdout += d.toString() })
    child.stderr?.on('data', (d: Buffer) => { stderr += d.toString() })
    child.on('close', code => {
      if (code !== 0) { reject(new Error(stderr.trim() || `gcloud projects list failed (exit code ${code})`)); return }
      try {
        const raw = JSON.parse(stdout) as Array<{ projectId: string; name: string }>
        resolve(raw.map(p => ({ projectId: p.projectId, name: p.name })))
      } catch {
        reject(new Error('Failed to parse project list from gcloud'))
      }
    })
    child.on('error', err => reject(new Error(`Failed to run gcloud: ${err.message}`)))
  })
}

// Accepts a region (e.g. "us-central1") or zone (e.g. "us-central1-c").
// Regions end with a number; zones end with a single letter — append "-c" if it's a region.
export function toZone(location: string): string {
  return /^[a-z]+-[a-z]+[0-9]+-[a-z]$/.test(location) ? location : `${location}-c`
}

export function ensureDisk(projectId: string, zone: string, name: string, sizeGb: number) {
  try {
    execFileSync('gcloud', ['compute', 'disks', 'describe', name, `--zone=${zone}`, `--project=${projectId}`],
      { encoding: 'utf-8', stdio: 'pipe' })
  } catch {
    execFileSync('gcloud', [
      'compute', 'disks', 'create', name,
      `--zone=${zone}`, `--project=${projectId}`,
      `--size=${sizeGb}GB`, '--type=pd-balanced',
    ], { encoding: 'utf-8', stdio: 'pipe' })
  }
}

export function deleteDisk(projectId: string, zone: string, name: string): void {
  try {
    execFileSync('gcloud', [
      'compute', 'disks', 'delete', name,
      `--zone=${zone}`, `--project=${projectId}`, '--quiet',
    ], { encoding: 'utf-8', stdio: 'pipe' })
  } catch (e: unknown) {
    if (String(e).includes('was not found')) return
    throw e
  }
}

export function labelDisk(projectId: string, zone: string, name: string, labels: Record<string, string>): void {
  const labelStr = Object.entries(labels).map(([k, v]) => `${k}=${v}`).join(',')
  try {
    execFileSync('gcloud', [
      'compute', 'disks', 'add-labels', name,
      `--zone=${zone}`, `--project=${projectId}`,
      `--labels=${labelStr}`,
    ], { encoding: 'utf-8', stdio: 'pipe' })
  } catch (e: unknown) {
    if (String(e).includes('was not found')) return
    throw e
  }
}

export interface GcpDisk {
  name: string
  zone: string
}

export function listDisksByLabels(projectId: string, labels: Record<string, string>): GcpDisk[] {
  const filter = Object.entries(labels).map(([k, v]) => `labels.${k}=${v}`).join(' AND ')
  try {
    const stdout = execFileSync('gcloud', [
      'compute', 'disks', 'list',
      `--project=${projectId}`,
      `--filter=${filter}`,
      '--format=json(name,zone)',
    ], { encoding: 'utf-8', stdio: 'pipe' })
    const raw = JSON.parse(stdout) as Array<{ name: string; zone: string }>
    return raw.map(d => ({ name: d.name, zone: d.zone.split('/').pop()! }))
  } catch {
    return []
  }
}

export function listGkeClusters(projectId: string): Promise<GkeCluster[]> {
  return new Promise((resolve, reject) => {
    let stdout = ''
    let stderr = ''
    const child = spawn('gcloud', ['container', 'clusters', 'list', `--project=${projectId}`, '--format=json'], {
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    child.stdout?.on('data', (d: Buffer) => { stdout += d.toString() })
    child.stderr?.on('data', (d: Buffer) => { stderr += d.toString() })
    child.on('close', code => {
      if (code !== 0) { reject(new Error(stderr.trim() || `gcloud clusters list failed (exit code ${code})`)); return }
      try {
        const raw = JSON.parse(stdout) as Array<{ name: string; location: string; status: string }>
        resolve(raw.map(c => ({ name: c.name, location: c.location, status: c.status })))
      } catch {
        reject(new Error('Failed to parse cluster list from gcloud'))
      }
    })
    child.on('error', err => reject(new Error(`Failed to run gcloud: ${err.message}`)))
  })
}
