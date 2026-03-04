// File-based store for environment configs reading and writing JSON
// FEATURE: Store layer replacing SQLite for environment record persistence
import fs from 'fs/promises'
import path from 'path'
import os from 'os'
import { OAuth2Client } from 'google-auth-library'
import { EnvironmentRecord } from '../../shared/types'
import { getSecret, setSecret, deleteSecret } from '../keychain'

const envsDir = (): string => path.join(os.homedir(), '.coordina', 'environments')

const envPath = (slug: string): string => path.join(envsDir(), `${slug}.json`)

const ensureDir = (): Promise<void> => fs.mkdir(envsDir(), { recursive: true }).then(() => undefined)

export const listEnvironments = async (): Promise<EnvironmentRecord[]> => {
  await ensureDir()
  const entries = await fs.readdir(envsDir()).catch(() => [] as string[])
  const records = await Promise.all(
    entries
      .filter((f) => f.endsWith('.json'))
      .map((f) => fs.readFile(path.join(envsDir(), f), 'utf-8').then(JSON.parse).catch(() => null))
  )
  return records.filter(Boolean) as EnvironmentRecord[]
}

export const getEnvironment = async (slug: string): Promise<EnvironmentRecord | null> => {
  const content = await fs.readFile(envPath(slug), 'utf-8').catch(() => null)
  return content ? JSON.parse(content) : null
}

export const saveEnvironment = async (record: EnvironmentRecord): Promise<void> => {
  await ensureDir()
  await fs.writeFile(envPath(record.slug), JSON.stringify(record, null, 2), 'utf-8')
}

export const deleteEnvironment = async (slug: string): Promise<void> => {
  await fs.unlink(envPath(slug)).catch(() => undefined)
  await deleteSecret(slug, 'environments')
}

export const getEnvToken = (slug: string): Promise<string | null> =>
  getSecret(slug, 'environments')

export const setEnvToken = (slug: string, token: string): Promise<void> =>
  setSecret(slug, 'environments', token)

export const getEnvAuthToken = async (slug: string): Promise<string | null> => {
  const raw = await getEnvToken(slug)
  if (!raw) return null

  const readParsed = (): { id_token?: unknown; access_token?: unknown; refresh_token?: unknown; expiry_date?: unknown } | null => {
    try {
      return JSON.parse(raw) as { id_token?: unknown; access_token?: unknown; refresh_token?: unknown; expiry_date?: unknown }
    } catch {
      return null
    }
  }

  const parsed = readParsed()
  if (!parsed) {
    // Backward compatibility: token may already be stored as a plain bearer token string.
    return raw
  }

  if (typeof parsed.id_token === 'string' && parsed.id_token.length > 0) {
    return parsed.id_token
  }

  const env = await getEnvironment(slug)
  const clientId = (env?.config as { clientId?: unknown } | undefined)?.clientId
  const clientSecret = (env?.config as { clientSecret?: unknown } | undefined)?.clientSecret
  const refreshToken = parsed.refresh_token
  const needsRefresh = typeof parsed.access_token !== 'string' || parsed.access_token.length === 0

  if (
    typeof clientId === 'string' &&
    typeof clientSecret === 'string' &&
    typeof refreshToken === 'string' &&
    (needsRefresh || typeof parsed.id_token !== 'string')
  ) {
    try {
      const client = new OAuth2Client(clientId, clientSecret)
      client.setCredentials({
        refresh_token: refreshToken,
        access_token: typeof parsed.access_token === 'string' ? parsed.access_token : undefined,
        id_token: typeof parsed.id_token === 'string' ? parsed.id_token : undefined,
        expiry_date: typeof parsed.expiry_date === 'number' ? parsed.expiry_date : undefined,
      })
      const refreshed = await client.refreshAccessToken()
      const creds = {
        ...parsed,
        ...refreshed.credentials,
        refresh_token: refreshToken,
      }
      await setEnvToken(slug, JSON.stringify(creds))

      if (typeof creds.id_token === 'string' && creds.id_token.length > 0) return creds.id_token
      if (typeof creds.access_token === 'string' && creds.access_token.length > 0) return creds.access_token
    } catch {
      // Fall through to existing token fields.
    }
  }

  if (typeof parsed.access_token === 'string' && parsed.access_token.length > 0) {
    return parsed.access_token
  }

  return raw
}
