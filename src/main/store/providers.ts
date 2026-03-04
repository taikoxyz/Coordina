// File-based store for provider configs reading and writing JSON
// FEATURE: Store layer replacing SQLite for provider record persistence
import fs from 'fs/promises'
import path from 'path'
import os from 'os'
import { ProviderRecord } from '../../shared/types'
import { getSecret, setSecret, deleteSecret } from '../keychain'

const providersDir = (): string => path.join(os.homedir(), '.coordina', 'providers')

const providerPath = (slug: string): string => path.join(providersDir(), `${slug}.json`)

const ensureDir = (): Promise<void> => fs.mkdir(providersDir(), { recursive: true }).then(() => undefined)

export const listProviders = async (): Promise<ProviderRecord[]> => {
  await ensureDir()
  const entries = await fs.readdir(providersDir()).catch(() => [] as string[])
  const records = await Promise.all(
    entries
      .filter((f) => f.endsWith('.json'))
      .map((f) => fs.readFile(path.join(providersDir(), f), 'utf-8').then(JSON.parse).catch(() => null))
  )
  return records.filter(Boolean) as ProviderRecord[]
}

export const getProvider = async (slug: string): Promise<ProviderRecord | null> => {
  const content = await fs.readFile(providerPath(slug), 'utf-8').catch(() => null)
  return content ? JSON.parse(content) : null
}

export const saveProvider = async (record: ProviderRecord): Promise<void> => {
  await ensureDir()
  await fs.writeFile(providerPath(record.slug), JSON.stringify(record, null, 2), 'utf-8')
}

export const deleteProvider = async (slug: string): Promise<void> => {
  await fs.unlink(providerPath(slug)).catch(() => undefined)
  await deleteSecret(slug, 'providers')
}

export const getProviderApiKey = (slug: string): Promise<string | null> =>
  getSecret(slug, 'providers')

export const setProviderApiKey = (slug: string, apiKey: string): Promise<void> =>
  setSecret(slug, 'providers', apiKey)
