import Database from 'better-sqlite3'

export function openDb(path: string): Database.Database {
  const db = new Database(path)
  db.exec(`
    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS providers (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      name TEXT NOT NULL,
      config TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS environments (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      name TEXT NOT NULL,
      config TEXT NOT NULL,
      used INTEGER DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS teams (
      slug TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      github_repo TEXT,
      lead_agent_slug TEXT,
      config TEXT NOT NULL,
      gateway_url TEXT,
      deployed_env_id TEXT
    );
    CREATE TABLE IF NOT EXISTS agents (
      slug TEXT NOT NULL,
      team_slug TEXT NOT NULL REFERENCES teams(slug) ON DELETE CASCADE,
      name TEXT NOT NULL,
      role TEXT NOT NULL,
      email TEXT,
      slack_handle TEXT,
      github_id TEXT,
      skills TEXT NOT NULL DEFAULT '[]',
      soul TEXT NOT NULL DEFAULT '',
      provider_id TEXT,
      model TEXT,
      is_lead INTEGER DEFAULT 0,
      PRIMARY KEY (slug, team_slug)
    );
  `)
  try { db.exec('ALTER TABLE teams ADD COLUMN domain TEXT') } catch { /* column already exists */ }
  try { db.exec('ALTER TABLE teams ADD COLUMN image TEXT') } catch { /* column already exists */ }
  try { db.exec('ALTER TABLE agents ADD COLUMN image TEXT') } catch { /* column already exists */ }
  try { db.exec('ALTER TABLE teams ADD COLUMN deployed_spec_hash TEXT') } catch { /* column already exists */ }
  return db
}
