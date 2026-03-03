import { ipcMain } from 'electron'
import { join } from 'path'
import fs from 'fs'
import { getDataDir } from '../db'

const MODELS_URL = 'https://models.dev/api.json'
const CACHE_TTL_MS = 60 * 60 * 1000

const PROVIDER_PREFIXES: Record<string, string> = {
  anthropic: 'anthropic/',
  openai: 'openai/',
  deepseek: 'deepseek/',
  openrouter: 'openrouter/',
  groq: 'groq/',
  mistral: 'mistral/',
  xai: 'xai/',
  google: 'google/',
  together: 'together/',
  'openai-compatible': '',
}

interface CachedModels {
  fetchedAt: number
  data: Record<string, unknown>
}

async function fetchModelsWithCache(): Promise<Record<string, unknown>> {
  const cachePath = join(getDataDir(), 'models-cache.json')
  try {
    const raw = fs.readFileSync(cachePath, 'utf-8')
    const cached: CachedModels = JSON.parse(raw)
    if (Date.now() - cached.fetchedAt < CACHE_TTL_MS) return cached.data
  } catch { /* no cache or stale */ }

  const res = await fetch(MODELS_URL)
  const data = await res.json() as Record<string, unknown>
  fs.writeFileSync(cachePath, JSON.stringify({ fetchedAt: Date.now(), data }))
  return data
}

export function registerModelsHandlers() {
  ipcMain.handle('providers:models', async (_event, providerType: string) => {
    const prefix = PROVIDER_PREFIXES[providerType]
    if (prefix === undefined || prefix === '') return []

    try {
      const all = await fetchModelsWithCache()
      return Object.entries(all)
        .filter(([key]) => key.startsWith(prefix))
        .map(([key, val]) => {
          const entry = val as Record<string, unknown>
          const limit = entry.limit as Record<string, number> | undefined
          return {
            id: key.slice(prefix.length),
            name: (entry.name as string) ?? key.slice(prefix.length),
            contextWindow: limit?.context,
          }
        })
        .sort((a, b) => a.name.localeCompare(b.name))
    } catch {
      return []
    }
  })
}
