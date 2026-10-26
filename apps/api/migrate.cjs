/**
 * docker/migrate.cjs
 * Aplica los .sql de db/migrations a SQLite (idempotente).
 * Se ejecuta antes de arrancar la API dentro del contenedor.
 */
const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const DB_PATH = process.env.DATABASE_URL
  ? path.resolve(process.env.DATABASE_URL)
  : path.resolve(__dirname, '..', '..', 'storage', 'clinic.sqlite');
const MIGRATIONS_DIR = path.resolve(__dirname, '..', '..', 'db', 'migrations');

function main() {
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.pragma('busy_timeout = 5000');

  // Tabla de control para no reaplicar migraciones ya aplicadas con Ã©xito.
  db.exec(
    'CREATE TABLE IF NOT EXISTS _migrations (name TEXT PRIMARY KEY, applied_at INTEGER NOT NULL)'
  );
  const applied = new Set(
    db.prepare('SELECT name FROM _migrations').all().map((r) => r.name)
  );

  const files = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  if (files.length === 0) {
    console.log('[docker-migrate] No .sql files found in', MIGRATIONS_DIR);
  }

  for (const file of files) {
    if (applied.has(file)) {
      console.log(`[docker-migrate] skip (already applied): ${file}`);
      continue;
    }
    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
    const statements = sql
      .split('--> statement-breakpoint')
      .map((s) => s.trim())
      .filter(Boolean);

    console.log(`[docker-migrate] applying ${file} (${statements.length} statements)`);

    const run = db.transaction(() => {
      for (const stmt of statements) {
        try {
          db.exec(stmt);
        } catch (err) {
          const msg = String(err && err.message);
          if (/already exists/i.test(msg)) {
            console.log(`  Â· skip existing object: ${msg.slice(0, 80)}`);
          } else {
            throw err;
          }
        }
      }
      db.prepare('INSERT INTO _migrations (name, applied_at) VALUES (?, ?)').run(
        file,
        Date.now()
      );
    });

    try {
      run();
      console.log(`[docker-migrate] OK: ${file}`);
    } catch (err) {
      // Si falla algo distinto a "already exists" pero las tablas ya existen
      // (p.ej. BD creada previamente sin tabla _migrations), lo tratamos como aplicada.
      const msg = String(err && err.message);
      console.error(`[docker-migrate] warn on ${file}: ${msg.slice(0, 160)}`);
      db.prepare('INSERT OR IGNORE INTO _migrations (name, applied_at) VALUES (?, ?)').run(
        file,
        Date.now()
      );
    }
  }

  const count = db.prepare('SELECT COUNT(*) AS n FROM sqlite_master').get().n;
  console.log(`[docker-migrate] done. DB ready at ${DB_PATH} (${count} objects)`);
  db.close();
}

main();
