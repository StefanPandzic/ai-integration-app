/**
 * Migration Runner
 *
 * Applies db/migrations/*.sql in filename order, each in its own
 * transaction, and records them in schema_migrations.
 * Usage: npm run db:migrate
 */

import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { Client } from 'pg';
import { closePool, query, withTransaction } from './index';

dotenv.config();

const MIGRATIONS_DIR = path.resolve(__dirname, '../../db/migrations');

// Local dev convenience: create the target database if it doesn't exist yet
const ensureLocalDatabase = async (): Promise<void> => {
  const url = new URL(process.env.DATABASE_URL ?? '');
  if (!['localhost', '127.0.0.1'].includes(url.hostname)) return;

  const database = decodeURIComponent(url.pathname.slice(1));
  url.pathname = '/postgres';
  const client = new Client({ connectionString: url.toString() });
  await client.connect();
  try {
    const existing = await client.query(
      'select 1 from pg_database where datname = $1',
      [database],
    );
    if (existing.rowCount === 0) {
      await client.query(`create database "${database.replace(/"/g, '""')}"`);
      console.log(`✅ Created database ${database}`);
    }
  } finally {
    await client.end();
  }
};

const migrate = async (): Promise<void> => {
  await ensureLocalDatabase();

  await query(`
    create table if not exists schema_migrations (
      name        text primary key,
      applied_at  timestamptz not null default now()
    )
  `);

  const applied = new Set(
    (await query<{ name: string }>('select name from schema_migrations')).map(
      (row) => row.name,
    ),
  );

  const pending = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((file) => file.endsWith('.sql') && !applied.has(file))
    .sort();

  if (pending.length === 0) {
    console.log('✅ Database is up to date');
    return;
  }

  for (const file of pending) {
    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
    await withTransaction(async (client) => {
      await client.query(sql);
      await client.query('insert into schema_migrations (name) values ($1)', [
        file,
      ]);
    });
    console.log(`✅ Applied ${file}`);
  }
};

migrate()
  .catch((error) => {
    console.error('❌ Migration failed:', error);
    process.exitCode = 1;
  })
  .finally(closePool);
