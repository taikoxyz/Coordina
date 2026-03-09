import { getSecret, setSecret, deleteSecret } from '../keychain'

export const getOpenRouterApiKey = (): Promise<string | null> =>
  getSecret('openrouter', 'providers')

export const setOpenRouterApiKey = (apiKey: string): Promise<void> =>
  setSecret('openrouter', 'providers', apiKey)

export const deleteOpenRouterApiKey = async (): Promise<void> => {
  await deleteSecret('openrouter', 'providers')
}
