import Database from 'better-sqlite3'

export function openDb(path: string) {
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
      config TEXT NOT NULL
    );
  `)
  return db
}
