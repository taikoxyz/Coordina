import { describe, it, expect } from 'vitest'
import { openDb } from './db'

describe('database', () => {
  it('opens and runs migrations', () => {
    const db = openDb(':memory:')
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all()
    const names = (tables as { name: string }[]).map((t) => t.name)
    expect(names).toContain('app_settings')
    expect(names).toContain('providers')
    expect(names).toContain('environments')
    expect(names).toContain('teams')
  })

  it('can store and retrieve a provider', () => {
    const db = openDb(':memory:')
    db.prepare("INSERT INTO providers (id, type, name, config) VALUES (?, ?, ?, ?)").run(
      'p1', 'anthropic', 'My Anthropic', '{}'
    )
    const row = db.prepare("SELECT * FROM providers WHERE id = ?").get('p1') as { name: string }
    expect(row.name).toBe('My Anthropic')
  })
})
