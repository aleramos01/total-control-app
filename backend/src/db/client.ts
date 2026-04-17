import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import path from 'node:path';
import fs from 'node:fs';
import * as schema from './schema.js';

const databaseUrl = process.env.DATABASE_URL ?? './data/total-control.sqlite';
const resolvedPath = path.isAbsolute(databaseUrl)
  ? databaseUrl
  : path.resolve(process.cwd(), databaseUrl);

fs.mkdirSync(path.dirname(resolvedPath), { recursive: true });

export const sqlite = new Database(resolvedPath);
sqlite.pragma('journal_mode = WAL');
sqlite.pragma('foreign_keys = ON');

export const db = drizzle(sqlite, { schema });
