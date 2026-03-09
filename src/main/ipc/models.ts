import { ipcMain } from 'electron'
import { join } from 'path'
import fs from 'fs'
import { getDataDir } from '../store/dataDir'
import type { ModelInfo } from '../../shared/types'

const OPENROUTER_MODELS_URL = 'https://openrouter.ai/api/v1/models'
const CACHE_TTL_MS = 60 * 60 * 1000

interface CachedModels {
  fetchedAt: number
  data: ModelInfo[]
}

async function fetchOpenRouterModels(): Promise<ModelInfo[]> {
  const cachePath = join(getDataDir(), 'openrouter-models-cache.json')
  try {
    const raw = fs.readFileSync(cachePath, 'utf-8')
    const cached: CachedModels = JSON.parse(raw)
    if (Date.now() - cached.fetchedAt < CACHE_TTL_MS) return cached.data
  } catch { /* no cache or stale */ }

  const res = await fetch(OPENROUTER_MODELS_URL)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const body = await res.json() as { data?: { id: string; name?: string; context_length?: number }[] }
  const models: ModelInfo[] = (body.data ?? [])
    .map((m) => ({
      id: m.id,
      name: m.name ?? m.id,
      contextWindow: m.context_length,
    }))
    .sort((a, b) => a.name.localeCompare(b.name))

  fs.writeFileSync(cachePath, JSON.stringify({ fetchedAt: Date.now(), data: models }))
  return models
}

export function registerModelsHandlers() {
  ipcMain.handle('providers:models', async (_event, providerType: string) => {
    if (providerType !== 'openrouter') return []
    try {
      return await fetchOpenRouterModels()
    } catch {
      return []
    }
  })
}
