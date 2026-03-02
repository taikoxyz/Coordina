import { setSecret, getSecret, deleteSecret } from '../../keychain'

export interface GkeCredentials {
  type: 'oauth' | 'service-account'
  projectId: string
  clusterName: string
  clusterZone: string
}

export async function storeGkeCredentials(envId: string, creds: GkeCredentials): Promise<void> {
  await setSecret(envId, 'gke-credentials', JSON.stringify(creds))
}

export async function getGkeCredentials(envId: string): Promise<GkeCredentials | null> {
  const raw = await getSecret(envId, 'gke-credentials')
  if (!raw) return null
  return JSON.parse(raw) as GkeCredentials
}

export async function storeGkeAccessToken(envId: string, token: string): Promise<void> {
  await setSecret(envId, 'gke-access-token', token)
}

export async function getGkeAccessToken(envId: string): Promise<string | null> {
  return getSecret(envId, 'gke-access-token')
}

export async function storeServiceAccountKey(envId: string, keyJson: string): Promise<void> {
  await setSecret(envId, 'gke-sa-key', keyJson)
}

export async function getServiceAccountKey(envId: string): Promise<string | null> {
  return getSecret(envId, 'gke-sa-key')
}

export async function deleteGkeSecrets(envId: string): Promise<void> {
  await deleteSecret(envId, 'gke-credentials')
  await deleteSecret(envId, 'gke-access-token')
  await deleteSecret(envId, 'gke-sa-key')
}
