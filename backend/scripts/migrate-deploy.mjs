/**
 * Lock-free migration deployment.
 *
 * Replaces `prisma migrate deploy` to avoid the Postgres advisory lock
 * (pg_advisory_lock) that causes timeout issues on Neon serverless.
 *
 * Reads migration SQL files from prisma/migrations/, checks the
 * _prisma_migrations table, and applies any pending migrations directly
 * via the DIRECT_URL connection — no advisory lock, no CLI overhead.
 */
import pg from 'pg';
import { config } from 'dotenv';
import { readFileSync, readdirSync, statSync } from 'fs';
import { createHash, randomUUID } from 'crypto';
import { resolve, join, dirname } from 'path';
import { fileURLToPath } from 'url';

config();

const __dirname = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = resolve(__dirname, '../prisma/migrations');

const url = process.env.DIRECT_URL || process.env.DATABASE_URL;
if (!url) {
  console.error('migrate-deploy: neither DIRECT_URL nor DATABASE_URL is set');
  process.exit(1);
}

function getMigrationDirs() {
  return readdirSync(MIGRATIONS_DIR)
    .filter(name => statSync(join(MIGRATIONS_DIR, name)).isDirectory())
    .sort();
}

const client = new pg.Client({ connectionString: url });

try {
  await client.connect();

  await client.query(`
    CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
      "id"                  VARCHAR(36)  PRIMARY KEY,
      "checksum"            VARCHAR(64)  NOT NULL,
      "finished_at"         TIMESTAMPTZ,
      "migration_name"      VARCHAR(255) NOT NULL UNIQUE,
      "logs"                TEXT,
      "rolled_back_at"      TIMESTAMPTZ,
      "started_at"          TIMESTAMPTZ  NOT NULL DEFAULT now(),
      "applied_steps_count" INTEGER      NOT NULL DEFAULT 0
    )
  `);

  const { rows: applied } = await client.query(
    `SELECT migration_name FROM "_prisma_migrations" WHERE finished_at IS NOT NULL`,
  );
  const appliedSet = new Set(applied.map(r => r.migration_name));

  const pending = getMigrationDirs().filter(name => !appliedSet.has(name));

  if (pending.length === 0) {
    console.log('migrate-deploy: all migrations already applied ✓');
  } else {
    console.log(`migrate-deploy: applying ${pending.length} pending migration(s)…`);
    for (const name of pending) {
      const sql = readFileSync(join(MIGRATIONS_DIR, name, 'migration.sql'), 'utf8');
      const checksum = createHash('sha256').update(sql).digest('hex');
      const id = randomUUID();

      // PROD-3: apply the migration DDL *and* its bookkeeping row inside ONE
      // transaction. Previously the SQL ran as a bare client.query(sql) with no
      // BEGIN/COMMIT, so a multi-statement migration that failed midway left
      // partially-applied DDL (marked rolled_back, but the executed statements
      // persisted) — the exact drift the runtime repairSchema() hack exists to
      // patch. Wrapping it means a failure leaves the DB unchanged.
      try {
        await client.query('BEGIN');
        await client.query(
          `INSERT INTO "_prisma_migrations" (id, checksum, migration_name, started_at, applied_steps_count)
           VALUES ($1, $2, $3, now(), 0)`,
          [id, checksum, name],
        );
        await client.query(sql);
        await client.query(
          `UPDATE "_prisma_migrations" SET finished_at = now(), applied_steps_count = 1 WHERE id = $1`,
          [id],
        );
        await client.query('COMMIT');
        console.log(`migrate-deploy: ✓ ${name}`);
      } catch (err) {
        await client.query('ROLLBACK');
        // Record the failed attempt OUTSIDE the rolled-back tx so the log
        // survives (the in-tx insert above was rolled back). Best-effort.
        try {
          await client.query(
            `INSERT INTO "_prisma_migrations" (id, checksum, migration_name, started_at, logs, rolled_back_at)
             VALUES ($1, $2, $3, now(), $4, now())`,
            [randomUUID(), checksum, name, String(err.message ?? err)],
          );
        } catch {
          // ignore — the throw below is what matters
        }
        throw err;
      }
    }
    console.log('migrate-deploy: done ✓');
  }
} catch (err) {
  console.error('migrate-deploy: FAILED —', err.message);
  process.exit(1);
} finally {
  await client.end();
}
