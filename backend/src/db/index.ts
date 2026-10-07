/**
 * Postgres Client (Supabase)
 *
 * Direct `pg` access rather than supabase-js: the job queue relies on
 * `FOR UPDATE SKIP LOCKED` and transactions.
 *
 * DATABASE_URL: Supabase connection string (Session pooler, port 5432).
 * Leave `sslmode` out of the URL; SSL is configured here.
 */

import fs from 'fs';
import { Pool, PoolClient, QueryResultRow } from 'pg';

let pool: Pool | null = null;

const buildSslConfig = (connectionString: string) => {
  const { hostname } = new URL(connectionString);
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return false;
  }

  // Pin Supabase's CA (Dashboard → Database → SSL) when provided
  const caPath = process.env.DATABASE_CA_CERT;
  return caPath
    ? { ca: fs.readFileSync(caPath, 'utf8'), rejectUnauthorized: true }
    : { rejectUnauthorized: false };
};

export const isDatabaseConfigured = (): boolean =>
  Boolean(process.env.DATABASE_URL);

export const getPool = (): Pool => {
  if (pool) return pool;

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is not set');
  }

  pool = new Pool({
    connectionString,
    ssl: buildSslConfig(connectionString),
    max: 10,
  });
  pool.on('error', (error) => {
    console.error('❌ Postgres pool error:', error);
  });
  return pool;
};

export const query = async <R extends QueryResultRow>(
  text: string,
  params: unknown[] = [],
): Promise<R[]> => {
  const result = await getPool().query<R>(text, params);
  return result.rows;
};

export const withTransaction = async <T>(
  fn: (client: PoolClient) => Promise<T>,
): Promise<T> => {
  const client = await getPool().connect();
  try {
    await client.query('begin');
    const result = await fn(client);
    await client.query('commit');
    return result;
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }
};

export const checkDatabase = async (): Promise<boolean> => {
  try {
    await getPool().query('select 1');
    return true;
  } catch {
    return false;
  }
};

export const closePool = async (): Promise<void> => {
  await pool?.end();
  pool = null;
};
