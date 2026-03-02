import { ipcMain } from 'electron'
import { getSecret } from '../keychain'
import { enhanceSkills, enhanceSoul } from '../ai/enhance'

export function registerEnhanceHandlers() {
  ipcMain.handle('ai:enhanceSkills', async (_event, role: string, skills: string[]) => {
    const apiKey = await getSecret('app', 'anthropic-key')
    return enhanceSkills({ role, skills, apiKey })
  })

  ipcMain.handle('ai:enhanceSoul', async (_event, role: string, userInput: string) => {
    const apiKey = await getSecret('app', 'anthropic-key')
    return enhanceSoul({ role, userInput, apiKey })
  })
}
