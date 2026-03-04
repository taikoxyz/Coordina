// File-based store for environment configs reading and writing JSON
// FEATURE: Store layer replacing SQLite for environment record persistence
import fs from 'fs/promises'
import path from 'path'
import os from 'os'
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
