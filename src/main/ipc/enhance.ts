import { ipcMain } from 'electron'
import { getOpenRouterApiKey } from '../store/providers'
import { createModel } from '../ai/provider'
import { enhanceSkills, enhanceSoul } from '../ai/enhance'

async function getModel() {
  const apiKey = await getOpenRouterApiKey()
  if (!apiKey) throw new Error('OpenRouter not configured. Connect OpenRouter in Settings first.')
  return createModel({}, apiKey)
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
      const model = await getModel()
      return await enhanceSkills({ role, skills, model })
    } catch (e) {
      cleanError(e)
    }
  })

  ipcMain.handle('ai:enhanceSoul', async (_event, role: string, userInput: string) => {
    try {
      const model = await getModel()
      return await enhanceSoul({ role, userInput, model })
    } catch (e) {
      cleanError(e)
    }
  })
}
