import { ipcMain, app } from 'electron'
import path from 'path'
import { getSecret } from '../keychain'
import { openDb } from '../db'
import { createModel } from '../ai/provider'
import { enhanceSkills, enhanceSoul } from '../ai/enhance'

function getDb() {
  return openDb(path.join(app.getPath('userData'), 'coordina.db'))
}

async function getBestModel() {
  const anthropicKey = await getSecret('app', 'anthropic-key')
  if (anthropicKey) {
    return createModel('anthropic', {}, anthropicKey)
  }

  const db = getDb()
  const providers = db.prepare('SELECT id, type, config FROM providers').all() as { id: string; type: string; config: string }[]
  for (const p of providers) {
    const config = JSON.parse(p.config) as Record<string, unknown>
    if (p.type === 'ollama') {
      return createModel(p.type, config, null)
    }
    const apiKey = await getSecret(p.id, 'provider-api-key')
    if (apiKey) {
      return createModel(p.type, config, apiKey)
    }
  }

  throw new Error('No AI provider configured. Add a provider in Model Providers or set an Anthropic key in Settings.')
}

function cleanError(e: unknown): never {
  const raw = (e instanceof Error ? e.message : String(e)) || 'Enhancement failed'
  const clean = raw
    .replace(/^Error invoking remote method '[^']+': /, '')
    .replace(/^AI_\w+Error:\s*/, '')
  throw new Error(clean)
}

export function registerEnhanceHandlers() {
  ipcMain.handle('ai:enhanceSkills', async (_event, role: string, skills: string[]) => {
    try {
      const model = await getBestModel()
      return await enhanceSkills({ role, skills, model })
    } catch (e) {
      cleanError(e)
    }
  })

  ipcMain.handle('ai:enhanceSoul', async (_event, role: string, userInput: string) => {
    try {
      const model = await getBestModel()
      return await enhanceSoul({ role, userInput, model })
    } catch (e) {
      cleanError(e)
    }
  })
}
