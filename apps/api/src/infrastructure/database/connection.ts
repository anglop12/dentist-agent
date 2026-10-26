import Database from 'better-sqlite3';
import { drizzle, BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { dirname, isAbsolute, resolve } from 'path';
import { existsSync, mkdirSync } from 'fs';
import * as schema from './schema';

export type DB = BetterSQLite3Database<typeof schema>;

export interface DatabaseConnection {
  db: DB;
  raw: Database.Database;
  close: () => void;
}

export function createSqliteConnection(databaseUrl: string): DatabaseConnection {
  // Resolver respecto al cwd del proceso (raíz del repo), no al del archivo TS.
  const baseDir = process.cwd();
  const absPath = isAbsolute(databaseUrl)
    ? databaseUrl
    : resolve(baseDir, databaseUrl);
  const dir = dirname(absPath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  const sqlite = new Database(absPath);
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('synchronous = NORMAL');
  sqlite.pragma('foreign_keys = ON');
  sqlite.pragma('busy_timeout = 5000');

  const db = drizzle(sqlite, { schema });

  return {
    db,
    raw: sqlite,
    close: () => sqlite.close(),
  };
}
