import { PGlite } from '@electric-sql/pglite';
import { drizzle as drizzleNodePg } from 'drizzle-orm/node-postgres';
import { drizzle as drizzlePglite } from 'drizzle-orm/pglite';
import { Pool } from 'pg';
import { env } from '../lib/env.js';
import * as schema from './schema.js';

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error('Missing required environment variable: DATABASE_URL');
}

type QueryResult = { rowCount?: number | null; rows?: unknown[] };
type QueryClient = {
  query: (queryText: string, params?: unknown[]) => Promise<QueryResult>;
  close?: () => Promise<void>;
  end?: () => Promise<void>;
};

function createRuntimeClient(connectionString: string) {
  if (connectionString.startsWith('pglite://')) {
    const pglite = new PGlite();
    return {
      driver: pglite,
      queryClient: pglite as QueryClient,
      db: drizzlePglite(pglite, { schema }),
    };
  }

  const requiresSsl = /sslmode=require/i.test(connectionString) || env.databaseSsl;
  const pool = new Pool({
    connectionString,
    ssl: requiresSsl ? { rejectUnauthorized: env.databaseSslRejectUnauthorized } : undefined,
  });

  return {
    driver: pool,
    queryClient: pool as QueryClient,
    db: drizzleNodePg(pool, { schema }),
  };
}

const runtime = createRuntimeClient(databaseUrl);

export const db = runtime.db;
export const queryClient = runtime.queryClient;

export async function closeDb() {
  if ('end' in runtime.driver && typeof runtime.driver.end === 'function') {
    await runtime.driver.end();
    return;
  }

  if ('close' in runtime.driver && typeof runtime.driver.close === 'function') {
    await runtime.driver.close();
  }
}
