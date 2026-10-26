#!/usr/bin/env tsx
/**
 * bin/migrate.ts
 *
 * CLI para aplicar migraciones a la BD.
 *
 * Uso:
 *   pnpm migrate                  # aplica todas las pendientes
 *   pnpm migrate --reset          # ⚠️ borra la BD y la recrea
 *   pnpm migrate --status         # muestra tablas existentes
 *   pnpm migrate --db=./path.sqlite
 */

import { existsSync, unlinkSync, readdirSync, readFileSync } from 'fs';
import { resolve } from 'path';
import { createSqliteConnection } from '../apps/api/src/infrastructure/database/connection';

function parseArgs(): { reset: boolean; status: boolean; dbPath?: string } {
  const args = process.argv.slice(2);
  return {
    reset: args.includes('--reset'),
    status: args.includes('--status'),
    dbPath: args.find((a) => a.startsWith('--db='))?.split('=')[1],
  };
}

function applyMigrations(absPath: string): void {
  const conn = createSqliteConnection(absPath);
  const { db, raw, close } = conn;
  const migrationsFolder = resolve('db/migrations');

  try {
    if (!existsSync(migrationsFolder)) {
      throw new Error(`Migrations folder not found: ${migrationsFolder}`);
    }

    const journalPath = resolve(migrationsFolder, 'meta/_journal.json');
    if (existsSync(journalPath)) {
      console.log(`[migrate] Using drizzle-kit migrations`);
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { migrate } = require('drizzle-orm/better-sqlite3/migrator');
      migrate(db, { migrationsFolder });
    } else {
      const files = readdirSync(migrationsFolder)
        .filter((f) => f.endsWith('.sql'))
        .sort();
      if (files.length === 0) {
        throw new Error(`No .sql files in ${migrationsFolder}`);
      }
      console.log(`[migrate] Found ${files.length} SQL files (raw mode)`);
      for (const f of files) {
        const sql = readFileSync(resolve(migrationsFolder, f), 'utf-8');
        const statements = sql
          .split('--> statement-breakpoint')
          .map((s) => s.trim())
          .filter((s) => s.length > 0);
        console.log(`[migrate] Applying ${f} (${statements.length} statements)…`);
        for (const stmt of statements) {
          try {
            raw.exec(stmt);
          } catch (e) {
            const msg = (e as Error).message;
            if (msg.includes('already exists') || msg.includes('duplicate')) {
              continue;
            }
            throw e;
          }
        }
      }
    }
  } finally {
    close();
  }
}

function main(): void {
  const opts = parseArgs();
  const dbPath = opts.dbPath ?? process.env.DATABASE_URL ?? './storage/clinic.sqlite';
  const absPath = resolve(dbPath);

  if (opts.reset && existsSync(absPath)) {
    console.log(`[migrate] ⚠️  Reset: deleting ${absPath}`);
    unlinkSync(absPath);
  }

  console.log(`[migrate] Connecting to ${absPath}…`);

  try {
    if (opts.status) {
      const conn = createSqliteConnection(absPath);
      const { raw, close } = conn;
      try {
        const tables = raw
          .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
          .all() as Array<{ name: string }>;
        console.log(`[migrate] Tables in DB:`);
        for (const t of tables) console.log(`  - ${t.name}`);
      } finally {
        close();
      }
      return;
    }

    applyMigrations(absPath);
    console.log(`[migrate] ✅ Done.`);
  } catch (e) {
    console.error(`[migrate] ❌ Failed:`, e);
    process.exit(1);
  }
}

main();
