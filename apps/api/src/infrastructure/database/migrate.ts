import { config as dotenv } from 'dotenv';
import { existsSync, readdirSync, readFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { createSqliteConnection } from './connection';

// Cargar .env desde la raÃ­z del monorepo.
function findRepoRoot(start: string): string {
  let dir = start;
  for (let i = 0; i < 5; i++) {
    if (existsSync(resolve(dir, '.env'))) return dir;
    dir = dirname(dir);
  }
  return start;
}
const repoRoot = findRepoRoot(process.cwd());
dotenv({ path: resolve(repoRoot, '.env') });
process.chdir(repoRoot);

async function main(): Promise<void> {
  const dbUrl = process.env.DATABASE_URL ?? './storage/clinic.sqlite';
  const { db, close } = createSqliteConnection(dbUrl);

  console.log(`[migrate] Running migrations on ${dbUrl}â€¦`);
  try {
    const migrationsFolder = resolve('./db/migrations');
    if (!existsSync(migrationsFolder)) {
      throw new Error(`Migrations folder not found: ${migrationsFolder}`);
    }

    // Si hay _journal.json (drizzle-kit) usamos migrator oficial.
    const journalPath = resolve(migrationsFolder, 'meta/_journal.json');
    if (existsSync(journalPath)) {
      const { migrate } = await import('drizzle-orm/better-sqlite3/migrator');
      migrate(db, { migrationsFolder });
    } else {
      // Si no, ejecutamos todos los .sql en orden.
      const files = readdirSync(migrationsFolder)
        .filter((f) => f.endsWith('.sql'))
        .sort();
      if (files.length === 0) {
        throw new Error(`No .sql files in ${migrationsFolder}`);
      }
      console.log(`[migrate] Found ${files.length} SQL files (no drizzle journal)`);
      for (const f of files) {
        const sql = readFileSync(resolve(migrationsFolder, f), 'utf-8');
        // Drizzle separa statements con `--> statement-breakpoint`
        const statements = sql
          .split('--> statement-breakpoint')
          .map((s) => s.trim())
          .filter((s) => s.length > 0);
        console.log(`[migrate] Applying ${f} (${statements.length} statements)â€¦`);
        for (const stmt of statements) {
          try {
            (db as any).raw.exec(stmt);
          } catch (e) {
            const msg = (e as Error).message;
            // Ignorar errores de "ya existe" en re-aplicaciones.
            if (msg.includes('already exists') || msg.includes('duplicate')) {
              continue;
            }
            throw e;
          }
        }
      }
    }
    console.log('[migrate] âœ… Done.');
  } catch (err) {
    console.error('[migrate] âŒ Failed:', err);
    process.exit(1);
  } finally {
    close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
