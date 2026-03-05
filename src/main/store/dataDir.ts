import { mkdirSync } from 'fs'
import { join } from 'path'
import { homedir } from 'os'

const DATA_DIR = join(homedir(), '.coordina')

export function getDataDir(): string {
  mkdirSync(DATA_DIR, { recursive: true })
  return DATA_DIR
}
